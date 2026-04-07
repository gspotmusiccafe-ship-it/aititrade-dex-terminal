import { db } from "./db";
import { tracks, orders, portalSettings, settlementQueue, settlementCycles } from "@shared/schema";
import { desc, sql, eq, asc, and, inArray, isNotNull } from "drizzle-orm";

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
    status: currentFloorTotal >= portal.pool ? "SETTLED" as const : "QUEUED" as const,
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
  cashTag: string | null;
  trackId: string;
  buyIn: number;
  portalName: string;
  baseMbb: number;
  lockedMbbp: number;
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
  lockedMbbpPrice?: number,
  cashTag?: string,
): Promise<void> {
  const portal = getPortalForPrice(buyIn);
  const liveMbbp = lockedMbbpPrice || liveEngine.mbbp;
  const settlementOffer = parseFloat((buyIn * liveMbbp).toFixed(2));
  const multiplier = parseFloat(liveMbbp.toFixed(4));

  const [maxPos] = await db.select({
    maxPos: sql<string>`COALESCE(MAX(queue_position), 0)`,
  }).from(settlementQueue).where(
    inArray(settlementQueue.status, ["QUEUED", "OFFERED"])
  );
  const nextPos = parseInt(maxPos?.maxPos || "0") + 1;

  await db.insert(settlementQueue).values({
    orderId,
    userId,
    cashTag: cashTag || null,
    trackId,
    buyIn: buyIn.toString(),
    portalName: portal.name,
    baseMbb: portal.mbb.toString(),
    lockedMbbp: liveMbbp.toFixed(4),
    currentOffer: settlementOffer.toString(),
    currentMultiplier: multiplier.toString(),
    cyclesHeld: 0,
    status: "QUEUED",
    queuePosition: nextPos,
  });

  console.log(`[GOVERNOR] Trader enqueued: Order ${orderId} | BuyIn: $${buyIn} | Portal: ${portal.name} | Position: #${nextPos} | LOCKED MBBP: $${liveMbbp.toFixed(4)} | Settle At: $${settlementOffer} | CashTag: ${cashTag || "NONE"}`);
}

export async function getGrossIntake(): Promise<number> {
  const [result] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
  }).from(orders).where(
    and(
      isNotNull(orders.buyerEmail),
      sql`${orders.buyerEmail} != ''`,
      inArray(orders.status, ["confirmed", "settled", "settled_early"])
    )
  );
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
  return parseFloat(Math.max(0, grossIntake - totalPaid).toFixed(2));
}

export async function getCompletedCycleCount(): Promise<number> {
  const [result] = await db.select({
    cnt: sql<string>`COALESCE(MAX(cycle_number), 0)`,
  }).from(settlementCycles);
  return parseInt(result?.cnt || "0");
}

export async function runSettlementCycle(forceAdmin: boolean = false): Promise<{
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
  const split = getLiveSplit();

  const alreadyPaid = await getTotalPaidOut();
  const floorPoolTotal = parseFloat((grossIntake * split.floor).toFixed(2));
  let payoutBudget = parseFloat((floorPoolTotal - alreadyPaid).toFixed(2));

  if (payoutBudget <= 0) {
    console.log(`[GOVERNOR] Cycle #${cycleNumber} — No payout budget. Gross: $${grossIntake.toFixed(2)} | Floor Pool: $${floorPoolTotal.toFixed(2)} | Already paid: $${alreadyPaid.toFixed(2)}`);
    return { cycleNumber, settled: [], holding: [], payoutBudget: 0, totalPaidOut: 0 };
  }

  console.log(`[GOVERNOR] Admin cycle #${cycleNumber} — Floor Pool: $${floorPoolTotal.toFixed(2)} | Already Paid: $${alreadyPaid.toFixed(2)} | Budget: $${payoutBudget.toFixed(2)}`);

  const closingSplit = getLiveSplit();
  console.log(`[GOVERNOR] Cycle #${cycleNumber} | Gross: $${grossIntake.toFixed(2)} | ${totalKsReached}K | KINETIC SPLIT: ${Math.round(closingSplit.floor*100)}/${Math.round(closingSplit.ceo*100)} | Payout/K: $${lockedPayout} | Paid: $${alreadyPaid.toFixed(2)} | Budget: $${payoutBudget.toFixed(2)}`);

  const queued = await db.select().from(settlementQueue)
    .where(inArray(settlementQueue.status, ["QUEUED", "OFFERED"]))
    .orderBy(asc(settlementQueue.queuePosition));

  let remaining = payoutBudget;
  const settled: { userId: string; payout: number; multiplier: number }[] = [];
  const holding: string[] = [];
  let totalPaidOut = 0;

  for (const entry of queued) {
    const buyIn = parseFloat(entry.buyIn || "0");
    const locked = parseFloat(entry.lockedMbbp || entry.currentMultiplier || "1.25");
    const offerAmount = parseFloat((buyIn * locked).toFixed(2));

    if (remaining <= 0 || offerAmount > remaining) {
      await db.update(settlementQueue).set({
        status: "QUEUED",
        currentMultiplier: locked.toFixed(2),
        currentOffer: offerAmount.toFixed(2),
        cyclesHeld: (entry.cyclesHeld || 0) + 1,
      }).where(eq(settlementQueue.id, entry.id));
      holding.push(entry.userId);
      console.log(`[GOVERNOR] HOLD: ${entry.userId} | #${entry.queuePosition} | $${buyIn} × ${locked}x = $${offerAmount} | Budget: $${remaining.toFixed(2)} — waiting for volume`);
      continue;
    }

    await db.update(settlementQueue).set({
      status: "SETTLED",
      acceptedMultiplier: locked.toFixed(2),
      payoutAmount: offerAmount.toFixed(2),
      currentOffer: offerAmount.toFixed(2),
      currentMultiplier: locked.toFixed(2),
      cyclesHeld: (entry.cyclesHeld || 0) + 1,
      settledAt: new Date(),
    }).where(eq(settlementQueue.id, entry.id));

    remaining = parseFloat((remaining - offerAmount).toFixed(2));
    totalPaidOut = parseFloat((totalPaidOut + offerAmount).toFixed(2));
    settled.push({ userId: entry.userId, payout: offerAmount, multiplier: locked });
    console.log(`[GOVERNOR] SETTLED: ${entry.userId} | #${entry.queuePosition} | $${buyIn} × LOCKED ${locked}x = $${offerAmount} | Budget: $${remaining.toFixed(2)}`);
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
  const locked = parseFloat(entry.lockedMbbp || entry.currentMultiplier || "1.25");
  const offerAmount = parseFloat((buyIn * locked).toFixed(2));

  const grossIntake = await getGrossIntake();
  const totalKsReached = Math.floor(grossIntake / SETTLEMENT_CYCLE_THRESHOLD);
  const totalPayoutBudget = totalKsReached * getPayoutPerCycle();
  const alreadyPaid = await getTotalPaidOut();
  const available = parseFloat((totalPayoutBudget - alreadyPaid).toFixed(2));

  if (offerAmount > available) {
    return {
      success: false,
      message: `Fund has $${available.toFixed(2)} available. Your locked offer is $${offerAmount.toFixed(2)}. Hold for next cycle — budget replenishes when gross hits $${((totalKsReached + 1) * SETTLEMENT_CYCLE_THRESHOLD).toLocaleString()}.`,
    };
  }

  await db.update(settlementQueue).set({
    status: "SETTLED",
    acceptedMultiplier: locked.toFixed(2),
    payoutAmount: offerAmount.toFixed(2),
    currentOffer: offerAmount.toFixed(2),
    currentMultiplier: locked.toFixed(2),
    settledAt: new Date(),
  }).where(eq(settlementQueue.id, queueId));

  console.log(`[GOVERNOR] TRADER ACCEPTED: ${userId} | $${buyIn} × LOCKED ${locked}x = $${offerAmount} | Fund remaining: $${(available - offerAmount).toFixed(2)}`);

  return {
    success: true,
    payout: offerAmount,
    multiplier: locked,
    message: `SETTLED — $${offerAmount.toFixed(2)} at ${locked}x. Payout via $AITITRADEBROKERAGE.`,
  };
}

export async function traderDiscountSell(queueId: string, userId: string, discountRate?: number): Promise<{
  success: boolean;
  discountMultiplier?: number;
  discountOffer?: number;
  message: string;
}> {
  const [entry] = await db.select().from(settlementQueue)
    .where(and(eq(settlementQueue.id, queueId), eq(settlementQueue.userId, userId)));

  if (!entry) return { success: false, message: "Position not found" };
  if (entry.status === "SETTLED") return { success: false, message: "Already settled" };

  const buyIn = parseFloat(entry.buyIn || "0");
  const currentMult = parseFloat(entry.lockedMbbp || entry.currentMultiplier || "1.25");
  const rate = discountRate || Math.max(0.5, currentMult * 0.85);
  const discountAmount = parseFloat((buyIn * rate).toFixed(2));

  await db.update(settlementQueue).set({
    lockedMbbp: rate.toFixed(4),
    currentOffer: discountAmount.toString(),
    currentMultiplier: rate.toFixed(4),
    queuePosition: 0,
    status: "QUEUED",
  }).where(eq(settlementQueue.id, queueId));

  console.log(`[GOVERNOR] DISCOUNT SELL: ${userId} | ${currentMult}x → ${rate.toFixed(4)}x DISCOUNT | $${buyIn} → $${discountAmount} | QUEUED FIRST`);

  return {
    success: true,
    discountMultiplier: rate,
    discountOffer: discountAmount,
    message: `DISCOUNT SELL — ${rate.toFixed(4)}x locked. $${discountAmount.toFixed(2)} queued FIRST for settlement.`,
  };
}

export async function getTraderPositions(userId: string): Promise<SettlementOffer[]> {
  const positions = await db.select().from(settlementQueue)
    .where(and(
      eq(settlementQueue.userId, userId),
      inArray(settlementQueue.status, ["QUEUED", "OFFERED"])
    ))
    .orderBy(asc(settlementQueue.queuePosition));

  return positions.map(p => {
    const buyIn = parseFloat(p.buyIn || "0");
    const baseMbb = parseFloat(p.baseMbb || "3.00");
    const locked = parseFloat(p.lockedMbbp || p.currentMultiplier || "1.25");
    return {
      queueId: p.id,
      orderId: p.orderId,
      userId: p.userId,
      cashTag: p.cashTag || null,
      trackId: p.trackId,
      buyIn,
      portalName: p.portalName || "NANO_SAFE",
      baseMbb,
      lockedMbbp: locked,
      currentMultiplier: locked,
      currentOffer: parseFloat((buyIn * locked).toFixed(2)),
      maxPayout: parseFloat((buyIn * locked).toFixed(2)),
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
  floorPoolTotal: number;
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
  const dashSplit = getLiveSplit();
  const floorPoolTotal = parseFloat((grossIntake * dashSplit.floor).toFixed(2));
  const fundAvailable = parseFloat(Math.max(0, grossIntake - totalPaid).toFixed(2));
  const ceo46Total = parseFloat((grossIntake * dashSplit.ceo).toFixed(2));
  const nextKAt = (ksReached + 1) * SETTLEMENT_CYCLE_THRESHOLD;

  const [counts] = await db.select({
    total: sql<string>`COUNT(*)`,
    queued: sql<string>`SUM(CASE WHEN status IN ('QUEUED','OFFERED') THEN 1 ELSE 0 END)`,
    discountQueued: sql<string>`SUM(CASE WHEN queue_position = 0 AND status = 'QUEUED' THEN 1 ELSE 0 END)`,
    settled: sql<string>`SUM(CASE WHEN status = 'SETTLED' THEN 1 ELSE 0 END)`,
  }).from(settlementQueue);

  const completedCycles = await getCompletedCycleCount();

  const recentSettled = await db.select().from(settlementQueue)
    .where(eq(settlementQueue.status, "SETTLED"))
    .orderBy(desc(settlementQueue.settledAt))
    .limit(10);

  const topQueued = await db.select().from(settlementQueue)
    .where(inArray(settlementQueue.status, ["QUEUED", "OFFERED"]))
    .orderBy(asc(settlementQueue.queuePosition))
    .limit(20);

  const mapEntry = (p: any): SettlementOffer => {
    const buyIn = parseFloat(p.buyIn || "0");
    const baseMbb = parseFloat(p.baseMbb || "3.00");
    const locked = parseFloat(p.lockedMbbp || p.currentMultiplier || "1.25");
    return {
      queueId: p.id,
      orderId: p.orderId,
      userId: p.userId,
      cashTag: p.cashTag || null,
      trackId: p.trackId,
      buyIn,
      portalName: p.portalName || "NANO_SAFE",
      baseMbb,
      lockedMbbp: locked,
      currentMultiplier: locked,
      currentOffer: parseFloat((buyIn * locked).toFixed(2)),
      maxPayout: parseFloat((buyIn * locked).toFixed(2)),
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
    fundAvailable,
    floorPoolTotal,
    payoutPerK: getPayoutPerCycle(),
    totalTraders: parseInt(counts?.total || "0"),
    queuedCount: parseInt(counts?.queued || "0"),
    discountQueuedCount: parseInt(counts?.discountQueued || "0"),
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
let frozenSplit: { floor: number; house: number; pulse: string } | null = null;

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
  if (frozenSplit) {
    return { floorROI: frozenSplit.floor, houseMBBP: frozenSplit.house, pulse: frozenSplit.pulse, bias: adminBias, frozen: true };
  }
  const splits = adminBias === "FLOOR_HEAVY" ? KINETIC_SPLITS_HEAVY : KINETIC_SPLITS;
  const cycleIndex = Math.floor(Date.now() / 10000) % splits.length;
  const current = splits[cycleIndex];
  return { floorROI: current.floor, houseMBBP: current.house, pulse: current.pulse, bias: adminBias, frozen: false };
}

function freezeKineticSplit() {
  const state = getKineticState();
  frozenSplit = { floor: state.floorROI, house: state.houseMBBP, pulse: state.pulse };
  console.log(`[KINETIC] FROZEN at ${Math.round(frozenSplit.floor * 100)}/${Math.round(frozenSplit.house * 100)}`);
  return frozenSplit;
}

function unfreezeKineticSplit() {
  frozenSplit = null;
  console.log(`[KINETIC] UNFROZEN — oscillator live`);
}

function isKineticFrozen() {
  return frozenSplit !== null;
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
  queue: Array<{
    userId: string;
    amount: number;
    entryPrice: number;
    timestamp: number;
    status: "holding" | "discount_exit" | "settled" | "rollover";
    discountPrice?: number;
    discountAcceptedAt?: number;
    isRollover?: boolean;
    rolloverWeight?: number;
    originalCycle?: number;
  }>;
  floorPercent: number;
  housePercent: number;
  cycle: number;
  cash: { deposits: number; entries: number; totalIn: number; lastDeposit: number; lastEntry: number };
  settled: boolean;
  marketOpen: boolean;
  mbbp: number;
  discountOffer: number;
  closePrice: number;
  minMBBP: number;

  constructor() {
    this.P_current = 0.01;
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
    this.marketOpen = true;
    this.mbbp = 1.01;
    this.discountOffer = 0;
    this.closePrice = 0;
    this.minMBBP = 1.01;
  }

  private bounceDir: number = 1;
  private bounceTicks: number = 0;
  private spikeActive: boolean = false;
  private spikePeak: number = 0;
  private spikeDecay: number = 0;
  private basePrice: number = 0.01;
  private idleTicks: number = 0;

  updatePrice(): number {
    if (!this.marketOpen) return this.P_current;

    const fillRatio = this.totalVolume / this.targetVolume;

    if (this.spikeActive) {
      this.spikeDecay++;
      if (this.spikeDecay >= 2 + Math.floor(Math.random() * 4)) {
        const dropSpeed = 0.15 + Math.random() * 0.35;
        this.P_current -= (this.P_current - this.basePrice) * dropSpeed;
        if (this.P_current <= this.basePrice + 0.02) {
          this.P_current = this.basePrice + Math.random() * 0.02;
          this.spikeActive = false;
          this.idleTicks = 0;
        }
      } else {
        const wobble = (Math.random() - 0.5) * 0.04;
        this.P_current = this.spikePeak + wobble;
      }
    } else {
      this.idleTicks++;
      const microJitter = (Math.random() - 0.5) * 0.008;
      this.P_current = this.basePrice + Math.abs(microJitter);

      const spikeChance = Math.random();
      const spikeThreshold = this.idleTicks < 5 ? 0.92 : this.idleTicks < 15 ? 0.82 : 0.70;

      if (spikeChance > spikeThreshold) {
        const spikeType = Math.random();
        let spikeHeight: number;
        if (spikeType < 0.40) {
          spikeHeight = 0.03 + Math.random() * 0.08;
        } else if (spikeType < 0.70) {
          spikeHeight = 0.10 + Math.random() * 0.20;
        } else if (spikeType < 0.90) {
          spikeHeight = 0.25 + Math.random() * 0.35;
        } else {
          spikeHeight = 0.50 + Math.random() * 0.50;
        }
        this.P_current = this.basePrice + spikeHeight;
        this.spikePeak = this.P_current;
        this.spikeActive = true;
        this.spikeDecay = 0;
      }
    }

    if (this.P_current < 0.01) this.P_current = 0.01;
    if (this.P_current > 1.00) this.P_current = 1.00;

    this.mbbp = parseFloat((1.00 + this.P_current).toFixed(4));
    if (this.mbbp < this.minMBBP) this.mbbp = this.minMBBP;

    const discountPct = 0.15 + fillRatio * 0.10 + Math.random() * 0.05;
    this.discountOffer = parseFloat(Math.max(this.minMBBP, this.mbbp * (1 - discountPct)).toFixed(4));

    return this.P_current;
  }

  enterMarket(userId: string, amount: number = 1): number {
    logEvent("BUY", { userId, amount, price: this.P_current, mbbp: this.mbbp });
    this.queue.push({
      userId,
      amount,
      entryPrice: this.P_current,
      timestamp: Date.now(),
      status: "holding",
    });
    this.totalVolume += amount;
    this.demand += amount;
    this.cash.entries += amount;
    this.cash.totalIn += amount;
    this.cash.lastEntry = Date.now();
    return this.queue.length;
  }

  acceptDiscount(userId: string): { ok: boolean; payout: number; discountPrice: number; error?: string } {
    const idx = this.queue.findIndex(q => q.userId === userId && q.status === "holding");
    if (idx === -1) return { ok: false, payout: 0, discountPrice: 0, error: "NOT_IN_QUEUE" };

    const trader = this.queue[idx];
    trader.status = "discount_exit";
    trader.discountPrice = this.discountOffer;
    trader.discountAcceptedAt = Date.now();

    const payout = parseFloat((trader.amount * this.discountOffer).toFixed(2));

    this.queue.splice(idx, 1);
    this.queue.unshift(trader);

    logEvent("DISCOUNT_EXIT_QUEUED", { userId, discountPrice: this.discountOffer, expectedPayout: payout, mbbp: this.mbbp });
    return { ok: true, payout, discountPrice: this.discountOffer };
  }

  recordDeposit(amount: number): void {
    this.cash.deposits += amount;
    this.cash.totalIn += amount;
    this.cash.lastDeposit = Date.now();
    logEvent("DEPOSIT", { amount, totalDeposits: this.cash.deposits, totalIn: this.cash.totalIn });
  }

  closeMarket(): {
    cycle: number;
    closePrice: number;
    mbbp: number;
    floorPool: number;
    housePool: number;
    queueSize: number;
  } {
    this.marketOpen = false;
    this.closePrice = this.P_current;
    this.mbbp = parseFloat((1.00 + this.closePrice).toFixed(4));
    if (this.mbbp < this.minMBBP) this.mbbp = this.minMBBP;

    const floorPool = parseFloat((this.totalVolume * this.floorPercent).toFixed(2));
    const housePool = parseFloat((this.totalVolume * this.housePercent).toFixed(2));

    logEvent("MARKET_CLOSE", {
      cycle: this.cycle,
      closePrice: this.closePrice,
      mbbp: this.mbbp,
      floorPool, housePool,
      queueSize: this.queue.length,
    });

    return {
      cycle: this.cycle,
      closePrice: this.closePrice,
      mbbp: this.mbbp,
      floorPool,
      housePool,
      queueSize: this.queue.length,
    };
  }

  settleQueue(): Array<{ userId: string; amount: number; payout: number; type: "discount" | "mbbp"; position: number }> {
    const floorPool = this.totalVolume * this.floorPercent;
    let remaining = floorPool;
    const payouts: Array<{ userId: string; amount: number; payout: number; type: "discount" | "mbbp"; position: number }> = [];

    const sorted = [...this.queue].sort((a, b) => {
      if (a.status === "discount_exit" && b.status !== "discount_exit") return -1;
      if (b.status === "discount_exit" && a.status !== "discount_exit") return 1;
      if (a.isRollover && !b.isRollover) return -1;
      if (b.isRollover && !a.isRollover) return 1;
      return a.timestamp - b.timestamp;
    });

    for (let i = 0; i < sorted.length; i++) {
      const trader = sorted[i];
      if (remaining <= 0) break;

      let payout: number;
      let type: "discount" | "mbbp";

      if (trader.status === "discount_exit" && trader.discountPrice) {
        payout = parseFloat((trader.amount * trader.discountPrice).toFixed(2));
        type = "discount";
      } else {
        payout = parseFloat((trader.amount * this.mbbp).toFixed(2));
        type = "mbbp";
      }

      if (payout > remaining) {
        break;
      }
      remaining -= payout;

      trader.status = "settled";
      payouts.push({ userId: trader.userId, amount: trader.amount, payout, type, position: i + 1 });
    }

    return payouts;
  }

  getRolloverPositions(): Array<{ userId: string; amount: number; unpaid: number; originalCycle: number }> {
    const settled = new Set(this.queue.filter(q => q.status === "settled").map(q => q.userId + q.timestamp));
    const unsettled = this.queue.filter(q => {
      const key = q.userId + q.timestamp;
      return !settled.has(key) && q.status !== "settled";
    });

    const MIN_WEIGHT = 0.10;

    return unsettled
      .map(q => {
        const expectedPayout = q.status === "discount_exit" && q.discountPrice
          ? q.amount * q.discountPrice
          : q.amount * this.mbbp;
        return {
          userId: q.userId,
          amount: q.amount,
          unpaid: parseFloat(expectedPayout.toFixed(2)),
          originalCycle: q.originalCycle || this.cycle,
        };
      })
      .filter(r => r.unpaid >= MIN_WEIGHT);
  }

  resetCycle(): void {
    const rollovers = this.getRolloverPositions();

    settlementHistory.push({
      cycle: this.cycle,
      closePrice: this.closePrice,
      mbbp: this.mbbp,
      floorPool: parseFloat((this.totalVolume * this.floorPercent).toFixed(2)),
      housePool: parseFloat((this.totalVolume * this.housePercent).toFixed(2)),
      traders: this.queue.length,
      rolloverCount: rollovers.length,
      time: Date.now(),
    });
    if (settlementHistory.length > 20) settlementHistory.shift();

    this.P_current = 0.01;
    this.totalVolume = 0;
    this.demand = 0;
    this.supply = 0;
    this.cycle += 1;
    this.settled = false;
    this.marketOpen = true;
    this.mbbp = 1.01;
    this.discountOffer = 0;
    this.closePrice = 0;

    this.queue = rollovers.map(r => {
      const weight = parseFloat((r.unpaid / 1.0).toFixed(2));
      return {
        userId: r.userId,
        amount: weight,
        entryPrice: 0.01,
        timestamp: Date.now() - 1,
        status: "holding" as const,
        isRollover: true,
        rolloverWeight: weight,
        originalCycle: r.originalCycle,
      };
    });

    if (rollovers.length > 0) {
      console.log(`[ENGINE] Rolled over ${rollovers.length} positions into cycle ${this.cycle}`);
      logEvent("ROLLOVER", { count: rollovers.length, fromCycle: this.cycle - 1, toCycle: this.cycle });
    }
  }

  adjustBalance(floorPercent: number): void {
    if (floorPercent < 0.5) floorPercent = 0.5;
    if (floorPercent > 0.9) floorPercent = 0.9;
    this.floorPercent = floorPercent;
    this.housePercent = 1 - floorPercent;
  }

  safeStop(threshold: number = 0.005): { stopped: boolean; price: number } {
    if (this.P_current <= threshold) {
      this.marketOpen = false;
      return { stopped: true, price: this.P_current };
    }
    return { stopped: false, price: this.P_current };
  }

  getState() {
    return {
      price: parseFloat(this.P_current.toFixed(4)),
      mbbp: parseFloat(this.mbbp.toFixed(4)),
      discountOffer: parseFloat(this.discountOffer.toFixed(4)),
      marketOpen: this.marketOpen,
      closePrice: parseFloat(this.closePrice.toFixed(4)),
      totalVolume: parseFloat(this.totalVolume.toFixed(2)),
      targetVolume: this.targetVolume,
      demand: this.demand,
      supply: this.supply,
      floorPercent: this.floorPercent,
      housePercent: this.housePercent,
      floorPool: parseFloat((this.totalVolume * this.floorPercent).toFixed(2)),
      housePool: parseFloat((this.totalVolume * this.housePercent).toFixed(2)),
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

let settlementHistory: Array<{ cycle: number; closePrice: number; mbbp: number; floorPool: number; housePool: number; traders: number; rolloverCount?: number; time: number }> = [];

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
      marketOpen: liveEngine.marketOpen,
      mbbp: liveEngine.mbbp,
      closePrice: liveEngine.closePrice,
      settled: liveEngine.settled,
      queue: liveEngine.queue,
      wallets,
      settlementHistory,
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
    if (typeof data.P_current === "number") liveEngine.P_current = data.P_current;
    if (typeof data.totalVolume === "number") liveEngine.totalVolume = data.totalVolume;
    if (data.cycle) liveEngine.cycle = data.cycle;
    if (typeof data.demand === "number") liveEngine.demand = data.demand;
    if (typeof data.supply === "number") liveEngine.supply = data.supply;
    if (typeof data.marketOpen === "boolean") liveEngine.marketOpen = data.marketOpen;
    if (typeof data.mbbp === "number") liveEngine.mbbp = data.mbbp;
    if (typeof data.closePrice === "number") liveEngine.closePrice = data.closePrice;
    if (typeof data.settled === "boolean") liveEngine.settled = data.settled;
    if (data.cash) {
      liveEngine.cash = {
        deposits: data.cash.deposits || 0,
        entries: data.cash.entries || 0,
        totalIn: data.cash.totalIn || 0,
        lastDeposit: data.cash.lastDeposit || 0,
        lastEntry: data.cash.lastEntry || 0,
      };
    }
    if (Array.isArray(data.queue) && data.queue.length > 0) {
      liveEngine.queue = data.queue;
      console.log(`[ENGINE] Restored ${data.queue.length} queue positions`);
    }
    if (data.wallets && typeof data.wallets === "object") {
      for (const [userId, w] of Object.entries(data.wallets)) {
        wallets[userId] = w as Wallet;
      }
      console.log(`[ENGINE] Restored ${Object.keys(data.wallets).length} wallets`);
    }
    if (Array.isArray(data.settlementHistory)) {
      settlementHistory = data.settlementHistory;
    }
    if (liveEngine.settled && !liveEngine.marketOpen) {
      console.log(`[ENGINE] Detected stuck settlement state — auto-resetting cycle`);
      liveEngine.resetCycle();
    }
    console.log(`[ENGINE] State restored — Cycle: ${liveEngine.cycle}, Price: $${liveEngine.P_current.toFixed(4)}, MBBP: $${liveEngine.mbbp.toFixed(4)}, Market: ${liveEngine.marketOpen ? "OPEN" : "CLOSED"}, Queue: ${liveEngine.queue.length}`);
  } catch (e) {
    console.error("[ENGINE] State load error:", e);
  }
}

loadState();
setInterval(saveState, 5000);

let eventLog: Array<{ id: string; type: string; payload: any; time: number }> = [];

function loadAudit(): void {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return;
    const data = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf-8"));
    if (Array.isArray(data) && data.length > 0) {
      eventLog = data.slice(-5000);
      console.log(`[ENGINE] Restored ${eventLog.length} audit events`);
    }
  } catch (e) {
    console.error("[ENGINE] Audit load error:", e);
  }
}

loadAudit();

function saveAudit(): void {
  try {
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(eventLog, null, 2));
  } catch (e) {
    console.error("[ENGINE] Audit save error:", e);
  }
}

setInterval(saveAudit, 5000);

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

interface WalletEntry {
  type: "DEPOSIT" | "ENTRY" | "PAYOUT" | "WITHDRAWAL";
  amount: number;
  time: number;
  meta?: string;
}

interface Wallet {
  balance: number;
  deposited: number;
  withdrawn: number;
  earned: number;
  history: WalletEntry[];
}

const wallets: Record<string, Wallet> = {};

function getWallet(userId: string): Wallet {
  if (!wallets[userId]) {
    wallets[userId] = { balance: 0, deposited: 0, withdrawn: 0, earned: 0, history: [] };
  }
  return wallets[userId];
}

function recordWalletDeposit(userId: string, amount: number): Wallet {
  const w = getWallet(userId);
  w.balance += amount;
  w.deposited += amount;
  w.history.push({ type: "DEPOSIT", amount, time: Date.now() });
  liveEngine.recordDeposit(amount);
  logEvent("WALLET_DEPOSIT", { userId, amount, balance: w.balance });
  return w;
}

function recordWalletEntry(userId: string, amount: number): Wallet {
  const w = getWallet(userId);
  w.balance -= amount;
  w.history.push({ type: "ENTRY", amount, time: Date.now() });
  logEvent("WALLET_ENTRY", { userId, amount, balance: w.balance });
  return w;
}

function recordWalletPayout(userId: string, amount: number, meta?: string): Wallet {
  const w = getWallet(userId);
  w.balance += amount;
  w.earned += amount;
  w.history.push({ type: "PAYOUT", amount, time: Date.now(), meta });
  logEvent("WALLET_PAYOUT", { userId, amount, balance: w.balance, meta });
  return w;
}

function recordWalletWithdrawal(userId: string, amount: number): Wallet | null {
  const w = getWallet(userId);
  if (w.balance < amount) return null;
  w.balance -= amount;
  w.withdrawn += amount;
  w.history.push({ type: "WITHDRAWAL", amount, time: Date.now() });
  logEvent("WALLET_WITHDRAWAL", { userId, amount, balance: w.balance });
  return w;
}

function getWalletSummary(userId: string) {
  const w = getWallet(userId);
  return {
    balance: parseFloat(w.balance.toFixed(2)),
    deposited: parseFloat(w.deposited.toFixed(2)),
    withdrawn: parseFloat(w.withdrawn.toFixed(2)),
    earned: parseFloat(w.earned.toFixed(2)),
    transactions: w.history.length,
    recentHistory: w.history.slice(-20),
  };
}

function getGlobalWalletSummary() {
  let totalBalance = 0, totalDeposited = 0, totalEarned = 0, totalWithdrawn = 0, walletCount = 0;
  for (const userId of Object.keys(wallets)) {
    const w = wallets[userId];
    totalBalance += w.balance;
    totalDeposited += w.deposited;
    totalEarned += w.earned;
    totalWithdrawn += w.withdrawn;
    walletCount++;
  }
  return {
    walletCount,
    totalBalance: parseFloat(totalBalance.toFixed(2)),
    totalDeposited: parseFloat(totalDeposited.toFixed(2)),
    totalEarned: parseFloat(totalEarned.toFixed(2)),
    totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
    netFlow: parseFloat((totalDeposited - totalWithdrawn).toFixed(2)),
  };
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

function enterSafe(userId: string, amount: number = 1): { ok: boolean; position?: number; error?: string } {
  if (queueLock) return { ok: false, error: "QUEUE_LOCKED" };
  if (!liveEngine.marketOpen) return { ok: false, error: "MARKET_CLOSED" };

  const w = getWallet(userId);
  if (w.balance < amount) {
    return { ok: false, error: "INSUFFICIENT_FUNDS" };
  }

  queueLock = true;
  recordWalletEntry(userId, amount);
  const pos = liveEngine.enterMarket(userId, amount);
  addPosition(userId, amount, liveEngine.P_current);
  queueLock = false;

  logEvent("market_enter", { userId, amount, position: pos, price: liveEngine.P_current, mbbp: liveEngine.mbbp, walletBalance: w.balance });
  return { ok: true, position: pos };
}

function clampPrice(): void {
  if (liveEngine.P_current < 0.01) liveEngine.P_current = 0.01;
  if (liveEngine.P_current > 1.00) liveEngine.P_current = 1.00;
}

function emergencyReset(): void {
  logEvent("emergency_reset", { priceBefore: liveEngine.P_current, cycleBefore: liveEngine.cycle, cashSnapshot: { ...liveEngine.cash } });
  liveEngine.queue = [];
  liveEngine.demand = 0;
  liveEngine.supply = 0;
  liveEngine.totalVolume = 0;
  liveEngine.P_current = 0.01;
  liveEngine.marketOpen = true;
  liveEngine.mbbp = 1.01;
  liveEngine.discountOffer = 0;
  liveEngine.closePrice = 0;
  liveEngine.settled = false;
  liveEngine.cash = { deposits: 0, entries: 0, totalIn: 0, lastDeposit: 0, lastEntry: 0 };
  console.log("[ENGINE] EMERGENCY RESET — All positions cleared, price reset to $0.01, market OPEN, cash zeroed");
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

    engineIO.emit("queue_update", {
      marketId: "FLOOR",
      queue: liveEngine.queue.slice(0, 20).map((q, i) => ({
        position: i + 1,
        userId: q.userId,
        amount: q.amount,
        entryPrice: q.entryPrice,
        timestamp: q.timestamp,
        status: q.status,
      })),
      total: liveEngine.queue.length,
    });

    engineIO.emit("mbbp", {
      mbbp: parseFloat(liveEngine.mbbp.toFixed(4)),
      discountOffer: parseFloat(liveEngine.discountOffer.toFixed(4)),
      marketOpen: liveEngine.marketOpen,
      time: Date.now(),
    });

    if (liveEngine.totalVolume >= liveEngine.targetVolume && !liveEngine.settled && liveEngine.marketOpen) {
      liveEngine.settled = true;

      const closeData = liveEngine.closeMarket();
      const payouts = liveEngine.settleQueue();

      payouts.forEach(p => {
        recordWalletPayout(p.userId, p.payout, `Cycle ${liveEngine.cycle} ${p.type === "discount" ? "discount exit" : "MBBP settlement"}`);
      });

      const settlementData = {
        marketId: "FLOOR",
        cycle: closeData.cycle,
        closePrice: closeData.closePrice,
        mbbp: closeData.mbbp,
        floorPool: closeData.floorPool,
        housePool: closeData.housePool,
        queueSize: closeData.queueSize,
        payouts: payouts.map((p, i) => ({ ...p, position: i + 1 })),
        time: Date.now(),
      };

      engineIO.emit("settlement", settlementData);
      logEvent("AUTO_SETTLEMENT", { ...settlementData, payoutCount: payouts.length, totalPaid: payouts.reduce((s, p) => s + p.payout, 0) });
      console.log(`[ENGINE] MARKET CLOSED — Cycle ${closeData.cycle} | Close: $${closeData.closePrice.toFixed(4)} | MBBP: $${closeData.mbbp.toFixed(4)} | Floor: $${closeData.floorPool.toFixed(2)} | House: $${closeData.housePool.toFixed(2)} | Paid: ${payouts.length} traders | Resetting in 5s...`);

      setTimeout(() => {
        liveEngine.resetCycle();
        if (engineIO) {
          engineIO.emit("market_reset", { cycle: liveEngine.cycle, time: Date.now() });
        }
        console.log(`[ENGINE] Market reset — New cycle ${liveEngine.cycle} | Price: $0.01 | Market OPEN`);
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

let lastPriceUpdate = Date.now();
let lastPrice = 0;
let priceStallCount = 0;
let errorLog: Array<{ type: string; message: string; time: number }> = [];

function logError(type: string, message: string) {
  errorLog.push({ type, message, time: Date.now() });
  if (errorLog.length > 100) errorLog.shift();
  console.log(`[MONITOR ERROR] ${type}: ${message}`);
}

function buildMonitor(): MonitorSnapshot {
  const alerts: MonitorAlert[] = [];
  const now = Date.now();
  const state = liveEngine.getState();
  const kinetic = getKineticState();

  if (Math.abs(state.price - lastPrice) > 0.0001) {
    lastPriceUpdate = now;
    lastPrice = state.price;
    priceStallCount = 0;
  } else if (now - lastPriceUpdate > 30000) {
    priceStallCount++;
    alerts.push({
      level: priceStallCount > 5 ? "CRITICAL" : "WARNING",
      market: "FLOOR",
      message: `PRICE STALL: No movement for ${Math.floor((now - lastPriceUpdate) / 1000)}s (count: ${priceStallCount})`,
      value: state.price,
      time: now,
    });
    if (priceStallCount > 5) logError("PRICE_STALL", `Stalled at $${state.price.toFixed(4)} for ${Math.floor((now - lastPriceUpdate) / 1000)}s`);
  }

  const expectedFloor = parseFloat((state.totalVolume * state.floorPercent).toFixed(2));
  const actualFloor = state.floorPool;
  const volumeDiff = Math.abs(expectedFloor - actualFloor);
  if (volumeDiff > 0.50 && state.totalVolume > 10) {
    alerts.push({
      level: volumeDiff > 5 ? "CRITICAL" : "WARNING",
      market: "FLOOR",
      message: `VOLUME MISMATCH: Expected floor $${expectedFloor.toFixed(2)} vs actual $${actualFloor.toFixed(2)} (diff: $${volumeDiff.toFixed(2)})`,
      value: volumeDiff,
      time: now,
    });
    if (volumeDiff > 5) logError("VOLUME_MISMATCH", `Floor pool off by $${volumeDiff.toFixed(2)}`);
  }

  const holdingCount = liveEngine.queue.filter(q => q.status === "holding").length;
  if (liveEngine.queue.length > 0 && holdingCount > 0 && !state.marketOpen) {
    alerts.push({
      level: "WARNING",
      market: "FLOOR",
      message: `QUEUE LOCK: ${liveEngine.queue.length} entries but none queued — market closed`,
      value: liveEngine.queue.length,
      time: now,
    });
    logError("QUEUE_LOCK", `${liveEngine.queue.length} entries stuck, market closed`);
  }

  if (state.price < 0.005) {
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: `CRITICAL LOW PRICE: ${state.price.toFixed(4)}`,
      value: state.price,
      time: now,
    });
  } else if (state.price < 0.005) {
    alerts.push({
      level: "WARNING",
      market: "FLOOR",
      message: `Low price warning: ${state.price.toFixed(4)}`,
      value: state.price,
      time: now,
    });
  }

  if (state.totalVolume >= 950) {
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: `READY TO SETTLE: $${state.totalVolume.toFixed(2)} / $1000 — ${(1000 - state.totalVolume).toFixed(2)} remaining`,
      value: state.totalVolume,
      time: now,
    });
  } else if (state.totalVolume > 800) {
    alerts.push({
      level: "WARNING",
      market: "FLOOR",
      message: `Near settlement: $${state.totalVolume.toFixed(2)} / $1000 (${((state.totalVolume / 1000) * 100).toFixed(1)}%)`,
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

  const depositsVsEntries = state.cash.deposits - state.cash.entries;
  if (depositsVsEntries < -1) {
    alerts.push({
      level: "CRITICAL",
      market: "FLOOR",
      message: `CASH DEFICIT: Entries ($${state.cash.entries.toFixed(2)}) exceed deposits ($${state.cash.deposits.toFixed(2)}) by $${Math.abs(depositsVsEntries).toFixed(2)}`,
      value: depositsVsEntries,
      time: now,
    });
    logError("CASH_DEFICIT", `Entries exceed deposits by $${Math.abs(depositsVsEntries).toFixed(2)}`);
  }

  let engineHealth: MonitorSnapshot["engineHealth"] = "HEALTHY";
  if (state.price < 0.05 || liquidationCheck() || depositsVsEntries < -5) {
    engineHealth = "CRITICAL";
  } else if (state.price < 0.20 || state.totalVolume > 900 || priceStallCount > 3) {
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

  const walletSummary = getGlobalWalletSummary();

  return {
    totalMarkets: 1,
    activeMarkets: state.totalVolume > 0 ? 1 : 0,
    totalVolume: state.totalVolume,
    targetVolume: liveEngine.targetVolume,
    avgPrice: state.price,
    mbbp: state.mbbp,
    discountOffer: state.discountOffer,
    marketOpen: state.marketOpen,
    closePrice: state.closePrice,
    floorPool: state.floorPool,
    housePool: state.housePool,
    floorSplit: state.floorPercent,
    houseSplit: state.housePercent,
    cycle: state.cycle,
    alerts,
    engineHealth,
    queueDepth: state.queueSize,
    cycleProgress: parseFloat(Math.min(cycleProgress, 1).toFixed(4)),
    kineticPulse: kinetic.pulse,
    kineticBias: kinetic.bias,
    kineticFloor: kinetic.floorROI,
    kineticHouse: kinetic.houseMBBP,
    cash: state.cash,
    walletSummary,
    errorLog: errorLog.slice(-20),
    settlementHistory: settlementHistory.slice(-10),
    queue: liveEngine.queue.slice(0, 50).map((q, i) => ({
      position: i + 1,
      userId: q.userId.slice(0, 8) + "...",
      amount: q.amount,
      entryPrice: q.entryPrice,
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
  getKineticState, setKineticBias, getKineticBias, freezeKineticSplit, unfreezeKineticSplit, isKineticFrozen, getKineticSplit, refreshSplitFromKinetic,
  MarketEngine, liveEngine, setEngineIO, getEngineIO,
  logEvent, getEventLog,
  addPosition, getPortfolioValue, getPortfolio,
  getWallet, recordWalletDeposit, recordWalletEntry, recordWalletPayout, recordWalletWithdrawal, getWalletSummary, getGlobalWalletSummary,
  computeGlobalIndex, buildMonitor,
  safeExecute, enterSafe, clampPrice, emergencyReset, liquidationCheck,
  generateOrderBook, saveState, loadState, saveAudit,
};
