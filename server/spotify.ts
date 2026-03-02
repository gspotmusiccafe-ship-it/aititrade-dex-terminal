// Spotify Integration - Replit Connector
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let cachedCreds: { accessToken: string; clientId: string; refreshToken: string; expiresIn: number; expiresAt: number } | null = null;

async function fetchFreshCredentials() {
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
  const cs = data.items?.[0];

  const refreshToken = cs?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = cs?.settings?.access_token || cs?.settings?.oauth?.credentials?.access_token;
  const clientId = cs?.settings?.oauth?.credentials?.client_id;
  const expiresIn = cs?.settings?.oauth?.credentials?.expires_in || 3600;

  if (!cs || !accessToken || !clientId || !refreshToken) {
    throw new Error('Spotify not connected');
  }

  const expiresAt = cs.settings?.expires_at
    ? new Date(cs.settings.expires_at).getTime()
    : Date.now() + (expiresIn * 1000) - 60000;

  cachedCreds = { accessToken, clientId, refreshToken, expiresIn, expiresAt };
  return cachedCreds;
}

async function getAccessToken() {
  if (cachedCreds && cachedCreds.expiresAt > Date.now() + 30000) {
    return cachedCreds;
  }
  cachedCreds = null;
  return fetchFreshCredentials();
}

export function clearSpotifyCache() {
  cachedCreds = null;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await getAccessToken();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}
