import { db } from "./db";
import { tracks } from "@shared/schema";
import { desc, sql, eq } from "drizzle-orm";

const FLOOR_SPLIT = 0.54;
const CEO_SPLIT = 0.46;

const PORTALS = {
  STANDARD:    { tbi: 2.00,  mbb: 3.00, early: 1.50, pool: 1000 },
  MICRO_700:   { tbi: 5.00,  mbb: 3.35, early: 2.00, pool: 700 },
  MID_2K:      { tbi: 10.00, mbb: 3.75, early: 2.85, pool: 2000 },
  PRO_20:      { tbi: 20.00, mbb: 3.75, early: 2.85, pool: 2000 },
  PRO_30:      { tbi: 30.00, mbb: 3.75, early: 2.85, pool: 3000 },
  HIGH_50:     { tbi: 50.00, mbb: 3.75, early: 2.85, pool: 5000 },
};

type PortalName = keyof typeof PORTALS;

export interface PortalConfig {
  name: PortalName;
  tbi: number;
  mbb: number;
  early: number;
  pool: number;
}

export function getPortalForPrice(amount: number): PortalConfig {
  if (amount >= 50) return { name: "HIGH_50", ...PORTALS.HIGH_50 };
  if (amount >= 30) return { name: "PRO_30", ...PORTALS.PRO_30 };
  if (amount >= 20) return { name: "PRO_20", ...PORTALS.PRO_20 };
  if (amount >= 10) return { name: "MID_2K", ...PORTALS.MID_2K };
  if (amount >= 5) return { name: "MICRO_700", ...PORTALS.MICRO_700 };
  return { name: "STANDARD", ...PORTALS.STANDARD };
}

export function calculateTradeStatus(buyIn: number, currentFloorTotal: number) {
  const portal = getPortalForPrice(buyIn);

  const maxPayout = buyIn * portal.mbb;
  const earlyOffer = buyIn * portal.early;
  const houseTake = maxPayout - earlyOffer;

  return {
    portal: portal.name,
    poolCeiling: portal.pool,
    isReadyToClose: currentFloorTotal >= portal.pool,
    earlyOffer: parseFloat(earlyOffer.toFixed(2)),
    houseTake: parseFloat(houseTake.toFixed(2)),
    maxPayout: parseFloat(maxPayout.toFixed(2)),
    status: currentFloorTotal >= portal.pool ? "SETTLED" as const : "HOLDING" as const,
  };
}

const POOL_CEILING = 1000;

interface MarketSession {
  sessionId: string;
  date: string;
  tradingRate: number;
  volatility: number;
  marketSentiment: "BULL" | "BEAR" | "NEUTRAL";
  buyBackRate: number;
  poolCeiling: number;
  generatedAt: number;
  accumulatedIntake: number;
  settlementCycle: number;
}

interface PoolConfig {
  trackId: string;
  poolSize: number;
  portalName: PortalName;
  dynamicPrice: number;
  buyBackPrice: number;
  buyBackRate: number;
  paperTradeCap: number;
  grossVolume: number;
  fillPct: number;
  seats: number;
  rushMultiplier: number;
  flashTriggerMinute: number | null;
  liquiditySplit: { floor: number; ceo: number };
  minterFee: number;
  status: "OPEN" | "RUSH" | "CLOSED" | "REOPENED";
  roi: number;
  leaderboardRank: number;
  earlyOffer: number;
  maxPayout: number;
  houseTake: number;
}

interface MarketState {
  session: MarketSession;
  pools: PoolConfig[];
  nextFlashTarget: string | null;
  nextFlashAt: number | null;
  activePoolCount: number;
  systemIntake: number;
  settlementQueue: string[];
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

function getBuyInForRank(rank: number, totalTracks: number, rng: () => number): { buyIn: number; buyBack: number; roi: number; portal: PortalConfig } {
  const topPct = totalTracks > 0 ? rank / totalTracks : 1;

  let buyIn: number;
  if (topPct <= 0.05) {
    buyIn = PORTALS.HIGH_50.tbi;
  } else if (topPct <= 0.10) {
    buyIn = PORTALS.PRO_30.tbi;
  } else if (topPct <= 0.20) {
    buyIn = PORTALS.PRO_20.tbi;
  } else if (topPct <= 0.40) {
    buyIn = PORTALS.MID_2K.tbi;
  } else if (topPct <= 0.70) {
    buyIn = PORTALS.MICRO_700.tbi;
  } else {
    buyIn = PORTALS.STANDARD.tbi;
  }

  const portal = getPortalForPrice(buyIn);
  const jitter = 0.95 + rng() * 0.10;
  buyIn = parseFloat((buyIn * jitter).toFixed(2));

  const buyBack = parseFloat((buyIn * portal.mbb).toFixed(2));
  const roi = parseFloat((((buyBack - buyIn) / buyIn) * 100).toFixed(1));

  return { buyIn, buyBack, roi, portal };
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
    buyBackRate: 1.80,
    poolCeiling: POOL_CEILING,
    generatedAt: Date.now(),
    accumulatedIntake: 0,
    settlementCycle: 1,
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
      playCount: tracks.playCount,
    })
    .from(tracks)
    .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
    .orderBy(desc(tracks.playCount));

  let systemIntake = 0;
  const settlementQueue: string[] = [];

  const pools: PoolConfig[] = allTracks.map((t, index) => {
    const rank = index + 1;
    const pricing = getBuyInForRank(rank, allTracks.length, rng);

    const price = parseFloat(t.unitPrice || pricing.buyIn.toString());
    const portal = getPortalForPrice(price);
    const poolCeil = portal.pool;

    const sales = t.salesCount || 0;
    const grossVolume = parseFloat((sales * price).toFixed(2));
    const fillPct = Math.min(100, parseFloat(((grossVolume / poolCeil) * 100).toFixed(1)));

    systemIntake += grossVolume;

    const rushMultiplier = 1 + (session.volatility / 100) * (0.5 + rng() * 0.5);
    const shouldFlash = rng() < 0.25;
    const flashTriggerMinute = shouldFlash ? Math.floor(rng() * 1440) : null;

    const tradeStatus = calculateTradeStatus(price, grossVolume);

    let status: "OPEN" | "RUSH" | "CLOSED" | "REOPENED" = "OPEN";
    if (grossVolume >= poolCeil) {
      status = "CLOSED";
      settlementQueue.push(t.id);
    } else if (fillPct >= 90) {
      status = "RUSH";
    }

    return {
      trackId: t.id,
      poolSize: poolCeil,
      portalName: portal.name,
      dynamicPrice: price,
      buyBackPrice: pricing.buyBack,
      buyBackRate: pricing.buyBack / price,
      paperTradeCap: poolCeil * 0.50,
      grossVolume,
      fillPct,
      seats: Math.max(5, Math.floor(poolCeil / price)),
      rushMultiplier: parseFloat(rushMultiplier.toFixed(3)),
      flashTriggerMinute,
      liquiditySplit: { floor: FLOOR_SPLIT, ceo: CEO_SPLIT },
      minterFee: FLOOR_SPLIT,
      status,
      roi: pricing.roi,
      leaderboardRank: rank,
      earlyOffer: tradeStatus.earlyOffer,
      maxPayout: tradeStatus.maxPayout,
      houseTake: tradeStatus.houseTake,
    };
  });

  session.accumulatedIntake = parseFloat(systemIntake.toFixed(2));

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

  cachedState = {
    session,
    pools,
    nextFlashTarget,
    nextFlashAt,
    activePoolCount: activePools.length,
    systemIntake: parseFloat(systemIntake.toFixed(2)),
    settlementQueue,
  };
  cachedDay = today;
  return cachedState;
}

export function invalidateCache() {
  cachedState = null;
  cachedDay = 0;
}

export function generateRecycleValues(volatility: number): { newPrice: number; newBuyBackRate: number; newBuyBackPrice: number; portalName: PortalName } {
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const rng = seededRandom(seed);

  const portalEntries = Object.entries(PORTALS) as [PortalName, typeof PORTALS[PortalName]][];
  const idx = Math.floor(rng() * portalEntries.length);
  const [portalName, portalCfg] = portalEntries[idx];
  const jitter = 0.90 + rng() * 0.20;
  const newPrice = parseFloat((portalCfg.tbi * jitter).toFixed(2));
  const newBuyBackPrice = parseFloat((newPrice * portalCfg.mbb).toFixed(2));
  return {
    newPrice,
    newBuyBackRate: portalCfg.mbb,
    newBuyBackPrice,
    portalName,
  };
}

export async function initTrackPricing(): Promise<void> {
  const allTracks = await db
    .select({ id: tracks.id, unitPrice: tracks.unitPrice, buyBackRate: tracks.buyBackRate, playCount: tracks.playCount })
    .from(tracks)
    .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
    .orderBy(desc(tracks.playCount));

  const rng = seededRandom(getDaySeed() + 31337);

  let seeded = 0;
  for (let i = 0; i < allTracks.length; i++) {
    const t = allTracks[i];
    const pricing = getBuyInForRank(i + 1, allTracks.length, rng);

    const needsPrice = !t.unitPrice || t.unitPrice.trim() === "" || t.unitPrice === "3.50";
    const needsBuyBack = !t.buyBackRate || t.buyBackRate.trim() === "";

    if (needsPrice || needsBuyBack) {
      const updates: Record<string, string> = {};
      if (needsPrice) updates.unitPrice = pricing.buyIn.toString();
      if (needsBuyBack) updates.buyBackRate = pricing.buyBack.toString();
      await db.update(tracks).set(updates).where(eq(tracks.id, t.id));
      seeded++;
    }
  }
  console.log(`[MARKET] Initialized pricing for ${allTracks.length} native assets (${seeded} updated)`);
}

export function getPoolForTrack(state: MarketState, trackId: string): PoolConfig | undefined {
  return state.pools.find((p) => p.trackId === trackId);
}

export function computeLiquiditySplit(grossSales: number): {
  floor54: number;
  ceo46: number;
  trustTithe: number;
  blessing: number;
} {
  const floor54 = parseFloat((grossSales * FLOOR_SPLIT).toFixed(2));
  const ceo46 = parseFloat((grossSales * CEO_SPLIT).toFixed(2));
  const trustTithe = parseFloat((ceo46 * 0.10).toFixed(2));
  const blessing = parseFloat((ceo46 - trustTithe).toFixed(2));
  return { floor54, ceo46, trustTithe, blessing };
}

const TRUST_VAULT_SPLIT_TIERS = [0.18, 0.42, 0.50];

export function computeGlobalRoyaltySplit(
  grossGlobalSales: number,
  volatility: number,
): {
  trustVaultRate: number;
  trustVaultAmount: number;
  platformAmount: number;
  minterFeeAmount: number;
} {
  let trustVaultRate: number;
  if (volatility >= 30) {
    trustVaultRate = volatility >= 40 ? 0.50 : 0.42;
  } else if (volatility >= 15) {
    trustVaultRate = 0.42;
  } else {
    trustVaultRate = 0.18;
  }

  const minterFeeAmount = parseFloat((grossGlobalSales * FLOOR_SPLIT).toFixed(2));
  const afterMinterFee = grossGlobalSales - minterFeeAmount;
  const trustVaultAmount = parseFloat((afterMinterFee * trustVaultRate).toFixed(2));
  const platformAmount = parseFloat((afterMinterFee - trustVaultAmount).toFixed(2));

  return {
    trustVaultRate,
    trustVaultAmount,
    platformAmount,
    minterFeeAmount,
  };
}

export function calculateEarlyExit(buyIn: number) {
  const portal = getPortalForPrice(buyIn);
  const earlyPayout = parseFloat((buyIn * portal.early).toFixed(2));
  const houseProfit = parseFloat(((buyIn * portal.mbb) - earlyPayout).toFixed(2));
  return { earlyPayout, houseProfit, portal };
}

export { POOL_CEILING, FLOOR_SPLIT, CEO_SPLIT, TRUST_VAULT_SPLIT_TIERS, PORTALS };
