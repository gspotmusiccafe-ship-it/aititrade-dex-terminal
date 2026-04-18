import { Crown, DollarSign, Bitcoin, Rocket } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const CASH_APP_HANDLE = "AITITRADEBROKERAGE";
const CEO_AMOUNT = 250;
const BLOCK_CEILING = 1000;
const TARGET_CEOS = 7;
const LIQUIDITY_GOAL = CEO_AMOUNT * TARGET_CEOS; // $1,750

interface CeoBannerProps {
  onCryptoClick: (amount: number, purpose: string, refId: string) => void;
}

export default function CeoBuyInBanner({ onCryptoClick }: CeoBannerProps) {
  // Pull current global CEO count if available; falls back gracefully
  const { data } = useQuery<{ count: number; raised: number } | null>({
    queryKey: ["/api/ceo-buyin/progress"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/ceo-buyin/progress", { credentials: "include" });
        if (!r.ok) return null;
        return r.json();
      } catch {
        return null;
      }
    },
    refetchInterval: 30000,
  });

  const ceosIn = data?.count ?? 0;
  const raised = data?.raised ?? 0;
  const pct = Math.min(100, (raised / LIQUIDITY_GOAL) * 100);

  const cashAppHref = `https://cash.app/$${CASH_APP_HANDLE}/${CEO_AMOUNT}.00?note=CEO_BUYIN_HALFBLOCK_$AITI_LIQUIDITY`;

  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 mb-6"
      style={{
        borderColor: "#fbbf24",
        background: "linear-gradient(135deg, #1a1100 0%, #2b1a00 50%, #1a1100 100%)",
        boxShadow: "0 0 30px rgba(251,191,36,0.25)",
      }}
      data-testid="ceo-buyin-banner"
    >
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Crown className="h-5 w-5 text-amber-400" />
          <span className="text-amber-400 text-[10px] sm:text-xs font-black tracking-widest">
            CEO FLEXIBLE BUY-IN — SECURE THE LIQUIDITY LAUNCH
          </span>
          <span className="ml-auto text-[8px] sm:text-[9px] font-black tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            ${LIQUIDITY_GOAL} GOAL · {TARGET_CEOS} SEATS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">FULL BUY-IN</p>
            <p className="text-amber-300 font-black text-base sm:text-lg">${CEO_AMOUNT}</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">BLOCK CREDIT</p>
            <p className="text-lime-400 font-black text-base sm:text-lg">50% / 1K</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">CEOs ENROLLED</p>
            <p className="text-amber-300 font-black text-base sm:text-lg">{ceosIn} / {TARGET_CEOS}</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">RAISED</p>
            <p className="text-emerald-400 font-black text-base sm:text-lg">${raised.toFixed(0)}</p>
          </div>
        </div>

        <div className="bg-black/70 border border-amber-500/25 rounded p-2.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] text-amber-500/70 font-bold tracking-widest">LIQUIDITY PROGRESS</span>
            <span className="text-amber-300 text-[10px] font-mono font-black">${raised.toFixed(0)} / ${LIQUIDITY_GOAL}</span>
          </div>
          <div className="relative w-full bg-amber-500/10 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #f59e0b, #fbbf24, #fde047)",
              }}
            />
          </div>
        </div>

        <p className="text-[10px] text-amber-200/80 mb-3 leading-relaxed">
          Each <strong className="text-amber-300">$250 deposit</strong> counts as <strong className="text-amber-300">50% of a single $1,000 Block Milestone</strong>. Two CEO buy-ins close one block; seven CEOs unlock the <strong className="text-lime-400">$AITI liquidity pool launch</strong>. Cash App or BSC crypto.
        </p>

        <div className="flex flex-wrap gap-2">
          <a
            href={cashAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs tracking-wider rounded transition-colors"
            data-testid="btn-ceo-cashapp"
          >
            <DollarSign className="h-4 w-4" /> PAY $250 VIA CASH APP
          </a>
          <button
            onClick={() => onCryptoClick(CEO_AMOUNT, "ceo_buyin", `ceo_${Date.now()}`)}
            className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/35 border-2 border-amber-500/50 text-amber-300 font-black text-xs tracking-wider rounded transition-colors"
            data-testid="btn-ceo-crypto"
          >
            <Bitcoin className="h-4 w-4" /> PAY $250 VIA CRYPTO (BSC)
          </button>
        </div>

        <p className="text-[9px] text-amber-500/50 font-mono mt-2 flex items-center gap-1">
          <Rocket className="h-2.5 w-2.5" /> Note <code className="text-amber-300">CEO_BUYIN_HALFBLOCK</code> auto-attached for settlement reconciliation.
        </p>
      </div>
    </div>
  );
}
