import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Tag, BarChart3,
  Trophy, Loader2, ArrowUpRight, ArrowDownRight, Activity, Zap,
  Crown, Star, Medal, Eye, X, RefreshCw, ChevronRight, Music, QrCode, ExternalLink
} from "lucide-react";

interface MarketListing {
  id: string;
  trackId: string | null;
  title: string;
  artistName: string;
  coverImage: string | null;
  genre: string | null;
  basePrice: string;
  currentPrice: string;
  highPrice: string;
  lowPrice: string;
  livePrice: number;
  targetPrice: number;
  analystSignal: string;
  momentum: string;
  volume: number;
  totalSold: number;
  maxSupply: number;
  holders: number;
  seatsLeft: number;
  poolFull: boolean;
  resaleCount: number;
}

interface PortfolioItem {
  id: string;
  listingId: string;
  purchasePrice: string;
  title: string;
  artistName: string;
  coverImage: string | null;
  livePrice: number;
  profitLoss: number;
  roiPct: number;
  listedForSale: boolean;
  askPrice: string | null;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  profileImage: string | null;
  portfolioValue: number;
  holdings: number;
}

function PriceTicker({ listing }: { listing: MarketListing }) {
  const [tick, setTick] = useState(0);
  const [prevPrice, setPrevPrice] = useState(listing.livePrice);
  const [direction, setDirection] = useState<"up" | "down" | "flat">("flat");

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const base = parseFloat(listing.currentPrice || "1");
    const seed = listing.id.charCodeAt(0) * 7919 + (listing.id.charCodeAt(1) || 0) * 1301;
    const t = (Date.now() / 1000) + tick * 0.03;
    const s1 = Math.sin(seed + t * 0.013) * 0.08;
    const s2 = Math.sin(seed * 0.7 + t * 0.037) * 0.05;
    const s3 = Math.sin(seed * 1.3 + t * 0.091) * 0.03;
    const s4 = Math.sin(seed * 0.3 + t * 0.0017) * 0.12;
    const vol = Math.min(0.5, (listing.totalSold || 0) * 0.005);
    const spike = Math.sin(seed * 2.1 + t * 0.003) > 0.92 ? 0.15 : 0;
    const newPrice = Math.max(0.25, parseFloat((base * (1 + s1 + s2 + s3 + s4 + vol + spike)).toFixed(2)));
    setDirection(newPrice > prevPrice ? "up" : newPrice < prevPrice ? "down" : "flat");
    setPrevPrice(newPrice);
  }, [tick, listing]);

  return (
    <span className={`font-black font-mono transition-colors ${
      direction === "up" ? "text-emerald-400" : direction === "down" ? "text-red-400" : "text-white"
    }`}>
      ${prevPrice.toFixed(2)}
    </span>
  );
}

function MiniChart({ listing }: { listing: MarketListing }) {
  const seed = listing.id.charCodeAt(0) * 7919;
  const points: number[] = [];
  const now = Date.now() / 1000;
  for (let i = 0; i < 30; i++) {
    const t = now - (30 - i) * 60;
    const s = Math.sin(seed + t * 0.013) * 0.08 + Math.sin(seed * 0.7 + t * 0.037) * 0.05;
    points.push(s);
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 0.01;
  const h = 32;
  const w = 80;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / 29) * w},${h - ((p - min) / range) * h}`).join(" ");
  const isUp = points[points.length - 1] > points[0];

  return (
    <svg width={w} height={h} className="opacity-60">
      <path d={path} fill="none" stroke={isUp ? "#34d399" : "#f87171"} strokeWidth="1.5" />
    </svg>
  );
}

function StockCard({ listing, onBuy, buying }: { listing: MarketListing; onBuy: (id: string) => void; buying: boolean }) {
  const base = parseFloat(listing.basePrice);
  const change = listing.livePrice - base;
  const changePct = base > 0 ? (change / base * 100) : 0;
  const isUp = change >= 0;
  const spread = listing.targetPrice - listing.livePrice;
  const spreadPct = listing.livePrice > 0 ? ((spread / listing.livePrice) * 100) : 0;

  const signalColor = listing.analystSignal === "STRONG BUY" ? "text-lime-400 bg-lime-500/15 border-lime-500/40" :
    listing.analystSignal === "BUY" ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/40" :
    listing.analystSignal === "ACCUMULATE" ? "text-amber-400 bg-amber-500/15 border-amber-500/40" :
    "text-zinc-400 bg-zinc-500/15 border-zinc-500/40";

  return (
    <div
      className="relative border bg-black/90 overflow-hidden transition-all hover:scale-[1.005] group"
      style={{
        borderColor: isUp ? "#065f4640" : "#7f1d1d40",
        boxShadow: `0 0 12px ${isUp ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)"}`,
      }}
      data-testid={`market-card-${listing.id}`}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          {listing.coverImage ? (
            <img src={listing.coverImage} alt="" className="w-12 h-12 border border-zinc-800 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-950 to-black border border-zinc-800 flex items-center justify-center flex-shrink-0">
              <Music className="h-5 w-5 text-emerald-500/40" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-black truncate">{listing.title}</p>
            <p className="text-zinc-500 text-[9px] truncate">{listing.artistName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {listing.genre && <span className="text-[7px] text-emerald-500/50 uppercase">{listing.genre}</span>}
              <span className={`text-[7px] font-black px-1 py-0.5 border ${signalColor}`} data-testid={`signal-${listing.id}`}>{listing.analystSignal}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg">
              <PriceTicker listing={listing} />
            </div>
            <div className={`flex items-center justify-end gap-0.5 text-[10px] font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {isUp ? "+" : ""}{changePct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/20 px-2 py-1.5 mt-2 flex items-center justify-between" data-testid={`target-${listing.id}`}>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-amber-400" />
            <span className="text-[8px] text-amber-400/70 font-bold">TARGET</span>
            <span className="text-[11px] text-amber-400 font-black">${listing.targetPrice.toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-lime-400 font-black">+{spreadPct.toFixed(0)}% UPSIDE</span>
          </div>
        </div>

        <div className={`px-2 py-1.5 mt-1.5 flex items-center justify-between border ${listing.poolFull ? "bg-red-950/20 border-red-500/30" : "bg-emerald-950/20 border-emerald-500/20"}`} data-testid={`pool-status-${listing.id}`}>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-zinc-400">POOL</span>
            <div className="w-20 h-1.5 bg-zinc-800 overflow-hidden">
              <div
                className={`h-full transition-all ${listing.poolFull ? "bg-red-500" : listing.seatsLeft <= 5 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, (listing.holders / listing.maxSupply) * 100)}%` }}
              />
            </div>
            <span className={`text-[9px] font-black ${listing.poolFull ? "text-red-400" : listing.seatsLeft <= 5 ? "text-amber-400" : "text-emerald-400"}`}>
              {listing.holders}/{listing.maxSupply}
            </span>
          </div>
          <span className={`text-[8px] font-black px-1.5 py-0.5 border ${listing.poolFull ? "text-red-400 border-red-500/40 bg-red-500/10" : listing.seatsLeft <= 5 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"}`}>
            {listing.poolFull ? "SOLD OUT — RESALE ONLY" : listing.seatsLeft <= 5 ? `${listing.seatsLeft} SEATS LEFT` : `${listing.seatsLeft} SEATS OPEN`}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-3">
            <MiniChart listing={listing} />
            <div className="text-[8px] text-zinc-500 space-y-0.5">
              <div>H: <span className="text-emerald-400">${parseFloat(listing.highPrice).toFixed(2)}</span></div>
              <div>L: <span className="text-red-400">${parseFloat(listing.lowPrice).toFixed(2)}</span></div>
              <div>VOL: <span className="text-amber-400">{listing.volume}</span></div>
            </div>
          </div>
          {listing.poolFull ? (
            <div className="text-center">
              <p className="text-[8px] text-red-400/60 mb-0.5">BUY FROM OWNERS</p>
              {listing.resaleCount > 0 ? (
                <button
                  onClick={() => onBuy(listing.id)}
                  disabled={buying}
                  className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 transition-all disabled:opacity-50"
                  style={{ boxShadow: "0 0 10px rgba(139,92,246,0.25)" }}
                  data-testid={`btn-resale-${listing.id}`}
                >
                  {buying ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                  {listing.resaleCount} FOR SALE
                </button>
              ) : (
                <span className="text-[9px] text-zinc-500 font-bold px-3 py-2 border border-zinc-700 bg-zinc-900">NO OFFERS YET</span>
              )}
            </div>
          ) : (
            <button
              onClick={() => onBuy(listing.id)}
              disabled={buying}
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black bg-green-600 hover:bg-green-500 text-white border border-green-500 transition-all disabled:opacity-50"
              style={{ boxShadow: "0 0 10px rgba(34,197,94,0.25)" }}
              data-testid={`btn-buy-${listing.id}`}
            >
              {buying ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
              BUY — CASH APP
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CashAppBuyDialog({ listing, onClose }: { listing: MarketListing; onClose: () => void }) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [buyData, setBuyData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const price = listing.livePrice;

  const [resaleOffers, setResaleOffers] = useState<any[]>([]);
  const [poolFullState, setPoolFullState] = useState(listing.poolFull || false);

  const loadResaleOffers = async () => {
    try {
      const res = await fetch(`/api/market/listings/${listing.id}`);
      const data = await res.json();
      setResaleOffers(data.resaleOffers || []);
    } catch {}
  };

  const handleLockPosition = async (fromResaleId?: string) => {
    try {
      setProcessing(true);
      setError(null);
      const body: any = { listingId: listing.id };
      if (fromResaleId) body.fromResaleId = fromResaleId;
      const res = await apiRequest("POST", "/api/market/buy", body);
      const data = await res.json();
      if (data.poolFull) {
        setPoolFullState(true);
        setError(data.message);
        await loadResaleOffers();
        return;
      }
      if (!data.success) throw new Error(data.message || "Purchase failed");
      setBuyData(data);
      queryClient.invalidateQueries({ queryKey: ["/api/market/listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-vault/balance"] });
      toast({
        title: data.isP2P ? "P2P TRADE LOCKED" : "POSITION LOCKED",
        description: `${data.trackingNumber} — Send $${(data.buyerPays ?? data.price).toFixed(2)} to ${data.cashtag}${data.escalation ? ` | LADDER +${data.escalation.pct.toFixed(1)}% → $${data.escalation.to.toFixed(2)}` : ""}`,
      });
    } catch (e: any) {
      setError(e.message || "Failed to lock position");
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (listing.poolFull) loadResaleOffers();
  }, [listing.poolFull]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-black border-2 border-green-500/60 font-mono max-w-sm w-full shadow-2xl shadow-green-500/20 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="market-cashapp-dialog">
        <div className="border-b border-green-500/30 px-4 py-2.5 flex items-center justify-between bg-green-950/80 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-400" />
            <span className="text-[11px] text-green-400 font-bold tracking-wider">MUSIC MARKET — CASH APP</span>
          </div>
          <button onClick={onClose} className="text-green-500/40 hover:text-green-400" data-testid="btn-close-cashapp"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="border border-green-400/20 bg-green-950/30 p-3 text-center">
            <p className="text-[9px] text-green-400 font-black tracking-wider">AITITRADE BROKERAGE — MARKET ORDER</p>
          </div>

          <div className={`flex items-center justify-between px-3 py-2 border ${poolFullState ? "border-red-500/30 bg-red-950/20" : "border-emerald-500/20 bg-emerald-950/20"}`}>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-zinc-400">POOL</span>
              <div className="w-16 h-1.5 bg-zinc-800 overflow-hidden">
                <div className={`h-full ${poolFullState ? "bg-red-500" : listing.seatsLeft <= 5 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (listing.holders / listing.maxSupply) * 100)}%` }} />
              </div>
              <span className={`text-[9px] font-black ${poolFullState ? "text-red-400" : "text-emerald-400"}`}>{listing.holders}/{listing.maxSupply}</span>
            </div>
            <span className={`text-[8px] font-black ${poolFullState ? "text-red-400" : "text-emerald-400"}`}>
              {poolFullState ? "SOLD OUT" : `${listing.seatsLeft} SEATS LEFT`}
            </span>
          </div>

          <div className="flex items-center gap-3 border border-green-500/15 bg-green-950/20 p-3">
            {listing.coverImage ? (
              <img src={listing.coverImage} alt="" className="w-14 h-14 border border-zinc-800 flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-950 to-black border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Music className="h-6 w-6 text-emerald-500/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black truncate">{listing.title}</p>
              <p className="text-zinc-500 text-[9px] truncate">{listing.artistName}</p>
              {listing.genre && <span className="text-[7px] text-emerald-500/50 uppercase">{listing.genre}</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-950/40 border border-green-500/15 p-2.5">
              <p className="text-[8px] text-green-500/40 tracking-wider">BUY PRICE</p>
              <p className="text-lg text-green-400 font-black mt-0.5">${(buyData?.price || price).toFixed(2)}</p>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/20 p-2.5">
              <p className="text-[8px] text-amber-400/60 tracking-wider">TARGET</p>
              <p className="text-lg text-amber-400 font-black mt-0.5">${listing.targetPrice.toFixed(2)}</p>
            </div>
            <div className="bg-lime-950/40 border border-lime-500/20 p-2.5">
              <p className="text-[8px] text-lime-400/60 tracking-wider">UPSIDE</p>
              <p className="text-lg text-lime-400 font-black mt-0.5">+{(listing.livePrice > 0 ? ((listing.targetPrice - listing.livePrice) / listing.livePrice * 100) : 0).toFixed(0)}%</p>
            </div>
          </div>

          <div className="border border-amber-500/20 bg-amber-950/10 p-2 text-center">
            <p className="text-[8px] text-amber-400/60">MARKET ANALYST</p>
            <p className="text-[10px] text-amber-400 font-black">{listing.analystSignal} — MOMENTUM: {listing.momentum}</p>
            <p className="text-[7px] text-amber-400/40 mt-0.5">EXCLUSIVE ASSET — NOT AVAILABLE ANYWHERE ELSE</p>
          </div>

          <div className="border-2 border-green-500/40 bg-green-950/30 p-3 text-center">
            <p className="text-[9px] text-green-400/70 tracking-wider mb-1">SEND PAYMENT TO</p>
            <p className="text-lg sm:text-2xl text-green-400 font-black tracking-normal sm:tracking-wider truncate">$AITITRADEBROKERAGE</p>
            <p className="text-[8px] text-green-500/50 mt-1">VIA CASH APP</p>
          </div>

          <div className="border border-green-500/20 bg-green-950/30 p-2.5 text-center">
            <p className="text-[9px] text-green-500/50">POSITION LOCKS AT CURRENT MARKET PRICE</p>
            <p className="text-[8px] text-emerald-500/40 mt-1">ONCE PAID, YOUR SONG POSITION IS SECURED</p>
          </div>

          {buyData && (
            <>
              <div className={`border-2 ${buyData.isP2P ? "border-violet-500/50 bg-violet-950/30" : "border-cyan-500/40 bg-cyan-950/20"} p-3`} data-testid="fee-breakdown">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-black tracking-wider ${buyData.isP2P ? "text-violet-400" : "text-cyan-400"}`}>
                    {buyData.isP2P ? "P2P TRADE — ESCROW SETTLEMENT" : "INITIAL BUY — HOUSE FEE"}
                  </span>
                  <span className="text-[8px] text-zinc-500">2% TWO-WAY</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="border border-zinc-800 bg-black/40 p-1.5">
                    <p className="text-[7px] text-zinc-500">PRICE</p>
                    <p className="text-white font-black">${buyData.price.toFixed(2)}</p>
                  </div>
                  <div className="border border-zinc-800 bg-black/40 p-1.5">
                    <p className="text-[7px] text-zinc-500">YOU PAY</p>
                    <p className="text-amber-400 font-black">${buyData.buyerPays.toFixed(2)}</p>
                  </div>
                  {buyData.isP2P && (
                    <>
                      <div className="border border-zinc-800 bg-black/40 p-1.5">
                        <p className="text-[7px] text-zinc-500">SELLER NETS</p>
                        <p className="text-emerald-400 font-black">${buyData.sellerNet.toFixed(2)}</p>
                      </div>
                      <div className="border border-zinc-800 bg-black/40 p-1.5">
                        <p className="text-[7px] text-zinc-500">VAULT TAKE</p>
                        <p className="text-yellow-400 font-black">+${buyData.houseTake.toFixed(2)}</p>
                      </div>
                    </>
                  )}
                  {!buyData.isP2P && (
                    <div className="col-span-2 border border-zinc-800 bg-black/40 p-1.5">
                      <p className="text-[7px] text-zinc-500">VAULT TAKE</p>
                      <p className="text-yellow-400 font-black">+${buyData.houseTake.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {buyData.escalation && (
                  <div className="mt-2 border-t border-amber-500/30 pt-2 text-center">
                    <p className="text-[8px] text-amber-400 font-black tracking-wider">⚡ LADDER STEP-UP TRIGGERED</p>
                    <p className="text-[9px] text-amber-300 font-mono">${buyData.escalation.from.toFixed(2)} → ${buyData.escalation.to.toFixed(2)} (+{buyData.escalation.pct.toFixed(2)}%)</p>
                  </div>
                )}
                <p className="text-[7px] text-zinc-600 text-center mt-2">CEILING ${buyData.priceCeiling?.toFixed(2) || "500.00"} • LADDER FIRES EVERY 5 SOLD</p>
              </div>

              <div className="border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-center">
                <p className="text-[8px] text-emerald-500/50 tracking-wider">TRACKING NUMBER</p>
                <p className="text-sm text-emerald-400 font-black" data-testid="text-tracking-number">{buyData.trackingNumber}</p>
                <p className="text-[8px] text-emerald-500/30 mt-1">INCLUDE IN CASH APP NOTE</p>
              </div>

              <div className="border-2 border-green-500/50 bg-green-950/30 p-4 text-center">
                <p className="text-[9px] text-green-400/70 tracking-wider mb-2">SCAN TO PAY VIA CASH APP</p>
                <div className="bg-white p-3 inline-block mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(buyData.cashAppUrl)}`}
                    alt="Cash App QR Code"
                    className="w-[180px] h-[180px]"
                    data-testid="img-market-cashapp-qr"
                  />
                </div>
                <p className="text-base sm:text-lg text-green-400 font-black mt-2 truncate">$AITITRADEBROKERAGE</p>
                <p className="text-[10px] text-green-400/60 mt-1">AMOUNT: ${buyData.price.toFixed(2)}</p>
              </div>

              <div className="text-center">
                <p className="text-[8px] text-emerald-500/60">Or tap below to open Cash App directly</p>
                <a
                  href={buyData.cashAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-black text-[11px] tracking-wider transition-colors"
                  data-testid="link-market-cashapp-pay"
                >
                  <ExternalLink className="h-3 w-3" />
                  OPEN CASH APP — ${buyData.price.toFixed(2)}
                </a>
              </div>
            </>
          )}

          {error && (
            <div className="border border-red-500/30 bg-red-500/10 p-2 text-center">
              <p className="text-[10px] text-red-400 font-bold">{error}</p>
            </div>
          )}

          {poolFullState && resaleOffers.length > 0 && !buyData && (
            <div className="border-2 border-violet-500/40 bg-violet-950/20 p-3 space-y-2" data-testid="resale-board">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                <span className="text-[10px] text-violet-400 font-black tracking-wider">RESALE BOARD — BUY FROM OWNERS</span>
              </div>
              {resaleOffers.map((offer: any) => (
                <div key={offer.id} className="flex items-center justify-between border border-violet-500/20 bg-violet-950/30 px-3 py-2">
                  <div>
                    <p className="text-[9px] text-zinc-400">SELLER OFFER</p>
                    <p className="text-sm text-violet-400 font-black">${parseFloat(offer.askPrice).toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => handleLockPosition(offer.id)}
                    disabled={processing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 transition-all disabled:opacity-50"
                    data-testid={`btn-buy-resale-${offer.id}`}
                  >
                    {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <DollarSign className="h-3 w-3" />}
                    BUY THIS OFFER
                  </button>
                </div>
              ))}
            </div>
          )}

          {poolFullState && resaleOffers.length === 0 && !buyData && (
            <div className="border border-zinc-700 bg-zinc-900/50 p-3 text-center">
              <p className="text-[10px] text-zinc-400 font-bold">POOL FULL — NO RESALE OFFERS YET</p>
              <p className="text-[8px] text-zinc-500 mt-1">Check back later — owners may list their position for sale</p>
            </div>
          )}

          {processing ? (
            <div className="border border-green-500/30 bg-green-950/30 p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-[11px] text-green-400 font-bold animate-pulse">LOCKING POSITION...</p>
              </div>
            </div>
          ) : !buyData && !poolFullState ? (
            <button
              onClick={() => handleLockPosition()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-3 text-sm tracking-wider transition-colors"
              data-testid="btn-lock-market-position"
            >
              <DollarSign className="h-4 w-4 inline mr-1" />
              LOCK POSITION — ${price.toFixed(2)}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PortfolioPanel({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [sellId, setSellId] = useState<string | null>(null);
  const [askPrice, setAskPrice] = useState("");

  const { data: portfolio, isLoading } = useQuery<{ holdings: PortfolioItem[]; totalValue: number; totalInvested: number; totalPL: number }>({
    queryKey: ["/api/market/portfolio"],
    refetchInterval: 5000,
  });

  const sellMut = useMutation({
    mutationFn: async ({ holdingId, askPrice }: { holdingId: string; askPrice: string }) => {
      const res = await apiRequest("POST", "/api/market/sell", { holdingId, askPrice: parseFloat(askPrice) });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "LISTED FOR SALE", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/market/portfolio"] });
      setSellId(null);
      setAskPrice("");
    },
    onError: (err: any) => toast({ title: "FAILED", description: err.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async (holdingId: string) => {
      const res = await apiRequest("POST", "/api/market/cancel-sale", { holdingId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "SALE CANCELLED" });
      queryClient.invalidateQueries({ queryKey: ["/api/market/portfolio"] });
    },
  });

  if (isLoading) return <div className="text-emerald-400 animate-pulse p-6 text-center font-mono">LOADING PORTFOLIO...</div>;

  const pl = portfolio?.totalPL || 0;
  const isProfit = pl >= 0;

  return (
    <div className="border border-emerald-500/20 bg-black/95 overflow-hidden" data-testid="portfolio-panel">
      <div className="bg-gradient-to-r from-emerald-950/40 to-black px-4 py-3 border-b border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-400 text-[11px] font-black tracking-wider">MY PORTFOLIO</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white" data-testid="btn-close-portfolio"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        <div className="bg-emerald-950/20 border border-emerald-500/15 p-2 text-center">
          <p className="text-[7px] text-emerald-500/60 tracking-widest">VALUE</p>
          <p className="text-emerald-400 font-black">${(portfolio?.totalValue || 0).toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-2 text-center">
          <p className="text-[7px] text-zinc-500 tracking-widest">INVESTED</p>
          <p className="text-white font-black">${(portfolio?.totalInvested || 0).toFixed(2)}</p>
        </div>
        <div className={`border p-2 text-center ${isProfit ? "bg-emerald-950/20 border-emerald-500/15" : "bg-red-950/20 border-red-500/15"}`}>
          <p className="text-[7px] tracking-widest" style={{ color: isProfit ? "#34d39960" : "#f8717160" }}>P/L</p>
          <p className={`font-black ${isProfit ? "text-emerald-400" : "text-red-400"}`}>{isProfit ? "+" : ""}${pl.toFixed(2)}</p>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/50 max-h-80 overflow-y-auto">
        {portfolio?.holdings.map((h) => (
          <div key={h.id} className="px-3 py-2.5 flex items-center gap-3 hover:bg-emerald-950/10" data-testid={`holding-${h.id}`}>
            {h.coverImage ? (
              <img src={h.coverImage} alt="" className="w-8 h-8 border border-zinc-800 flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 bg-emerald-950 border border-zinc-800 flex-shrink-0 flex items-center justify-center">
                <Music className="h-3 w-3 text-emerald-500/30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold truncate">{h.title}</p>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-zinc-500">BOUGHT: ${parseFloat(h.purchasePrice).toFixed(2)}</span>
                <span className={h.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {h.profitLoss >= 0 ? "+" : ""}{h.roiPct}%
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-black font-mono ${h.profitLoss >= 0 ? "text-emerald-400" : "text-red-400"}`}>${h.livePrice.toFixed(2)}</p>
              {h.listedForSale ? (
                <button
                  onClick={() => cancelMut.mutate(h.id)}
                  className="text-[8px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 hover:bg-amber-500/10 mt-0.5"
                  data-testid={`btn-cancel-${h.id}`}
                >
                  LISTED ${parseFloat(h.askPrice || "0").toFixed(2)} — CANCEL
                </button>
              ) : sellId === h.id ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0.25"
                    value={askPrice}
                    onChange={e => setAskPrice(e.target.value)}
                    className="w-16 bg-black border border-emerald-500/30 text-emerald-400 text-[10px] p-1 font-mono"
                    placeholder="Price"
                    data-testid={`input-ask-${h.id}`}
                  />
                  <button
                    onClick={() => sellMut.mutate({ holdingId: h.id, askPrice })}
                    disabled={!askPrice || parseFloat(askPrice) < 0.25}
                    className="text-[8px] bg-orange-600 text-white px-1.5 py-0.5 font-bold disabled:opacity-50"
                    data-testid={`btn-confirm-sell-${h.id}`}
                  >
                    LIST
                  </button>
                  <button onClick={() => setSellId(null)} className="text-[8px] text-zinc-500 px-1">X</button>
                </div>
              ) : (
                <button
                  onClick={() => { setSellId(h.id); setAskPrice(h.livePrice.toFixed(2)); }}
                  className="text-[8px] text-orange-400 border border-orange-500/30 px-1.5 py-0.5 hover:bg-orange-500/10 mt-0.5"
                  data-testid={`btn-sell-${h.id}`}
                >
                  SELL
                </button>
              )}
            </div>
          </div>
        ))}
        {(!portfolio?.holdings || portfolio.holdings.length === 0) && (
          <div className="p-6 text-center text-zinc-500 text-xs font-mono">NO HOLDINGS YET — BUY YOUR FIRST SONG</div>
        )}
      </div>
    </div>
  );
}

function LeaderboardPanel() {
  const { data, isLoading } = useQuery<{ leaderboard: LeaderboardEntry[]; first10k: LeaderboardEntry | null; contestGoal: number }>({
    queryKey: ["/api/market/leaderboard"],
    refetchInterval: 15000,
  });

  if (isLoading) return <div className="text-amber-400 animate-pulse p-4 font-mono text-xs">LOADING LEADERBOARD...</div>;

  const board = data?.leaderboard || [];
  const goal = data?.contestGoal || 10000;
  const winner = data?.first10k;

  function getTier(val: number) {
    if (val >= 10000) return { label: "10K CHAMPION", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Crown };
    if (val >= 1000) return { label: "$1K+", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30", icon: Trophy };
    if (val >= 100) return { label: "$100+", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30", icon: Medal };
    if (val >= 10) return { label: "$10+", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: Star };
    return { label: "STARTER", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-800", icon: Zap };
  }

  return (
    <div className="border border-amber-500/20 bg-black/95 overflow-hidden" data-testid="leaderboard-panel">
      <div className="bg-gradient-to-r from-amber-950/40 to-black px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-amber-400 text-[11px] font-black tracking-wider">FIRST TO $10K — LEADERBOARD</span>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </div>
      </div>

      {winner && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-transparent px-4 py-3 border-b border-yellow-500/20">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-400" />
            <span className="text-yellow-400 font-black text-sm">{winner.username} — $10K CHAMPION!</span>
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="text-[8px] text-amber-500/60 mb-2 font-mono tracking-widest">$1 → $10 → $100 → $1,000 → $10,000</div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {board.map((entry, i) => {
            const tier = getTier(entry.portfolioValue);
            const TierIcon = tier.icon;
            const pct = Math.min(100, (entry.portfolioValue / goal) * 100);
            return (
              <div key={entry.userId} className={`flex items-center gap-2.5 p-2 border rounded ${tier.bg}`} data-testid={`board-entry-${i}`}>
                <span className={`text-xs font-black w-5 text-right ${i < 3 ? "text-amber-400" : "text-zinc-500"}`}>#{i + 1}</span>
                {entry.profileImage ? (
                  <img src={entry.profileImage} alt="" className="w-6 h-6 rounded-full border border-zinc-700" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                    {entry.username[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-[10px] font-bold truncate">{entry.username}</span>
                    <TierIcon className={`h-3 w-3 ${tier.color}`} />
                  </div>
                  <div className="w-full bg-zinc-800 h-1 rounded-full mt-0.5">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f59e0b, #eab308)" }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-black font-mono ${tier.color}`}>${entry.portfolioValue.toFixed(2)}</span>
                  <p className="text-[7px] text-zinc-500">{entry.holdings} SONGS</p>
                </div>
              </div>
            );
          })}
          {board.length === 0 && <div className="text-center text-zinc-500 text-xs py-4 font-mono">NO TRADERS YET</div>}
        </div>
      </div>
    </div>
  );
}

export default function MusicMarketPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyDialogListing, setBuyDialogListing] = useState<MarketListing | null>(null);

  const { data: listings, isLoading } = useQuery<MarketListing[]>({
    queryKey: ["/api/market/listings"],
    refetchInterval: 8000,
  });

  const handleBuy = (listingId: string) => {
    const listing = listings?.find(l => l.id === listingId);
    if (listing) setBuyDialogListing(listing);
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-emerald-500/60 font-mono text-xs">LOADING MUSIC MARKET...</p>
        </div>
      </div>
    );
  }

  const totalVolume = listings?.reduce((s, l) => s + l.volume, 0) || 0;
  const avgPrice = listings && listings.length > 0
    ? (listings.reduce((s, l) => s + l.livePrice, 0) / listings.length) : 0;
  const gainers = listings?.filter(l => l.livePrice > parseFloat(l.basePrice)).length || 0;
  const losers = listings?.filter(l => l.livePrice < parseFloat(l.basePrice)).length || 0;

  return (
    <div className="min-h-full bg-black pb-36 font-mono">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-black to-amber-950/10" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(16,185,129,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16,185,129,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Activity className="h-6 w-6 text-emerald-400" />
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight" data-testid="text-market-title">THE MUSIC MARKET</h1>
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 8px #34d399" }} />
              </div>
              <p className="text-emerald-500/60 text-xs">BUY SONGS • HOLD FOR GAINS • SELL TO TRADERS • FIRST TO $10K WINS</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPortfolio(!showPortfolio)}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/30 transition-all"
                data-testid="btn-toggle-portfolio"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                {showPortfolio ? "HIDE PORTFOLIO" : "MY PORTFOLIO"}
              </button>
              <Link
                href="/"
                className="flex items-center gap-1 px-3 py-2 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors"
                data-testid="link-back-floor"
              >
                TRADE FLOOR <ChevronRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-black/60 border border-emerald-500/20 p-3 text-center">
              <p className="text-[7px] text-emerald-500/60 tracking-widest">SONGS LISTED</p>
              <p className="text-emerald-400 font-black text-xl">{listings?.length || 0}</p>
            </div>
            <div className="bg-black/60 border border-amber-500/20 p-3 text-center">
              <p className="text-[7px] text-amber-500/60 tracking-widest">TOTAL VOLUME</p>
              <p className="text-amber-400 font-black text-xl">{totalVolume}</p>
            </div>
            <div className="bg-black/60 border border-emerald-500/20 p-3 text-center">
              <p className="text-[7px] text-emerald-500/60 tracking-widest">GAINERS</p>
              <p className="text-emerald-400 font-black text-xl">{gainers}</p>
            </div>
            <div className="bg-black/60 border border-red-500/20 p-3 text-center">
              <p className="text-[7px] text-red-500/60 tracking-widest">LOSERS</p>
              <p className="text-red-400 font-black text-xl">{losers}</p>
            </div>
          </div>

          <div className="bg-emerald-950/20 border border-emerald-500/15 p-2 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-[9px] text-amber-400 font-black">CONTEST: FIRST TO $10,000 PORTFOLIO VALUE</span>
            </div>
            <span className="text-[8px] text-emerald-500/60 font-mono">$1 → $10 → $100 → $1K → $10K</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${showPortfolio ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 text-[11px] font-black tracking-wider">ALL LISTINGS</span>
                <span className="text-emerald-500/40 text-[9px]">{listings?.length} SONGS</span>
              </div>
              <div className="text-[9px] text-emerald-500/40 font-mono">AVG: ${avgPrice.toFixed(2)} | LIVE PRICES</div>
            </div>

            <div className={`grid ${showPortfolio ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"} gap-3`}>
              {listings?.map((listing) => (
                <StockCard
                  key={listing.id}
                  listing={listing}
                  onBuy={handleBuy}
                  buying={false}
                />
              ))}
            </div>

            {(!listings || listings.length === 0) && (
              <div className="border border-emerald-500/15 bg-black/60 p-10 text-center">
                <Activity className="h-12 w-12 text-emerald-500/20 mx-auto mb-4" />
                <p className="text-white font-bold text-lg mb-2" data-testid="text-no-listings">MARKET OPENING SOON</p>
                <p className="text-emerald-500/60 text-xs">Songs will be listed for trading shortly</p>
              </div>
            )}
          </div>

          {showPortfolio && (
            <div className="space-y-4">
              <PortfolioPanel onClose={() => setShowPortfolio(false)} />
              <LeaderboardPanel />
            </div>
          )}

          {!showPortfolio && (
            <div className="lg:col-span-3">
              <LeaderboardPanel />
            </div>
          )}
        </div>
      </div>

      {buyDialogListing && (
        <CashAppBuyDialog
          listing={buyDialogListing}
          onClose={() => setBuyDialogListing(null)}
        />
      )}
    </div>
  );
}
