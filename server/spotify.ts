// Spotify Integration - Replit Connector
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let cachedCredentials: { accessToken: string; clientId: string; refreshToken: string; expiresIn: number; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedCredentials && cachedCredentials.expiresAt > Date.now()) {
    return cachedCredentials;
  }

  cachedCredentials = null;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  const res = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  );
  const data = await res.json();
  const connectionSettings = data.items?.[0];

  const refreshToken = connectionSettings?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
  const clientId = connectionSettings?.settings?.oauth?.credentials?.client_id;
  const expiresIn = connectionSettings?.settings?.oauth?.credentials?.expires_in || 3600;

  if (!connectionSettings || !accessToken || !clientId || !refreshToken) {
    throw new Error('Spotify not connected');
  }

  const expiresAt = connectionSettings?.settings?.expires_at
    ? new Date(connectionSettings.settings.expires_at).getTime()
    : Date.now() + (expiresIn * 1000) - 60000;

  cachedCredentials = { accessToken, clientId, refreshToken, expiresIn, expiresAt };
  return cachedCredentials;
}

export function clearSpotifyCache() {
  cachedCredentials = null;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableSpotifyClient() {
  try {
    const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

    const spotify = SpotifyApi.withAccessToken(clientId, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn || 3600,
      refresh_token: refreshToken,
    });

    return spotify;
  } catch (error) {
    cachedCredentials = null;
    throw error;
  }
}
