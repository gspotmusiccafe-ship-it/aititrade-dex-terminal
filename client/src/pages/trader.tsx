import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Shield, DollarSign, TrendingUp, Activity, Loader2, ExternalLink, Zap } from "lucide-react";

const CASH_APP_URL = "https://cash.app/$AITITRADEBROKERAGE";

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

export default function TraderPage() {
  const [, params] = useRoute("/trader/:userId");
  const { user } = useAuth();
  const userId = params?.userId || user?.id || "";

  const { data: trader, isLoading } = useQuery<TraderData>({
    queryKey: ["/api/trader", userId],
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

  return (
    <div className="min-h-full bg-black pb-36">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            {trader.trader.profileImage ? (
              <img src={trader.trader.profileImage} alt="" className="w-14 h-14 border-2 border-green-500" />
            ) : (
              <div className="w-14 h-14 border-2 border-green-500 bg-green-900/20 flex items-center justify-center">
                <span className="text-green-400 font-mono font-black text-xl">
                  {(trader.trader.username || "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-4xl font-black italic text-white underline font-mono tracking-tight" data-testid="text-trader-identity">
                TRADER_IDENTITY: {trader.trader.username}
              </h1>
              <p className="text-zinc-500 text-[10px] font-mono mt-1">
                {hasTrust ? `TRUST: ${trader.trust!.trustId} | BENEFICIARY` : "NO TRUST MEMBERSHIP"}
              </p>
            </div>
          </div>
        </div>

        {hasTrust ? (
          <>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-zinc-900 p-4 border-l-4 border-green-500">
                <p className="text-zinc-500 text-xs font-mono font-bold">TRUST LOAN STATUS</p>
                <p className="text-white font-mono text-xl font-black" data-testid="text-trust-balance">
                  ${trader.trust!.noteAmount.toFixed(2)} / ${trader.trust!.outstandingBalance.toFixed(2)} BAL
                </p>
                <div className="mt-2 h-1.5 bg-zinc-800">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${paidPct}%` }} />
                </div>
                <p className="text-zinc-600 text-[9px] font-mono mt-1">{paidPct}% AMORTIZED</p>
              </div>
              <div className="bg-zinc-900 p-4 border-l-4 border-blue-500">
                <p className="text-zinc-500 text-xs font-mono font-bold">MONTHLY AMORT</p>
                <p className="text-white font-mono text-xl font-black" data-testid="text-monthly-amort">
                  ${trader.trust!.monthlyCommitment} / MO
                </p>
                <p className="text-zinc-600 text-[9px] font-mono mt-2">
                  {trader.trust!.monthsRemaining} MONTHS REMAINING
                </p>
              </div>
              <div className="bg-zinc-900 p-4 border-l-4 border-yellow-500">
                <p className="text-zinc-500 text-xs font-mono font-bold">BENEFICIARY STATUS</p>
                <p className="text-white font-mono text-xl font-black" data-testid="text-beneficiary-status">
                  {trader.trust!.isBeneficiary ? "ACTIVE" : "INACTIVE"} ({trader.trust!.trustId})
                </p>
                {trader.trust!.giftedYield > 0 && (
                  <p className="text-green-400 text-[9px] font-mono mt-2">
                    GIFTED YIELD: ${trader.trust!.giftedYield.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-8">
              <div className="border border-zinc-800 bg-black p-3 text-center">
                <Activity className="h-4 w-4 text-green-500/50 mx-auto mb-1" />
                <p className="text-zinc-600 text-[8px] font-mono">POSITIONS</p>
                <p className="text-green-400 text-lg font-mono font-black">{trader.summary.totalPositions}</p>
              </div>
              <div className="border border-zinc-800 bg-black p-3 text-center">
                <DollarSign className="h-4 w-4 text-green-500/50 mx-auto mb-1" />
                <p className="text-zinc-600 text-[8px] font-mono">INVESTED</p>
                <p className="text-green-400 text-lg font-mono font-black">${trader.summary.totalInvested.toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-black p-3 text-center">
                <TrendingUp className="h-4 w-4 text-green-500/50 mx-auto mb-1" />
                <p className="text-zinc-600 text-[8px] font-mono">BUY-BACK</p>
                <p className="text-green-400 text-lg font-mono font-black">${trader.summary.totalBuyBack.toFixed(2)}</p>
              </div>
              <div className="border border-zinc-800 bg-black p-3 text-center">
                <Zap className="h-4 w-4 text-green-500/50 mx-auto mb-1" />
                <p className="text-zinc-600 text-[8px] font-mono">PROJ. ROI</p>
                <p className="text-green-400 text-lg font-mono font-black">{trader.summary.projectedROI}%</p>
              </div>
            </div>

            {trader.positions.length > 0 ? (
              <div className="border border-zinc-800 mb-8">
                <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-500 text-[10px] font-mono font-bold">ACTIVE POSITIONS (FIFO)</span>
                  <span className="text-zinc-600 text-[9px] font-mono">{trader.positions.length} TOTAL</span>
                </div>
                <div className="divide-y divide-zinc-900">
                  {trader.positions.map((pos, i) => (
                    <div key={pos.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/30 transition-colors">
                      <span className="text-zinc-600 text-[10px] font-mono w-6">#{i + 1}</span>
                      {pos.coverImage ? (
                        <img src={pos.coverImage} alt="" className="w-8 h-8 border border-zinc-700" />
                      ) : (
                        <div className="w-8 h-8 bg-zinc-800 border border-zinc-700" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-mono font-bold truncate">{pos.trackTitle}</p>
                        <p className="text-zinc-600 text-[9px] font-mono">{pos.trackingNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-xs font-mono font-extrabold">${pos.buyIn.toFixed(2)} → ${pos.buyBack.toFixed(2)}</p>
                        <p className="text-zinc-500 text-[9px] font-mono">{pos.roi}% ROI</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-zinc-800 p-8 text-center mb-8">
                <Shield className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-500 text-sm font-mono">NO POSITIONS ACQUIRED YET</p>
                <p className="text-zinc-700 text-[10px] font-mono mt-1">Trade assets on the exchange floor to build your portfolio</p>
              </div>
            )}
          </>
        ) : (
          <div className="border-2 border-green-600 p-8 text-center">
            <Shield className="h-12 w-12 text-green-500/30 mx-auto mb-4" />
            <p className="text-white font-mono font-black text-xl mb-2">ACTIVATE TRADER PORTAL</p>
            <p className="text-zinc-400 text-sm font-mono mb-6">$25 down payment activates your $500 promissory note</p>
            <a
              href={CASH_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-green-600 text-white text-center py-4 px-12 font-black text-2xl font-mono hover:bg-green-400 transition-all"
              data-testid="button-activate-trader"
            >
              ACTIVATE TRADER PORTAL ($25.00)
              <ExternalLink className="inline h-5 w-5 ml-2" />
            </a>
            <p className="text-zinc-600 text-[9px] font-mono mt-3">$AITITRADEBROKERAGE VIA CASH APP</p>
          </div>
        )}

        <div className="bg-zinc-900/30 border border-zinc-800 p-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
            <span>54/46 FLOOR SPLIT</span>
            <span>90% ROI BUY-BACK</span>
            <span>$1K SETTLEMENT CYCLE</span>
            <span>FIFO QUEUE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
