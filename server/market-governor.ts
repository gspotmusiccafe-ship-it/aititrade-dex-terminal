import { db } from "./db";
import { tracks } from "@shared/schema";
import { desc, sql, eq } from "drizzle-orm";

const POOL_CEILING = 1000;
const MINTER_FEE = 0.16;
const PRICE_MIN = 0.99;
const PRICE_MAX = 9.99;
const BUYBACK_TIERS = [0.18, 0.42, 0.50];

interface MarketSession {
  sessionId: string;
  date: string;
  tradingRate: number;
  volatility: number;
  marketSentiment: "BULL" | "BEAR" | "NEUTRAL";
  buyBackRate: number;
  poolCeiling: number;
  generatedAt: number;
}

interface PoolConfig {
  trackId: string;
  poolSize: number;
  dynamicPrice: number;
  buyBackRate: number;
  paperTradeCap: number;
  grossVolume: number;
  fillPct: number;
  seats: number;
  rushMultiplier: number;
  flashTriggerMinute: number | null;
  liquiditySplit: { house: number; payout: number };
  minterFee: number;
  status: "OPEN" | "RUSH" | "CLOSED";
}

interface MarketState {
  session: MarketSession;
  pools: PoolConfig[];
  nextFlashTarget: string | null;
  nextFlashAt: number | null;
  activePoolCount: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function getDaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function generateDynamicPrice(rng: () => number): number {
  const raw = PRICE_MIN + rng() * (PRICE_MAX - PRICE_MIN);
  return parseFloat(raw.toFixed(2));
}

function selectBuyBackRate(volatility: number, rng: () => number): number {
  if (volatility >= 30) {
    const roll = rng();
    return roll > 0.5 ? 0.50 : 0.42;
  } else if (volatility >= 15) {
    const roll = rng();
    return roll > 0.6 ? 0.42 : 0.18;
  }
  return 0.18;
}

function generateSession(): MarketSession {
  const seed = getDaySeed();
  const rng = seededRandom(seed);

  const tradingRate = Math.round(35 + rng() * 20);
  const volatility = Math.round(rng() * 45);

  const sentimentRoll = rng();
  const sentiment: "BULL" | "BEAR" | "NEUTRAL" =
    sentimentRoll > 0.6 ? "BULL" : sentimentRoll > 0.3 ? "NEUTRAL" : "BEAR";

  const buyBackRate = selectBuyBackRate(volatility, rng);
  const sessionId = `MKT-${seed}-${tradingRate}`;

  return {
    sessionId,
    date: new Date().toISOString().split("T")[0],
    tradingRate,
    volatility,
    marketSentiment: sentiment,
    buyBackRate,
    poolCeiling: POOL_CEILING,
    generatedAt: Date.now(),
  };
}

let cachedState: MarketState | null = null;
let cachedDay: number = 0;

export async function getMarketState(): Promise<MarketState> {
  const today = getDaySeed();

  if (cachedState && cachedDay === today) {
    return cachedState;
  }

  const session = generateSession();
  const rng = seededRandom(today + 7919);

  const allTracks = await db
    .select({
      id: tracks.id,
      salesCount: tracks.salesCount,
      unitPrice: tracks.unitPrice,
      buyBackRate: tracks.buyBackRate,
      title: tracks.title,
    })
    .from(tracks)
    .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
    .orderBy(desc(tracks.playCount));

  const pools: PoolConfig[] = allTracks.map((t) => {
    const price = parseFloat(t.unitPrice || "3.50");
    const bbRate = parseFloat(t.buyBackRate || "0.18");
    const sales = t.salesCount || 0;
    const grossVolume = parseFloat((sales * price).toFixed(2));
    const fillPct = Math.min(100, parseFloat(((grossVolume / POOL_CEILING) * 100).toFixed(1)));
    const paperTradeCap = POOL_CEILING * 0.50;

    const rushMultiplier = 1 + (session.volatility / 100) * (0.5 + rng() * 0.5);
    const shouldFlash = rng() < 0.25;
    const flashTriggerMinute = shouldFlash ? Math.floor(rng() * 1440) : null;

    let status: "OPEN" | "RUSH" | "CLOSED" = "OPEN";
    if (grossVolume >= POOL_CEILING) {
      status = "CLOSED";
    } else if (fillPct >= 90) {
      status = "RUSH";
    }

    return {
      trackId: t.id,
      poolSize: POOL_CEILING,
      dynamicPrice: price,
      buyBackRate: bbRate,
      paperTradeCap,
      grossVolume,
      fillPct,
      seats: Math.max(5, Math.floor(POOL_CEILING / price)),
      rushMultiplier: parseFloat(rushMultiplier.toFixed(3)),
      flashTriggerMinute,
      liquiditySplit: { house: 0.30, payout: 0.70 },
      minterFee: MINTER_FEE,
      status,
    };
  });

  const activePools = pools.filter(p => p.status !== "CLOSED");

  const flashPools = pools.filter((p) => p.flashTriggerMinute !== null);
  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  let nextFlashTarget: string | null = null;
  let nextFlashAt: number | null = null;

  if (flashPools.length > 0) {
    const upcoming = flashPools
      .filter((p) => p.flashTriggerMinute! > currentMinute)
      .sort((a, b) => a.flashTriggerMinute! - b.flashTriggerMinute!);

    if (upcoming.length > 0) {
      nextFlashTarget = upcoming[0].trackId;
      const trigMin = upcoming[0].flashTriggerMinute!;
      const trigDate = new Date(now);
      trigDate.setHours(Math.floor(trigMin / 60), trigMin % 60, 0, 0);
      nextFlashAt = trigDate.getTime();
    }
  }

  cachedState = { session, pools, nextFlashTarget, nextFlashAt, activePoolCount: activePools.length };
  cachedDay = today;
  return cachedState;
}

export function invalidateCache() {
  cachedState = null;
  cachedDay = 0;
}

export function generateRecycleValues(volatility: number): { newPrice: number; newBuyBackRate: number } {
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const rng = seededRandom(seed);
  return {
    newPrice: generateDynamicPrice(rng),
    newBuyBackRate: selectBuyBackRate(volatility, rng),
  };
}

export async function initTrackPricing(): Promise<void> {
  const allTracks = await db
    .select({ id: tracks.id, unitPrice: tracks.unitPrice, buyBackRate: tracks.buyBackRate })
    .from(tracks)
    .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`);

  const rng = seededRandom(getDaySeed() + 31337);

  let seeded = 0;
  for (const t of allTracks) {
    const needsPrice = !t.unitPrice || t.unitPrice.trim() === "";
    const needsBuyBack = !t.buyBackRate || t.buyBackRate.trim() === "";

    if (needsPrice || needsBuyBack) {
      const updates: Record<string, string> = {};
      if (needsPrice) updates.unitPrice = generateDynamicPrice(rng).toString();
      if (needsBuyBack) updates.buyBackRate = BUYBACK_TIERS[Math.floor(rng() * BUYBACK_TIERS.length)].toString();
      await db.update(tracks).set(updates).where(eq(tracks.id, t.id));
      seeded++;
    }
  }
  console.log(`[MARKET] Initialized pricing for ${allTracks.length} native assets`);
}

export function getPoolForTrack(state: MarketState, trackId: string): PoolConfig | undefined {
  return state.pools.find((p) => p.trackId === trackId);
}

export function computeLiquiditySplit(grossSales: number): {
  houseCut: number;
  payoutPot: number;
} {
  return {
    houseCut: parseFloat((grossSales * 0.30).toFixed(2)),
    payoutPot: parseFloat((grossSales * 0.70).toFixed(2)),
  };
}

export { POOL_CEILING, MINTER_FEE };
