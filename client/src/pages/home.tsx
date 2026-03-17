import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Music, ShoppingCart, Activity, Zap, Lock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import type { TrackWithArtist } from "@shared/schema";

const UNIT_PRICE = 0.99;
const CEILING = 1000.00;
const SETTLEMENT_PAYOUT = 300.00;
const HOLDER_COUNT = 15;
const PAYHIP_STORE = "https://payhip.com/aitifymusicstore";

function AssetCard({ track, onPlay }: { track: TrackWithArtist; onPlay: (t: TrackWithArtist) => void }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;

  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;
  const assetId = `ATFY-${String(track.id).slice(0, 5).toUpperCase()}`;

  const unitsSold = track.playCount || 0;
  const grossSales = parseFloat((unitsSold * UNIT_PRICE).toFixed(2));
  const capacityPct = Math.min(100, parseFloat(((grossSales / CEILING) * 100).toFixed(1)));
  const isClosed = grossSales >= CEILING;
  const isHighCapacity = capacityPct >= 60 && !isClosed;
  const remaining = Math.max(0, parseFloat((CEILING - grossSales).toFixed(2)));

  return (
    <div className={`bg-black border font-mono group transition-all ${isClosed ? "border-red-500/40" : isHighCapacity ? "border-yellow-500/40" : "border-emerald-500/20 hover:border-emerald-500/60"}`} data-testid={`asset-card-${track.id}`}>
      <div className={`border-b px-3 py-1.5 flex items-center justify-between ${isClosed ? "border-red-500/20 bg-red-500/5" : isHighCapacity ? "border-yellow-500/20 bg-yellow-500/5" : "border-emerald-500/10 bg-emerald-500/5"}`}>
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs ${isClosed ? "text-red-400" : "text-emerald-400"}`}>{ticker}</span>
          <span className="text-zinc-600 text-[9px]">{assetId}</span>
        </div>
        {isClosed ? (
          <span className="text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 font-bold flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" /> CLOSED
          </span>
        ) : isHighCapacity ? (
          <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 font-bold animate-pulse">
            {capacityPct.toFixed(0)}% CAPACITY
          </span>
        ) : (
          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500">OPEN</span>
        )}
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

        <div className="grid grid-cols-3 gap-1 mb-2 text-center">
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">GROSS SALES ($)</p>
            <p className={`text-[11px] font-bold ${isClosed ? "text-red-400" : grossSales > 0 ? "text-emerald-400" : "text-zinc-500"}`}>${grossSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">UNITS SOLD</p>
            <p className="text-[11px] text-white font-bold">{unitsSold.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">CEILING</p>
            <p className="text-[11px] text-zinc-400 font-bold">${CEILING.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-zinc-600">SALES → $1K CEILING</span>
            <span className={`text-[10px] font-bold ${isClosed ? "text-red-400" : isHighCapacity ? "text-yellow-400" : "text-emerald-400"}`}>{capacityPct}%</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5">
            <div
              className={`h-1.5 transition-all ${isClosed ? "bg-red-500" : isHighCapacity ? "bg-yellow-500 animate-pulse" : "bg-emerald-500"}`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-zinc-600 text-[9px]">@ ${UNIT_PRICE}/UNIT</span>
            {!isClosed && <span className="text-emerald-500/50 text-[9px]">${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} TO CLOSE</span>}
            {isClosed && <span className="text-red-400 text-[9px]">SETTLED</span>}
          </div>
        </div>

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
          ) : (
            <a
              href={PAYHIP_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-1.5 text-center hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
              data-testid={`button-buy-${track.id}`}
            >
              <ShoppingCart className="h-3 w-3" /> BUY @ ${UNIT_PRICE}
            </a>
          )}
          <button
            className="flex-1 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1.5 text-center hover:bg-emerald-500/10 transition-colors"
            onClick={() => onPlay(track)}
            data-testid={`button-stream-${track.id}`}
          >
            <Play className="h-3 w-3 inline mr-1" />STREAM
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();
  const autoPlayedRef = useRef(false);

  const { data: featuredTracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
  });

  useEffect(() => {
    if (featuredTracks && featuredTracks.length > 0 && !autoPlayedRef.current && !currentTrack) {
      autoPlayedRef.current = true;
      playTrack(featuredTracks[0], featuredTracks);
    }
  }, [featuredTracks]);

  const displayTracks = featuredTracks || [];

  const totalGrossSales = displayTracks.reduce((sum, t) => sum + ((t.playCount || 0) * UNIT_PRICE), 0);
  const totalUnits = displayTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
  const closedCount = displayTracks.filter(t => ((t.playCount || 0) * UNIT_PRICE) >= CEILING).length;
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
              <p className="text-[9px] text-zinc-600">CLOSED / SETTLED</p>
              <p className="text-sm font-bold"><span className="text-red-400">{closedCount}</span><span className="text-zinc-600"> / {displayTracks.length}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-zinc-600">UNIT PRICE:</span>
          <span className="text-emerald-400">${UNIT_PRICE}</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CEILING:</span>
          <span className="text-emerald-400">${CEILING.toLocaleString()}</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">SETTLEMENT:</span>
          <span className="text-emerald-400">${SETTLEMENT_PAYOUT} → {HOLDER_COUNT} HOLDERS</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-600">{user?.firstName || user?.email || "TRADER"}</span>
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
            <p className="text-zinc-700 text-[10px] mt-1">Upload tracks via Artist Portal to list assets on the exchange</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[9px] text-zinc-600 font-mono">
          <span>AITIFY SOVEREIGN MINT | 97.7 THE FLAME | AityPay SETTLEMENT ENGINE</span>
          <span>UNIT: ${UNIT_PRICE} | CEILING: ${CEILING.toLocaleString()} | PAYOUT: ${SETTLEMENT_PAYOUT} → {HOLDER_COUNT} HOLDERS</span>
        </div>
      </div>
    </div>
  );
}
