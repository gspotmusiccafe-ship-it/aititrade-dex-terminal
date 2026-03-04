// Spotify Integration - Replit Connector
import { SpotifyApi } from "@spotify/web-api-ts-sdk";

// WARNING: Never cache the client or tokens long-term.
// Access tokens expire after ~1 hour. Always fetch fresh from the connector.
export function clearSpotifyCache() {
  // No-op — we no longer cache. Kept for API compatibility.
}

async function fetchConnectorCredentials() {
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
  const expiresIn = cs?.settings?.oauth?.credentials?.expires_in;

  if (!cs || !accessToken || !clientId || !refreshToken) {
    throw new Error('Spotify not connected');
  }

  return { accessToken, clientId, refreshToken, expiresIn };
}

export async function getUncachableSpotifyClient() {
  const { accessToken, clientId, refreshToken, expiresIn } = await fetchConnectorCredentials();

  const spotify = SpotifyApi.withAccessToken(clientId, {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn || 3600,
    refresh_token: refreshToken,
  });

  return spotify;
}
