import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Shield, DollarSign, TrendingUp, Activity, Loader2, ExternalLink, Zap, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Target, Flame, Globe, Crown, ChevronRight, CheckCircle, Tag, RefreshCw, Lock, Users, Radio } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

const CASH_APP_REFERRAL = "https://cash.app/app/JNXGD73";

function KineticPulseBar() {
  const { data: kState } = useQuery<{
    floorROI: number;
    houseMBBP: number;
    pulse: string;
    bias: string;
  }>({
    queryKey: ["/api/kinetic/state"],
    refetchInterval: 5000,
  });

  if (!kState) return null;
  const isHigh = kState.pulse === "HIGH";

  return (
    <div className="border border-emerald-500/20 bg-black/80 p-2.5 flex items-center justify-between font-mono">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Zap className={`h-3.5 w-3.5 ${isHigh ? "text-emerald-400" : "text-emerald-500/60"}`} />
          <span className="text-[9px] text-emerald-500/60 font-bold">KINETIC</span>
        </div>
        <span className={`text-xs font-black ${isHigh ? "floor-high-pulse" : "text-amber-400"}`}>
          {(kState.floorROI * 100).toFixed(0)}% ROI
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-emerald-500/40">HOUSE: {(kState.houseMBBP * 100).toFixed(0)}%</span>
        <span className={`text-[8px] px-1.5 py-0.5 border font-extrabold ${
          isHigh ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"
        }`} data-testid="badge-kinetic-pulse">{kState.pulse}</span>
      </div>
    </div>
  );
}

interface TraderData {
  trader: {
    id: string;
    username: string;
    profileImage: string | null;
    isAdmin: boolean;
  };
  trust: {
    trustId: string;
    noteAmount: number;
    outstandingBalance: number;
    monthlyCommitment: string;
    monthsRemaining: number;
    isBeneficiary: boolean;
    giftedYield: number;
  } | null;
  positions: Array<{
    id: string;
    trackId: string;
    trackingNumber: string;
    trackTitle: string;
    coverImage: string | null;
    buyIn: number;
    buyBack: number;
    roi: number;
    status: string;
    createdAt: string;
    queueId: string | null;
    queuePosition: number | null;
    queueStatus: string | null;
    currentMultiplier: number | null;
    currentOffer: number | null;
    payoutAmount: number | null;
  }>;
  summary: {
    totalPositions: number;
    totalInvested: number;
    totalBuyBack: number;
    projectedROI: number;
  };
}

interface SettlementStatus {
  grossIntake: number;
  ksReached: number;
  totalOwed54: number;
  totalPaidOut: number;
  fundAvailable: number;
  payoutPerK: number;
  nextKAt: number;
  ceo46Total: number;
}

function PortalBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-black to-lime-950/20" />
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20 animate-pulse"
          style={{
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            background: i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#84cc16' : '#facc15',
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${Math.random() * 2 + 2}s`,
          }}
        />
      ))}
    </div>
  );
}

function LiveIndicator({ label, value, trend, color }: { label: string; value: string; trend?: "up" | "down" | "neutral"; color: string }) {
  return (
    <div className={`relative bg-black/80 border ${color} p-3 overflow-hidden`}>
      <div className="absolute top-0 right-0 w-8 h-8 opacity-5">
        {trend === "up" ? <ArrowUpRight className="w-full h-full" /> : trend === "down" ? <ArrowDownRight className="w-full h-full" /> : <Activity className="w-full h-full" />}
      </div>
      <p className="text-[8px] text-emerald-500/60 font-bold tracking-widest uppercase">{label}</p>
      <p className={`text-lg font-black font-mono mt-0.5 ${
        color.includes("emerald") ? "text-emerald-400" :
        color.includes("lime") ? "text-lime-400" :
        color.includes("amber") ? "text-amber-400" :
        color.includes("red") ? "text-red-400" :
        "text-white"
      }`}>
        {value}
      </p>
      {trend && (
        <div className={`flex items-center gap-0.5 mt-1 ${
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-emerald-500/60"
        }`}>
          {trend === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend === "down" ? <ArrowDownRight className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
          <span className="text-[8px] font-bold">{trend === "up" ? "BULLISH" : trend === "down" ? "BEARISH" : "STABLE"}</span>
        </div>
      )}
    </div>
  );
}

function TraderDesk({ positions, userId }: { positions: TraderData["positions"]; userId: string }) {
  const { toast } = useToast();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [oTick, setOTick] = useState(0);

  const { data: engineState } = useQuery<{ price: number; mbbp: number; marketOpen: boolean }>({
    queryKey: ["/api/engine/state"],
    refetchInterval: 3000,
  });

  useEffect(() => {
    const iv = setInterval(() => setOTick(t => t + 1), 400);
    return () => clearInterval(iv);
  }, []);

  const acceptMut = useMutation({
    mutationFn: async ({ queueId, caughtPrice }: { queueId: string; caughtPrice: number }) => {
      const res = await apiRequest("POST", "/api/settlement/accept", { queueId, caughtPrice });
      const data = await res.json();
      if (data.success === false) throw new Error(data.message || "Position not found");
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: "SETTLED", description: data.message || `Payout: $${data.payout?.toFixed(2)}` });
      queryClient.invalidateQueries({ queryKey: ["/api/trader", userId] });
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast({ title: "FAILED", description: err.message || "Could not accept", variant: "destructive" });
      setPendingAction(null);
    },
  });

  const discountSellMut = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await apiRequest("POST", "/api/trade/execute", { type: "DISCOUNT_SELL", queueId });
      const data = await res.json();
      if (data.success === false) throw new Error(data.message || "Discount sell failed");
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: "DISCOUNT SELL QUEUED", description: data.message || `Queued first for settlement at discount` });
      queryClient.invalidateQueries({ queryKey: ["/api/trader", userId] });
      setPendingAction(null);
    },
    onError: (err: any) => {
      toast({ title: "FAILED", description: err.message || "Could not discount sell", variant: "destructive" });
      setPendingAction(null);
    },
  });

  const activePositions = positions.filter(p => p.queueStatus !== "SETTLED");
  const settledPositions = positions.filter(p => p.queueStatus === "SETTLED");
  const livePrice = engineState?.price || 0;
  const liveMbbp = engineState?.mbbp || 0;

  if (positions.length === 0) {
    return (
      <div className="border border-emerald-500/20 bg-black/80 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 border border-emerald-500/30 flex items-center justify-center bg-emerald-950/30">
          <BarChart3 className="h-8 w-8 text-emerald-500/30" />
        </div>
        <p className="text-white font-black text-lg mb-2" data-testid="text-no-positions">NO POSITIONS YET</p>
        <p className="text-emerald-500/60 text-xs mb-4">Head to the trading floor to acquire your first position</p>
        <Link
          href="/"
          className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 font-black text-sm transition-colors"
          data-testid="link-go-trade"
        >
          <Zap className="h-3.5 w-3.5 inline mr-1.5" />
          GO TO TRADE FLOOR
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-emerald-500/20 bg-black/90 overflow-hidden" style={{ boxShadow: "0 0 20px rgba(16,185,129,0.05)" }}>
        <div className="bg-gradient-to-r from-emerald-950/40 to-black px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-black tracking-wider">TRADER DESK — LIVE POSITIONS</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 6px #34d399" }} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-emerald-500/60 font-mono">PRICE: <span className="text-emerald-400">${livePrice.toFixed(4)}</span></span>
            <span className="text-[9px] text-emerald-500/60 font-mono">MBBP: <span className="text-lime-400">${liveMbbp.toFixed(4)}</span></span>
            <span className="text-emerald-500/40 text-[9px] font-mono">{activePositions.length} ACTIVE</span>
          </div>
        </div>

        <div className="divide-y divide-emerald-500/10">
          {activePositions.map((pos, i) => {
            const isQueued = pos.queueStatus === "QUEUED" || pos.queueStatus === "OFFERED";
            const canTrade = isQueued;
            const isPending = pendingAction === pos.id;
            const seed = (i + 1) * 7919;
            const t = oTick * 0.05;
            const s1 = Math.sin(seed + t * 1.73);
            const s2 = Math.sin(seed * 0.164 + t * 2.91);
            const s3 = Math.sin(seed * 0.538 + t * 0.87);
            const s4 = Math.sin(seed * 1.157 + t * 4.53);
            const raw = s1 * 0.35 + s2 * 0.28 + s3 * 0.22 + s4 * 0.15;
            const spike = s4 > 0.82 ? (s4 - 0.82) * 5.5 : 0;
            const crash = s1 < -0.65 && s2 < -0.1 ? (Math.abs(s1) - 0.65) * 2.8 : 0;
            const engineBias = liveMbbp > 1.0 ? (liveMbbp - 1.0) * 0.3 : 0;
            const pctMove = raw < 0
              ? raw * 0.28 - crash * 0.18
              : raw * 0.55 + spike * 0.50 + engineBias;
            const clampedPct = Math.max(-0.18, Math.min(1.0, pctMove));
            const baseOffer = pos.buyIn;
            const offer = parseFloat((baseOffer * (1 + clampedPct)).toFixed(2));
            const mult = parseFloat(((pos.currentMultiplier || liveMbbp || 1.0) * (1 + clampedPct * 0.35)).toFixed(2));
            const profitLoss = offer - pos.buyIn;
            const roiPct = pos.buyIn > 0 ? Math.abs(profitLoss / pos.buyIn * 100).toFixed(1) : "0";
            const roiPositive = profitLoss >= 0;

            return (
              <div key={pos.id} className="px-4 py-3 hover:bg-emerald-950/10 transition-colors" data-testid={`desk-position-${pos.id}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 relative">
                    {pos.coverImage ? (
                      <img src={pos.coverImage} alt="" className="w-12 h-12 border border-emerald-500/20" />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-950 border border-emerald-500/20 flex items-center justify-center">
                        <Flame className="h-4 w-4 text-emerald-500/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-black truncate">{pos.trackTitle}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-emerald-500/40 text-[9px] font-mono" data-testid={`text-tx-id-${pos.id}`}>ID: {pos.trackingNumber}</span>
                      {pos.queuePosition && (
                        <span className="text-emerald-500/40 text-[8px]">QUEUE #{pos.queuePosition}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right mr-3 grid grid-cols-4 gap-3 items-center font-mono">
                    <div className="text-center">
                      <p className="text-[7px] text-emerald-500/50 font-bold tracking-widest">STATUS</p>
                      <p className="text-cyan-400 text-[10px] font-black" data-testid={`status-${pos.id}`}>QUEUED</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] text-emerald-500/50 font-bold tracking-widest">IN</p>
                      <p className="text-emerald-500/80 text-xs font-black" data-testid={`in-${pos.id}`}>${pos.buyIn.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] text-emerald-500/50 font-bold tracking-widest">LOCKED</p>
                      <p className={`text-xs font-black ${roiPositive ? "text-emerald-400" : "text-red-400"}`} data-testid={`locked-${pos.id}`}>${offer.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] text-emerald-500/50 font-bold tracking-widest">SETTLE</p>
                      <p className="text-emerald-500/40 text-xs font-black" data-testid={`settle-${pos.id}`}>—</p>
                    </div>
                  </div>

                  {canTrade && (
                    <div className="flex-shrink-0 flex gap-1.5">
                      <button
                        onClick={() => { if (pos.queueId) { setPendingAction(pos.id); acceptMut.mutate({ queueId: pos.queueId, caughtPrice: offer }); } }}
                        disabled={isPending || !pos.queueId}
                        className="flex items-center gap-1 px-3 py-2 text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 transition-all disabled:opacity-50"
                        style={{ boxShadow: "0 0 8px rgba(16,185,129,0.3)" }}
                        data-testid={`btn-settle-now-${pos.id}`}
                      >
                        {isPending && acceptMut.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        SETTLE NOW
                      </button>
                      <button
                        onClick={() => { if (pos.queueId) { setPendingAction(pos.id); discountSellMut.mutate(pos.queueId); } }}
                        disabled={isPending || !pos.queueId}
                        className="flex items-center gap-1 px-3 py-2 text-[10px] font-black bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/40 transition-all disabled:opacity-50"
                        data-testid={`btn-discount-sell-${pos.id}`}
                      >
                        {isPending && discountSellMut.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Tag className="h-3 w-3" />}
                        DISCOUNT SELL
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-emerald-500/15 flex items-center justify-between">
          <Link href="/" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors" data-testid="link-buy-more">
            <Zap className="h-3 w-3" /> BUY MORE ON FLOOR <ChevronRight className="h-2.5 w-2.5" />
          </Link>
          <span className="text-[8px] text-emerald-500/40 font-mono">SELL = LOCK VALUE | DISCOUNT SELL = EXIT AT REDUCED RATE</span>
        </div>
      </div>

      {settledPositions.length > 0 && (
        <div className="border border-emerald-500/15 bg-black/60">
          <div className="bg-emerald-950/30 px-4 py-2 border-b border-emerald-500/15 flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-emerald-500/60" />
            <span className="text-emerald-500/60 text-[10px] font-black tracking-wider">SETTLED POSITIONS</span>
            <span className="text-emerald-500/25 text-[9px]">{settledPositions.length}</span>
          </div>
          <div className="divide-y divide-emerald-500/10">
            {settledPositions.map((pos) => (
              <div key={pos.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60" data-testid={`settled-position-${pos.id}`}>
                {pos.coverImage ? (
                  <img src={pos.coverImage} alt="" className="w-8 h-8 border border-emerald-500/15 flex-shrink-0 grayscale" />
                ) : (
                  <div className="w-8 h-8 bg-emerald-950 border border-emerald-500/15 flex-shrink-0 flex items-center justify-center">
                    <Flame className="h-3 w-3 text-emerald-500/25" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-400/70 text-xs font-bold truncate">{pos.trackTitle}</p>
                  <span className="text-emerald-500/25 text-[9px]">{pos.trackingNumber}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-emerald-500/60 text-xs font-bold font-mono">
                    ${(pos.payoutAmount || pos.buyBack).toFixed(2)} PAID
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraderPage() {
  const [, params] = useRoute("/trader/:userId");
  const { user } = useAuth();
  const userId = params?.userId || user?.id || "";

  const { data: trader, isLoading } = useQuery<TraderData>({
    queryKey: ["/api/trader", userId],
    enabled: !!userId,
  });

  const { data: settlementData } = useQuery<SettlementStatus>({
    queryKey: ["/api/settlement/status"],
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
          <p className="text-green-500/60 font-mono text-xs">LOADING TRADER PORTAL...</p>
        </div>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="min-h-full flex items-center justify-center bg-black">
        <p className="text-emerald-500/60 font-mono text-sm">TRADER NOT FOUND</p>
      </div>
    );
  }

  const hasTrust = !!trader.trust;
  const paidDown = hasTrust ? (trader.trust!.noteAmount - trader.trust!.outstandingBalance) : 0;
  const paidPct = hasTrust ? parseFloat(((paidDown / trader.trust!.noteAmount) * 100).toFixed(1)) : 0;

  const grossIntake = settlementData?.grossIntake || 0;
  const nextKAt = settlementData?.nextKAt || 1000;
  const ksReached = settlementData?.ksReached || 0;
  const fundAvailable = settlementData?.fundAvailable || 0;
  const remaining = Math.max(0, nextKAt - grossIntake);
  const cyclePct = Math.min(100, ((grossIntake % 1000) / 1000) * 100);
  const isCloseToSettlement = remaining <= 200;

  return (
    <div className="min-h-full bg-black pb-36 font-mono relative">
      <PortalBackground />

      <div className="relative z-10">
        <div className="border-b border-emerald-500/20 bg-black/90 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-start gap-4 sm:gap-6">
              <div className="relative flex-shrink-0">
                {trader.trader.profileImage ? (
                  <img src={trader.trader.profileImage} alt="" className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-emerald-500/50" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-950 to-black flex items-center justify-center">
                    <span className="text-emerald-400 font-black text-2xl sm:text-3xl">
                      {(trader.trader.username || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-black animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight truncate" data-testid="text-trader-identity">
                    {trader.trader.username}
                  </h1>
                  {hasTrust && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black">
                      <Crown className="h-2.5 w-2.5 inline mr-0.5" />SOVEREIGN
                    </span>
                  )}
                  {trader.trader.isAdmin && (
                    <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-black">ADMIN</span>
                  )}
                </div>
                <p className="text-emerald-500/60 text-[10px] mt-1">
                  {hasTrust ? `TRUST: ${trader.trust!.trustId} | BENEFICIARY` : "ACTIVE TRADER"} | AITITRADE DEX
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <Link href="/" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 px-2 py-1 hover:bg-emerald-500/10 transition-colors" data-testid="link-trade-floor">
                    <Zap className="h-3 w-3" /> TRADE FLOOR <ChevronRight className="h-2.5 w-2.5" />
                  </Link>
                  <Link href="/leaderboard" className="text-[10px] text-lime-400 hover:text-lime-300 flex items-center gap-1 border border-lime-500/30 px-2 py-1 hover:bg-lime-500/10 transition-colors" data-testid="link-leaderboard">
                    <BarChart3 className="h-3 w-3" /> LEADERBOARD <ChevronRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <KineticPulseBar />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <LiveIndicator
              label="POSITIONS"
              value={String(trader.summary.totalPositions)}
              trend={trader.summary.totalPositions > 0 ? "up" : "neutral"}
              color="border-emerald-500/30"
            />
            <LiveIndicator
              label="TOTAL INVESTED"
              value={`$${trader.summary.totalInvested.toFixed(2)}`}
              trend={trader.summary.totalInvested > 0 ? "up" : "neutral"}
              color="border-lime-500/30"
            />
            <LiveIndicator
              label="BUY-BACK VALUE"
              value={`$${trader.summary.totalBuyBack.toFixed(2)}`}
              trend={trader.summary.totalBuyBack > trader.summary.totalInvested ? "up" : "neutral"}
              color="border-amber-500/30"
            />
            <LiveIndicator
              label="PROJECTED ROI"
              value={`${trader.summary.projectedROI}%`}
              trend={trader.summary.projectedROI > 0 ? "up" : "neutral"}
              color="border-emerald-500/30"
            />
          </div>

          <div className="border border-emerald-500/20 bg-black/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                <span className="text-[11px] text-emerald-400 font-black tracking-wider">GLOBAL SETTLEMENT TRACKER</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-emerald-500/60">${ksReached} CYCLES COMPLETED</span>
                {isCloseToSettlement && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">IMMINENT</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-emerald-950/60 border border-emerald-500/15 p-2.5 text-center">
                <p className="text-[8px] text-emerald-500/60 tracking-widest">GROSS INTAKE</p>
                <p className="text-lg text-emerald-400 font-black">${grossIntake.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/15 p-2.5 text-center">
                <p className="text-[8px] text-emerald-500/60 tracking-widest">NEXT $1K AT</p>
                <p className="text-lg text-lime-400 font-black">${nextKAt.toLocaleString('en-US')}</p>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-500/15 p-2.5 text-center">
                <p className="text-[8px] text-emerald-500/60 tracking-widest">FUND AVAILABLE</p>
                <p className={`text-lg font-black ${fundAvailable > 0 ? "text-green-400" : "text-emerald-500/60"}`}>${fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="relative">
              <div className="w-full bg-emerald-950 h-4 border border-emerald-500/20/50 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${isCloseToSettlement ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}
                  style={{ width: `${cyclePct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-[9px] font-black ${cyclePct > 50 ? "text-black" : "text-emerald-400/70"}`}>
                    {cyclePct.toFixed(1)}% — ${remaining.toLocaleString('en-US', { minimumFractionDigits: 0 })} TO PAYOUT
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-emerald-500/40">
              <span>KINETIC FLOOR / CEO LIVE RATE</span>
              <span>EVERY $1K TRADED = KINETIC SETTLEMENT</span>
            </div>
          </div>

          {hasTrust && (
            <div className="border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-amber-400" />
                <span className="text-[11px] text-amber-400 font-black tracking-wider">SOVEREIGN TRUST STATUS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/60 border border-amber-500/20 p-3">
                  <p className="text-[8px] text-amber-500/60 tracking-widest">TRUST LOAN</p>
                  <p className="text-white font-black text-lg" data-testid="text-trust-balance">
                    ${trader.trust!.noteAmount.toFixed(2)}
                  </p>
                  <div className="mt-1.5 h-1.5 bg-emerald-500/10 overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <p className="text-emerald-500/40 text-[8px] mt-1">{paidPct}% AMORTIZED — ${trader.trust!.outstandingBalance.toFixed(2)} BAL</p>
                </div>
                <div className="bg-black/60 border border-amber-500/20 p-3">
                  <p className="text-[8px] text-amber-500/60 tracking-widest">MONTHLY AMORT</p>
                  <p className="text-white font-black text-lg" data-testid="text-monthly-amort">${trader.trust!.monthlyCommitment}/MO</p>
                  <p className="text-emerald-500/40 text-[8px] mt-1.5">{trader.trust!.monthsRemaining} MONTHS REMAINING</p>
                </div>
                <div className="bg-black/60 border border-amber-500/20 p-3">
                  <p className="text-[8px] text-amber-500/60 tracking-widest">BENEFICIARY</p>
                  <p className={`font-black text-lg ${trader.trust!.isBeneficiary ? "text-emerald-400" : "text-emerald-500/60"}`} data-testid="text-beneficiary-status">
                    {trader.trust!.isBeneficiary ? "ACTIVE" : "INACTIVE"}
                  </p>
                  {trader.trust!.giftedYield > 0 && (
                    <p className="text-emerald-400 text-[8px] mt-1.5">GIFTED YIELD: ${trader.trust!.giftedYield.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <TraderDesk positions={trader.positions} userId={userId} />

          <div className="border border-violet-500/30 bg-black/90 overflow-hidden" style={{ boxShadow: "0 0 20px rgba(139,92,246,0.08)" }} data-testid="private-room-section">
            <div className="bg-gradient-to-r from-violet-950/50 to-black px-4 py-3 border-b border-violet-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-violet-400" />
                <span className="text-violet-400 text-[11px] font-black tracking-wider">THE TRADER'S ROOM</span>
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ boxShadow: "0 0 6px #a78bfa" }} />
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-violet-500/60" />
                <span className="text-[9px] text-violet-500/60 font-mono">EXCLUSIVE ACCESS</span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-violet-950/20 border border-violet-500/15 p-2.5 text-center">
                  <Radio className="h-4 w-4 text-violet-400 mx-auto mb-1" />
                  <p className="text-[8px] text-violet-500/60 tracking-widest">MARKET NEWS</p>
                  <p className="text-[10px] text-violet-300 font-bold mt-0.5">LIVE UPDATES</p>
                </div>
                <div className="bg-violet-950/20 border border-violet-500/15 p-2.5 text-center">
                  <TrendingUp className="h-4 w-4 text-amber-400 mx-auto mb-1" />
                  <p className="text-[8px] text-violet-500/60 tracking-widest">PRE-MARKET</p>
                  <p className="text-[10px] text-amber-300 font-bold mt-0.5">EARLY ACCESS</p>
                </div>
                <div className="bg-violet-950/20 border border-violet-500/15 p-2.5 text-center">
                  <Users className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-[8px] text-violet-500/60 tracking-widest">P2P TRADING</p>
                  <p className="text-[10px] text-emerald-300 font-bold mt-0.5">DIRECT DEALS</p>
                </div>
              </div>

              <div className="border border-violet-500/20 bg-violet-950/10 p-3">
                <p className="text-[9px] text-violet-400/80 mb-2 font-bold">WHAT HAPPENS IN THE PRIVATE ROOM:</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Zap className="h-3 w-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-violet-300/80">Songs posted BEFORE they hit the market — get in early, ride the wave when it drops</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-violet-300/80">P2P sell & trade positions directly with other traders — set your own spread</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Target className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[9px] text-violet-300/80">Market intel, price targets, and brokerage updates posted live by AITITRADE</p>
                  </div>
                </div>
              </div>

              <a
                href="https://cutt.ly/mtDWjqRv"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-violet-600 hover:bg-violet-500 text-white font-black text-sm transition-all border border-violet-400/40"
                style={{ boxShadow: "0 0 15px rgba(139,92,246,0.3)" }}
                data-testid="btn-enter-private-room"
              >
                <Lock className="h-4 w-4" />
                ENTER THE TRADER'S ROOM
                <ExternalLink className="h-3 w-3" />
              </a>

              <p className="text-center text-[7px] text-violet-500/40 tracking-wider">VERIFIED TRADERS ONLY — MARKET INTEL • P2P DEALS • PRE-DROPS</p>
            </div>
          </div>

          {!hasTrust && (
            <div className="border border-amber-500/30 bg-amber-500/5 p-6 text-center">
              <Crown className="h-10 w-10 text-amber-500/40 mx-auto mb-3" />
              <p className="text-amber-400 font-black text-lg mb-1">UPGRADE TO SOVEREIGN TRUST</p>
              <p className="text-emerald-500/60 text-xs mb-4">Unlock premium Spotify room, CEO Class, Trust Vault & more</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/membership"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 font-black text-sm transition-colors"
                  data-testid="link-upgrade-premium"
                >
                  VIEW PREMIUM OPTIONS
                </Link>
                <a
                  href={CASH_APP_REFERRAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 font-black text-sm transition-colors flex items-center gap-2"
                  data-testid="link-open-brokerage"
                >
                  <DollarSign className="h-4 w-4" /> OPEN BROKERAGE ACCOUNT
                </a>
              </div>
              <p className="text-emerald-500/40 text-[9px] mt-3 truncate">$25 DOWN + $19.79/MO | $AITITRADEBROKERAGE</p>
            </div>
          )}

          <div className="bg-emerald-950/30 border border-emerald-500/15 p-3">
            <div className="flex items-center justify-between text-[9px] text-emerald-500/40 flex-wrap gap-2">
              <span>KINETIC FLOOR SPLIT</span>
              <span>90% ROI BUY-BACK</span>
              <span>$1K SETTLEMENT CYCLE</span>
              <span>FIFO QUEUE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
