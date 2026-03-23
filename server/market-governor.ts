import { db } from "./db";
import { tracks, orders, portalSettings, settlementQueue, settlementCycles } from "@shared/schema";
import { desc, sql, eq, asc, and, inArray } from "drizzle-orm";

const FLOOR_SPLIT = 0.54;
const CEO_SPLIT = 0.46;

type PortalName = string;

const PRICE_TIERS = [
  { prefix: "NANO",      tbi: 1.00,  basePool: 300 },
  { prefix: "MICRO",     tbi: 2.00,  basePool: 400 },
  { prefix: "PENNY",     tbi: 3.50,  basePool: 500 },
  { prefix: "MINI",      tbi: 5.00,  basePool: 600 },
  { prefix: "ENTRY",     tbi: 7.50,  basePool: 700 },
  { prefix: "STANDARD",  tbi: 10.00, basePool: 1000 },
  { prefix: "MID",       tbi: 15.00, basePool: 1500 },
  { prefix: "PRO",       tbi: 25.00, basePool: 2500 },
  { prefix: "SOVEREIGN", tbi: 50.00, basePool: 5000 },
];

const RISK_PROFILES = [
  { suffix: "SAFE",      mbb: 1.50, early: 1.25, poolMult: 1.0 },
  { suffix: "STEADY",    mbb: 1.75, early: 1.35, poolMult: 1.2 },
  { suffix: "MODERATE",  mbb: 2.00, early: 1.50, poolMult: 1.4 },
  { suffix: "GROWTH",    mbb: 2.25, early: 1.65, poolMult: 1.6 },
  { suffix: "BALANCED",  mbb: 2.50, early: 1.80, poolMult: 2.0 },
  { suffix: "DYNAMIC",   mbb: 2.75, early: 1.95, poolMult: 2.5 },
  { suffix: "MOMENTUM",  mbb: 3.00, early: 2.15, poolMult: 3.0 },
  { suffix: "VELOCITY",  mbb: 3.35, early: 2.50, poolMult: 4.0 },
  { suffix: "APEX",      mbb: 3.75, early: 2.85, poolMult: 5.0 },
];

function generateAll81Portals(): Record<string, { tbi: number; mbb: number; early: number; pool: number }> {
  const portals: Record<string, { tbi: number; mbb: number; early: number; pool: number }> = {};
  for (const tier of PRICE_TIERS) {
    for (const risk of RISK_PROFILES) {
      const name = `${tier.prefix}_${risk.suffix}`;
      portals[name] = {
        tbi: tier.tbi,
        mbb: risk.mbb,
        early: risk.early,
        pool: Math.round(tier.basePool * risk.poolMult),
      };
    }
  }
  return portals;
}

const DEFAULT_PORTALS = generateAll81Portals();
const PORTALS: Record<string, { tbi: number; mbb: number; early: number; pool: number }> = { ...DEFAULT_PORTALS };

export interface PortalConfig {
  name: string;
  tbi: number;
  mbb: number;
  early: number;
  pool: number;
}

let portalCache: PortalConfig[] | null = null;
let portalCacheTime = 0;
const PORTAL_CACHE_TTL = 30000;

export async function loadPortalsFromDb(): Promise<PortalConfig[]> {
  try {
    const rows = await db.select().from(portalSettings)
      .where(eq(portalSettings.isActive, true))
      .orderBy(asc(portalSettings.sortOrder));

    if (rows.length === 0) {
      return Object.entries(DEFAULT_PORTALS).map(([name, cfg]) => ({ name, ...cfg }));
    }

    const configs = rows.map(r => ({
      name: r.name,
      tbi: parseFloat(r.tbi),
      mbb: parseFloat(r.mbb),
      early: parseFloat(r.early),
      pool: r.pool,
    }));

    for (const cfg of configs) {
      (PORTALS as any)[cfg.name] = { tbi: cfg.tbi, mbb: cfg.mbb, early: cfg.early, pool: cfg.pool };
    }

    portalCache = configs;
    portalCacheTime = Date.now();
    console.log(`[PORTALS] Loaded ${configs.length} portal configs from DB`);
    return configs;
  } catch (e) {
    console.error("[PORTALS] Failed to load from DB, using defaults:", e);
    return Object.entries(DEFAULT_PORTALS).map(([name, cfg]) => ({ name, ...cfg }));
  }
}

export async function getPortalConfigs(): Promise<PortalConfig[]> {
  if (portalCache && (Date.now() - portalCacheTime) < PORTAL_CACHE_TTL) {
    return portalCache;
  }
  return loadPortalsFromDb();
}

export function invalidatePortalCache() {
  portalCache = null;
  portalCacheTime = 0;
}

export function getPortalForPrice(amount: number): PortalConfig {
  let bestTier = PRICE_TIERS[0];
  for (const tier of PRICE_TIERS) {
    if (amount >= tier.tbi) bestTier = tier;
  }

  const riskIndex = Math.min(
    Math.floor((amount - bestTier.tbi) / (bestTier.tbi * 0.5)),
    RISK_PROFILES.length - 1
  );
  const risk = RISK_PROFILES[Math.max(0, riskIndex)];
  const name = `${bestTier.prefix}_${risk.suffix}`;
  const cfg = PORTALS[name];
  if (cfg) return { name, ...cfg };

  const balancedName = `${bestTier.prefix}_BALANCED`;
  const balancedCfg = PORTALS[balancedName];
  if (balancedCfg) return { name: balancedName, ...balancedCfg };

  return { name: "NANO_SAFE", tbi: 1.00, mbb: 1.50, early: 1.25, pool: 300 };
}

export function getPortalByName(portalName: string): PortalConfig {
  const cfg = PORTALS[portalName];
  if (cfg) return { name: portalName, ...cfg };
  return { name: "NANO_SAFE", tbi: 1.00, mbb: 1.50, early: 1.25, pool: 300 };
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

  let tierIndex: number;
  if (topPct <= 0.02)      tierIndex = 8;
  else if (topPct <= 0.05) tierIndex = 7;
  else if (topPct <= 0.10) tierIndex = 6;
  else if (topPct <= 0.18) tierIndex = 5;
  else if (topPct <= 0.28) tierIndex = 4;
  else if (topPct <= 0.40) tierIndex = 3;
  else if (topPct <= 0.55) tierIndex = 2;
  else if (topPct <= 0.75) tierIndex = 1;
  else                     tierIndex = 0;

  const tier = PRICE_TIERS[tierIndex];
  let buyIn = tier.tbi;

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

export async function seed81Portals(): Promise<number> {
  const existing = await db.select({ cnt: sql<string>`COUNT(*)` }).from(portalSettings);
  const currentCount = parseInt(existing[0]?.cnt || "0");

  if (currentCount >= 81) {
    console.log(`[PORTALS] Already have ${currentCount} portals — skipping seed`);
    return currentCount;
  }

  await db.delete(portalSettings).where(sql`1=1`);

  let sortOrder = 0;
  for (const tier of PRICE_TIERS) {
    for (const risk of RISK_PROFILES) {
      const name = `${tier.prefix}_${risk.suffix}`;
      const poolSize = Math.round(tier.basePool * risk.poolMult);
      await db.insert(portalSettings).values({
        name,
        tbi: tier.tbi.toFixed(2),
        mbb: risk.mbb.toFixed(2),
        early: risk.early.toFixed(2),
        pool: poolSize,
        sortOrder: sortOrder++,
        isActive: true,
      }).onConflictDoUpdate({
        target: portalSettings.name,
        set: {
          tbi: tier.tbi.toFixed(2),
          mbb: risk.mbb.toFixed(2),
          early: risk.early.toFixed(2),
          pool: poolSize,
          sortOrder: sortOrder - 1,
          isActive: true,
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log(`[PORTALS] Seeded 81 portals (9 tiers × 9 risk profiles) into DB`);
  invalidatePortalCache();
  return 81;
}

export function getPortalTiers() {
  return PRICE_TIERS.map(tier => ({
    prefix: tier.prefix,
    tbi: tier.tbi,
    variants: RISK_PROFILES.map(risk => ({
      name: `${tier.prefix}_${risk.suffix}`,
      suffix: risk.suffix,
      mbb: risk.mbb,
      early: risk.early,
      pool: Math.round(tier.basePool * risk.poolMult),
    })),
  }));
}

export function getPoolForTrack(state: MarketState, trackId: string): PoolConfig | undefined {
  return state.pools.find((p) => p.trackId === trackId);
}

export function applyMarketBreathing(pool: PoolConfig): PoolConfig {
  const now = Date.now();
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const wave1 = Math.sin((minuteOfDay / 1440) * Math.PI * 2) * 0.03;
  const wave2 = Math.sin((minuteOfDay / 360) * Math.PI * 2) * 0.02;
  const wave3 = Math.sin((now / 30000) * Math.PI * 2) * 0.015;
  const fillPressure = pool.fillPct > 75 ? 0.04 : pool.fillPct > 50 ? 0.02 : pool.fillPct > 25 ? 0.01 : 0;
  const rushBoost = pool.status === "RUSH" ? 0.05 : 0;
  const totalSwing = wave1 + wave2 + wave3 + fillPressure + rushBoost;
  const breathingPrice = parseFloat((pool.dynamicPrice * (1 + totalSwing)).toFixed(2));
  const breathingBuyBack = parseFloat((breathingPrice * pool.buyBackRate).toFixed(2));

  return {
    ...pool,
    dynamicPrice: Math.max(0.50, breathingPrice),
    buyBackPrice: breathingBuyBack,
  };
}

export function getBreathingState(state: MarketState): MarketState {
  return {
    ...state,
    pools: state.pools.map(p => p.status === "CLOSED" ? p : applyMarketBreathing(p)),
  };
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

const TREASURY_MILESTONES = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000];
const reachedMilestones = new Set<number>();

export async function checkTreasuryMilestones(): Promise<{ reached: number[]; total: number }> {
  const [{ total }] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(house_take AS DECIMAL)), 0)`,
  }).from(orders);

  const totalNum = parseFloat(total || "0");
  const newlyReached: number[] = [];

  for (const target of TREASURY_MILESTONES) {
    if (totalNum >= target && !reachedMilestones.has(target)) {
      reachedMilestones.add(target);
      newlyReached.push(target);
      console.log(`[TREASURY] MILESTONE REACHED: House Treasury has cleared $${target.toLocaleString()}!`);
    }
  }

  return { reached: newlyReached, total: totalNum };
}

const SETTLEMENT_CYCLE_THRESHOLD = 1000;
const PAYOUT_PER_CYCLE = 540;
const EARLY_ACCEPT_MULTIPLIER = 1.25;
const HOLD_BONUS_PER_CYCLE = 0.15;

export interface SettlementOffer {
  queueId: string;
  orderId: string;
  userId: string;
  trackId: string;
  buyIn: number;
  portalName: string;
  baseMbb: number;
  currentMultiplier: number;
  currentOffer: number;
  maxPayout: number;
  cyclesHeld: number;
  queuePosition: number;
  status: string;
  createdAt: Date | null;
}

export async function enqueueTrader(
  orderId: string,
  userId: string,
  trackId: string,
  buyIn: number,
): Promise<void> {
  const portal = getPortalForPrice(buyIn);

  const [maxPos] = await db.select({
    maxPos: sql<string>`COALESCE(MAX(queue_position), 0)`,
  }).from(settlementQueue).where(
    inArray(settlementQueue.status, ["QUEUED", "OFFERED", "HOLDING"])
  );
  const nextPos = parseInt(maxPos?.maxPos || "0") + 1;

  const earlyOffer = parseFloat((buyIn * EARLY_ACCEPT_MULTIPLIER).toFixed(2));

  await db.insert(settlementQueue).values({
    orderId,
    userId,
    trackId,
    buyIn: buyIn.toString(),
    portalName: portal.name,
    baseMbb: portal.mbb.toString(),
    currentOffer: earlyOffer.toString(),
    currentMultiplier: EARLY_ACCEPT_MULTIPLIER.toString(),
    cyclesHeld: 0,
    status: "QUEUED",
    queuePosition: nextPos,
  });

  console.log(`[GOVERNOR] Trader enqueued: Order ${orderId} | BuyIn: $${buyIn} | Portal: ${portal.name} | Position: #${nextPos} | Early Offer: $${earlyOffer}`);
}

export async function getGrossIntake(): Promise<number> {
  const [result] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
  }).from(orders);
  return parseFloat(result?.total || "0");
}

export async function getTotalPaidOut(): Promise<number> {
  const [result] = await db.select({
    paid: sql<string>`COALESCE(SUM(CAST(payout_amount AS DECIMAL)), 0)`,
  }).from(settlementQueue).where(eq(settlementQueue.status, "SETTLED"));
  return parseFloat(result?.paid || "0");
}

export async function getSettlementFundBalance(): Promise<number> {
  const grossIntake = await getGrossIntake();
  const totalPaid = await getTotalPaidOut();
  const totalOwed = parseFloat((grossIntake * FLOOR_SPLIT).toFixed(2));
  return parseFloat((totalOwed - totalPaid).toFixed(2));
}

export async function getCompletedCycleCount(): Promise<number> {
  const [result] = await db.select({
    cnt: sql<string>`COALESCE(MAX(cycle_number), 0)`,
  }).from(settlementCycles);
  return parseInt(result?.cnt || "0");
}

export async function runSettlementCycle(): Promise<{
  cycleNumber: number;
  settled: { userId: string; payout: number; multiplier: number }[];
  holding: string[];
  payoutBudget: number;
  totalPaidOut: number;
}> {
  const grossIntake = await getGrossIntake();
  const completedCycles = await getCompletedCycleCount();
  const cycleNumber = completedCycles + 1;

  const totalKsReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);
  const totalPayoutBudget = totalKsReached * PAYOUT_PER_CYCLE;

  const alreadyPaid = await getTotalPaidOut();
  const payoutBudget = parseFloat((totalPayoutBudget - alreadyPaid).toFixed(2));

  if (payoutBudget <= 0) {
    console.log(`[GOVERNOR] Cycle #${cycleNumber} — No payout budget. Gross: $${grossIntake.toFixed(2)} | ${totalKsReached} K's reached | Already paid: $${alreadyPaid.toFixed(2)}`);
    return { cycleNumber, settled: [], holding: [], payoutBudget: 0, totalPaidOut: 0 };
  }

  console.log(`[GOVERNOR] Cycle #${cycleNumber} | Gross: $${grossIntake.toFixed(2)} | ${totalKsReached}K = $${totalPayoutBudget} total owed | Paid: $${alreadyPaid.toFixed(2)} | Budget: $${payoutBudget.toFixed(2)}`);

  const queued = await db.select().from(settlementQueue)
    .where(inArray(settlementQueue.status, ["QUEUED", "OFFERED", "HOLDING"]))
    .orderBy(asc(settlementQueue.queuePosition));

  let remaining = payoutBudget;
  const settled: { userId: string; payout: number; multiplier: number }[] = [];
  const holding: string[] = [];
  let totalPaidOut = 0;

  for (const entry of queued) {
    if (remaining <= 0) {
      holding.push(entry.userId);
      continue;
    }

    const buyIn = parseFloat(entry.buyIn || "0");
    const baseMbb = parseFloat(entry.baseMbb || "3.00");
    const cyclesHeld = entry.cyclesHeld || 0;

    const holdBonus = cyclesHeld * HOLD_BONUS_PER_CYCLE;
    const currentMult = parseFloat(Math.min(
      EARLY_ACCEPT_MULTIPLIER + holdBonus,
      baseMbb
    ).toFixed(2));
    const offerAmount = parseFloat((buyIn * currentMult).toFixed(2));

    await db.update(settlementQueue).set({
      currentMultiplier: currentMult.toFixed(2),
      currentOffer: offerAmount.toFixed(2),
      cyclesHeld: cyclesHeld + 1,
    }).where(eq(settlementQueue.id, entry.id));

    if (offerAmount <= remaining) {
      await db.update(settlementQueue).set({
        status: "OFFERED",
        currentMultiplier: currentMult.toFixed(2),
        currentOffer: offerAmount.toFixed(2),
        cyclesHeld: cyclesHeld + 1,
      }).where(eq(settlementQueue.id, entry.id));

      holding.push(entry.userId);
    } else {
      holding.push(entry.userId);
    }
  }

  await db.insert(settlementCycles).values({
    cycleNumber,
    poolIntake: grossIntake.toFixed(2),
    totalSettled: totalPaidOut.toFixed(2),
    tradersSettled: settled.length,
    tradersHolding: holding.length,
    status: "COMPLETED",
    closedAt: new Date(),
  });

  console.log(`[GOVERNOR] Cycle #${cycleNumber} COMPLETE | Budget: $${payoutBudget.toFixed(2)} | Settled: ${settled.length} | Holding: ${holding.length} | Paid: $${totalPaidOut.toFixed(2)}`);

  return { cycleNumber, settled, holding, payoutBudget, totalPaidOut };
}

export async function traderAcceptOffer(queueId: string, userId: string): Promise<{
  success: boolean;
  payout?: number;
  multiplier?: number;
  message: string;
}> {
  const [entry] = await db.select().from(settlementQueue)
    .where(and(eq(settlementQueue.id, queueId), eq(settlementQueue.userId, userId)));

  if (!entry) return { success: false, message: "Position not found" };
  if (entry.status === "SETTLED") return { success: false, message: "Already settled" };

  const buyIn = parseFloat(entry.buyIn || "0");
  const baseMbb = parseFloat(entry.baseMbb || "3.00");
  const cyclesHeld = entry.cyclesHeld || 0;

  const holdBonus = cyclesHeld * HOLD_BONUS_PER_CYCLE;
  const currentMult = parseFloat(Math.min(
    EARLY_ACCEPT_MULTIPLIER + holdBonus,
    baseMbb
  ).toFixed(2));
  const offerAmount = parseFloat((buyIn * currentMult).toFixed(2));

  const grossIntake = await getGrossIntake();
  const totalKsReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);
  const totalPayoutBudget = totalKsReached * PAYOUT_PER_CYCLE;
  const alreadyPaid = await getTotalPaidOut();
  const available = parseFloat((totalPayoutBudget - alreadyPaid).toFixed(2));

  if (offerAmount > available) {
    return {
      success: false,
      message: `Fund has $${available.toFixed(2)} available. Your offer is $${offerAmount.toFixed(2)}. Hold for next $1K cycle — next $540 drops when gross hits $${((totalKsReached + 1) * SETTLEMENT_CYCLE_THRESHOLD).toLocaleString()}.`,
    };
  }

  await db.update(settlementQueue).set({
    status: "SETTLED",
    acceptedMultiplier: currentMult.toFixed(2),
    payoutAmount: offerAmount.toFixed(2),
    currentOffer: offerAmount.toFixed(2),
    currentMultiplier: currentMult.toFixed(2),
    settledAt: new Date(),
  }).where(eq(settlementQueue.id, queueId));

  console.log(`[GOVERNOR] TRADER ACCEPTED: ${userId} | $${buyIn} → $${offerAmount} (${currentMult}x) | Fund remaining: $${(available - offerAmount).toFixed(2)}`);

  return {
    success: true,
    payout: offerAmount,
    multiplier: currentMult,
    message: `SETTLED — $${offerAmount.toFixed(2)} at ${currentMult}x. Payout via $AITITRADEBROKERAGE.`,
  };
}

export async function traderHoldPosition(queueId: string, userId: string): Promise<{
  success: boolean;
  nextMultiplier?: number;
  nextOffer?: number;
  message: string;
}> {
  const [entry] = await db.select().from(settlementQueue)
    .where(and(eq(settlementQueue.id, queueId), eq(settlementQueue.userId, userId)));

  if (!entry) return { success: false, message: "Position not found" };
  if (entry.status === "SETTLED") return { success: false, message: "Already settled" };

  const buyIn = parseFloat(entry.buyIn || "0");
  const baseMbb = parseFloat(entry.baseMbb || "3.00");
  const cyclesHeld = (entry.cyclesHeld || 0);

  const nextMult = parseFloat(Math.min(
    EARLY_ACCEPT_MULTIPLIER + (cyclesHeld + 1) * HOLD_BONUS_PER_CYCLE,
    baseMbb
  ).toFixed(2));
  const nextOffer = parseFloat((buyIn * nextMult).toFixed(2));
  const maxPayout = parseFloat((buyIn * baseMbb).toFixed(2));

  await db.update(settlementQueue).set({
    status: "HOLDING",
  }).where(eq(settlementQueue.id, queueId));

  console.log(`[GOVERNOR] TRADER HOLDING: ${userId} | Current: ${parseFloat(entry.currentMultiplier || "1.25").toFixed(2)}x → Next: ${nextMult}x ($${nextOffer}) | Max: $${maxPayout}`);

  return {
    success: true,
    nextMultiplier: nextMult,
    nextOffer,
    message: `HOLDING — Next cycle offer: $${nextOffer.toFixed(2)} (${nextMult}x). Max payout: $${maxPayout.toFixed(2)} (${baseMbb}x).`,
  };
}

export async function getTraderPositions(userId: string): Promise<SettlementOffer[]> {
  const positions = await db.select().from(settlementQueue)
    .where(eq(settlementQueue.userId, userId))
    .orderBy(asc(settlementQueue.queuePosition));

  return positions.map(p => {
    const buyIn = parseFloat(p.buyIn || "0");
    const baseMbb = parseFloat(p.baseMbb || "3.00");
    const currentMult = parseFloat(p.currentMultiplier || EARLY_ACCEPT_MULTIPLIER.toString());
    return {
      queueId: p.id,
      orderId: p.orderId,
      userId: p.userId,
      trackId: p.trackId,
      buyIn,
      portalName: p.portalName || "NANO_SAFE",
      baseMbb,
      currentMultiplier: currentMult,
      currentOffer: parseFloat(p.currentOffer || (buyIn * currentMult).toFixed(2)),
      maxPayout: parseFloat((buyIn * baseMbb).toFixed(2)),
      cyclesHeld: p.cyclesHeld || 0,
      queuePosition: p.queuePosition || 0,
      status: p.status || "QUEUED",
      createdAt: p.createdAt,
    };
  });
}

export async function getSettlementDashboard(): Promise<{
  grossIntake: number;
  ksReached: number;
  totalOwed54: number;
  totalPaidOut: number;
  fundAvailable: number;
  payoutPerK: number;
  totalTraders: number;
  queuedCount: number;
  holdingCount: number;
  settledCount: number;
  currentCycle: number;
  cycleThreshold: number;
  nextKAt: number;
  ceo46Total: number;
  recentSettlements: SettlementOffer[];
  topQueue: SettlementOffer[];
}> {
  const grossIntake = await getGrossIntake();
  const totalPaid = await getTotalPaidOut();
  const ksReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);
  const totalOwed54 = parseFloat((ksReached * PAYOUT_PER_CYCLE).toFixed(2));
  const fundAvailable = parseFloat((totalOwed54 - totalPaid).toFixed(2));
  const ceo46Total = parseFloat((grossIntake * CEO_SPLIT).toFixed(2));
  const nextKAt = (ksReached + 1) * SETTLEMENT_CYCLE_THRESHOLD;

  const [counts] = await db.select({
    total: sql<string>`COUNT(*)`,
    queued: sql<string>`SUM(CASE WHEN status IN ('QUEUED','OFFERED') THEN 1 ELSE 0 END)`,
    holding: sql<string>`SUM(CASE WHEN status = 'HOLDING' THEN 1 ELSE 0 END)`,
    settled: sql<string>`SUM(CASE WHEN status = 'SETTLED' THEN 1 ELSE 0 END)`,
  }).from(settlementQueue);

  const completedCycles = await getCompletedCycleCount();

  const recentSettled = await db.select().from(settlementQueue)
    .where(eq(settlementQueue.status, "SETTLED"))
    .orderBy(desc(settlementQueue.settledAt))
    .limit(10);

  const topQueued = await db.select().from(settlementQueue)
    .where(inArray(settlementQueue.status, ["QUEUED", "OFFERED", "HOLDING"]))
    .orderBy(asc(settlementQueue.queuePosition))
    .limit(20);

  const mapEntry = (p: any): SettlementOffer => {
    const buyIn = parseFloat(p.buyIn || "0");
    const baseMbb = parseFloat(p.baseMbb || "3.00");
    const currentMult = parseFloat(p.currentMultiplier || EARLY_ACCEPT_MULTIPLIER.toString());
    return {
      queueId: p.id,
      orderId: p.orderId,
      userId: p.userId,
      trackId: p.trackId,
      buyIn,
      portalName: p.portalName || "NANO_SAFE",
      baseMbb,
      currentMultiplier: currentMult,
      currentOffer: parseFloat(p.currentOffer || (buyIn * currentMult).toFixed(2)),
      maxPayout: parseFloat((buyIn * baseMbb).toFixed(2)),
      cyclesHeld: p.cyclesHeld || 0,
      queuePosition: p.queuePosition || 0,
      status: p.status || "QUEUED",
      createdAt: p.createdAt,
    };
  };

  return {
    grossIntake,
    ksReached,
    totalOwed54: totalOwed54,
    totalPaidOut: totalPaid,
    fundAvailable: Math.max(0, fundAvailable),
    payoutPerK: PAYOUT_PER_CYCLE,
    totalTraders: parseInt(counts?.total || "0"),
    queuedCount: parseInt(counts?.queued || "0"),
    holdingCount: parseInt(counts?.holding || "0"),
    settledCount: parseInt(counts?.settled || "0"),
    currentCycle: completedCycles,
    cycleThreshold: SETTLEMENT_CYCLE_THRESHOLD,
    nextKAt,
    ceo46Total,
    recentSettlements: recentSettled.map(mapEntry),
    topQueue: topQueued.map(mapEntry),
  };
}

export async function checkAndTriggerSettlement(): Promise<boolean> {
  const grossIntake = await getGrossIntake();
  const completedCycles = await getCompletedCycleCount();
  const ksReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);

  if (ksReached > completedCycles) {
    console.log(`[GOVERNOR] New $1K milestone! Gross: $${grossIntake.toFixed(2)} | ${ksReached}K reached | ${completedCycles} cycles done | Triggering settlement...`);
    await runSettlementCycle();
    return true;
  }
  return false;
}

const VALID_ENTRIES = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

let currentSystemBias: "NATURAL" | "FLOOR_HEAVY" = "NATURAL";

function getKineticState(adminBias: "NATURAL" | "FLOOR_HEAVY" = currentSystemBias) {
  const isUpPulse = (Math.floor(Date.now() / 10000) % 2) === 1;
  if (adminBias === "FLOOR_HEAVY") {
    return { floorROI: isUpPulse ? 0.90 : 0.70, houseMBBP: isUpPulse ? 0.10 : 0.30, pulse: isUpPulse ? "HIGH" : "MID", bias: adminBias };
  }
  return { floorROI: isUpPulse ? 0.90 : 0.50, houseMBBP: isUpPulse ? 0.10 : 0.50, pulse: isUpPulse ? "HIGH" : "LOW", bias: adminBias };
}

function setKineticBias(bias: "NATURAL" | "FLOOR_HEAVY") {
  currentSystemBias = bias;
  console.log(`[KINETIC] Bias set to ${bias}`);
}

function getKineticBias() {
  return currentSystemBias;
}

export { POOL_CEILING, FLOOR_SPLIT, CEO_SPLIT, TRUST_VAULT_SPLIT_TIERS, PORTALS, DEFAULT_PORTALS, SETTLEMENT_CYCLE_THRESHOLD, PRICE_TIERS, RISK_PROFILES, VALID_ENTRIES, getKineticState, setKineticBias, getKineticBias };
