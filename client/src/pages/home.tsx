import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Play, Pause, Music, Activity, Zap, Lock, AlertTriangle, FileCheck, X, Globe, Shield, ExternalLink, Cpu, Binary } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrackWithArtist } from "@shared/schema";

const CEILING = 1000.00;
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

function AssetCard({ track, onPlay }: { track: TrackWithArtist; onPlay: (t: TrackWithArtist) => void }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [mintReceipt, setMintReceipt] = useState<MintReceipt | null>(null);
  const [trustReceipt, setTrustReceipt] = useState<TrustReceipt | null>(null);

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

  const price = parseFloat((track as any).unitPrice || "0.99");
  const sales = (track as any).salesCount || 0;
  const assetClass = ((track as any).assetClass || "standard").toLowerCase();
  const releaseType = ((track as any).releaseType || "native").toLowerCase();
  const isGlobal = releaseType === "global";
  const isInspirational = assetClass === "inspirational";
  const grossSales = parseFloat((sales * price).toFixed(2));
  const capacityPct = Math.min(100, parseFloat(((grossSales / CEILING) * 100).toFixed(1)));
  const isClosed = !isGlobal && grossSales >= CEILING;
  const isHighCapacity = !isGlobal && capacityPct >= 60 && !isClosed;
  const remaining = Math.max(0, parseFloat((CEILING - grossSales).toFixed(2)));
  const yieldPct = capacityPct >= 45 ? "45%" : capacityPct >= 30 ? "30%" : "16%";

  const priceLabel = price === 0.99 ? "$0.99" : price === 2.50 ? "$2.50" : price === 5.00 ? "$5.00" : `$${price.toFixed(2)}`;
  const priceClass = price >= 5 ? "text-yellow-400" : price >= 2.50 ? "text-blue-400" : "text-emerald-400";

  const borderColor = isClosed ? "border-red-500/40" : isHighCapacity ? "border-yellow-500/40" : isGlobal ? "border-blue-500/30 hover:border-blue-500/60" : isInspirational ? "border-violet-500/40 hover:border-violet-500/70" : "border-emerald-500/20 hover:border-emerald-500/60";
  const headerBg = isClosed ? "border-red-500/20 bg-red-500/5" : isHighCapacity ? "border-yellow-500/20 bg-yellow-500/5" : isGlobal ? "border-blue-500/20 bg-blue-500/5" : isInspirational ? "border-violet-500/20 bg-violet-500/5" : "border-emerald-500/10 bg-emerald-500/5";

  return (
    <div className={`bg-black border font-mono group transition-all ${borderColor}`} data-testid={`asset-card-${track.id}`}>
      <div className={`border-b px-3 py-1.5 flex items-center justify-between ${headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs ${isClosed ? "text-red-400" : isGlobal ? "text-blue-400" : isInspirational ? "text-violet-400" : "text-emerald-400"}`}>{ticker}</span>
          <span className="text-zinc-600 text-[9px]">{assetId}</span>
          {isGlobal && (
            <span className="text-[8px] px-1 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" /> GLOBAL</span>
          )}
          {isInspirational && !isGlobal && (
            <span className="text-[8px] px-1 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold">INSPIRATIONAL</span>
          )}
          {!isGlobal && !isInspirational && (
            <span className="text-[8px] px-1 py-0.5 bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/20 font-bold">NATIVE</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold ${priceClass}`}>{priceLabel}</span>
          {isGlobal ? (
            <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 font-bold flex items-center gap-1">
              <Shield className="h-2.5 w-2.5" /> VERIFIED
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

      {isHighCapacity && (
        <div className="px-3 py-1.5 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0" />
          <span className="text-[9px] text-yellow-400 font-bold">{capacityPct.toFixed(0)}% CAPACITY — RECONCILIATION AT $1K CEILING</span>
        </div>
      )}

      {isClosed && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-center">
          <p className="text-[10px] text-red-400 font-bold">TRADE CLOSED — ${SETTLEMENT_PAYOUT} SETTLEMENT PENDING TO {HOLDER_COUNT} HOLDERS</p>
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
            <h3 className="text-xs font-bold text-emerald-400 truncate">{track.title.toUpperCase()}</h3>
            <p className="text-[10px] text-zinc-600 truncate">{track.artist?.name || "UNKNOWN"}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 mb-2 text-center">
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">GROSS SALES</p>
            <p className={`text-[11px] font-bold ${isClosed ? "text-red-400" : grossSales > 0 ? "text-emerald-400" : "text-zinc-500"}`}>${grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">UNITS SOLD</p>
            <p className="text-[11px] text-white font-bold">{sales.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">UNIT PRICE</p>
            <p className={`text-[11px] font-bold ${priceClass}`}>{priceLabel}</p>
          </div>
          <div className={`bg-zinc-900/80 p-1.5 border ${isInspirational ? "border-violet-500/20" : "border-zinc-800"}`}>
            <p className="text-[9px] text-zinc-600">YIELD</p>
            <p className={`text-[11px] font-bold ${isInspirational ? "text-violet-400" : capacityPct >= 45 ? "text-yellow-400" : capacityPct >= 30 ? "text-emerald-400" : "text-zinc-400"}`}>▲ {yieldPct}</p>
          </div>
        </div>

        {isGlobal ? (
          <div className="mb-2 px-2 py-2 border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-blue-400 font-bold flex items-center gap-1"><Globe className="h-3 w-3" /> VERIFIED GLOBAL RELEASE</span>
              <span className="text-[9px] text-blue-300 font-bold flex items-center gap-1"><Shield className="h-3 w-3" /> TRUST CERTIFIED</span>
            </div>
            <p className="text-[8px] text-blue-500/40 text-center">NO CAP LIMIT — GLOBAL DISTRIBUTION — STORE FULFILLMENT</p>
          </div>
        ) : (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-zinc-600">SALES → $1K CEILING</span>
              <span className={`text-[10px] font-bold ${isClosed ? "text-red-400" : isHighCapacity ? "text-yellow-400" : "text-emerald-400"}`}>{capacityPct}%</span>
            </div>
            <div className="w-full bg-zinc-900 h-1.5">
              <div
                className={`h-1.5 transition-all ${isClosed ? "bg-red-500" : isHighCapacity ? "bg-yellow-500 animate-pulse" : isInspirational ? "bg-violet-500" : "bg-emerald-500"}`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-zinc-600 text-[9px]">@ {priceLabel}/UNIT</span>
              {!isClosed && <span className="text-emerald-500/50 text-[9px]">${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} TO CLOSE</span>}
              {isClosed && <span className="text-red-400 text-[9px]">SETTLED</span>}
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
            href="/membership"
            className="flex-1 bg-yellow-600/20 border border-yellow-600/30 text-yellow-300 text-[9px] font-bold py-1.5 text-center hover:bg-yellow-600/30 transition-colors"
            data-testid={`button-ceo-${track.id}`}
          >
            CEO $99 / $475 TERMS
          </a>
          <a
            href="/membership"
            className="flex-1 bg-blue-600/20 border border-blue-600/30 text-blue-300 text-[9px] font-bold py-1.5 text-center hover:bg-blue-600/30 transition-colors"
            data-testid={`button-investor-${track.id}`}
          >
            INVESTOR $25 / $475
          </a>
        </div>
        <div className="flex gap-1">
          {isClosed ? (
            <div className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold py-1.5 text-center flex items-center justify-center gap-1 cursor-not-allowed">
              <Lock className="h-3 w-3" /> TRADE CLOSED
            </div>
          ) : isGlobal ? (
            <button
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
              className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-1.5 text-center hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              data-testid={`button-acquire-${track.id}`}
            >
              <Globe className="h-3 w-3" /> {orderMutation.isPending ? "VERIFYING..." : `ACQUIRE TRUST @ ${priceLabel}`}
            </button>
          ) : (
            <button
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
              className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-1.5 text-center hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              data-testid={`button-acquire-${track.id}`}
            >
              <FileCheck className="h-3 w-3" /> {orderMutation.isPending ? "MINTING..." : `ACQUIRE POSITION @ ${priceLabel}`}
            </button>
          )}
          <button
            className={`flex-1 border ${isGlobal ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"} text-[10px] font-bold py-1.5 text-center transition-colors`}
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

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();
  const autoPlayedRef = useRef(false);

  const { data: featuredTracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
    refetchInterval: 30000,
    staleTime: 0,
  });

  useEffect(() => {
    if (featuredTracks && featuredTracks.length > 0 && !autoPlayedRef.current && !currentTrack) {
      autoPlayedRef.current = true;
      playTrack(featuredTracks[0], featuredTracks);
    }
  }, [featuredTracks]);

  const displayTracks = featuredTracks || [];

  const totalGrossSales = displayTracks.reduce((sum, t) => {
    const p = parseFloat((t as any).unitPrice || "0.99");
    const s = (t as any).salesCount || 0;
    return sum + (s * p);
  }, 0);
  const totalUnits = displayTracks.reduce((sum, t) => sum + ((t as any).salesCount || 0), 0);
  const closedCount = displayTracks.filter(t => {
    const p = parseFloat((t as any).unitPrice || "0.99");
    const s = (t as any).salesCount || 0;
    return (s * p) >= CEILING;
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

      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-zinc-600">VARIANTS:</span>
          <span className="text-emerald-400">$0.99</span>
          <span className="text-blue-400">$2.50</span>
          <span className="text-yellow-400">$5.00</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CLASS:</span>
          <span className="text-emerald-400">STD</span>
          <span className="text-violet-400">INSP</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CEILING:</span>
          <span className="text-emerald-400">${CEILING.toLocaleString()}</span>
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
          <span>CEILING: ${CEILING.toLocaleString()} | PAYOUT: ${SETTLEMENT_PAYOUT} → {HOLDER_COUNT} HOLDERS</span>
        </div>
      </div>
    </div>
  );
}
