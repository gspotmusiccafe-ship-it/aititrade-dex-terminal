// Spotify Integration - Custom OAuth using user's own Spotify Developer App
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { db } from "./db";
import { spotifyTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export function getSpotifyAuthUrl(req?: any): string {
  const redirectUri = getRedirectUri(req);
  console.log("[Spotify] Auth redirect URI:", redirectUri);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    show_dialog: "true",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string, userId: string, req?: any): Promise<{ success: boolean; error?: string }> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(req),
  });

  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    return { success: false, error: data.error_description || data.error || "Token exchange failed" };
  }

  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { "Authorization": `Bearer ${data.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : null;

  const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

  const existing = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));

  const tokenData = {
    userId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    spotifyUserId: profile?.id || null,
    spotifyDisplayName: profile?.display_name || null,
    spotifyEmail: profile?.email || null,
    spotifyProduct: profile?.product || null,
    spotifyImage: profile?.images?.[0]?.url || null,
  };

  if (existing.length > 0) {
    await db.update(spotifyTokens).set(tokenData).where(eq(spotifyTokens.userId, userId));
  } else {
    await db.insert(spotifyTokens).values(tokenData);
  }

  return { success: true };
}

async function refreshAccessToken(userId: string): Promise<string> {
  const [token] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));
  if (!token) throw new Error("Spotify not connected");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  });

  const authHeader = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, userId));
    throw new Error("Spotify token refresh failed. Please reconnect.");
  }

  const expiresAt = new Date(Date.now() + (data.expires_in * 1000));
  await db.update(spotifyTokens).set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || token.refreshToken,
    expiresAt,
  }).where(eq(spotifyTokens.userId, userId));

  return data.access_token;
}

export async function getSpotifyProfile(userId: string) {
  const [token] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));
  if (!token) {
    return { connected: false };
  }
  return {
    connected: true,
    name: token.spotifyDisplayName,
    email: token.spotifyEmail,
    product: token.spotifyProduct,
    isPremium: token.spotifyProduct === "premium",
    image: token.spotifyImage,
  };
}

export async function getSpotifyClientForUser(userId: string): Promise<SpotifyApi> {
  const [token] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));
  if (!token) throw new Error("Spotify not connected");

  let accessToken = token.accessToken;

  if (new Date(token.expiresAt).getTime() < Date.now() + 60000) {
    accessToken = await refreshAccessToken(userId);
  }

  return SpotifyApi.withAccessToken(SPOTIFY_CLIENT_ID, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: token.refreshToken,
  });
}

export async function disconnectSpotify(userId: string): Promise<void> {
  await db.delete(spotifyTokens).where(eq(spotifyTokens.userId, userId));
}

export function clearSpotifyCache() {
  // No-op — kept for backwards compatibility
}

export async function getUncachableSpotifyClient() {
  throw new Error("Use getSpotifyClientForUser(userId) instead");
}
