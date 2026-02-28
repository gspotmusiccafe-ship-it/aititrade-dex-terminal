// Spotify Integration - Replit Connector
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

let connectionSettings: any;

function extractCredentials(cs: any) {
  const refreshToken = cs?.settings?.oauth?.credentials?.refresh_token;
  const accessToken = cs?.settings?.access_token || cs?.settings?.oauth?.credentials?.access_token;
  const clientId = cs?.settings?.oauth?.credentials?.client_id;
  const expiresIn = cs?.settings?.oauth?.credentials?.expires_in;
  return { accessToken, clientId, refreshToken, expiresIn };
}

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    const cached = extractCredentials(connectionSettings);
    if (cached.accessToken && cached.clientId && cached.refreshToken) {
      return cached;
    }
  }

  connectionSettings = null;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=spotify',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const creds = extractCredentials(connectionSettings);

  if (!connectionSettings || !creds.accessToken || !creds.clientId || !creds.refreshToken) {
    connectionSettings = null;
    throw new Error('Spotify not connected');
  }

  return creds;
}

export function clearSpotifyCache() {
  connectionSettings = null;
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
