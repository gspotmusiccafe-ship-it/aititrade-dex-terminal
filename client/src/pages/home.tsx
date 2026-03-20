import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Music, Activity, Zap, Lock, AlertTriangle, FileCheck, X, Globe, Shield, ExternalLink, Cpu, Binary, Radio, GripVertical, Plus, Trash2, ChevronDown, ChevronUp, DollarSign, Users, TrendingUp, TrendingDown, Flame, BarChart3, ArrowUpRight, ArrowDownRight, Target, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TrackWithArtist } from "@shared/schema";
import { Link } from "wouter";
import { getPortal, PortalBadge, LivingTicker, usePortalConfigs } from "@/components/TradePortal";

function generateSparklineData(seed: number, basePrice: number, points: number = 24): number[] {
  let s = seed;
  const rng = () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
  const now = Date.now();
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const data: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = minuteOfDay - (points - i) * 30;
    const wave1 = Math.sin((t / 1440) * Math.PI * 2) * 0.03;
    const wave2 = Math.sin((t / 360) * Math.PI * 2) * 0.02;
    const wave3 = Math.sin(((now / 30000) + i * 0.4) * Math.PI * 2) * 0.015;
    const noise = (rng() - 0.5) * 0.02;
    data.push(basePrice * (1 + wave1 + wave2 + wave3 + noise));
  }
  return data;
}

let sparklineIdCounter = 0;
function MomentumSparkline({ data, width = 120, height = 36, color }: { data: number[]; width?: number; height?: number; color: string }) {
  const gradId = useMemo(() => `spark-grad-${++sparklineIdCounter}`, []);
  if (data.length < 2) return null;
  const min = Math.min(...data) * 0.998;
  const max = Math.max(...data) * 1.002;
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  const lastY = height - ((data[data.length - 1] - min) / range) * height;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2.5" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

const CEILING = 1000.00;
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
        </div>
        <div className="relative z-10">
          <div className="border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between bg-emerald-950/80">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-bold tracking-wider">DIGITAL ASSET — POSITION RECEIPT</span>
            </div>
            <button onClick={onClose} className="text-emerald-500/40 hover:text-emerald-400"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="border-2 border-emerald-400/50 bg-emerald-500/5 p-4 text-center relative">
              <p className="text-[9px] text-emerald-500/50 mb-1 tracking-widest">TRACKING ID — PROOF OF POSITION</p>
              <p className="text-2xl text-emerald-400 font-black tracking-[0.15em] leading-tight" data-testid="text-mint-id">{receipt.mintId}</p>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">TICKER</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.ticker}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">BOUGHT AT</p>
                <p className="text-sm text-emerald-400 font-bold mt-0.5">${receipt.unitPrice.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2.5">
                <p className="text-[8px] text-emerald-500/40 tracking-wider">AI ENGINE</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-0.5" data-testid="text-ai-model-mint">{receipt.aiModel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-center">
              <div className="bg-black/50 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/50">FLOOR RETAINED (54%)</p>
                <p className="text-sm text-emerald-400 font-bold" data-testid="text-floor-retained">${receipt.floorRetained.toFixed(4)}</p>
              </div>
              <div className="bg-black/50 border border-yellow-500/15 p-2">
                <p className="text-[8px] text-yellow-400/50">CEO GROSS (46%)</p>
                <p className="text-sm text-yellow-400 font-bold" data-testid="text-ceo-gross">${receipt.ceoGross.toFixed(4)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">LEDGER GROSS</p>
                <p className="text-xs text-white font-bold">${receipt.grossSales.toFixed(2)}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">TOTAL TRADES</p>
                <p className="text-xs text-emerald-400 font-bold" data-testid="text-total-mints">{receipt.totalMints} / {receipt.mintCap}</p>
              </div>
              <div className="bg-zinc-900/80 border border-emerald-500/15 p-2">
                <p className="text-[8px] text-emerald-500/40">FILL RATE</p>
                <p className={`text-xs font-bold ${receipt.capacityPct >= 60 ? "text-yellow-400" : "text-emerald-400"}`}>{receipt.capacityPct}%</p>
              </div>
            </div>
            <div className="border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-center">
              <p className={`text-sm font-black ${receipt.status === "CLOSED" ? "text-red-400" : "text-emerald-400"}`}>
                {receipt.status === "CLOSED" ? "POSITION SETTLED" : "POSITION LOCKED — ACTIVE"}
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[8px] text-emerald-500/25">{receipt.timestamp}</p>
              <p className="text-[8px] text-emerald-500/30 font-bold">AITITRADE DEX</p>
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
      toast({ title: "POSITION LOCKED", description: `${data.trackingNumber} — Send to ${data.cashtag}` });
      onSuccess({ type: "native", receipt: { mintId: data.trackingNumber, asset: data.asset, ticker: data.ticker, unitPrice: data.unitPrice, floorRetained: data.floorRetained, ceoGross: data.ceoGross, trustTithe: data.trustTithe, blessingPool: data.blessingPool, aiModel: data.aiModel, grossSales: data.grossSales, totalMints: data.totalMints, mintCap: data.mintCap, capacityPct: data.capacityPct, priority: data.priority, indicator: data.indicator, status: data.status === "CLOSED" ? "CLOSED" : "TRADE_EXECUTED", timestamp: data.timestamp } });
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
            <span className="text-[11px] text-lime-400 font-bold tracking-wider">BUY POSITION — CASH APP</span>
          </div>
          <button onClick={onClose} className="text-lime-500/40 hover:text-lime-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-zinc-900/80 border border-lime-500/15 p-2.5">
              <p className="text-[8px] text-lime-500/40 tracking-wider">ASSET</p>
              <p className="text-sm text-lime-400 font-bold mt-0.5">{ticker}</p>
            </div>
            <div className="bg-zinc-900/80 border border-lime-500/15 p-2.5">
              <p className="text-[8px] text-lime-500/40 tracking-wider">PRICE</p>
              <p className="text-xl text-lime-400 font-black mt-0.5">${price.toFixed(2)}</p>
            </div>
          </div>
          <div className="border-2 border-green-500/40 bg-green-950/30 p-3 text-center">
            <p className="text-[9px] text-green-400/70 tracking-wider mb-1">SEND PAYMENT TO</p>
            <p className="text-2xl text-green-400 font-black tracking-wider">$AITITRADEBROKERAGE</p>
            <p className="text-[8px] text-green-500/50 mt-1">VIA CASH APP</p>
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
              className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3.5 text-sm tracking-wider transition-colors"
              data-testid={`button-cashapp-trade-${track.id}`}
            >
              <DollarSign className="h-4 w-4 inline mr-1" />
              BUY NOW — ${price.toFixed(2)}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-green-500/50 bg-green-950/30 p-4 text-center">
                <p className="text-[9px] text-green-400/70 tracking-wider mb-2">SCAN TO PAY</p>
                <div className="bg-white p-3 inline-block mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tradeData.url || "https://cash.app/$AITITRADEBROKERAGE/" + price.toFixed(2))}`}
                    alt="Cash App QR Code"
                    className="w-[180px] h-[180px]"
                    data-testid="img-cashapp-qr"
                  />
                </div>
                <p className="text-lg text-green-400 font-black mt-2">$AITITRADEBROKERAGE</p>
                <p className="text-[10px] text-green-400/60 mt-1">AMOUNT: ${price.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <a
                  href={tradeData.url || "https://cash.app/$AITITRADEBROKERAGE/" + price.toFixed(2)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[10px] text-green-400 underline hover:text-green-300"
                  data-testid="link-cashapp-pay"
                >
                  Open Cash App
                </a>
              </div>
            </div>
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

function getHeatLevel(capacityPct: number, remaining: number): { label: string; color: string; bg: string; border: string; glow: string; icon: "flame" | "trending" | "target" } {
  if (remaining <= 50) return { label: "EXPLOSIVE", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/50", glow: "shadow-red-500/20", icon: "flame" };
  if (remaining <= 200) return { label: "ON FIRE", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40", glow: "shadow-orange-500/15", icon: "flame" };
  if (capacityPct >= 30) return { label: "HOT", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", glow: "shadow-amber-500/10", icon: "trending" };
  if (capacityPct >= 10) return { label: "WARMING UP", color: "text-yellow-400", bg: "bg-yellow-500/5", border: "border-yellow-500/20", glow: "", icon: "trending" };
  return { label: "NEW LISTING", color: "text-emerald-400", bg: "bg-emerald-500/5", border: "border-emerald-500/20", glow: "", icon: "target" };
}

function HeatBadge({ heat }: { heat: ReturnType<typeof getHeatLevel> }) {
  const IconComponent = heat.icon === "flame" ? Flame : heat.icon === "trending" ? TrendingUp : Target;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[7px] sm:text-[8px] font-black px-1 sm:px-1.5 py-0.5 border ${heat.color} ${heat.bg} ${heat.border} ${heat.label === "EXPLOSIVE" || heat.label === "ON FIRE" ? "animate-pulse" : ""}`}>
      <IconComponent className="h-2 w-2 sm:h-2.5 sm:w-2.5" />
      {heat.label}
    </span>
  );
}

function AssetCard({ track, onPlay, settlement }: { track: TrackWithArtist; onPlay: (t: TrackWithArtist) => void; settlement?: SettlementStatus }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [mintReceipt, setMintReceipt] = useState<MintReceipt | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 8000);
    return () => clearInterval(iv);
  }, []);

  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;

  const price = parseFloat((track as any).unitPrice || "3.50");
  const sales = (track as any).salesCount || 0;
  const portal = getPortal(price);
  const maxPayout = parseFloat((price * portal.mbb).toFixed(2));
  const roi = price > 0 ? parseFloat((((maxPayout - price) / price) * 100).toFixed(0)) : 0;
  const grossSales = parseFloat((sales * price).toFixed(2));

  const globalGross = settlement?.grossIntake || 0;
  const nextKAt = settlement?.nextKAt || 1000;
  const globalRemaining = Math.max(0, parseFloat((nextKAt - globalGross).toFixed(2)));
  const globalPct = Math.min(100, parseFloat(((globalGross % 1000) / 1000 * 100).toFixed(1)));
  const ksReached = settlement?.ksReached || 0;
  const fundAvailable = settlement?.fundAvailable || 0;

  const heat = getHeatLevel(globalPct, globalRemaining);
  const trackSeed = parseInt(String(track.id).replace(/\D/g, '').slice(0, 8) || '12345');

  const { liveMbbp, pctChange, sparkData } = useMemo(() => {
    const now = Date.now();
    const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
    const w1 = Math.sin((minuteOfDay / 1440) * Math.PI * 2) * 0.03;
    const w2 = Math.sin((minuteOfDay / 360) * Math.PI * 2) * 0.02;
    const w3 = Math.sin((now / 30000) * Math.PI * 2) * 0.015;
    const swing = w1 + w2 + w3;
    const livePrice = price * (1 + swing);
    const liveMbbp = parseFloat((livePrice * portal.mbb).toFixed(2));
    const pctChange = parseFloat((((liveMbbp - maxPayout) / maxPayout) * 100).toFixed(1));
    const sparkData = generateSparklineData(trackSeed, maxPayout, 24);
    sparkData[sparkData.length - 1] = liveMbbp;
    return { liveMbbp, pctChange, sparkData };
  }, [price, maxPayout, portal.mbb, trackSeed, tick]);

  const isUp = pctChange >= 0;
  const chartColor = isUp ? "#4ade80" : "#f87171";

  const isClosed = false;
  const isSettlementClose = globalRemaining <= 200 && globalRemaining > 50;
  const isSettlementImminent = globalRemaining <= 50;

  return (
    <div className={`bg-zinc-950 border font-mono group transition-all hover:scale-[1.01] ${heat.border} ${heat.glow ? `shadow-lg ${heat.glow}` : ""}`} data-testid={`asset-card-${track.id}`}>
      {/* HEAT HEADER */}
      <div className={`px-2 sm:px-3 py-1.5 sm:py-2 ${heat.bg} border-b ${heat.border}`}>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <HeatBadge heat={heat} />
            <span className="font-black text-sm sm:text-base text-white truncate">{ticker}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-base sm:text-lg font-black ${price >= 10 ? "text-amber-400" : price >= 5 ? "text-yellow-300" : "text-lime-400"}`}>
              ${price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* URGENCY BANNERS */}
      {isSettlementImminent && (
        <div className="px-3 py-2 bg-red-500/15 border-b border-red-500/40 text-center animate-pulse">
          <div className="flex items-center justify-center gap-2">
            <Flame className="h-4 w-4 text-red-400" />
            <span className="text-sm text-red-400 font-black tracking-wider">SETTLEMENT CLOSING — BUY NOW</span>
            <Flame className="h-4 w-4 text-red-400" />
          </div>
          <p className="text-[9px] text-red-400/80 font-bold mt-0.5">${globalRemaining.toFixed(0)} LEFT — NEXT TRADE COULD TRIGGER $540 PAYOUT</p>
        </div>
      )}
      {isSettlementClose && !isSettlementImminent && (
        <div className="px-3 py-1.5 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2 animate-pulse">
          <TrendingUp className="h-3 w-3 text-orange-400 flex-shrink-0" />
          <span className="text-[9px] text-orange-400 font-bold">${globalRemaining.toFixed(0)} AWAY FROM $540 PAYOUT — GET IN BEFORE IT CLOSES</span>
        </div>
      )}
      {fundAvailable > 0 && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-2">
          <DollarSign className="h-3 w-3 text-emerald-400 flex-shrink-0" />
          <span className="text-[9px] text-emerald-400 font-bold">${fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })} PAYOUT READY</span>
        </div>
      )}

      <div className="p-2.5 sm:p-3">
        {/* ASSET INFO ROW */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-700 group-hover:border-emerald-500/40 transition-colors">
            {track.coverImage ? (
              <img src={track.coverImage} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 to-black">
                <Music className="h-5 w-5 text-emerald-500/40" />
              </div>
            )}
            <button
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => isCurrentTrack ? togglePlay() : onPlay(track)}
              data-testid={`button-play-${track.id}`}
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="h-4 w-4 text-white" />
              ) : (
                <Play className="h-4 w-4 text-white" />
              )}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-black text-white truncate">{track.title.toUpperCase()}</h3>
            <p className="text-[10px] sm:text-xs text-zinc-500 font-semibold truncate">{track.artist?.name || "AI ARTIST"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <PortalBadge unitPrice={price} />
            </div>
          </div>
        </div>

        {/* LIVE CHART */}
        <div className="bg-black/60 border border-zinc-800 p-2 mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-zinc-500" />
              <span className="text-[8px] text-zinc-500 font-bold">BUY-BACK PROJECTION</span>
            </div>
            <div className="flex items-center gap-1">
              {isUp ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
              <span className={`text-[10px] font-black ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {isUp ? "+" : ""}{pctChange}%
              </span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className={`text-lg font-black ${isUp ? "text-emerald-400" : "text-red-400"}`}>${liveMbbp.toFixed(2)}</p>
              <p className="text-[8px] text-zinc-600">BUY-IN: ${price.toFixed(2)} → {roi}% ROI</p>
            </div>
            <MomentumSparkline data={sparkData} color={chartColor} width={100} height={32} />
          </div>
        </div>

        {/* KEY STATS */}
        <div className="grid grid-cols-4 gap-1 mb-2.5 text-center">
          <div className="bg-black/40 border border-zinc-800 p-1.5">
            <p className="text-[7px] text-zinc-600 font-bold">VOLUME</p>
            <p className="text-[11px] text-white font-black">{sales}</p>
          </div>
          <div className="bg-black/40 border border-zinc-800 p-1.5">
            <p className="text-[7px] text-zinc-600 font-bold">GROSS</p>
            <p className="text-[11px] text-lime-400 font-black">${grossSales > 0 ? grossSales.toLocaleString('en-US', { maximumFractionDigits: 0 }) : "0"}</p>
          </div>
          <div className="bg-black/40 border border-zinc-800 p-1.5">
            <p className="text-[7px] text-zinc-600 font-bold">PAYOUT</p>
            <p className="text-[11px] text-emerald-400 font-black">${maxPayout.toFixed(0)}</p>
          </div>
          <div className="bg-black/40 border border-zinc-800 p-1.5">
            <p className="text-[7px] text-zinc-600 font-bold">ROI</p>
            <p className={`text-[11px] font-black ${roi >= 200 ? "text-amber-400" : "text-lime-400"}`}>{roi}%</p>
          </div>
        </div>

        {/* SETTLEMENT PROGRESS */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-zinc-500 font-bold">SETTLEMENT CYCLE #{ksReached + 1}</span>
            <span className={`text-[10px] font-black ${isSettlementImminent ? "text-red-400 animate-pulse" : isSettlementClose ? "text-orange-400" : "text-lime-400"}`}>
              {globalPct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-3 relative overflow-hidden border border-zinc-700/50">
            <div
              className={`h-full transition-all duration-700 ${
                isSettlementImminent ? "bg-gradient-to-r from-red-600 to-red-400 animate-pulse" :
                isSettlementClose ? "bg-gradient-to-r from-orange-600 to-amber-400 animate-pulse" :
                globalPct >= 30 ? "bg-gradient-to-r from-emerald-600 to-lime-400" :
                "bg-gradient-to-r from-emerald-700 to-emerald-500"
              }`}
              style={{ width: `${globalPct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-[8px] font-black ${globalPct > 45 ? "text-black" : "text-zinc-400"}`}>
                ${globalGross.toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${nextKAt.toLocaleString('en-US')}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[8px] text-zinc-600 font-bold">${price.toFixed(2)} BUY-IN | {portal.name}</span>
            <span className={`text-[8px] font-bold ${isSettlementImminent ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>
              ${globalRemaining.toFixed(0)} TO $540 PAYOUT
            </span>
          </div>
        </div>

        {/* BIG BUY BUTTON */}
        <button
          onClick={() => setShowCheckout(true)}
          className={`w-full font-black py-3 sm:py-3.5 text-sm sm:text-base tracking-wider transition-all flex items-center justify-center gap-2 ${
            isSettlementImminent
              ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white animate-pulse shadow-lg shadow-red-500/20"
              : isSettlementClose
              ? "bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white shadow-lg shadow-orange-500/15"
              : "bg-gradient-to-r from-emerald-600 to-lime-500 hover:from-emerald-500 hover:to-lime-400 text-white hover:shadow-lg hover:shadow-emerald-500/20"
          }`}
          data-testid={`button-acquire-${track.id}`}
        >
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
          {isSettlementImminent ? "BUY NOW — SETTLEMENT CLOSING" : isSettlementClose ? `BUY NOW — $${globalRemaining.toFixed(0)} LEFT` : `BUY NOW — $${price.toFixed(2)}`}
        </button>

        {/* SECONDARY ACTIONS */}
        <div className="flex gap-1 mt-1.5">
          <button
            className="flex-1 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-[9px] font-bold py-1.5 text-center transition-colors flex items-center justify-center gap-1"
            onClick={() => isCurrentTrack ? togglePlay() : onPlay(track)}
            data-testid={`button-stream-${track.id}`}
          >
            <Play className="h-2.5 w-2.5" /> PREVIEW
          </button>
          <Link
            href="/trader"
            className="flex-1 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-[9px] font-bold py-1.5 text-center transition-colors flex items-center justify-center gap-1"
            data-testid={`button-portfolio-link-${track.id}`}
          >
            <BarChart3 className="h-2.5 w-2.5" /> MY PORTFOLIO
          </Link>
        </div>
      </div>

      {mintReceipt && <MintCertificate receipt={mintReceipt} onClose={() => setMintReceipt(null)} />}
      <TradeCashAppCheckout
        track={track}
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={(data: any) => {
          setMintReceipt(data.receipt);
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

function ScrollingTicker({ tracks, settlement }: { tracks: TrackWithArtist[]; settlement?: SettlementStatus }) {
  const items = tracks.map(t => {
    const price = parseFloat((t as any).unitPrice || "3.50");
    const sales = (t as any).salesCount || 0;
    const gross = sales * price;
    const portal = getPortal(price);
    const roi = price > 0 ? Math.round(((price * portal.mbb - price) / price) * 100) : 0;
    const ticker = `$${(t.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 10)}`;
    return { ticker, price, gross, roi, sales };
  });

  const globalRemaining = settlement ? Math.max(0, settlement.nextKAt - settlement.grossIntake) : 0;
  const isHot = globalRemaining <= 200;

  return (
    <div className="bg-zinc-950 border-b border-zinc-800 overflow-hidden relative">
      <div className="flex animate-scroll-left">
        {[...items, ...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-1.5 whitespace-nowrap border-r border-zinc-800/50">
            <span className="text-[10px] font-black text-white">{item.ticker}</span>
            <span className="text-[10px] font-bold text-lime-400">${item.price.toFixed(2)}</span>
            <span className="text-[9px] font-bold text-emerald-400">▲{item.roi}%</span>
            <span className="text-[9px] text-zinc-600">{item.sales} trades</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes scroll-left {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-scroll-left {
          animation: scroll-left 20s linear infinite;
          width: max-content;
        }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack, setAutopilotPool } = usePlayer();
  const autoPlayedRef = useRef(false);
  usePortalConfigs();

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
  const globalRemaining = settlementData ? Math.max(0, settlementData.nextKAt - settlementData.grossIntake) : 0;
  const globalPct = settlementData ? Math.min(100, ((settlementData.grossIntake % 1000) / 1000 * 100)) : 0;
  const isHot = globalRemaining <= 200;

  return (
    <div className="min-h-full pb-28 bg-black font-mono">
      {/* HERO BANNER */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(16,185,129,0.3) 30px, rgba(16,185,129,0.3) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(16,185,129,0.3) 30px, rgba(16,185,129,0.3) 31px)'}} />
        <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] text-red-400 font-bold tracking-wider">LIVE TRADING</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-none mb-1" data-testid="text-terminal-title">
            AITITRADE <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-lime-400">DEX</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-semibold mb-4 sm:mb-6">DIGITAL ASSET EXCHANGE — AI-POWERED MUSIC ASSETS</p>

          {/* MAIN STATS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 sm:p-3 hover:border-emerald-500/30 transition-colors">
              <p className="text-[8px] sm:text-[9px] text-zinc-600 font-bold tracking-wider mb-0.5">MARKET VOLUME</p>
              <p className="text-lg sm:text-2xl text-white font-black">${totalGrossSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-[8px] text-emerald-500/60">{totalUnits} trades executed</p>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 sm:p-3 hover:border-emerald-500/30 transition-colors">
              <p className="text-[8px] sm:text-[9px] text-zinc-600 font-bold tracking-wider mb-0.5">ASSETS LISTED</p>
              <p className="text-lg sm:text-2xl text-emerald-400 font-black">{displayTracks.length}</p>
              <p className="text-[8px] text-emerald-500/60">Open positions available</p>
            </div>
            <div className={`bg-zinc-900/80 border p-2.5 sm:p-3 transition-colors ${isHot ? "border-orange-500/40 hover:border-orange-500/60" : "border-zinc-800 hover:border-emerald-500/30"}`}>
              <p className="text-[8px] sm:text-[9px] text-zinc-600 font-bold tracking-wider mb-0.5">NEXT PAYOUT</p>
              <p className={`text-lg sm:text-2xl font-black ${isHot ? "text-orange-400 animate-pulse" : "text-lime-400"}`}>${globalRemaining.toFixed(0)}</p>
              <p className={`text-[8px] ${isHot ? "text-orange-400/60" : "text-emerald-500/60"}`}>{isHot ? "Settlement closing soon!" : "away from $540 payout"}</p>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 sm:p-3 hover:border-emerald-500/30 transition-colors">
              <p className="text-[8px] sm:text-[9px] text-zinc-600 font-bold tracking-wider mb-0.5">CYCLE FILL</p>
              <p className="text-lg sm:text-2xl text-white font-black">{globalPct.toFixed(1)}%</p>
              <div className="mt-1 h-1.5 bg-zinc-800 overflow-hidden">
                <div className={`h-full transition-all duration-500 ${isHot ? "bg-gradient-to-r from-orange-500 to-red-500" : "bg-gradient-to-r from-emerald-500 to-lime-400"}`} style={{ width: `${globalPct}%` }} />
              </div>
            </div>
          </div>

          {/* SENTIMENT BAR */}
          {marketSession && (
            <div className="mt-3 flex items-center gap-2 sm:gap-4 flex-wrap">
              <div className={`flex items-center gap-1 px-2 py-1 border text-[9px] sm:text-[10px] font-black ${
                marketSession.marketSentiment === "BULL" ? "text-lime-400 border-lime-500/40 bg-lime-500/10" :
                marketSession.marketSentiment === "BEAR" ? "text-red-400 border-red-500/40 bg-red-500/10" :
                "text-zinc-400 border-zinc-600 bg-zinc-800"
              }`}>
                {marketSession.marketSentiment === "BULL" ? "▲ BULLISH MARKET" : marketSession.marketSentiment === "BEAR" ? "▼ BEARISH MARKET" : "— NEUTRAL MARKET"}
              </div>
              <span className="text-[9px] text-zinc-600 font-bold">VOLATILITY: <span className={`${marketSession.volatility > 30 ? "text-red-400" : marketSession.volatility > 20 ? "text-amber-400" : "text-lime-400"}`}>{marketSession.volatility}%</span></span>
              <span className="text-[9px] text-zinc-600 font-bold">RATE: <span className="text-lime-400">{marketSession.tradingRate}%</span></span>
              <span className="text-[9px] text-zinc-600 font-bold hidden sm:inline">81 PORTALS ACTIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* SCROLLING TICKER */}
      {displayTracks.length > 0 && <ScrollingTicker tracks={displayTracks} settlement={settlementData} />}

      {/* HOW IT WORKS BAR */}
      <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3 sm:gap-6 text-[9px] sm:text-[10px] overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-black text-emerald-400">1</div>
            <span className="text-zinc-400 font-bold">BUY A POSITION</span>
          </div>
          <ArrowUpRight className="h-3 w-3 text-zinc-700 flex-shrink-0" />
          <div className="flex items-center gap-1 whitespace-nowrap">
            <div className="w-4 h-4 rounded-full bg-lime-500/20 flex items-center justify-center text-[8px] font-black text-lime-400">2</div>
            <span className="text-zinc-400 font-bold">POOL FILLS TO $1K</span>
          </div>
          <ArrowUpRight className="h-3 w-3 text-zinc-700 flex-shrink-0" />
          <div className="flex items-center gap-1 whitespace-nowrap">
            <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px] font-black text-amber-400">3</div>
            <span className="text-zinc-400 font-bold">$540 SETTLEMENT DROPS</span>
          </div>
          <ArrowUpRight className="h-3 w-3 text-zinc-700 flex-shrink-0" />
          <div className="flex items-center gap-1 whitespace-nowrap">
            <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-[8px] font-black text-green-400">4</div>
            <span className="text-zinc-400 font-bold">ACCEPT OR HOLD</span>
          </div>
        </div>
      </div>

      {/* ASSET GRID */}
      <div className="px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
            <h2 className="text-sm sm:text-lg font-black text-white tracking-tight">TRADING FLOOR</h2>
            <div className="bg-red-600 text-white text-[7px] sm:text-[8px] px-1.5 py-0.5 rounded-full animate-pulse font-bold">LIVE</div>
          </div>
          <span className="text-[9px] sm:text-[10px] text-zinc-600 font-bold">{displayTracks.length} ASSETS</span>
        </div>

        {loadingTracks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-800 p-4">
                <Skeleton className="h-4 w-32 mb-3 bg-zinc-800" />
                <Skeleton className="h-12 w-full mb-2 bg-zinc-800" />
                <Skeleton className="h-8 w-full mb-2 bg-zinc-800" />
                <Skeleton className="h-10 w-full bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : displayTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
          <div className="text-center py-20 border border-zinc-800 bg-zinc-950">
            <BarChart3 className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-bold">NO ASSETS LISTED YET</p>
            <p className="text-zinc-700 text-[10px] mt-1">New assets coming soon — check back</p>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950">
        <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-zinc-600 font-mono flex-wrap gap-1">
          <span>AITITRADE DIGITAL ASSET EXCHANGE</span>
          <div className="flex items-center gap-2 sm:gap-4">
            <span>81 PORTALS</span>
            <span className="text-emerald-500/60">EVERY $1K = $540 PAYOUT</span>
            <span>54/46 SPLIT</span>
            <span className="hidden sm:inline">ACCEPT OR HOLD — NO LOSING</span>
          </div>
        </div>
      </div>
    </div>
  );
}
