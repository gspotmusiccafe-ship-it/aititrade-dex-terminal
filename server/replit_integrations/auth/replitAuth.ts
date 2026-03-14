import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import bcrypt from "bcryptjs";

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

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email: rawEmail, password, displayName } = req.body;
      if (!rawEmail || !password || !displayName) {
        return res.status(400).json({ message: "Email, password, and display name are required" });
      }
      const email = rawEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Please enter a valid email address" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await authStorage.upsertUser({
        email,
        password: hashedPassword,
        firstName: displayName,
        lastName: null,
        profileImageUrl: null,
      });

      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[Auth] Signup login error:", err);
          return res.status(500).json({ message: "Account created but login failed" });
        }
        req.session.save(() => {
          const { password: _, ...safeUser } = user;
          res.json({ success: true, user: safeUser });
        });
      });
    } catch (error) {
      console.error("[Auth] Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email: rawEmail, password } = req.body;
      if (!rawEmail || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const email = rawEmail.trim().toLowerCase();

      const user = await authStorage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.isSuspended) {
        return res.status(403).json({ message: "Your account has been suspended" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "This account uses Spotify login. Please use 'Connect with Spotify' instead, or reset your password." });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const sessionUser = {
        claims: {
          sub: user.id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          profile_image_url: user.profileImageUrl,
        },
      };

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("[Auth] Login error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.save(() => {
          const { password: _, ...safeUser } = user;
          res.json({ success: true, user: safeUser });
        });
      });
    } catch (error) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/login/spotify", (req, res) => {
    const redirectUri = getRedirectUri(req);
    const postLoginRedirect = req.query.redirect as string || "/";
    const oauthState = crypto.randomUUID();
    (req.session as any).postLoginRedirect = postLoginRedirect;
    (req.session as any).connectSpotifyUserId = (req.user as any)?.claims?.sub || null;
    (req.session as any).oauthState = oauthState;
    req.session.save(() => {
      console.log("[Spotify Auth] Login redirect URI:", redirectUri, "post-login:", postLoginRedirect);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: SPOTIFY_CLIENT_ID,
        scope: SPOTIFY_SCOPES,
        redirect_uri: redirectUri,
        show_dialog: "true",
        state: oauthState,
      });
      res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
    });
  });

  app.get("/api/login", (req, res) => {
    res.redirect("/api/login/spotify" + (req.query.redirect ? `?redirect=${req.query.redirect}` : ""));
  });

  app.get("/api/spotify/callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const state = req.query.state as string;

    const expectedState = (req.session as any).oauthState;
    if (expectedState && state !== expectedState) {
      console.error("[Spotify Auth] OAuth state mismatch — possible CSRF, expected:", expectedState, "got:", state);
      return res.redirect("/?auth_error=invalid_state");
    }
    delete (req.session as any).oauthState;

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

      const tokenText = await tokenRes.text();
      let tokenData: any;
      try {
        tokenData = JSON.parse(tokenText);
      } catch {
        console.error("[Spotify Auth] Token response not JSON:", tokenText);
        return res.redirect("/?auth_error=spotify_not_registered");
      }

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("[Spotify Auth] Token exchange failed:", tokenData);
        return res.redirect("/?auth_error=token_failed");
      }

      const profileRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { "Authorization": `Bearer ${tokenData.access_token}` },
      });

      const profileText = await profileRes.text();
      let profile: any;
      try {
        profile = JSON.parse(profileText);
      } catch {
        console.error("[Spotify Auth] Profile response not JSON:", profileText);
        return res.redirect("/?auth_error=profile_failed");
      }

      if (!profile.id) {
        console.error("[Spotify Auth] Failed to get Spotify profile");
        return res.redirect("/?auth_error=profile_failed");
      }

      const spotifyUserId = profile.id;
      const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      const connectUserId = (req.session as any).connectSpotifyUserId;
      let userId: string;

      if (connectUserId) {
        userId = connectUserId;
        await authStorage.markSpotifyConnected(userId);
        delete (req.session as any).connectSpotifyUserId;
      } else {
        const existingUser = await authStorage.getUserBySpotifyId(spotifyUserId);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          const user = await authStorage.upsertUser({
            id: spotifyUserId,
            email: profile.email || null,
            firstName: profile.display_name || profile.id,
            lastName: null,
            profileImageUrl: profile.images?.[0]?.url || null,
            spotifyConnected: true,
          });
          userId = user.id;
        }
      }

      const { db } = await import("../../db");
      const { spotifyTokens } = await import("@shared/schema");
      const { sql: sqlTag } = await import("drizzle-orm");

      const spotifyTokenData = {
        userId: userId,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        spotifyUserId: profile.id,
        spotifyDisplayName: profile.display_name || null,
        spotifyEmail: profile.email || null,
        spotifyProduct: profile.product || null,
        spotifyImage: profile.images?.[0]?.url || null,
      };

      await db.execute(sqlTag`DELETE FROM spotify_tokens WHERE user_id = ${userId}`);
      await db.insert(spotifyTokens).values(spotifyTokenData);

      const user = {
        claims: {
          sub: userId,
          email: profile.email,
          first_name: profile.display_name || profile.id,
          last_name: null,
          profile_image_url: profile.images?.[0]?.url || null,
        },
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
        spotify_product: profile.product,
        spotify_connected: true,
      };

      req.login(user, (err) => {
        if (err) {
          console.error("[Spotify Auth] Login error:", err);
          return res.redirect("/?auth_error=login_failed");
        }
        let postLoginRedirect = (req.session as any).postLoginRedirect || "/";
        delete (req.session as any).postLoginRedirect;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[Spotify Auth] Session save error:", saveErr);
          }
          const separator = postLoginRedirect.includes("?") ? "&" : "?";
          const redirectWithFlag = `${postLoginRedirect}${separator}spotify_login=success`;
          console.log("[Spotify Auth] Login successful for:", profile.display_name, `(${spotifyUserId}), product: ${profile.product}, redirect: ${redirectWithFlag}`);
          return res.redirect(redirectWithFlag);
        });
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

  if (user.access_token && user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      try {
        const refreshToken = user.refresh_token;
        if (!refreshToken) {
          return next();
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
          return next();
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
            console.error("[Auth] Failed to save session after token refresh:", err);
          }
          return next();
        });
      } catch (error) {
        console.error("[Auth] Token refresh error:", error);
        return next();
      }
    } else {
      return next();
    }
  } else {
    return next();
  }
};

export const requireSpotify: RequestHandler = async (req, res, next) => {
  const user = req.user as any;
  if (!user?.access_token && user?.claims?.sub) {
    try {
      const { db } = await import("../../db");
      const { spotifyTokens } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [token] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, user.claims.sub)).limit(1);
      if (token) {
        user.access_token = token.accessToken;
        user.refresh_token = token.refreshToken;
        user.expires_at = Math.floor(new Date(token.expiresAt).getTime() / 1000);
        user.spotify_user_id = token.spotifyUserId;
        req.session.save(() => {});
        return next();
      }
    } catch (err) {
      console.error("[Auth] Error loading Spotify tokens from DB:", err);
    }
  }
  if (!user?.access_token) {
    return res.status(403).json({ message: "Spotify not connected. Connect your Spotify account to use this feature.", code: "SPOTIFY_NOT_CONNECTED" });
  }
  return next();
};
