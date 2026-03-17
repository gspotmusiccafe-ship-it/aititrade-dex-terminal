import { db } from "./db";
import { tracks } from "@shared/schema";
import { desc, sql, eq } from "drizzle-orm";

interface MarketSession {
  sessionId: string;
  date: string;
  tradingRate: number;
  volatility: number;
  marketSentiment: "BULL" | "BEAR" | "NEUTRAL";
  generatedAt: number;
}

interface PoolConfig {
  trackId: string;
  poolSize: number;
  seats: number;
  rushMultiplier: number;
  flashTriggerMinute: number | null;
  liquiditySplit: { house: number; payout: number };
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

function generateSession(): MarketSession {
  const seed = getDaySeed();
  const rng = seededRandom(seed);

  const tradingRate = Math.round(35 + rng() * 20);
  const volatility = Math.round(rng() * 45);

  const sentimentRoll = rng();
  const sentiment: "BULL" | "BEAR" | "NEUTRAL" =
    sentimentRoll > 0.6 ? "BULL" : sentimentRoll > 0.3 ? "NEUTRAL" : "BEAR";

  const sessionId = `MKT-${seed}-${tradingRate}`;

  return {
    sessionId,
    date: new Date().toISOString().split("T")[0],
    tradingRate,
    volatility,
    marketSentiment: sentiment,
    generatedAt: Date.now(),
  };
}

function computePoolConfig(
  trackId: string,
  salesCount: number,
  price: number,
  session: MarketSession,
  rng: () => number
): PoolConfig {
  const grossVolume = salesCount * price;
  const velocity = salesCount > 0 ? grossVolume / Math.max(salesCount, 1) : 0;

  let poolSize: number;
  if (session.tradingRate > 48 && velocity > 2) {
    poolSize = 2000;
  } else if (session.tradingRate > 40 || velocity > 1.5) {
    poolSize = 1000;
  } else {
    poolSize = 500;
  }

  const baseSeats = Math.floor(poolSize / price);
  const rushMultiplier = 1 + (session.volatility / 100) * (0.5 + rng() * 0.5);
  const seats = Math.max(5, Math.floor(baseSeats * (session.tradingRate / 50)));

  const shouldFlash = rng() < 0.25;
  const flashTriggerMinute = shouldFlash ? Math.floor(rng() * 1440) : null;

  return {
    trackId,
    poolSize,
    seats,
    rushMultiplier: parseFloat(rushMultiplier.toFixed(3)),
    flashTriggerMinute,
    liquiditySplit: { house: 0.30, payout: 0.70 },
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
      title: tracks.title,
    })
    .from(tracks)
    .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
    .orderBy(desc(tracks.playCount));

  const pools: PoolConfig[] = allTracks.map((t) => {
    const price = parseFloat(t.unitPrice || "0.99");
    return computePoolConfig(t.id, t.salesCount || 0, price, session, rng);
  });

  const activePools = allTracks.filter((t) => {
    const price = parseFloat(t.unitPrice || "0.99");
    const gross = (t.salesCount || 0) * price;
    const pool = pools.find((p) => p.trackId === t.id);
    return pool ? gross < pool.poolSize : true;
  });

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
