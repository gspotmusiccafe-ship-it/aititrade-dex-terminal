import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, TrendingUp, Music, ShoppingCart, Activity, Zap, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import type { TrackWithArtist } from "@shared/schema";

const SETTLEMENT_RATE = 0.00025;

interface LivePopScore {
  id: string;
  spotifyTrackId: string;
  title: string;
  artistName: string;
  streamCount: number;
  isQualified: boolean;
  coverArt: string | null;
  popScore: number;
  settlement: string;
  ticker: string;
}

function AssetCard({ track, liveData, onPlay }: { track: TrackWithArtist; liveData?: LivePopScore; onPlay: (t: TrackWithArtist) => void }) {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;
  const ticker = `$${(track.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`;
  const assetId = `ATFY-${track.id.slice(0, 5).toUpperCase()}`;
  const streamCount = liveData?.streamCount || track.plays || 0;
  const isQualified = liveData?.isQualified || streamCount >= 1000;
  const popScore = liveData?.popScore || Math.min(100, Math.round((streamCount / 1000) * 100));
  const settlement = liveData?.settlement || (streamCount * SETTLEMENT_RATE).toFixed(4);
  const positions = Math.max(5, 50 - Math.floor(streamCount / 20));
  const tradeVol = (streamCount * 1.3 + Math.floor(Math.random() * 100)).toLocaleString();

  return (
    <div className="bg-black border border-emerald-500/20 hover:border-emerald-500/60 transition-all font-mono group" data-testid={`asset-card-${track.id}`}>
      <div className="border-b border-emerald-500/10 px-3 py-1.5 flex items-center justify-between bg-emerald-500/5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-xs">{ticker}</span>
          <span className="text-zinc-600 text-[9px]">{assetId}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] px-1 py-0.5 ${isQualified ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/10 text-emerald-500"}`}>
            {isQualified ? "QUALIFIED" : "EMERGING"}
          </span>
          <span className="text-zinc-600 text-[9px]">{positions} POS</span>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="relative w-10 h-10 bg-zinc-900 overflow-hidden flex-shrink-0 border border-emerald-500/10">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover opacity-80" />
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
          <div className="text-right">
            <p className="text-xs text-emerald-400 font-bold">${settlement}</p>
            <p className="text-[9px] text-zinc-600">SETTLEMENT</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 mb-2 text-center">
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">VOL</p>
            <p className="text-[10px] text-white font-bold">{streamCount.toLocaleString()}</p>
          </div>
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">TRADE VOL</p>
            <p className="text-[10px] text-white font-bold">{tradeVol}</p>
          </div>
          <div className="bg-zinc-900/80 p-1 border border-zinc-800">
            <p className="text-[9px] text-zinc-600">YIELD</p>
            <p className={`text-[10px] font-bold ${isQualified ? "text-yellow-400" : "text-emerald-400"}`}>▲ {isQualified ? "25%" : "16%"}</p>
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-zinc-600">POP SCORE {liveData ? "(LIVE)" : "(EST)"}</span>
            <span className={`text-[10px] font-bold ${popScore >= 75 ? "text-yellow-400" : popScore >= 40 ? "text-emerald-400" : "text-zinc-500"}`}>{popScore}/100</span>
          </div>
          <div className="w-full bg-zinc-900 h-1">
            <div
              className={`h-1 transition-all ${popScore >= 75 ? "bg-yellow-500" : popScore >= 40 ? "bg-emerald-500" : "bg-zinc-600"}`}
              style={{ width: `${popScore}%` }}
            />
          </div>
        </div>

        <div className="flex gap-1">
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
        <div className="flex gap-1 mt-1">
          {track.buyLink ? (
            <a
              href={track.buyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-1.5 text-center hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
              data-testid={`button-buy-${track.id}`}
            >
              <ShoppingCart className="h-3 w-3" /> BUY @ 0.99
            </a>
          ) : (
            <button
              className="flex-1 bg-emerald-600 text-white text-[10px] font-bold py-1.5 text-center hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1"
              onClick={() => onPlay(track)}
              data-testid={`button-stream-${track.id}`}
            >
              <Play className="h-3 w-3" /> STREAM
            </button>
          )}
          <button
            className="flex-1 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-1.5 text-center hover:bg-emerald-500/10 transition-colors"
            onClick={() => onPlay(track)}
            data-testid={`button-trade-${track.id}`}
          >
            TRADE
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

  const { data: liveScores } = useQuery<LivePopScore[]>({
    queryKey: ["/api/live-pop-scores"],
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (featuredTracks && featuredTracks.length > 0 && !autoPlayedRef.current && !currentTrack) {
      autoPlayedRef.current = true;
      playTrack(featuredTracks[0], featuredTracks);
    }
  }, [featuredTracks]);

  const displayTracks = featuredTracks || [];

  const getLiveData = (track: TrackWithArtist): LivePopScore | undefined => {
    if (!liveScores) return undefined;
    const titleMatch = track.title.toLowerCase().trim();
    return liveScores.find(s => s.title.toLowerCase().trim() === titleMatch);
  };

  const totalVol = displayTracks.reduce((sum, t) => sum + (t.plays || 0), 0);
  const totalSettlement = (totalVol * SETTLEMENT_RATE).toFixed(4);
  const qualifiedCount = liveScores?.filter(s => s.isQualified).length || 0;
  const liveCount = liveScores?.length || 0;

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
              <p className="text-[9px] text-zinc-600">TOTAL ASSETS</p>
              <p className="text-sm text-white font-bold">{displayTracks.length}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">TOTAL VOLUME</p>
              <p className="text-sm text-emerald-400 font-bold">{totalVol.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">SETTLEMENT</p>
              <p className="text-sm text-emerald-400 font-bold">${totalSettlement}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-2">
              <p className="text-[9px] text-zinc-600">QUALIFIED / TRACKED</p>
              <p className="text-sm font-bold"><span className="text-yellow-400">{qualifiedCount}</span><span className="text-zinc-600"> / {liveCount}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-zinc-600">RATE:</span>
          <span className="text-emerald-400">${SETTLEMENT_RATE}/STREAM</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">SECTOR:</span>
          <span className="text-emerald-400">$MUSE</span>
          <span className="text-zinc-800">|</span>
          <span className="text-zinc-600">CLASS:</span>
          <span className="text-emerald-400">MUSICAL EQUITY</span>
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
                liveData={getLiveData(track)}
                onPlay={(t) => playTrack(t, displayTracks)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-zinc-800">
            <Zap className="h-8 w-8 text-emerald-500/30 mx-auto mb-3" />
            <p className="text-emerald-500/50 text-sm">NO ASSETS IN EXCHANGE</p>
            <p className="text-zinc-700 text-[10px] mt-1">Upload tracks via Artist Portal to list assets</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex items-center justify-between text-[9px] text-zinc-600 font-mono">
          <span>AITIFY SOVEREIGN MINT | 97.7 THE FLAME | $MUSE EXCHANGE</span>
          <span>SETTLEMENT: ${SETTLEMENT_RATE}/STREAM | ALL RIGHTS RESERVED</span>
        </div>
      </div>
    </div>
  );
}
