import { db } from "./db";
import { tracks, orders, portalSettings, settlementQueue, settlementCycles } from "@shared/schema";
import { desc, sql, eq, asc, and, inArray } from "drizzle-orm";

let FLOOR_SPLIT = 0.54;
let CEO_SPLIT = 0.46;

function getKineticSplit() {
  const state = getKineticState();
  return { floor: state.floorROI, ceo: state.houseMBBP };
}

function refreshSplitFromKinetic() {
  const split = getKineticSplit();
  FLOOR_SPLIT = split.floor;
  CEO_SPLIT = split.ceo;
}

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
      liquiditySplit: { floor: getKineticSplit().floor, ceo: getKineticSplit().ceo },
      minterFee: getKineticSplit().floor,
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
  bounce: number;
  floorPct: number;
  ceoPct: number;
} {
  const split = getLiveSplit();
  const floor54 = parseFloat((grossSales * split.floor).toFixed(2));
  const ceo46 = parseFloat((grossSales * split.ceo).toFixed(2));
  const trustTithe = parseFloat((ceo46 * 0.10).toFixed(2));
  const bounce = parseFloat((ceo46 - trustTithe).toFixed(2));
  return { floor54, ceo46, trustTithe, bounce, floorPct: Math.round(split.floor * 100), ceoPct: Math.round(split.ceo * 100) };
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

  const minterFeeAmount = parseFloat((grossGlobalSales * 0.54).toFixed(2));
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
function getLiveSplit(): { floor: number; ceo: number } {
  return getKineticSplit();
}
function getPayoutPerCycle(): number {
  const split = getLiveSplit();
  return parseFloat((SETTLEMENT_CYCLE_THRESHOLD * split.floor).toFixed(2));
}
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
  const ksReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);
  const totalOwed = parseFloat((ksReached * getPayoutPerCycle()).toFixed(2));
  return parseFloat(Math.max(0, totalOwed - totalPaid).toFixed(2));
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
  const lockedPayout = getPayoutPerCycle();
  const totalPayoutBudget = totalKsReached * lockedPayout;

  const alreadyPaid = await getTotalPaidOut();
  const payoutBudget = parseFloat((totalPayoutBudget - alreadyPaid).toFixed(2));

  if (payoutBudget <= 0) {
    console.log(`[GOVERNOR] Cycle #${cycleNumber} — No payout budget. Gross: $${grossIntake.toFixed(2)} | ${totalKsReached} K's reached | Already paid: $${alreadyPaid.toFixed(2)}`);
    return { cycleNumber, settled: [], holding: [], payoutBudget: 0, totalPaidOut: 0 };
  }

  const closingSplit = getLiveSplit();
  console.log(`[GOVERNOR] Cycle #${cycleNumber} | Gross: $${grossIntake.toFixed(2)} | ${totalKsReached}K | KINETIC SPLIT: ${Math.round(closingSplit.floor*100)}/${Math.round(closingSplit.ceo*100)} | Payout/K: $${lockedPayout} | Paid: $${alreadyPaid.toFixed(2)} | Budget: $${payoutBudget.toFixed(2)}`);

  const queued = await db.select().from(settlementQueue)
    .where(inArray(settlementQueue.status, ["QUEUED", "OFFERED", "HOLDING"]))
    .orderBy(asc(settlementQueue.queuePosition));

  let remaining = payoutBudget;
  const settled: { userId: string; payout: number; multiplier: number }[] = [];
  const holding: string[] = [];
  let totalPaidOut = 0;

  for (const entry of queued) {
    const buyIn = parseFloat(entry.buyIn || "0");
    const baseMbb = parseFloat(entry.baseMbb || "3.00");
    const cyclesHeld = entry.cyclesHeld || 0;

    const holdBonus = cyclesHeld * HOLD_BONUS_PER_CYCLE;
    const currentMult = parseFloat(Math.min(
      EARLY_ACCEPT_MULTIPLIER + holdBonus,
      baseMbb
    ).toFixed(2));
    const offerAmount = parseFloat((buyIn * currentMult).toFixed(2));

    if (remaining <= 0 || offerAmount > remaining) {
      await db.update(settlementQueue).set({
        status: "HOLDING",
        currentMultiplier: currentMult.toFixed(2),
        currentOffer: offerAmount.toFixed(2),
        cyclesHeld: cyclesHeld + 1,
      }).where(eq(settlementQueue.id, entry.id));
      holding.push(entry.userId);
      console.log(`[GOVERNOR] HOLD: ${entry.userId} | Position #${entry.queuePosition} | $${buyIn} → $${offerAmount} (${currentMult}x) | Budget left: $${remaining.toFixed(2)} — waiting for next $1K`);
      continue;
    }

    await db.update(settlementQueue).set({
      status: "SETTLED",
      acceptedMultiplier: currentMult.toFixed(2),
      payoutAmount: offerAmount.toFixed(2),
      currentOffer: offerAmount.toFixed(2),
      currentMultiplier: currentMult.toFixed(2),
      cyclesHeld: cyclesHeld + 1,
      settledAt: new Date(),
    }).where(eq(settlementQueue.id, entry.id));

    remaining = parseFloat((remaining - offerAmount).toFixed(2));
    totalPaidOut = parseFloat((totalPaidOut + offerAmount).toFixed(2));
    settled.push({ userId: entry.userId, payout: offerAmount, multiplier: currentMult });
    console.log(`[GOVERNOR] SETTLED: ${entry.userId} | Position #${entry.queuePosition} | $${buyIn} → $${offerAmount} (${currentMult}x) | Budget left: $${remaining.toFixed(2)}`);
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
  const totalPayoutBudget = totalKsReached * getPayoutPerCycle();
  const alreadyPaid = await getTotalPaidOut();
  const available = parseFloat((totalPayoutBudget - alreadyPaid).toFixed(2));

  if (offerAmount > available) {
    return {
      success: false,
      message: `Fund has $${available.toFixed(2)} available. Your offer is $${offerAmount.toFixed(2)}. Hold for next $1K cycle — next $${getPayoutPerCycle()} drops when gross hits $${((totalKsReached + 1) * SETTLEMENT_CYCLE_THRESHOLD).toLocaleString()}.`,
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
  const currentPayoutPerK = getPayoutPerCycle();
  const totalOwed54 = parseFloat((ksReached * currentPayoutPerK).toFixed(2));
  const fundAvailable = parseFloat((totalOwed54 - totalPaid).toFixed(2));
  const dashSplit = getLiveSplit();
  const ceo46Total = parseFloat((grossIntake * dashSplit.ceo).toFixed(2));
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
    payoutPerK: getPayoutPerCycle(),
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

const KINETIC_SPLITS = [
  { floor: 0.90, house: 0.10, pulse: "HIGH" },
  { floor: 0.80, house: 0.20, pulse: "HIGH" },
  { floor: 0.70, house: 0.30, pulse: "MID" },
  { floor: 0.60, house: 0.40, pulse: "MID" },
  { floor: 0.50, house: 0.50, pulse: "LOW" },
];

const KINETIC_SPLITS_HEAVY = [
  { floor: 0.90, house: 0.10, pulse: "HIGH" },
  { floor: 0.80, house: 0.20, pulse: "HIGH" },
  { floor: 0.70, house: 0.30, pulse: "MID" },
];

function getKineticState(adminBias: "NATURAL" | "FLOOR_HEAVY" = currentSystemBias) {
  const splits = adminBias === "FLOOR_HEAVY" ? KINETIC_SPLITS_HEAVY : KINETIC_SPLITS;
  const cycleIndex = Math.floor(Date.now() / 10000) % splits.length;
  const current = splits[cycleIndex];
  return { floorROI: current.floor, houseMBBP: current.house, pulse: current.pulse, bias: adminBias };
}

function setKineticBias(bias: "NATURAL" | "FLOOR_HEAVY") {
  currentSystemBias = bias;
  console.log(`[KINETIC] Bias set to ${bias}`);
}

function getKineticBias() {
  return currentSystemBias;
}

class MarketEngine {
  P_current: number;
  totalVolume: number;
  targetVolume: number;
  demand: number;
  supply: number;
  queue: Array<{ userId: string; amount: number; timestamp: number; status: string }>;
  floorPercent: number;
  housePercent: number;
  cycle: number;
  cash: { deposits: number; entries: number; totalIn: number; lastDeposit: number; lastEntry: number };
  settled: boolean;

  constructor() {
    this.P_current = 1.0;
    this.totalVolume = 0;
    this.targetVolume = 1000;
    this.demand = 0;
    this.supply = 0;
    this.queue = [];
    this.floorPercent = 0.5;
    this.housePercent = 0.5;
    this.cycle = 1;
    this.cash = { deposits: 0, entries: 0, totalIn: 0, lastDeposit: 0, lastEntry: 0 };
    this.settled = false;
  }

  updatePrice(): number {
    const imbalance = this.demand - this.supply;
    const ALPHA = 0.01;
    this.P_current += ALPHA * imbalance;
    if (this.P_current < 0.01) this.P_current = 0.01;
    return this.P_current;
  }

  enterMarket(userId: string, amount: number = 1): number {
    logEvent("BUY", { userId, amount, price: this.P_current });
    this.queue.push({
      userId,
      amount,
      timestamp: Date.now(),
      status: "pending",
    });
    this.totalVolume += amount;
    this.demand += amount;
    this.cash.entries += amount;
    this.cash.totalIn += amount;
    this.cash.lastEntry = Date.now();
    return this.queue.length;
  }

  recordDeposit(amount: number): void {
    this.cash.deposits += amount;
    this.cash.totalIn += amount;
    this.cash.lastDeposit = Date.now();
    logEvent("DEPOSIT", { amount, totalDeposits: this.cash.deposits, totalIn: this.cash.totalIn });
  }

  impulse(amount: number): void {
    logEvent("IMPULSE", { amount, price: this.P_current });
    this.demand += amount;
    this.P_current += amount * 0.001;
  }

  settle(): {
    cycle: number;
    settlementPrice: number;
    roi: number;
    floorPool: number;
    housePool: number;
    queueSize: number;
  } | null {
    if (this.totalVolume < this.targetVolume) return null;

    const settlementPrice = this.P_current;
    const floorPool = this.totalVolume * this.floorPercent;
    const housePool = this.totalVolume * this.housePercent;

    const result = {
      cycle: this.cycle,
      settlementPrice,
      roi: settlementPrice - 1,
      floorPool,
      housePool,
      queueSize: this.queue.length,
    };

    this.resetCycle();
    return result;
  }

  resetCycle(): void {
    this.P_current = 1.0;
    this.totalVolume = 0;
    this.demand = 0;
    this.supply = 0;
    this.queue = [];
    this.cycle += 1;
    this.settled = false;
  }

  adjustBalance(floorPercent: number): void {
    if (floorPercent < 0.5) floorPercent = 0.5;
    if (floorPercent > 0.9) floorPercent = 0.9;
    this.floorPercent = floorPercent;
    this.housePercent = 1 - floorPercent;
  }

  safeStop(threshold: number = 0.25): { stopped: boolean; price: number } {
    if (this.P_current <= threshold) {
      return { stopped: true, price: this.P_current };
    }
    return { stopped: false, price: this.P_current };
  }

  getState() {
    return {
      price: parseFloat(this.P_current.toFixed(4)),
      totalVolume: parseFloat(this.totalVolume.toFixed(2)),
      targetVolume: this.targetVolume,
      demand: this.demand,
      supply: this.supply,
      floorPercent: this.floorPercent,
      housePercent: this.housePercent,
      cycle: this.cycle,
      queueSize: this.queue.length,
      fillPct: parseFloat(((this.totalVolume / this.targetVolume) * 100).toFixed(1)),
      safeStop: this.safeStop(),
      cash: {
        deposits: parseFloat(this.cash.deposits.toFixed(2)),
        entries: parseFloat(this.cash.entries.toFixed(2)),
        totalIn: parseFloat(this.cash.totalIn.toFixed(2)),
        diff: parseFloat((this.cash.deposits - this.cash.entries).toFixed(2)),
        lastDeposit: this.cash.lastDeposit,
        lastEntry: this.cash.lastEntry,
      },
    };
  }
}

const liveEngine = new MarketEngine();

function syncEngineWithKinetic(): void {
  const kinetic = getKineticState();
  liveEngine.adjustBalance(kinetic.floorROI);
}

syncEngineWithKinetic();
setInterval(syncEngineWithKinetic, 10000);

import * as fs from "fs";
import * as path from "path";

const STATE_FILE = path.join(process.cwd(), "engine-state.json");
const AUDIT_FILE = path.join(process.cwd(), "audit.json");

function saveState(): void {
  try {
    const snapshot = {
      P_current: liveEngine.P_current,
      totalVolume: liveEngine.totalVolume,
      floorPercent: liveEngine.floorPercent,
      housePercent: liveEngine.housePercent,
      cycle: liveEngine.cycle,
      demand: liveEngine.demand,
      supply: liveEngine.supply,
      cash: liveEngine.cash,
      savedAt: Date.now(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2));
  } catch (e) {
    console.error("[ENGINE] State save error:", e);
  }
}

function loadState(): void {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    if (data.P_current) liveEngine.P_current = data.P_current;
    if (data.totalVolume) liveEngine.totalVolume = data.totalVolume;
    if (data.cycle) liveEngine.cycle = data.cycle;
    if (data.demand) liveEngine.demand = data.demand;
    if (data.supply) liveEngine.supply = data.supply;
    if (data.cash) {
      liveEngine.cash = {
        deposits: data.cash.deposits || 0,
        entries: data.cash.entries || 0,
        totalIn: data.cash.totalIn || 0,
        lastDeposit: data.cash.lastDeposit || 0,
        lastEntry: data.cash.lastEntry || 0,
      };
    }
    console.log(`[ENGINE] State restored — Cycle: ${liveEngine.cycle}, Price: ${liveEngine.P_current.toFixed(4)}, Cash: $${liveEngine.cash.totalIn.toFixed(2)}`);
  } catch (e) {
    console.error("[ENGINE] State load error:", e);
  }
}

loadState();
setInterval(saveState, 5000);

function saveAudit(): void {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(eventLog, null, 2));
  } catch (e) {
    console.error("[ENGINE] Audit save error:", e);
  }
}

setInterval(saveAudit, 5000);

let eventLog: Array<{ id: string; type: string; payload: any; time: number }> = [];

function logEvent(type: string, payload: any) {
  const event = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    type,
    payload,
    time: Date.now(),
  };
  eventLog.push(event);
  if (eventLog.length > 5000) eventLog.shift();
  return event;
}

function getEventLog() {
  return eventLog;
}

const portfolios: Record<string, Array<{ amount: number; entryPrice: number; timestamp: number }>> = {};

function addPosition(userId: string, amount: number, price: number): void {
  if (!portfolios[userId]) portfolios[userId] = [];
  portfolios[userId].push({
    amount,
    entryPrice: price,
    timestamp: Date.now(),
  });
  logEvent("position_open", { userId, amount, price });
}

function getPortfolioValue(userId: string): { positions: number; pnl: number; currentPrice: number } {
  const positions = portfolios[userId] || [];
  let pnl = 0;
  positions.forEach((p) => {
    pnl += (liveEngine.P_current - p.entryPrice) * p.amount;
  });
  return {
    positions: positions.length,
    pnl: parseFloat(pnl.toFixed(4)),
    currentPrice: parseFloat(liveEngine.P_current.toFixed(4)),
  };
}

function getPortfolio(userId: string) {
  return portfolios[userId] || [];
}

function computeGlobalIndex(): number {
  return parseFloat(liveEngine.P_current.toFixed(4));
}

const processedEvents = new Set<string>();

function safeExecute(eventId: string, fn: () => void): boolean {
  if (processedEvents.has(eventId)) return false;
  processedEvents.add(eventId);
  if (processedEvents.size > 10000) {
    const first = processedEvents.values().next().value;
    if (first) processedEvents.delete(first);
  }
  fn();
  return true;
}

let queueLock = false;

function enterSafe(userId: string): number | null {
  if (queueLock) return null;
  queueLock = true;
  const pos = liveEngine.enterMarket(userId, 1);
  queueLock = false;
  logEvent("market_enter", { userId, position: pos, price: liveEngine.P_current });
  return pos;
}

function clampPrice(): void {
  if (liveEngine.P_current < 0.01) liveEngine.P_current = 0.01;
  if (liveEngine.P_current > 1000) liveEngine.P_current = 1000;
}

function emergencyReset(): void {
  logEvent("emergency_reset", { priceBefore: liveEngine.P_current, cycleBefore: liveEngine.cycle, cashSnapshot: { ...liveEngine.cash } });
  liveEngine.queue = [];
  liveEngine.demand = 0;
  liveEngine.supply = 0;
  liveEngine.totalVolume = 0;
  liveEngine.P_current = 1.0;
  liveEngine.cash = { deposits: 0, entries: 0, totalIn: 0, lastDeposit: 0, lastEntry: 0 };
  console.log("[ENGINE] EMERGENCY RESET — All positions cleared, price reset to 1.0, cash zeroed");
}

function liquidationCheck(): boolean {
  if (liveEngine.P_current <= 0.15 && liveEngine.queue.length > 0) {
    return true;
  }
  return false;
}

function generateOrderBook(price: number): { bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> } {
  const bids = [];
  const asks = [];
  const bidPressure = Math.random() * 10;
  const askPressure = Math.random() * 10;

  for (let i = 0; i < 15; i++) {
    bids.push({
      price: parseFloat((price - i * 0.01).toFixed(4)),
      size: parseFloat((bidPressure * Math.random()).toFixed(2)),
    });
    asks.push({
      price: parseFloat((price + i * 0.01).toFixed(4)),
      size: parseFloat((askPressure * Math.random()).toFixed(2)),
    });
  }

  return { bids, asks };
}

let engineIO: any = null;

function getEngineIO() {
  return engineIO;
}

function setEngineIO(io: any) {
  engineIO = io;

  io.on("connection", (socket: any) => {
    console.log(`[ENGINE] Trader connected: ${socket.id}`);
    socket.emit("price", parseFloat(liveEngine.P_current.toFixed(4)));
    socket.emit("engineState", liveEngine.getState());
    socket.emit("global_index", { value: computeGlobalIndex(), time: Date.now() });

    const book = generateOrderBook(liveEngine.P_current);
    socket.emit("orderbook", book);

    socket.on("disconnect", () => {
      console.log(`[ENGINE] Trader disconnected: ${socket.id}`);
    });
  });
}

let tickCounter = 0;

setInterval(() => {
  const price = liveEngine.updatePrice();
  clampPrice();
  const stop = liveEngine.safeStop();

  tickCounter++;
  if (tickCounter % 10 === 0) {
    logEvent("PRICE_TICK", { price: parseFloat(price.toFixed(4)), volume: liveEngine.totalVolume });
  }

  const candle = {
    time: Math.floor(Date.now() / 1000),
    open: parseFloat((price * 0.999).toFixed(4)),
    high: parseFloat((price * 1.002).toFixed(4)),
    low: parseFloat((price * 0.997).toFixed(4)),
    close: parseFloat(price.toFixed(4)),
    volume: liveEngine.totalVolume,
  };

  if (engineIO) {
    const roundedPrice = parseFloat(price.toFixed(4));
    engineIO.emit("price", roundedPrice);
    engineIO.emit("candle", candle);
    engineIO.emit("engineState", liveEngine.getState());
    engineIO.emit("global_index", { value: computeGlobalIndex(), time: Date.now() });

    const book = generateOrderBook(roundedPrice);
    engineIO.emit("orderbook", book);

    if (liquidationCheck()) {
      engineIO.emit("liquidation", {
        intensity: Math.random() * 10,
        price: roundedPrice,
        queueSize: liveEngine.queue.length,
      });
      logEvent("liquidation", { price: roundedPrice, queue: liveEngine.queue.length });
    }

    if (stop.stopped) {
      engineIO.emit("halt", stop);
      logEvent("safe_stop", { price: stop.price });
      console.log(`[ENGINE] SAFE STOP TRIGGERED — Price: ${stop.price.toFixed(4)} | Cycle frozen`);
    }

    if (liveEngine.totalVolume >= liveEngine.targetVolume && !liveEngine.settled) {
      liveEngine.settled = true;
      const settlementPrice = liveEngine.P_current;
      const floorPool = liveEngine.totalVolume * liveEngine.floorPercent;
      const housePool = liveEngine.totalVolume * liveEngine.housePercent;
      const settlementData = {
        marketId: "FLOOR",
        cycle: liveEngine.cycle,
        settlementPrice,
        roi: settlementPrice - 1,
        floorPool,
        housePool,
        queueSize: liveEngine.queue.length,
        time: Date.now(),
      };

      engineIO.emit("settlement", settlementData);
      logEvent("AUTO_SETTLEMENT", settlementData);
      console.log(`[ENGINE] AUTO-SETTLEMENT — Cycle ${liveEngine.cycle} | Price: ${settlementPrice.toFixed(4)} | Floor: $${floorPool.toFixed(2)} | House: $${housePool.toFixed(2)} | Resetting in 5s...`);

      setTimeout(() => {
        liveEngine.resetCycle();
        if (engineIO) {
          engineIO.emit("market_reset", { cycle: liveEngine.cycle, time: Date.now() });
        }
        console.log(`[ENGINE] Market reset — New cycle ${liveEngine.cycle} started`);
      }, 5000);
    }
  }
}, 1000);

interface MonitorAlert {
  level: "INFO" | "WARNING" | "CRITICAL";
  market: string;
  message: string;
  value: number;
  time: number;
}

interface MonitorSnapshot {
  totalMarkets: number;
  activeMarkets: number;
  totalVolume: number;
  avgPrice: number;
  alerts: MonitorAlert[];
  engineHealth: "HEALTHY" | "WARNING" | "CRITICAL" | "HALTED";
  queueDepth: number;
  cycleProgress: number;
  kineticPulse: string;
  time: number;
}

function buildMonitor(): MonitorSnapshot {
  const alerts: MonitorAlert[] = [];
  const now = Date.now();
  const state = liveEngine.getState();
  const kinetic = getKineticState();

  if (state.price < 0.05) {
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: `CRITICAL LOW PRICE: ${state.price.toFixed(4)}`,
      value: state.price,
      time: now,
    });
  } else if (state.price < 0.20) {
    alerts.push({
      level: "WARNING",
      market: "FLOOR",
      message: `Low price warning: ${state.price.toFixed(4)}`,
      value: state.price,
      time: now,
    });
  }

  if (state.totalVolume > 900) {
    alerts.push({
      level: "WARNING",
      market: "FLOOR",
      message: `Near settlement threshold: ${state.totalVolume}/1000`,
      value: state.totalVolume,
      time: now,
    });
  }

  if (state.queueSize > 50) {
    alerts.push({
      level: "INFO",
      market: "FLOOR",
      message: `Deep queue: ${state.queueSize} traders`,
      value: state.queueSize,
      time: now,
    });
  }

  if (liquidationCheck()) {
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: `LIQUIDATION ZONE — Price ${state.price.toFixed(4)} with ${state.queueSize} in queue`,
      value: state.price,
      time: now,
    });
  }

  let engineHealth: MonitorSnapshot["engineHealth"] = "HEALTHY";
  if (state.price < 0.05 || liquidationCheck()) {
    engineHealth = "CRITICAL";
  } else if (state.price < 0.20 || state.totalVolume > 900) {
    engineHealth = "WARNING";
  }
  const stopCheck = liveEngine.safeStop();
  if (stopCheck.stopped) {
    engineHealth = "HALTED";
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: "ENGINE HALTED — Safe stop triggered",
      value: state.price,
      time: now,
    });
  }

  const cycleProgress = state.totalVolume / liveEngine.targetVolume;

  return {
    totalMarkets: 1,
    activeMarkets: state.totalVolume > 0 ? 1 : 0,
    totalVolume: state.totalVolume,
    avgPrice: state.price,
    alerts,
    engineHealth,
    queueDepth: state.queueSize,
    cycleProgress: parseFloat(Math.min(cycleProgress, 1).toFixed(4)),
    kineticPulse: kinetic.pulse,
    cash: state.cash,
    queue: liveEngine.queue.slice(0, 50).map((q, i) => ({
      position: i + 1,
      userId: q.userId.slice(0, 8) + "...",
      amount: q.amount,
      age: Math.floor((now - q.timestamp) / 1000),
      status: q.status,
    })),
    time: now,
  };
}

setInterval(() => {
  if (engineIO) {
    const snapshot = buildMonitor();
    engineIO.emit("monitor", snapshot);

    if (snapshot.alerts.some(a => a.level === "CRITICAL")) {
      for (const alert of snapshot.alerts.filter(a => a.level === "CRITICAL")) {
        console.log(`[MONITOR] ${alert.level}: ${alert.message}`);
      }
    }
  }
}, 1000);

export {
  POOL_CEILING, FLOOR_SPLIT, CEO_SPLIT, TRUST_VAULT_SPLIT_TIERS,
  PORTALS, DEFAULT_PORTALS, SETTLEMENT_CYCLE_THRESHOLD,
  PRICE_TIERS, RISK_PROFILES, VALID_ENTRIES,
  getKineticState, setKineticBias, getKineticBias, getKineticSplit, refreshSplitFromKinetic,
  MarketEngine, liveEngine, setEngineIO, getEngineIO,
  logEvent, getEventLog,
  addPosition, getPortfolioValue, getPortfolio,
  computeGlobalIndex, buildMonitor,
  safeExecute, enterSafe, clampPrice, emergencyReset, liquidationCheck,
  generateOrderBook, saveState, loadState, saveAudit,
};
