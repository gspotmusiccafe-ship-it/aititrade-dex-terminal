import { Coins, ExternalLink, Copy, Check, Lock } from "lucide-react";
import { useState } from "react";

const SOVEREIGN_ADDRESS = "0x09632e2582E1d21E45852964541b0539D6594b50";
const POOCOIN_URL = `https://poocoin.app/tokens/${SOVEREIGN_ADDRESS}`;
const BSCSCAN_URL = `https://bscscan.com/address/${SOVEREIGN_ADDRESS}`;

export default function AitiCoinTicker({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copyAddr = () => {
    navigator.clipboard.writeText(SOVEREIGN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 mb-6"
      style={{
        borderColor: "#fbbf24",
        background: "linear-gradient(135deg, #1a1100 0%, #2b1a00 50%, #1a1100 100%)",
        boxShadow: "0 0 30px rgba(251,191,36,0.25), inset 0 0 20px rgba(251,191,36,0.05)",
      }}
      data-testid="aiti-coin-ticker"
    >
      {/* Animated shimmer */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.15), transparent)",
          animation: "shimmer 3s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="relative px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2 mb-2">
          <Coins className="h-5 w-5 text-amber-400 animate-pulse" />
          <span className="text-amber-400 text-[10px] sm:text-xs font-black tracking-widest">
            AITITRADE COIN ($AITI) — PRE-SALE INITIATED
          </span>
          <span className="ml-auto text-[8px] sm:text-[9px] font-black tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
            COMING SOON
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">SUPPLY</p>
            <p className="text-amber-300 font-black text-xs sm:text-sm">100M FIXED</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">TX TAX</p>
            <p className="text-amber-300 font-black text-xs sm:text-sm">2% → VAULT</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">CHAIN</p>
            <p className="text-amber-300 font-black text-xs sm:text-sm">BEP-20 / BSC</p>
          </div>
          <div className="bg-black/60 border border-amber-500/30 rounded px-2 py-1.5">
            <p className="text-[7px] text-amber-500/60 tracking-widest">LIQUIDITY GOAL</p>
            <p className="text-amber-300 font-black text-xs sm:text-sm">$1,750 / 7 CEOs</p>
          </div>
        </div>

        {!compact && (
          <div className="bg-black/70 border border-amber-500/25 rounded p-2.5 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-3 w-3 text-amber-400" />
              <p className="text-[8px] text-amber-500/70 tracking-widest">SOVEREIGN TRUST VAULT</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[10px] sm:text-xs text-amber-300 font-mono break-all" data-testid="text-sovereign-address">
                {SOVEREIGN_ADDRESS}
              </code>
              <button
                onClick={copyAddr}
                className="flex-shrink-0 p-1.5 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-300 transition-colors"
                data-testid="btn-copy-sovereign"
                aria-label="Copy address"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={POOCOIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] sm:text-xs tracking-wider rounded transition-colors"
            data-testid="link-poocoin-chart"
          >
            POOCOIN CHART <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={BSCSCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-[10px] sm:text-xs tracking-wider rounded transition-colors"
            data-testid="link-bscscan"
          >
            BSCSCAN <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-[9px] text-amber-500/50 font-mono ml-auto">
            CHART DATA POSTS AT LP LAUNCH
          </span>
        </div>
      </div>
    </div>
  );
}
