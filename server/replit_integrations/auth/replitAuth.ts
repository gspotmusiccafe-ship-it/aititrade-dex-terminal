import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-read-email",
  "user-read-private",
  "app-remote-control",
  "streaming",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-top-read",
].join(" ");

function getRedirectUri(req?: any): string {
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return `${proto}://${host}/api/spotify/callback`;
  }
  const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
  return `https://${domain}/api/spotify/callback`;
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  app.get("/api/login", (req, res) => {
    const redirectUri = getRedirectUri(req);
    console.log("[Spotify Auth] Login redirect URI:", redirectUri);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: SPOTIFY_CLIENT_ID,
      scope: SPOTIFY_SCOPES,
      redirect_uri: redirectUri,
      show_dialog: "true",
    });
    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
  });

  app.get("/api/spotify/callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error || !code) {
      console.error("[Spotify Auth] Callback error:", error);
      return res.redirect("/?auth_error=spotify_denied");
    }

    try {
      const redirectUri = getRedirectUri(req);
      const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("[Spotify Auth] Token exchange failed:", tokenData);
        return res.redirect("/?auth_error=token_failed");
      }

      const profileRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` },
      });
      const profile = await profileRes.json();

      if (!profile.id) {
        console.error("[Spotify Auth] Failed to get Spotify profile");
        return res.redirect("/?auth_error=profile_failed");
      }

      const spotifyUserId = profile.id;
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      await authStorage.upsertUser({
        id: spotifyUserId,
        email: profile.email || null,
        firstName: profile.display_name || profile.id,
        lastName: null,
        profileImageUrl: profile.images?.[0]?.url || null,
      });

      const { db } = await import("../../db");
      const { spotifyTokens } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      const existing = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, spotifyUserId));
      const spotifyTokenData = {
        userId: spotifyUserId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        spotifyUserId: profile.id,
        spotifyDisplayName: profile.display_name || null,
        spotifyEmail: profile.email || null,
        spotifyProduct: profile.product || null,
        spotifyImage: profile.images?.[0]?.url || null,
      };

      if (existing.length > 0) {
        await db.update(spotifyTokens).set(spotifyTokenData).where(eq(spotifyTokens.userId, spotifyUserId));
      } else {
        await db.insert(spotifyTokens).values(spotifyTokenData);
      }

      const user = {
        claims: {
          sub: spotifyUserId,
          email: profile.email,
          first_name: profile.display_name || profile.id,
          last_name: null,
          profile_image_url: profile.images?.[0]?.url || null,
        },
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        spotify_product: profile.product,
      };

      req.login(user, (err) => {
        if (err) {
          console.error("[Spotify Auth] Login error:", err);
          return res.redirect("/?auth_error=login_failed");
        }
        console.log("[Spotify Auth] Login successful for:", profile.display_name, `(${spotifyUserId}), product: ${profile.product}`);
        return res.redirect("/");
      });
    } catch (err) {
      console.error("[Spotify Auth] Callback exception:", err);
      return res.redirect("/?auth_error=server_error");
    }
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at && now > user.expires_at) {
    try {
      const refreshToken = user.refresh_token;
      if (!refreshToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.access_token) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      user.access_token = tokenData.access_token;
      if (tokenData.refresh_token) {
        user.refresh_token = tokenData.refresh_token;
      }
      user.expires_at = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      const { db } = await import("../../db");
      const { spotifyTokens } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      await db.update(spotifyTokens).set({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
      }).where(eq(spotifyTokens.userId, user.claims.sub));

      req.session.save((err: any) => {
        if (err) {
          console.error("[Spotify Auth] Failed to save session after token refresh:", err);
        }
        return next();
      });
    } catch (error) {
      console.error("[Spotify Auth] Token refresh error:", error);
      return res.status(401).json({ message: "Unauthorized" });
    }
  } else {
    return next();
  }
};
