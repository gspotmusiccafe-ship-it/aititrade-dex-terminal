import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Music, Activity, Zap, Lock, AlertTriangle, FileCheck, X, Globe, Shield, ExternalLink, Cpu, Binary, Radio, GripVertical, Plus, Trash2, ChevronDown, ChevronUp, DollarSign, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TrackWithArtist } from "@shared/schema";
import { Link } from "wouter";
import { getPortal, PortalBadge, LivingTicker, usePortalConfigs } from "@/components/TradePortal";
import { TrustTutorial } from "@/components/TrustTutorial";

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
  floorRetained: number;
  ceoGross: number;
  trustTithe: number;
  blessingPool: number;
  aiModel: string;
  grossSales: number;
  totalMints: number;
  mintCap: number;
  capacityPct: number;
  priority: string;
  indicator: string;
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
              <p className="text-[8px] text-yellow-400/60 mb-1.5 text-center tracking-widest">G. SMOOTH GLOBAL MANDATE — DISBURSEMENT</p>
              <div className="grid grid-cols-2 gap-1.5 text-center mb-1.5">
                <div className="bg-black/50 border border-emerald-500/15 p-2">
                  <p className="text-[8px] text-emerald-500/50">FLOOR RETAINED (54%)</p>
                  <p className="text-sm text-emerald-400 font-bold" data-testid="text-floor-retained">${receipt.floorRetained.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-yellow-500/15 p-2">
                  <p className="text-[8px] text-yellow-400/50">CEO GROSS (46%)</p>
                  <p className="text-sm text-yellow-400 font-bold" data-testid="text-ceo-gross">${receipt.ceoGross.toFixed(4)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-black/50 border border-amber-500/15 p-2">
                  <p className="text-[8px] text-amber-400/50">TRUST TITHE (10%)</p>
                  <p className="text-sm text-amber-400 font-bold" data-testid="text-trust-tithe">${receipt.trustTithe.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-green-500/15 p-2">
                  <p className="text-[8px] text-green-400/50">BLESSING POOL</p>
                  <p className="text-sm text-green-400 font-bold" data-testid="text-blessing-pool">${receipt.blessingPool.toFixed(4)}</p>
                </div>
              </div>
            </div>
            {receipt.priority === "HIGH" && (
              <div className="border border-lime-400/30 bg-lime-500/5 p-1.5 text-center">
                <p className="text-[9px] text-lime-400 font-black tracking-wider">PRIORITY: HIGH — THIN SPREAD SETTLEMENT</p>
              </div>
            )}
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
                {receipt.status === "CLOSED" ? "TRADE CLOSED — SETTLEMENT PENDING" : "TRADE_EXECUTED — STIMULATION_ACTIVE"}
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
              <p className="text-[7px] text-emerald-500/20 tracking-widest">AITITRADE DIGITAL ASSET EXCHANGE — 100% AI-POWERED PLATFORM</p>
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
  floorRetained: number;
  ceoGross: number;
  trustTithe: number;
  blessingPool: number;
  aiModel: string;
  priority: string;
  indicator: string;
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
              <p className="text-[8px] text-yellow-400/60 mb-1.5 text-center tracking-widest">G. SMOOTH GLOBAL MANDATE — DISBURSEMENT</p>
              <div className="grid grid-cols-2 gap-1.5 text-center mb-1.5">
                <div className="bg-black/50 border border-emerald-500/15 p-2">
                  <p className="text-[8px] text-emerald-500/50">FLOOR RETAINED (54%)</p>
                  <p className="text-sm text-emerald-400 font-bold">${receipt.floorRetained.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-yellow-500/15 p-2">
                  <p className="text-[8px] text-yellow-400/50">CEO GROSS (46%)</p>
                  <p className="text-sm text-yellow-400 font-bold">${receipt.ceoGross.toFixed(4)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="bg-black/50 border border-amber-500/15 p-2">
                  <p className="text-[8px] text-amber-400/50">TRUST TITHE (10%)</p>
                  <p className="text-sm text-amber-400 font-bold">${receipt.trustTithe.toFixed(4)}</p>
                </div>
                <div className="bg-black/50 border border-green-500/15 p-2">
                  <p className="text-[8px] text-green-400/50">BLESSING POOL</p>
                  <p className="text-sm text-green-400 font-bold">${receipt.blessingPool.toFixed(4)}</p>
                </div>
              </div>
            </div>
            {receipt.priority === "HIGH" && (
              <div className="border border-lime-400/30 bg-lime-500/5 p-1.5 text-center">
                <p className="text-[9px] text-lime-400 font-black tracking-wider">PRIORITY: HIGH — THIN SPREAD SETTLEMENT</p>
              </div>
            )}
            <div className="border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-center">
              <p className="text-sm font-black text-emerald-400">TRADE_EXECUTED — STIMULATION_ACTIVE</p>
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
              <p className="text-[7px] text-emerald-500/20 tracking-widest">AITITRADE DIGITAL ASSET EXCHANGE — 100% AI-POWERED PLATFORM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeCashAppCheckout({ track, open, onClose, onSuccess }: { track: TrackWithArtist; open: boolean; onClose: () => void; onSuccess: (data: any) => void }) {
  const [processing, setProcessing] = useState(false);
  const [tradeData, setTradeData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const price = parseFloat(track.unitPrice || "0.99");
  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;

  const handleAcquire = async () => {
    try {
      setProcessing(true);
      setError(null);

      const res = await fetch("/api/exchange/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ trackId: track.id, amount: price }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Trade failed");
      }

      const data = await res.json();
      setTradeData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });

      window.open(data.url, "_blank");

      toast({ title: "POSITION LOCKED", description: `${data.trackingNumber} — Send to ${data.cashtag}` });

      const isGlobal = track.releaseType === "global";
      if (isGlobal) {
        onSuccess({ type: "global", receipt: { trustId: data.trackingNumber, asset: data.asset, ticker: data.ticker, unitPrice: data.unitPrice, floorRetained: data.floorRetained, ceoGross: data.ceoGross, trustTithe: data.trustTithe, blessingPool: data.blessingPool, aiModel: data.aiModel, priority: data.priority, indicator: data.indicator, storeUrl: "https://payhip.com/aitifymusicstore", timestamp: data.timestamp } });
      } else {
        onSuccess({ type: "native", receipt: { mintId: data.trackingNumber, asset: data.asset, ticker: data.ticker, unitPrice: data.unitPrice, floorRetained: data.floorRetained, ceoGross: data.ceoGross, trustTithe: data.trustTithe, blessingPool: data.blessingPool, aiModel: data.aiModel, grossSales: data.grossSales, totalMints: data.totalMints, mintCap: data.mintCap, capacityPct: data.capacityPct, priority: data.priority, indicator: data.indicator, status: data.status === "CLOSED" ? "CLOSED" : "TRADE_EXECUTED", timestamp: data.timestamp } });
      }
    } catch (e: any) {
      setError(e.message || "Failed to process trade");
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black border-2 border-lime-500/60 font-mono max-w-sm w-full shadow-2xl shadow-lime-500/20 relative overflow-hidden" onClick={e => e.stopPropagation()} data-testid={`trade-cashapp-dialog-${track.id}`}>
        <div className="border-b border-lime-500/30 px-4 py-2.5 flex items-center justify-between bg-lime-950/80">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-lime-400" />
            <span className="text-[11px] text-lime-400 font-bold tracking-wider">ACQUIRE POSITION — CASH APP</span>
          </div>
          <button onClick={onClose} className="text-lime-500/40 hover:text-lime-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="border border-lime-400/20 bg-lime-950/30 p-3 text-center">
            <p className="text-[10px] text-lime-400 font-black tracking-[0.25em]">AITITRADE BROKERAGE — POSITION ORDER</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-zinc-900/80 border border-lime-500/15 p-2.5">
              <p className="text-[8px] text-lime-500/40 tracking-wider">ASSET</p>
              <p className="text-sm text-lime-400 font-bold mt-0.5">{ticker}</p>
            </div>
            <div className="bg-zinc-900/80 border border-lime-500/15 p-2.5">
              <p className="text-[8px] text-lime-500/40 tracking-wider">BUY-IN PRICE</p>
              <p className="text-xl text-lime-400 font-black mt-0.5">${price.toFixed(2)}</p>
            </div>
          </div>
          <div className="border-2 border-green-500/40 bg-green-950/30 p-3 text-center">
            <p className="text-[9px] text-green-400/70 tracking-wider mb-1">SEND PAYMENT TO</p>
            <p className="text-2xl text-green-400 font-black tracking-wider">$AITITRADEBROKERAGE</p>
            <p className="text-[8px] text-green-500/50 mt-1">VIA CASH APP</p>
          </div>
          <div className="border border-lime-500/20 bg-lime-950/30 p-2.5 text-center">
            <p className="text-[9px] text-lime-500/50">54% FLOOR RETAINED — 46% CEO GROSS (G. SMOOTH MANDATE)</p>
            <p className="text-[8px] text-zinc-600 mt-1">ONCE PAID, TRADE LOCKS — STIMULATION STARTING</p>
          </div>
          {tradeData && (
            <div className="border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-center">
              <p className="text-[8px] text-emerald-500/50 tracking-wider">TRACKING NUMBER</p>
              <p className="text-sm text-emerald-400 font-black">{tradeData.trackingNumber}</p>
              <p className="text-[8px] text-emerald-500/30 mt-1">INCLUDE IN CASH APP NOTE</p>
            </div>
          )}
          {error && (
            <div className="border border-red-500/30 bg-red-500/10 p-2 text-center">
              <p className="text-[10px] text-red-400 font-bold">{error}</p>
            </div>
          )}
          {processing ? (
            <div className="border border-lime-500/30 bg-lime-950/30 p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-lime-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-[11px] text-lime-400 font-bold animate-pulse">LOCKING POSITION...</p>
              </div>
            </div>
          ) : !tradeData ? (
            <button
              onClick={handleAcquire}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3 text-sm tracking-wider transition-colors"
              data-testid={`button-cashapp-trade-${track.id}`}
            >
              <DollarSign className="h-4 w-4 inline mr-1" />
              ACQUIRE POSITION — OPEN CASH APP
            </button>
          ) : (
            <a
              href={tradeData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-black py-3 text-sm tracking-wider transition-colors text-center"
              data-testid="link-cashapp-pay"
            >
              OPEN CASH APP — $AITITRADEBROKERAGE
            </a>
          )}
        </div>
      </div>
    </div>
  );
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

function useSettlementStatus() {
  return useQuery<SettlementStatus>({
    queryKey: ["/api/settlement/status"],
    refetchInterval: 15000,
    staleTime: 10000,
  });
}

function AssetCard({ track, onPlay, settlement }: { track: TrackWithArtist; onPlay: (t: TrackWithArtist) => void; settlement?: SettlementStatus }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [mintReceipt, setMintReceipt] = useState<MintReceipt | null>(null);
  const [trustReceipt, setTrustReceipt] = useState<TrustReceipt | null>(null);
  const [flashTimer, setFlashTimer] = useState<number | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [showP2P, setShowP2P] = useState(false);
  const flashTriggeredRef = useRef(false);

  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;
  const assetId = `ATFY-${String(track.id).slice(0, 5).toUpperCase()}`;

  const price = parseFloat((track as any).unitPrice || "3.50");
  const sales = (track as any).salesCount || 0;
  const assetClass = ((track as any).assetClass || "standard").toLowerCase();
  const releaseType = ((track as any).releaseType || "native").toLowerCase();
  const isGlobal = releaseType === "global";
  const isInspirational = assetClass === "inspirational";
  const portal = getPortal(price);
  const poolCeiling = isGlobal ? CEILING : portal.pool;
  const ptCap = poolCeiling * 0.50;
  const bbPrice = parseFloat((track as any).buyBackRate || (price * portal.mbb).toFixed(2));
  const maxPayout = parseFloat((price * portal.mbb).toFixed(2));
  const earlyExit = parseFloat((price * portal.early).toFixed(2));
  const roi = price > 0 ? parseFloat((((maxPayout - price) / price) * 100).toFixed(0)) : 0;
  const bbLabel = `$${maxPayout.toFixed(2)} (${roi}% ROI)`;
  const minterFeeLabel = "54/46";
  const grossSales = parseFloat((sales * price).toFixed(2));

  const globalGross = settlement?.grossIntake || 0;
  const nextKAt = settlement?.nextKAt || 1000;
  const globalRemaining = Math.max(0, parseFloat((nextKAt - globalGross).toFixed(2)));
  const globalPct = Math.min(100, parseFloat(((globalGross % 1000) / 1000 * 100).toFixed(1)));
  const ksReached = settlement?.ksReached || 0;
  const fundAvailable = settlement?.fundAvailable || 0;

  const capacityPct = globalPct;
  const isSettlementClose = globalRemaining <= 200 && globalRemaining > 50;
  const isSettlementImminent = globalRemaining <= 50 && globalRemaining > 0;
  const isFlashZone = isSettlementImminent;
  const isClosed = false;
  const isPaperCapHit = false;
  const isHighCapacity = isSettlementClose;
  const remaining = globalRemaining;
  const unitsRemaining = price > 0 ? Math.ceil(remaining / price) : 0;
  const poolLabel = `$1K CYCLE #${ksReached + 1}`;
  const yieldPct = capacityPct >= 45 ? "45%" : capacityPct >= 30 ? "30%" : "16%";

  const urgencyColor = isSettlementImminent ? "text-red-400" : isSettlementClose ? "text-amber-400" : "text-lime-400";
  const urgencyBg = isSettlementImminent ? "bg-red-500" : isSettlementClose ? "bg-amber-500" : "bg-emerald-500";
  const urgencyPulse = isSettlementImminent ? "animate-pulse" : isSettlementClose ? "animate-pulse" : "";

  useEffect(() => {
    if (isFlashZone && !flashTriggeredRef.current && !isClosed) {
      flashTriggeredRef.current = true;
    }
  }, [isFlashZone, isClosed]);

  useEffect(() => {
    if (flashTimer === null || flashTimer <= 0) return;
    const interval = setInterval(() => {
      setFlashTimer(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
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
          {!isGlobal && <PortalBadge unitPrice={price} />}
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

      {isSettlementClose && !isSettlementImminent && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
          <span className="text-[9px] text-amber-400 font-bold">
            ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} AWAY — SETTLEMENT CLOSING — {unitsRemaining} TRADES TO $540 PAYOUT
          </span>
        </div>
      )}

      {isSettlementImminent && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 text-center animate-pulse">
          <p className="text-[10px] text-red-400 font-extrabold">
            ⚡ ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} AWAY — SETTLEMENT IMMINENT — NEXT TRADE COULD CLOSE IT ⚡
          </p>
          <p className="text-[8px] text-red-400/70 mt-0.5">$540 PAYOUT DROPS WHEN GROSS HITS ${nextKAt.toLocaleString('en-US')} — TRADE NOW TO LOCK POSITION</p>
        </div>
      )}

      {fundAvailable > 0 && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
          <DollarSign className="h-3 w-3 text-emerald-400 flex-shrink-0" />
          <span className="text-[9px] text-emerald-400 font-bold">
            ${fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })} SETTLEMENT FUND AVAILABLE — ACCEPT OR HOLD
          </span>
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
            <p className={`text-[11px] font-extrabold ${bbPrice >= 0.42 ? "text-amber-400" : "text-lime-400"}`}>▲ {bbLabel}</p>
          </div>
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-500 font-bold">SPLIT</p>
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
                MARKET PROGRESS
              </span>
              <span className={`text-[11px] font-extrabold ${isClosed ? "text-red-400" : isFlashZone ? "text-red-400" : isHighCapacity ? "text-amber-400" : "text-lime-400"}`}>
                ${globalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })} / ${nextKAt.toLocaleString('en-US')} — NEXT $540 PAYOUT
              </span>
            </div>
            <div className="w-full bg-zinc-900 h-3 relative overflow-hidden border border-zinc-700/50">
              <div
                className={`h-full transition-all duration-500 ${urgencyBg} ${urgencyPulse}`}
                style={{ width: `${capacityPct}%` }}
              />
              {capacityPct >= 50 && capacityPct < 90 && (
                <div className="absolute left-1/2 top-0 h-full w-px bg-amber-500/40" title="54% Settlement Line" />
              )}
              {isFlashZone && (
                <div className="absolute right-0 top-0 h-full w-[10%] bg-red-500/30 animate-pulse" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-[8px] font-black ${capacityPct > 50 ? "text-black" : "text-zinc-400"}`}>
                  {capacityPct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-zinc-400 text-[10px] font-bold">@ {priceLabel}/UNIT | {portal.name}</span>
              {!isFlashZone && (
                <span className="text-lime-400/70 text-[10px] font-bold">${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} TO NEXT $540</span>
              )}
              {isFlashZone && (
                <span className="text-red-400 text-[10px] font-extrabold animate-pulse">⚡ ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} — SETTLEMENT IMMINENT</span>
              )}
              {fundAvailable > 0 && (
                <span className="text-emerald-400 text-[10px] font-extrabold">${fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })} PAYABLE</span>
              )}
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
          <Link
            href="/trust-vault"
            className="flex-1 bg-amber-600/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold py-1.5 text-center hover:bg-amber-600/20 transition-colors flex items-center justify-center gap-1"
            data-testid={`button-trust-link-${track.id}`}
          >
            <Shield className="h-3 w-3" /> TRUST VAULT
          </Link>
          <Link
            href="/artist-portal"
            className="flex-1 bg-violet-500/10 border border-violet-500/30 text-violet-400 text-[10px] font-extrabold py-1.5 text-center hover:bg-violet-500/20 transition-colors flex items-center justify-center gap-1"
            data-testid={`button-mentor-link-${track.id}`}
          >
            <Users className="h-3 w-3" /> MENTOR
          </Link>
        </div>
        <div className="flex gap-1">
          {isClosed || isReconciling ? (
            <div className={`flex-1 ${isReconciling ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" : "bg-red-500/10 border border-red-500/30 text-red-400"} text-[10px] font-extrabold py-2 text-center flex items-center justify-center gap-1 cursor-not-allowed`} data-testid={`button-closed-${track.id}`}>
              <Lock className="h-3 w-3" /> {isReconciling ? "POOL CLOSED — RECONCILING" : "POOL CLOSED — SETTLED"}
            </div>
          ) : isPaperCapHit ? (
            <div
              className="flex-1 bg-amber-600/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold py-2 text-center flex items-center justify-center gap-1"
              data-testid={`button-paper-cap-${track.id}`}
            >
              <AlertTriangle className="h-3 w-3" /> PAPER TRADE CAP — 50% POOL LIMIT HIT
            </div>
          ) : (
            <button
              onClick={() => setShowPayPal(true)}
              className="flex-1 bg-lime-600 text-white text-[11px] font-extrabold py-2 text-center hover:bg-lime-700 transition-colors flex items-center justify-center gap-1"
              data-testid={`button-acquire-${track.id}`}
            >
              <DollarSign className="h-3 w-3" /> ACQUIRE POSITION — CASH APP
            </button>
          )}
          <button
            className={`flex-1 border ${isGlobal ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"} text-[10px] font-bold py-1.5 text-center transition-colors`}
            onClick={() => onPlay(track)}
            data-testid={`button-stream-${track.id}`}
          >
            <Play className="h-3 w-3 inline mr-1" />STREAM
          </button>
          <button
            onClick={() => setShowP2P(!showP2P)}
            className={`border text-[10px] font-bold py-1.5 px-2 text-center transition-colors ${showP2P ? "border-green-500/50 text-green-400 bg-green-500/10" : "border-zinc-700 text-zinc-500 hover:border-green-500/30 hover:text-green-400"}`}
            data-testid={`button-p2p-toggle-${track.id}`}
          >
            <Users className="h-3 w-3 inline mr-0.5" />P2P
          </button>
        </div>
      </div>
      {showP2P && (
        <div className="border-t-2 border-green-600 bg-black p-4 shadow-[0_0_15px_rgba(0,255,0,0.1)]" data-testid={`p2p-terminal-${track.id}`}>
          <h3 className="text-white font-black italic text-lg mb-2 uppercase truncate">
            {track.title} <span className="text-green-500 text-sm not-italic">P2P FLOOR</span>
          </h3>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-zinc-500 text-[9px] font-bold tracking-wider">CURRENT TBI (BUY-IN)</p>
              <p className="text-white text-2xl font-black">${price.toFixed(2)}</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-500 text-[9px] font-bold tracking-wider">MBB TARGET</p>
              <p className="text-green-400 text-lg font-bold">$21.00</p>
            </div>
          </div>
          <button
            onClick={() => window.open("https://cash.app/$AITITRADEBROKERAGE", "_blank", "noopener,noreferrer")}
            className="w-full bg-green-600 hover:bg-green-400 text-white py-3 font-black text-sm transition-all border-b-4 border-green-900 active:border-b-0 flex items-center justify-center gap-2"
            data-testid={`button-p2p-execute-${track.id}`}
          >
            <DollarSign className="h-4 w-4" /> EXECUTE P2P TRADE — $AITITRADEBROKERAGE
          </button>
          <p className="text-[9px] text-zinc-600 mt-2 text-center uppercase tracking-widest">
            No PayPal • Direct Peer-to-Peer Settlement • 54% Floor Protected
          </p>
        </div>
      )}
      {mintReceipt && <MintCertificate receipt={mintReceipt} onClose={() => setMintReceipt(null)} />}
      {trustReceipt && <TrustCertificate receipt={trustReceipt} onClose={() => setTrustReceipt(null)} />}
      <TradeCashAppCheckout
        track={track}
        open={showPayPal}
        onClose={() => setShowPayPal(false)}
        onSuccess={(data: any) => {
          if (data.type === "global") {
            setTrustReceipt(data.receipt);
          } else {
            setMintReceipt(data.receipt);
          }
        }}
      />
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
  usePortalConfigs();

  const { data: trustStatus } = useQuery<{ isMember: boolean }>({
    queryKey: ["/api/trust/status"],
    enabled: !!user,
  });

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

  const { data: settlementData } = useQuery<SettlementStatus>({
    queryKey: ["/api/settlement/status"],
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: !!user,
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

  const allTracks = featuredTracks || [];
  const displayTracks = allTracks;

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
      <TrustTutorial />
      <div className="border-b border-emerald-500/20 bg-black">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-white" />
              <h1 className="text-lg font-black tracking-tighter text-white" data-testid="text-terminal-title">
                AITITRADE <span className="text-green-500">DIGITAL ASSET EXCHANGE</span>
              </h1>
              <div className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse font-bold">LIVE FLOOR</div>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-zinc-600">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[9px]">97.7 THE FLAME</Badge>
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

      <div className="flex gap-4 p-2 px-4 bg-black border-b border-zinc-800 items-center" data-testid="trade-indicators-bar">
        <div className="flex flex-col">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Market Floor</span>
          <span className={`text-sm font-mono font-black ${closedCount === 0 ? "text-green-500" : closedCount >= displayTracks.length * 0.5 ? "text-red-500" : "text-amber-400"}`}>
            $1,000.00 {closedCount === 0 ? "▲" : closedCount >= displayTracks.length * 0.5 ? "▼" : "—"}
          </span>
        </div>

        <div className="flex flex-col border-l border-zinc-800 pl-4">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Liquidity Load (54%)</span>
          <div className="w-24 h-1.5 bg-zinc-800 mt-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-1000 rounded-full"
              style={{ width: `${displayTracks.length > 0 ? Math.min(100, (totalGrossSales / (displayTracks.length * CEILING)) * 100) : 0}%` }}
            />
          </div>
          <span className="text-[8px] text-zinc-600 mt-0.5">{displayTracks.length > 0 ? ((totalGrossSales / (displayTracks.length * CEILING)) * 100).toFixed(1) : "0.0"}%</span>
        </div>

        <div className="flex flex-col border-l border-zinc-800 pl-4">
          <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">54/46 Split</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-green-400 font-black">${(totalGrossSales * 0.54).toFixed(0)}</span>
            <span className="text-zinc-700 text-[10px]">/</span>
            <span className="text-[10px] text-zinc-400 font-bold">${(totalGrossSales * 0.46).toFixed(0)}</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
          <span className="text-[10px] text-white font-black italic" data-testid="text-live-signal">LIVE SIGNAL: 97.7 THE FLAME</span>
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
          <span className="text-zinc-600">POWERED BY:</span>
          <span className="text-emerald-400">97.7 THE FLAME</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">EVERY $1K =</span>
          <span className="text-emerald-400">$540 PAYOUT</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">SPLIT:</span>
          <span className="text-emerald-400">54/46</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">PORTALS:</span>
          <span className="text-emerald-400">81 TERMINALS</span>
          <span className="text-zinc-800">|</span>
          {settlementData && (
            <>
              <span className={`font-bold ${(settlementData.nextKAt - settlementData.grossIntake) <= 100 ? "text-red-400 animate-pulse" : "text-lime-400"}`}>
                ${Math.max(0, settlementData.nextKAt - settlementData.grossIntake).toLocaleString('en-US', { minimumFractionDigits: 2 })} AWAY
              </span>
            </>
          )}
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
                settlement={settlementData}
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
          <span>AITITRADE DIGITAL ASSET EXCHANGE | 97.7 THE FLAME | AityPay ENGINE</span>
          <span>81 TRADE PORTALS | $1-$50 ENTRY | EVERY $1K TRADED = $540 SETTLEMENT | 54% DEX / 46% CEO | ACCEPT OR HOLD — NO LOSING | POWERED BY 97.7 THE FLAME</span>
        </div>
      </div>
    </div>
  );
}
