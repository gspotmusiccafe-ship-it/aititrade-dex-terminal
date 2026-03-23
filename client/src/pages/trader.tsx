import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Shield, DollarSign, TrendingUp, Activity, Loader2, ExternalLink, Zap, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Target, Flame, Globe, Crown, ChevronRight } from "lucide-react";

const CASH_APP_URL = "https://cash.app/$AITITRADEBROKERAGE";

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
          <Zap className={`h-3.5 w-3.5 ${isHigh ? "text-emerald-400" : "text-zinc-500"}`} />
          <span className="text-[9px] text-zinc-500 font-bold">KINETIC</span>
        </div>
        <span className={`text-xs font-black ${isHigh ? "floor-high-pulse" : "text-amber-400"}`}>
          {(kState.floorROI * 100).toFixed(0)}% ROI
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[9px] text-zinc-600">HOUSE: {(kState.houseMBBP * 100).toFixed(0)}%</span>
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
      <p className="text-[8px] text-zinc-500 font-bold tracking-widest uppercase">{label}</p>
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
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500"
        }`}>
          {trend === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend === "down" ? <ArrowDownRight className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
          <span className="text-[8px] font-bold">{trend === "up" ? "BULLISH" : trend === "down" ? "BEARISH" : "STABLE"}</span>
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
        <p className="text-zinc-500 font-mono text-sm">TRADER NOT FOUND</p>
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
                <p className="text-zinc-500 text-[10px] mt-1">
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
                <span className="text-[9px] text-zinc-500">${ksReached} CYCLES COMPLETED</span>
                {isCloseToSettlement && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 font-bold animate-pulse">IMMINENT</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 text-center">
                <p className="text-[8px] text-zinc-500 tracking-widest">GROSS INTAKE</p>
                <p className="text-lg text-emerald-400 font-black">${grossIntake.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
              </div>
              <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 text-center">
                <p className="text-[8px] text-zinc-500 tracking-widest">NEXT $1K AT</p>
                <p className="text-lg text-lime-400 font-black">${nextKAt.toLocaleString('en-US')}</p>
              </div>
              <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 text-center">
                <p className="text-[8px] text-zinc-500 tracking-widest">FUND AVAILABLE</p>
                <p className={`text-lg font-black ${fundAvailable > 0 ? "text-green-400" : "text-zinc-500"}`}>${fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="relative">
              <div className="w-full bg-zinc-900 h-4 border border-zinc-700/50 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${isCloseToSettlement ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}
                  style={{ width: `${cyclePct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-[9px] font-black ${cyclePct > 50 ? "text-black" : "text-zinc-400"}`}>
                    {cyclePct.toFixed(1)}% — ${remaining.toLocaleString('en-US', { minimumFractionDigits: 0 })} TO $540 PAYOUT
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-zinc-600">
              <span>54% FLOOR RETAINED | 46% CEO GROSS</span>
              <span>EVERY $1K TRADED = $540 SETTLEMENT</span>
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
                  <div className="mt-1.5 h-1.5 bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <p className="text-zinc-600 text-[8px] mt-1">{paidPct}% AMORTIZED — ${trader.trust!.outstandingBalance.toFixed(2)} BAL</p>
                </div>
                <div className="bg-black/60 border border-amber-500/20 p-3">
                  <p className="text-[8px] text-amber-500/60 tracking-widest">MONTHLY AMORT</p>
                  <p className="text-white font-black text-lg" data-testid="text-monthly-amort">${trader.trust!.monthlyCommitment}/MO</p>
                  <p className="text-zinc-600 text-[8px] mt-1.5">{trader.trust!.monthsRemaining} MONTHS REMAINING</p>
                </div>
                <div className="bg-black/60 border border-amber-500/20 p-3">
                  <p className="text-[8px] text-amber-500/60 tracking-widest">BENEFICIARY</p>
                  <p className={`font-black text-lg ${trader.trust!.isBeneficiary ? "text-emerald-400" : "text-zinc-500"}`} data-testid="text-beneficiary-status">
                    {trader.trust!.isBeneficiary ? "ACTIVE" : "INACTIVE"}
                  </p>
                  {trader.trust!.giftedYield > 0 && (
                    <p className="text-emerald-400 text-[8px] mt-1.5">GIFTED YIELD: ${trader.trust!.giftedYield.toFixed(2)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {trader.positions.length > 0 ? (
            <div className="border border-zinc-800 bg-black/80">
              <div className="bg-zinc-900/50 px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px] font-black tracking-wider">ACTIVE POSITIONS (FIFO)</span>
                </div>
                <span className="text-zinc-600 text-[9px]">{trader.positions.length} TOTAL</span>
              </div>
              <div className="divide-y divide-zinc-900">
                {trader.positions.map((pos, i) => {
                  const roiPositive = pos.roi > 0;
                  return (
                    <div key={pos.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/30 transition-colors group" data-testid={`position-row-${pos.id}`}>
                      <span className="text-zinc-600 text-[10px] w-6 flex-shrink-0">#{i + 1}</span>
                      {pos.coverImage ? (
                        <img src={pos.coverImage} alt="" className="w-9 h-9 border border-zinc-700 flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center">
                          <Flame className="h-3 w-3 text-zinc-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-bold truncate">{pos.trackTitle}</p>
                        <p className="text-zinc-600 text-[9px]">{pos.trackingNumber}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-extrabold">
                          <span className="text-zinc-400">${pos.buyIn.toFixed(2)}</span>
                          <span className="text-zinc-600 mx-1">→</span>
                          <span className="text-emerald-400">${pos.buyBack.toFixed(2)}</span>
                        </p>
                        <div className={`flex items-center justify-end gap-0.5 ${roiPositive ? "text-emerald-400" : "text-zinc-500"}`}>
                          {roiPositive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <Activity className="h-2.5 w-2.5" />}
                          <span className="text-[9px] font-bold">{pos.roi}% ROI</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border border-emerald-500/20 bg-black/80 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 border border-emerald-500/30 flex items-center justify-center bg-emerald-950/30">
                <BarChart3 className="h-8 w-8 text-emerald-500/30" />
              </div>
              <p className="text-white font-black text-lg mb-2">NO POSITIONS YET</p>
              <p className="text-zinc-500 text-xs mb-4">Head to the trading floor to acquire your first position</p>
              <Link
                href="/"
                className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 font-black text-sm transition-colors"
                data-testid="link-go-trade"
              >
                <Zap className="h-3.5 w-3.5 inline mr-1.5" />
                GO TO TRADE FLOOR
              </Link>
            </div>
          )}

          {!hasTrust && (
            <div className="border border-amber-500/30 bg-amber-500/5 p-6 text-center">
              <Crown className="h-10 w-10 text-amber-500/40 mx-auto mb-3" />
              <p className="text-amber-400 font-black text-lg mb-1">UPGRADE TO SOVEREIGN TRUST</p>
              <p className="text-zinc-500 text-xs mb-4">Unlock premium Spotify room, CEO Class, Trust Vault & more</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/membership"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 font-black text-sm transition-colors"
                  data-testid="link-upgrade-premium"
                >
                  VIEW PREMIUM OPTIONS
                </Link>
              </div>
              <p className="text-zinc-600 text-[9px] mt-3">$25 DOWN + $19.79/MO VIA CASH APP | $AITITRADEBROKERAGE</p>
            </div>
          )}

          <div className="bg-zinc-900/30 border border-zinc-800 p-3">
            <div className="flex items-center justify-between text-[9px] text-zinc-600 flex-wrap gap-2">
              <span>54/46 FLOOR SPLIT</span>
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
