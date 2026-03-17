interface RadioLogPayload {
  timestamp: string;
  userId: string;
  trackName: string;
  isrc: string;
  showName: string;
  status: string;
  duration?: number;
  poolCapacity?: string;
}

interface MarketLogPayload {
  timestamp: string;
  userId: string;
  eventType: "BUY_IN" | "POOL_CLOSE";
  trackName: string;
  ticker: string;
  unitPrice: number;
  grossSales: number;
  poolSize: number;
  capacityPct: number;
  mintId: string;
  houseCut: number;
  payoutPot: number;
}

let radioWebhookUrl: string | null = null;
let marketWebhookUrl: string | null = null;

let lastRadioSync: { success: boolean; at: number } = { success: true, at: Date.now() };
let lastMarketSync: { success: boolean; at: number } = { success: true, at: Date.now() };

export function setWebhookUrls(radio: string | null, market: string | null) {
  radioWebhookUrl = radio;
  marketWebhookUrl = market;
}

export function getSignalStatus(): {
  radio: { connected: boolean; lastSync: number };
  market: { connected: boolean; lastSync: number };
} {
  return {
    radio: { connected: lastRadioSync.success, lastSync: lastRadioSync.at },
    market: { connected: lastMarketSync.success, lastSync: lastMarketSync.at },
  };
}

export async function logRadioEvent(payload: RadioLogPayload): Promise<boolean> {
  if (!radioWebhookUrl) {
    lastRadioSync = { success: true, at: Date.now() };
    return true;
  }

  try {
    const details = [
      `Show: ${payload.showName}`,
      `ISRC: ${payload.isrc}`,
      payload.duration ? `Duration: ${payload.duration}s` : null,
      payload.poolCapacity ? `Pool: ${payload.poolCapacity}` : null,
    ].filter(Boolean).join(" | ");

    const response = await fetch(radioWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: payload.userId,
        eventType: "RADIO_" + payload.status.toUpperCase(),
        trackName: payload.trackName,
        details,
        status: payload.status,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const ok = response.ok;
    lastRadioSync = { success: ok, at: Date.now() };
    return ok;
  } catch (error) {
    console.error("[SHEETS] Radio log failed:", error);
    lastRadioSync = { success: false, at: Date.now() };
    return false;
  }
}

export async function logMarketEvent(payload: MarketLogPayload): Promise<boolean> {
  if (!marketWebhookUrl) {
    lastMarketSync = { success: true, at: Date.now() };
    return true;
  }

  try {
    const details = [
      `Ticker: $${payload.ticker}`,
      `Price: $${payload.unitPrice.toFixed(2)}`,
      `Gross: $${payload.grossSales.toFixed(2)}`,
      `Pool: $${payload.poolSize} (${payload.capacityPct}%)`,
      `Mint: ${payload.mintId}`,
      `House: $${payload.houseCut.toFixed(2)}`,
      `Payout: $${payload.payoutPot.toFixed(2)}`,
    ].join(" | ");

    const response = await fetch(marketWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: payload.userId,
        eventType: payload.eventType,
        assetTicker: `$${payload.ticker}`,
        trackName: payload.trackName,
        details,
        status: payload.eventType === "POOL_CLOSE" ? "CLOSED" : "CONFIRMED",
      }),
      signal: AbortSignal.timeout(10000),
    });

    const ok = response.ok;
    lastMarketSync = { success: ok, at: Date.now() };
    return ok;
  } catch (error) {
    console.error("[SHEETS] Market log failed:", error);
    lastMarketSync = { success: false, at: Date.now() };
    return false;
  }
}
