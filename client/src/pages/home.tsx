import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Play, Pause, Music, Activity, Zap, Lock, AlertTriangle, FileCheck, X, Globe, Shield, ExternalLink, Cpu, Binary, Radio, GripVertical, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { BLUEVINE_MINT_URL, BLUEVINE_TRUST_URL } from "@/lib/checkout-config";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TrackWithArtist } from "@shared/schema";

const CEILING = 1000.00;
const FLASH_THRESHOLD = 900.00;
const FLASH_TIMER_SECONDS = 120;
const SETTLEMENT_PAYOUT = 300.00;
const HOLDER_COUNT = 15;
const PAYHIP_STORE = "https://payhip.com/aitifymusicstore";

interface MintReceipt {
  mintId: string;
  asset: string;
  ticker: string;
  unitPrice: number;
  originatorCredit: number;
  positionValue: number;
  aiModel: string;
  grossSales: number;
  totalMints: number;
  mintCap: number;
  capacityPct: number;
  status: string;
  timestamp: string;
}

function MintCertificate({ receipt, onClose }: { receipt: MintReceipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black border-2 border-emerald-500/60 font-mono max-w-md w-full shadow-2xl shadow-emerald-500/20 relative overflow-hidden" onClick={e => e.stopPropagation()} data-testid="mint-certificate">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(16,185,129,0.15) 20px, rgba(16,185,129,0.15) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(16,185,129,0.15) 20px, rgba(16,185,129,0.15) 21px)'}} />
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
            <Cpu className="h-48 w-48 text-emerald-400" />
          </div>
        </div>
        <div className="relative z-10">
          <div className="border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between bg-emerald-950/80">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-bold tracking-wider">AI-GENERATED ASSET — DIGITAL MINT</span>
            </div>
            <button onClick={onClose} className="text-emerald-500/40 hover:text-emerald-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="border border-emerald-400/20 bg-emerald-950/30 p-2 text-center">
              <p className="text-[10px] text-emerald-400 font-black tracking-[0.25em]" data-testid="text-ai-certified-mint">CERTIFIED AI-GENERATED ASSET</p>
            </div>
            <div className="border-2 border-emerald-400/50 bg-emerald-500/5 p-4 text-center relative">
              <p className="text-[9px] text-emerald-500/50 mb-1 tracking-widest">OWNER ID — SOLE PROOF OF OWNERSHIP</p>
              <p className="text-2xl text-emerald-400 font-black tracking-[0.15em] leading-tight" data-testid="text-mint-id">{receipt.mintId}</p>
              <p className="text-[8px] text-emerald-500/30 mt-2 tracking-wider">SYNTHETIC POSITION — PAPER TRADE</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">ASSET / TICKER</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.ticker}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">UNIT PRICE</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.unitPrice.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">AI MODEL</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-0.5" data-testid="text-ai-model-mint">{receipt.aiModel}</p>
              </div>
            </div>
            <div className="border border-yellow-500/25 bg-yellow-500/5 p-2.5">
              <p className="text-[8px] text-yellow-400/60 mb-1.5 text-center tracking-widest">DISBURSEMENT BREAKDOWN</p>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-black/50 border border-yellow-500/15 p-2">
                  <p className="text-[8px] text-yellow-400/50">ORIGINATOR CREDIT (16%)</p>
                  <p className="text-sm text-yellow-400 font-bold" data-testid="text-originator-credit">${receipt.originatorCredit.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-emerald-500/15 p-2">
                  <p className="text-[8px] text-emerald-500/50">POSITION HOLDER (84%)</p>
                  <p className="text-sm text-emerald-400 font-bold" data-testid="text-position-value">${receipt.positionValue.toFixed(4)}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">LEDGER GROSS</p>
                <p className="text-xs text-white font-bold">${receipt.grossSales.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">TOTAL MINTS</p>
                <p className="text-xs text-emerald-400 font-bold" data-testid="text-total-mints">{receipt.totalMints} / {receipt.mintCap}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">CAPACITY</p>
                <p className={`text-xs font-bold ${receipt.capacityPct >= 60 ? "text-yellow-400" : "text-emerald-400"}`}>{receipt.capacityPct}%</p>
              </div>
            </div>
            <div className="border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-center">
              <p className={`text-sm font-black ${receipt.status === "CLOSED" ? "text-red-400" : "text-emerald-400"}`}>
                {receipt.status === "CLOSED" ? "TRADE CLOSED — SETTLEMENT PENDING" : "POSITION MINTED — PROOF OF OWNERSHIP"}
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <Binary className="h-3 w-3 text-emerald-500/30" />
                <p className="text-[8px] text-emerald-500/25">{receipt.timestamp}</p>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-emerald-500/30" />
                <p className="text-[8px] text-emerald-500/30 font-bold">VERIFIED BY GSR FUND</p>
              </div>
            </div>
            <div className="text-center border-t border-emerald-500/10 pt-2">
              <p className="text-[7px] text-emerald-500/20 tracking-widest">AITIFY SOVEREIGN EXCHANGE — 100% AI-POWERED PLATFORM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TrustReceipt {
  trustId: string;
  asset: string;
  ticker: string;
  unitPrice: number;
  originatorCredit: number;
  positionValue: number;
  aiModel: string;
  storeUrl: string;
  timestamp: string;
}

function TrustCertificate({ receipt, onClose }: { receipt: TrustReceipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black border-2 border-emerald-500/60 font-mono max-w-md w-full shadow-2xl shadow-emerald-500/20 relative overflow-hidden" onClick={e => e.stopPropagation()} data-testid="trust-certificate">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(16,185,129,0.15) 20px, rgba(16,185,129,0.15) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(16,185,129,0.15) 20px, rgba(16,185,129,0.15) 21px)'}} />
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02]">
            <Cpu className="h-48 w-48 text-emerald-400" />
          </div>
        </div>
        <div className="relative z-10">
          <div className="border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between bg-emerald-950/80">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-bold tracking-wider">AI-GENERATED ASSET — GLOBAL TRUST</span>
            </div>
            <button onClick={onClose} className="text-emerald-500/40 hover:text-emerald-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="border border-emerald-400/20 bg-emerald-950/30 p-2 text-center">
              <p className="text-[10px] text-emerald-400 font-black tracking-[0.25em]" data-testid="text-ai-certified-trust">CERTIFIED AI-GENERATED ASSET</p>
            </div>
            <div className="border-2 border-emerald-400/50 bg-emerald-500/5 p-4 text-center">
              <p className="text-[9px] text-emerald-500/50 mb-1 tracking-widest">OWNER ID — SOLE PROOF OF OWNERSHIP</p>
              <p className="text-2xl text-emerald-400 font-black tracking-[0.15em] leading-tight" data-testid="text-trust-id">{receipt.trustId}</p>
              <p className="text-[8px] text-emerald-500/30 mt-2 tracking-wider">MONITORED TRUST — VERIFIED GLOBAL RELEASE</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">ASSET / TICKER</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.ticker}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">UNIT PRICE</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.unitPrice.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">AI MODEL</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-0.5" data-testid="text-ai-model-trust">{receipt.aiModel}</p>
              </div>
            </div>
            <div className="border border-yellow-500/25 bg-yellow-500/5 p-2.5">
              <p className="text-[8px] text-yellow-400/60 mb-1.5 text-center tracking-widest">DISBURSEMENT</p>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-black/50 border border-yellow-500/15 p-2">
                  <p className="text-[8px] text-yellow-400/50">ORIGINATOR CREDIT (16%)</p>
                  <p className="text-sm text-yellow-400 font-bold">${receipt.originatorCredit.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-emerald-500/15 p-2">
                  <p className="text-[8px] text-emerald-500/50">POSITION HOLDER (84%)</p>
                  <p className="text-sm text-emerald-400 font-bold">${receipt.positionValue.toFixed(4)}</p>
                </div>
              </div>
            </div>
            <div className="border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-center">
              <p className="text-sm font-black text-emerald-400">VERIFIED GLOBAL RELEASE — TRUST CERTIFIED</p>
            </div>
            <a
              href={receipt.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-emerald-600 text-black text-xs font-black py-2.5 text-center hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 tracking-wider"
              data-testid="link-store"
            >
              <ExternalLink className="h-3.5 w-3.5" /> PROCEED TO STORE / DOWNLOAD
            </a>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1">
                <Binary className="h-3 w-3 text-emerald-500/30" />
                <p className="text-[8px] text-emerald-500/25">{receipt.timestamp}</p>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-emerald-500/30" />
                <p className="text-[8px] text-emerald-500/30 font-bold">VERIFIED BY GSR FUND</p>
              </div>
            </div>
            <div className="text-center border-t border-emerald-500/10 pt-2">
              <p className="text-[7px] text-emerald-500/20 tracking-widest">AITIFY SOVEREIGN EXCHANGE — 100% AI-POWERED PLATFORM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetCard({ track, onPlay, userTier, dynamicPoolSize, dynamicPrice, buyBackRate, paperTradeCap }: { track: TrackWithArtist; onPlay: (t: TrackWithArtist) => void; userTier: string; dynamicPoolSize?: number; dynamicPrice?: number; buyBackRate?: number; paperTradeCap?: number }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [mintReceipt, setMintReceipt] = useState<MintReceipt | null>(null);
  const [trustReceipt, setTrustReceipt] = useState<TrustReceipt | null>(null);
  const [flashTimer, setFlashTimer] = useState<number | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const flashTriggeredRef = useRef(false);

  const orderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/orders", { trackId: track.id });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.type === "global") {
        setTrustReceipt(data.receipt);
      } else {
        setMintReceipt(data.receipt);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
    },
  });

  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;
  const assetId = `ATFY-${String(track.id).slice(0, 5).toUpperCase()}`;

  const price = dynamicPrice || parseFloat((track as any).unitPrice || "3.50");
  const sales = (track as any).salesCount || 0;
  const assetClass = ((track as any).assetClass || "standard").toLowerCase();
  const releaseType = ((track as any).releaseType || "native").toLowerCase();
  const isGlobal = releaseType === "global";
  const isInspirational = assetClass === "inspirational";
  const poolCeiling = dynamicPoolSize || CEILING;
  const ptCap = paperTradeCap || (poolCeiling * 0.50);
  const bbRate = buyBackRate || 0.18;
  const bbLabel = `${Math.round(bbRate * 100)}%`;
  const minterFeeLabel = "16%";
  const grossSales = parseFloat((sales * price).toFixed(2));
  const capacityPct = Math.min(100, parseFloat(((grossSales / poolCeiling) * 100).toFixed(1)));
  const paperTradePct = Math.min(100, parseFloat(((grossSales / ptCap) * 100).toFixed(1)));
  const flashThreshold = poolCeiling * 0.9;
  const isFlashZone = !isGlobal && grossSales >= flashThreshold && grossSales < poolCeiling;
  const isClosed = !isGlobal && (grossSales >= poolCeiling || (flashTimer !== null && flashTimer <= 0));
  const isPaperCapHit = !isGlobal && grossSales >= ptCap && !isClosed;
  const isHighCapacity = !isGlobal && capacityPct >= 60 && !isClosed && !isFlashZone;
  const remaining = Math.max(0, parseFloat((poolCeiling - grossSales).toFixed(2)));
  const unitsRemaining = price > 0 ? Math.ceil(remaining / price) : 0;
  const reconciliationPct = price > 0 ? parseFloat(((price / poolCeiling) * 100).toFixed(1)) : 0;
  const poolLabel = poolCeiling >= 1000 ? `$${(poolCeiling / 1000).toFixed(0)}K` : `$${poolCeiling}`;
  const yieldPct = capacityPct >= 45 ? "45%" : capacityPct >= 30 ? "30%" : "16%";

  useEffect(() => {
    if (isFlashZone && !flashTriggeredRef.current && !isClosed) {
      flashTriggeredRef.current = true;
      setFlashTimer(FLASH_TIMER_SECONDS);
    }
  }, [isFlashZone, isClosed]);

  useEffect(() => {
    if (flashTimer === null || flashTimer <= 0) return;
    const interval = setInterval(() => {
      setFlashTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setIsReconciling(true);
          setTimeout(() => setIsReconciling(false), 30000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [flashTimer !== null && flashTimer > 0]);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const priceLabel = `$${price.toFixed(2)}`;
  const priceClass = price >= 5 ? "text-amber-400" : price >= 2.50 ? "text-yellow-300" : "text-lime-400";

  const borderColor = isClosed ? "border-red-500/40" : isHighCapacity ? "border-yellow-500/40" : isGlobal ? "border-amber-500/40 hover:border-amber-400/70" : isInspirational ? "border-violet-500/40 hover:border-violet-500/70" : "border-emerald-500/20 hover:border-emerald-500/60";
  const headerBg = isClosed ? "border-red-500/20 bg-red-500/5" : isHighCapacity ? "border-yellow-500/20 bg-yellow-500/5" : isGlobal ? "border-amber-500/20 bg-amber-500/5" : isInspirational ? "border-violet-500/20 bg-violet-500/5" : "border-emerald-500/10 bg-emerald-500/5";

  return (
    <div className={`bg-black border font-mono group transition-all ${borderColor}`} data-testid={`asset-card-${track.id}`}>
      <div className={`border-b px-3 py-1.5 flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-sm ${isClosed ? "text-red-400" : isGlobal ? "text-amber-400" : isInspirational ? "text-violet-400" : "text-lime-400"}`}>{ticker}</span>
          <span className="text-zinc-400 text-[10px] font-semibold">{assetId}</span>
          {isGlobal && (
            <span className="text-[8px] px-1 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" /> TRUST VAULT</span>
          )}
          {isInspirational && !isGlobal && (
            <span className="text-[8px] px-1 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">INSPIRATIONAL</span>
          )}
          {!isGlobal && !isInspirational && (
            <span className="text-[8px] px-1 py-0.5 bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/20 font-bold">NATIVE</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-extrabold ${priceClass}`}>{priceLabel}</span>
          {isGlobal ? (
            <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 font-extrabold flex items-center gap-1">
              <Shield className="h-2.5 w-2.5" /> TRUST VAULT
            </span>
          ) : isClosed ? (
            <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 font-bold flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> CLOSED
            </span>
          ) : isHighCapacity ? (
            <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 font-bold animate-pulse">
              {capacityPct.toFixed(0)}% CAP
            </span>
          ) : (
            <span className={`text-[9px] px-1.5 py-0.5 ${isInspirational ? "bg-violet-500/10 text-violet-400" : "bg-emerald-500/10 text-emerald-500"}`}>OPEN</span>
          )}
        </div>
      </div>

      {isFlashZone && flashTimer !== null && flashTimer > 0 && (
        <div className="px-3 py-2 bg-red-500/15 border-b border-red-500/30 text-center animate-pulse" data-testid={`flash-warning-${track.id}`}>
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-sm text-red-400 font-extrabold tracking-wider">⚡ TRADING CLOSES IN {formatTimer(flashTimer)}</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          </div>
          <p className="text-[9px] text-red-400/70 font-bold mt-0.5">{unitsRemaining} UNITS REMAINING TO CLOSE POOL — FLASH-POOL ACTIVE</p>
        </div>
      )}

      {isHighCapacity && !isFlashZone && (
        <div className="px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0" />
          <span className="text-[9px] text-yellow-400 font-bold">{capacityPct.toFixed(0)}% CAPACITY — {unitsRemaining} UNITS TO {poolLabel} CEILING</span>
        </div>
      )}

      {isClosed && !isReconciling && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-center">
          <p className="text-[10px] text-red-400 font-bold">POOL CLOSED — ${SETTLEMENT_PAYOUT} SETTLEMENT PENDING TO {HOLDER_COUNT} HOLDERS</p>
        </div>
      )}

      {isReconciling && (
        <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-center animate-pulse" data-testid={`reconciling-${track.id}`}>
          <p className="text-[10px] text-amber-400 font-extrabold">POOL CLOSED — RECONCILING...</p>
          <p className="text-[8px] text-amber-400/50 mt-0.5">SETTLEMENT IN PROGRESS — TRADING WILL REOPEN AFTER RECONCILIATION</p>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-10 h-10 bg-zinc-900 overflow-hidden flex-shrink-0 border border-emerald-500/10">
            {track.coverImage ? (
              <img src={track.coverImage} alt={track.title} className="w-full h-full object-cover opacity-80" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="h-4 w-4 text-emerald-500/30" />
              </div>
            )}
            <button
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => isCurrentTrack ? togglePlay() : onPlay(track)}
              data-testid={`button-play-${track.id}`}
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="h-4 w-4 text-emerald-400" />
              ) : (
                <Play className="h-4 w-4 text-emerald-400" />
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-extrabold text-lime-400 truncate">{track.title.toUpperCase()}</h3>
            <p className="text-[11px] text-zinc-400 font-semibold truncate">{track.artist?.name || "UNKNOWN"}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 mb-1 text-center">
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[10px] text-zinc-400 font-bold">GROSS</p>
            <p className={`text-xs font-extrabold ${isClosed ? "text-red-400" : grossSales > 0 ? "text-lime-400" : "text-zinc-500"}`}>${grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[10px] text-zinc-400 font-bold">UNITS</p>
            <p className="text-xs text-white font-extrabold">{sales.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[10px] text-zinc-400 font-bold">BUY-IN</p>
            <p className={`text-xs font-extrabold ${priceClass}`}>{priceLabel}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 mb-2 text-center">
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-500 font-bold">BUY-BACK</p>
            <p className={`text-[11px] font-extrabold ${bbRate >= 0.42 ? "text-amber-400" : "text-lime-400"}`}>▲ {bbLabel}</p>
          </div>
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-500 font-bold">MINTER FEE</p>
            <p className="text-[11px] font-extrabold text-emerald-400">{minterFeeLabel}</p>
          </div>
          <div className={`bg-zinc-900/80 p-1 border ${isInspirational ? "border-violet-500/20" : "border-zinc-800"}`}>
            <p className="text-[9px] text-zinc-500 font-bold">YIELD</p>
            <p className={`text-[11px] font-extrabold ${isInspirational ? "text-violet-400" : capacityPct >= 45 ? "text-amber-400" : capacityPct >= 30 ? "text-lime-400" : "text-zinc-300"}`}>▲ {yieldPct}</p>
          </div>
        </div>

        {isGlobal ? (
          <div className="mb-2 px-2 py-2 border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-amber-400 font-extrabold flex items-center gap-1"><Globe className="h-3 w-3" /> GLOBAL YIELD ASSET</span>
              <span className="text-[9px] text-amber-300 font-extrabold flex items-center gap-1"><Shield className="h-3 w-3" /> TRUST CERTIFIED</span>
            </div>
            <p className="text-[8px] text-amber-500/40 text-center">ROYALTY-BEARING — GLOBAL DISTRIBUTION — TRUST VAULT EXCLUSIVE</p>
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[10px] font-extrabold ${isFlashZone ? "text-red-400" : "text-zinc-400"}`}>
                POOL: ${grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ${poolCeiling.toLocaleString()} COLLECTED
              </span>
              <span className={`text-[11px] font-extrabold ${isClosed ? "text-red-400" : isFlashZone ? "text-red-400" : isHighCapacity ? "text-amber-400" : "text-lime-400"}`}>{capacityPct}%</span>
            </div>
            <div className="w-full bg-zinc-900 h-2 relative overflow-hidden">
              <div
                className={`h-2 transition-all ${isClosed ? "bg-red-500" : isFlashZone ? "bg-red-500 animate-pulse" : isHighCapacity ? "bg-yellow-500 animate-pulse" : isInspirational ? "bg-violet-500" : "bg-emerald-500"}`}
                style={{ width: `${capacityPct}%` }}
              />
              {isFlashZone && (
                <div className="absolute right-0 top-0 h-2 w-[10%] bg-red-500/30 animate-pulse" />
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-zinc-400 text-[10px] font-bold">@ {priceLabel}/UNIT — {reconciliationPct}% of 1K VOL</span>
              {!isClosed && !isFlashZone && (
                <span className="text-lime-400/70 text-[10px] font-bold">{unitsRemaining} UNITS TO CLOSE</span>
              )}
              {isFlashZone && !isClosed && (
                <span className="text-red-400 text-[10px] font-extrabold animate-pulse">⚡ {unitsRemaining} UNITS LEFT</span>
              )}
              {isClosed && !isReconciling && <span className="text-red-400 text-[10px] font-bold">SETTLED</span>}
              {isReconciling && <span className="text-amber-400 text-[10px] font-extrabold">RECONCILING</span>}
            </div>
          </div>
        )}

        {isInspirational && !isGlobal && (
          <div className="mb-1 px-2 py-1 border border-violet-500/20 bg-violet-500/5 flex items-center justify-between">
            <span className="text-[8px] text-violet-400 font-bold">◆ INSPIRATIONAL CLASS</span>
            <span className="text-[8px] text-violet-300">YIELD BAND: 30%–45%</span>
          </div>
        )}

        <div className="flex gap-1 mb-1">
          <a
            href={BLUEVINE_MINT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-lime-500/10 border border-lime-500/30 text-lime-400 text-[10px] font-extrabold py-1.5 text-center hover:bg-lime-500/20 transition-colors"
            data-testid={`button-mintor-${track.id}`}
          >
            MINTOR $9.99/MO
          </a>
          <a
            href={BLUEVINE_TRUST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-amber-600/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold py-1.5 text-center hover:bg-amber-600/20 transition-colors"
            data-testid={`button-trust-${track.id}`}
          >
            TRUST $25 DOWN
          </a>
        </div>
        <div className="flex gap-1">
          {isClosed || isReconciling ? (
            <div className={`flex-1 ${isReconciling ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-red-500/10 border border-red-500/30 text-red-400"} text-[10px] font-extrabold py-2 text-center flex items-center justify-center gap-1 cursor-not-allowed`} data-testid={`button-closed-${track.id}`}>
              <Lock className="h-3 w-3" /> {isReconciling ? "POOL CLOSED — RECONCILING" : "POOL CLOSED — SETTLED"}
            </div>
          ) : userTier === "free" ? (
            <a
              href="/membership"
              className="flex-1 bg-zinc-800 border border-zinc-600 text-amber-400 text-[11px] font-extrabold py-2 text-center flex items-center justify-center gap-1 hover:border-lime-500/50 hover:text-lime-400 transition-colors"
              data-testid={`button-acquire-locked-${track.id}`}
            >
              <Lock className="h-3 w-3" /> PREMIUM TRADING ACCOUNT REQUIRED
            </a>
          ) : isGlobal ? (
            <a
              href="/membership"
              className="flex-1 bg-amber-600/20 border border-amber-500/40 text-amber-400 text-[11px] font-extrabold py-2 text-center flex items-center justify-center gap-1 hover:border-amber-400/60 hover:bg-amber-600/30 transition-colors"
              data-testid={`button-trust-gate-${track.id}`}
            >
              <Shield className="h-3 w-3" /> TRUST CERTIFICATE REQUIRED — $25 DOWN
            </a>
          ) : isPaperCapHit ? (
            <div
              className="flex-1 bg-amber-600/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold py-2 text-center flex items-center justify-center gap-1"
              data-testid={`button-paper-cap-${track.id}`}
            >
              <AlertTriangle className="h-3 w-3" /> PAPER TRADE CAP — 50% POOL LIMIT HIT
            </div>
          ) : (
            <button
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
              className="flex-1 bg-lime-600 text-white text-[11px] font-extrabold py-2 text-center hover:bg-lime-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              data-testid={`button-acquire-${track.id}`}
            >
              <FileCheck className="h-3 w-3" /> {orderMutation.isPending ? "MINTING..." : `ACQUIRE POSITION @ ${priceLabel}`}
            </button>
          )}
          <button
            className={`flex-1 border ${isGlobal ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"} text-[10px] font-bold py-1.5 text-center transition-colors`}
            onClick={() => onPlay(track)}
            data-testid={`button-stream-${track.id}`}
          >
            <Play className="h-3 w-3 inline mr-1" />STREAM
          </button>
        </div>
      </div>
      {mintReceipt && <MintCertificate receipt={mintReceipt} onClose={() => setMintReceipt(null)} />}
      {trustReceipt && <TrustCertificate receipt={trustReceipt} onClose={() => setTrustReceipt(null)} />}
    </div>
  );
}

interface MarketSession {
  sessionId: string;
  date: string;
  tradingRate: number;
  volatility: number;
  marketSentiment: "BULL" | "BEAR" | "NEUTRAL";
  totalPools: number;
  activePools: number;
  nextFlashTarget: string | null;
  nextFlashAt: number | null;
  buyBackRate: number;
  pools: Array<{
    trackId: string;
    poolSize: number;
    dynamicPrice: number;
    buyBackRate: number;
    paperTradeCap: number;
    minterFee: number;
    seats: number;
    rushMultiplier: number;
    isFlashScheduled: boolean;
    liquiditySplit: { house: number; payout: number };
  }>;
}

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack, setAutopilotPool } = usePlayer();
  const autoPlayedRef = useRef(false);
  const [showIntel, setShowIntel] = useState(false);

  const { data: membership } = useQuery<{ tier: string }>({
    queryKey: ["/api/user/membership"],
    enabled: !!user,
  });
  const userTier = membership?.tier || "free";

  const { data: marketSession } = useQuery<MarketSession>({
    queryKey: ["/api/market/session"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: featuredTracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
    refetchInterval: 30000,
    staleTime: 0,
  });

  const { data: autopilotPoolData } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/autopilot/pool"],
    staleTime: 60000,
  });

  useEffect(() => {
    if (autopilotPoolData && autopilotPoolData.length > 0) {
      setAutopilotPool(autopilotPoolData);
    }
  }, [autopilotPoolData, setAutopilotPool]);

  useEffect(() => {
    if (featuredTracks && featuredTracks.length > 0 && !autoPlayedRef.current && !currentTrack) {
      autoPlayedRef.current = true;
      playTrack(featuredTracks[0], featuredTracks);
    }
  }, [featuredTracks]);

  const isEntryTrader = userTier === "entry_trader";
  const allTracks = featuredTracks || [];
  const displayTracks = isEntryTrader
    ? allTracks.filter(t => !(t as any).isPrerelease)
    : allTracks;

  const totalGrossSales = displayTracks.reduce((sum, t) => {
    const p = parseFloat((t as any).unitPrice || "3.50");
    const s = (t as any).salesCount || 0;
    return sum + (s * p);
  }, 0);
  const totalUnits = displayTracks.reduce((sum, t) => sum + ((t as any).salesCount || 0), 0);
  const closedCount = displayTracks.filter(t => {
    const p = parseFloat((t as any).unitPrice || "3.50");
    const s = (t as any).salesCount || 0;
    const trackPool = marketSession?.pools?.find(pl => pl.trackId === t.id);
    const ceil = trackPool?.poolSize || CEILING;
    return (s * p) >= ceil;
  }).length;
  const openCount = displayTracks.length - closedCount;

  return (
    <div className="min-h-full pb-28 bg-black font-mono">
      <div className="border-b border-emerald-500/20 bg-black">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-emerald-400" />
              <h1 className="text-lg font-bold text-emerald-400 tracking-tight" data-testid="text-terminal-title">
                AITIFY SOVEREIGN EXCHANGE
              </h1>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[9px]">97.7 THE FLAME</Badge>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-zinc-600">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="text-emerald-400">LIVE</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">TOTAL GROSS SALES</p>
              <p className="text-sm text-emerald-400 font-bold">${totalGrossSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">TOTAL UNITS</p>
              <p className="text-sm text-white font-bold">{totalUnits.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">OPEN TRADES</p>
              <p className="text-sm text-emerald-400 font-bold">{openCount}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">CLOSED / TOTAL</p>
              <p className="text-sm font-bold"><span className="text-red-400">{closedCount}</span><span className="text-zinc-600"> / {displayTracks.length}</span></p>
            </div>
          </div>
        </div>
      </div>

      {marketSession && (
        <div className="border-b border-emerald-500/20 bg-black">
          <button
            onClick={() => setShowIntel(!showIntel)}
            className="w-full px-4 py-1.5 flex items-center justify-between text-[10px] hover:bg-zinc-900/50 transition-colors"
            data-testid="button-toggle-intel"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-lime-400" />
              <span className="text-lime-400 font-extrabold tracking-widest">MARKET INTELLIGENCE — CEO HANDS-OFF MODE</span>
              <span className={`px-1.5 py-0.5 font-extrabold text-[8px] border ${
                marketSession.marketSentiment === "BULL"
                  ? "text-lime-400 border-lime-500/40 bg-lime-500/10"
                  : marketSession.marketSentiment === "BEAR"
                  ? "text-red-400 border-red-500/40 bg-red-500/10"
                  : "text-zinc-400 border-zinc-600 bg-zinc-800"
              }`}>
                {marketSession.marketSentiment === "BULL" ? "▲ BULL" : marketSession.marketSentiment === "BEAR" ? "▼ BEAR" : "— NEUTRAL"}
              </span>
            </div>
            <span className="text-zinc-600">{showIntel ? "▲ COLLAPSE" : "▼ EXPAND"}</span>
          </button>

          {showIntel && (
            <div className="px-4 pb-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-zinc-900/80 border border-lime-500/20 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">SESSION ID</p>
                  <p className="text-[10px] text-lime-400 font-bold" data-testid="text-session-id">{marketSession.sessionId}</p>
                </div>
                <div className="bg-zinc-900/80 border border-lime-500/20 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">TODAY'S TRADING RATE</p>
                  <p className="text-sm text-lime-400 font-extrabold" data-testid="text-trading-rate">{marketSession.tradingRate}%</p>
                  <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-lime-500 rounded-full" style={{ width: `${((marketSession.tradingRate - 35) / 20) * 100}%` }} />
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-lime-500/20 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">MARKET VOLATILITY</p>
                  <p className={`text-sm font-extrabold ${marketSession.volatility > 30 ? "text-red-400" : marketSession.volatility > 20 ? "text-amber-400" : "text-lime-400"}`} data-testid="text-volatility">
                    {marketSession.volatility}%
                  </p>
                  <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${marketSession.volatility > 30 ? "bg-red-500" : marketSession.volatility > 20 ? "bg-amber-500" : "bg-lime-500"}`} style={{ width: `${(marketSession.volatility / 45) * 100}%` }} />
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-lime-500/20 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">LIQUIDITY SPLIT</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-emerald-400 font-bold">70% PAYOUT</span>
                    <span className="text-[10px] text-zinc-600">|</span>
                    <span className="text-[10px] text-amber-400 font-bold">30% HOUSE</span>
                  </div>
                  <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: "70%" }} />
                    <div className="h-full bg-amber-500 rounded-r-full" style={{ width: "30%" }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="bg-zinc-900/80 border border-zinc-800 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">ACTIVE POOLS</p>
                  <p className="text-sm text-white font-bold">{marketSession.activePools} <span className="text-zinc-600 text-[9px]">/ {marketSession.totalPools}</span></p>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">POOL TIERS TODAY</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[9px] text-zinc-400 font-bold">$500: {marketSession.pools?.filter(p => p.poolSize === 500).length || 0}</span>
                    <span className="text-[9px] text-lime-400 font-bold">$1K: {marketSession.pools?.filter(p => p.poolSize === 1000).length || 0}</span>
                    <span className="text-[9px] text-amber-400 font-bold">$2K: {marketSession.pools?.filter(p => p.poolSize === 2000).length || 0}</span>
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-2">
                  <p className="text-[8px] text-zinc-600 tracking-widest">FLASH WARNINGS TODAY</p>
                  <p className="text-sm text-red-400 font-bold">
                    {marketSession.pools?.filter(p => p.isFlashScheduled).length || 0}
                    <span className="text-[9px] text-zinc-600 ml-1">SCHEDULED</span>
                  </p>
                  {marketSession.nextFlashAt && (
                    <p className="text-[8px] text-red-400 animate-pulse mt-0.5">
                      ⚡ NEXT FLASH: {new Date(marketSession.nextFlashAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-zinc-600">VARIANTS:</span>
          <span className="text-emerald-400">$0.99</span>
          <span className="text-amber-400">$2.50</span>
          <span className="text-yellow-400">$5.00</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CLASS:</span>
          <span className="text-emerald-400">STD</span>
          <span className="text-violet-400">INSP</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CEILING:</span>
          <span className="text-emerald-400">DYNAMIC</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">SETTLEMENT:</span>
          <span className="text-emerald-400">${SETTLEMENT_PAYOUT} → {HOLDER_COUNT} HOLDERS</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-600">{user?.firstName || user?.email || "PUBLIC"}</span>
        </div>
      </div>

      <div className="px-4 py-4">
        {loadingTracks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-black border border-zinc-800 p-4">
                <Skeleton className="h-3 w-24 mb-2 bg-zinc-800" />
                <Skeleton className="h-10 w-full mb-2 bg-zinc-800" />
                <Skeleton className="h-6 w-full bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : displayTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {displayTracks.map((track) => (
              <AssetCard
                key={track.id}
                track={track}
                onPlay={(t) => playTrack(t, displayTracks)}
                userTier={userTier}
                dynamicPoolSize={marketSession?.pools?.find(p => p.trackId === track.id)?.poolSize}
                dynamicPrice={marketSession?.pools?.find(p => p.trackId === track.id)?.dynamicPrice}
                buyBackRate={marketSession?.pools?.find(p => p.trackId === track.id)?.buyBackRate}
                paperTradeCap={marketSession?.pools?.find(p => p.trackId === track.id)?.paperTradeCap}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-zinc-800">
            <Zap className="h-8 w-8 text-emerald-500/30 mx-auto mb-3" />
            <p className="text-emerald-500/50 text-sm">NO ASSETS LISTED</p>
            <p className="text-zinc-700 text-[10px] mt-1">Add rows to the database to list assets</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[9px] text-zinc-600 font-mono">
          <span>AITIFY SOVEREIGN MINT | 97.7 THE FLAME | AityPay ENGINE</span>
          <span>CEILING: DYNAMIC | PAYOUT: ${SETTLEMENT_PAYOUT} → {HOLDER_COUNT} HOLDERS | SPLIT: 70/30</span>
        </div>
      </div>
    </div>
  );
}
