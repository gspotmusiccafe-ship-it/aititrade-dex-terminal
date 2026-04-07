import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ShoppingCart, ListMusic, X, Trash2, DollarSign, Radio, Wifi, Clock, Video, VideoOff, Zap, ChevronUp, ChevronDown } from "lucide-react";
import logoImage from "@assets/a-bold-radio-station-logo-featuring-aiti_1n6BE9AnRHSDyOdG86KF_1775583562146.jpeg";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TipJarDialog } from "@/components/tip-jar-dialog";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

function isVideoUrl(url: string): boolean {
  return isYouTubeUrl(url) || /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function truncateUrl(url: string, max = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "...";
}

function VideoPanel({ videoUrl, onClose }: { videoUrl: string; onClose: () => void }) {
  const youtubeId = extractYouTubeId(videoUrl);
  const isDirectVideo = !youtubeId && (videoUrl.includes(".mp4") || videoUrl.includes(".webm") || videoUrl.includes(".mov") || videoUrl.startsWith("http"));

  if (!youtubeId && !isDirectVideo) return null;

  return (
    <div className="fixed bottom-36 right-0 w-80 sm:w-96 bg-black border border-violet-500/30 shadow-2xl z-50 font-mono" style={{ boxShadow: "0 0 30px rgba(139,92,246,0.15)" }} data-testid="video-panel">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-violet-500/20 bg-violet-500/5">
        <div className="flex items-center gap-1.5">
          <Video className="h-3 w-3 text-violet-400" />
          <span className="text-[9px] text-violet-400 font-extrabold">97.7 THE FLAME — VIDEO</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-violet-500/60 hover:text-violet-400"
          onClick={onClose}
          data-testid="button-close-video"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="aspect-video w-full bg-black">
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            data-testid={`video-embed-${youtubeId}`}
          />
        ) : (
          <video
            src={videoUrl}
            className="w-full h-full"
            controls
            autoPlay
            playsInline
            data-testid="video-native-player"
          />
        )}
      </div>
    </div>
  );
}

export function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    progress,
    duration,
    shuffle,
    repeat,
    queue,
    queueIndex,
    autoplayBlocked,
    autopilot,
    broadcast,
    currentShow,
    broadcastUptime,
    signalStrength,
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    playFromQueue,
    resumeAutoplay,
    toggleAutopilot,
    toggleBroadcast,
    getShowLabel,
  } = usePlayer();

  const { toast } = useToast();
  const [queueOpen, setQueueOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [orderMakerOpen, setOrderMakerOpen] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  const upcomingTracks = queue.slice(queueIndex + 1);
  const trackVideoUrl = (currentTrack as any)?.videoUrl || "";
  const hasYouTubeVideo = currentTrack ? isYouTubeUrl(currentTrack.audioUrl) : false;
  const hasVideo = !!(trackVideoUrl) || hasYouTubeVideo;
  const activeVideoUrl = trackVideoUrl || (hasYouTubeVideo ? currentTrack!.audioUrl : "");

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-emerald-500/30 flex items-center justify-center gap-4 py-3 font-mono z-50" style={{ boxShadow: "0 -4px 30px rgba(34,197,94,0.08), 0 -1px 0 rgba(52,211,153,0.2)" }}>
        <img src={logoImage} alt="AITIFY" className="w-8 h-8 object-cover" style={{ filter: "drop-shadow(0 0 8px rgba(34,197,94,0.4))" }} />
        <div className="text-center">
          <p className="text-xs font-black text-lime-400 tracking-wider drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]" data-testid="text-radio-station-name">97.7 THE FLAME | AITITRADE EXCHANGE</p>
          <p className="text-[10px] text-amber-400 font-bold animate-pulse">AWAITING SIGNAL...</p>
        </div>
      </div>
    );
  }

  if (autoplayBlocked) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-emerald-500/30 z-50 flex items-center justify-center gap-4 px-4 py-3 font-mono cursor-pointer"
        style={{ boxShadow: "0 -4px 30px rgba(34,197,94,0.08), 0 -1px 0 rgba(52,211,153,0.2)" }}
        onClick={resumeAutoplay}
        role="button"
        data-testid="button-tune-in"
      >
        <img src={logoImage} alt="AITIFY" className="w-8 h-8 object-cover" style={{ filter: "drop-shadow(0 0 8px rgba(34,197,94,0.4))" }} />
        <div className="text-center">
          <p className="text-xs font-black text-lime-400 tracking-wider drop-shadow-[0_0_8px_rgba(132,204,22,0.4)]" data-testid="text-radio-blocked-name">97.7 THE FLAME</p>
          {(isVideoUrl(currentTrack.audioUrl) || isVideoUrl((currentTrack as any)?.videoUrl || "")) ? (
            <p className="text-[10px] text-violet-400 font-bold truncate max-w-[250px]">{truncateUrl((currentTrack as any)?.videoUrl || currentTrack.audioUrl, 45)}</p>
          ) : (
            <p className="text-[10px] text-amber-400 font-bold">{currentTrack.title.toUpperCase()} — <span className="text-cyan-400">{currentTrack.artist?.name}</span></p>
          )}
        </div>
        <Play className="h-4 w-4 text-lime-400 animate-pulse drop-shadow-[0_0_8px_rgba(132,204,22,0.6)]" />
      </div>
    );
  }

  const ticker = `$${(currentTrack.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 10)}`;
  const isUrlTrack = isVideoUrl(currentTrack.audioUrl) || isVideoUrl((currentTrack as any)?.videoUrl || "");
  const sourceUrl = (currentTrack as any)?.videoUrl || currentTrack.audioUrl;

  return (
    <>
      {orderMakerOpen && currentTrack && (
        <div className="fixed bottom-36 right-4 w-72 bg-zinc-950 border-2 border-green-500 p-4 shadow-2xl shadow-green-500/10 z-50 font-mono" data-testid="order-maker-panel">
          <div className="flex justify-between items-center border-b border-green-900 pb-2 mb-3">
            <span className="text-green-500 font-black text-xs uppercase italic">Direct Order Maker</span>
            <div className="flex items-center gap-2">
              <span className="text-red-600 text-[10px] font-bold animate-pulse">P2P_LIVE</span>
              <button onClick={() => setOrderMakerOpen(false)} className="text-emerald-500/40 hover:text-green-400"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="mb-3">
            <p className="text-[9px] text-emerald-500/60 tracking-wider mb-1">ASSET</p>
            <p className="text-white font-black text-sm uppercase truncate">{currentTrack.title}</p>
            <p className="text-emerald-500/40 text-[9px]">{currentTrack.artist?.name} | {ticker}</p>
          </div>
          <div className="bg-black border border-green-900/50 p-2.5 mb-3">
            <p className="text-white text-[10px] font-mono font-bold">STIMULATION: $7.00 FOR $21.00 MBB</p>
            <p className="text-emerald-500/40 text-[9px] mt-1">KINETIC SPLIT • FLOOR / CEO LIVE RATE</p>
          </div>
          <a
            href="https://cash.app/app/JNXGD73"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-green-600 text-center py-3 text-white font-black text-sm hover:bg-green-400 transition-all shadow-[0_0_10px_rgba(34,197,94,0.4)]"
            data-testid="button-order-maker-execute"
          >
            OPEN BROKERAGE ACCOUNT
          </a>
          <p className="text-[8px] text-emerald-500/25 mt-2 text-center truncate">$AITITRADEBROKERAGE • NO PAYPAL</p>
        </div>
      )}
      {videoOpen && hasVideo && activeVideoUrl && (
        <VideoPanel videoUrl={activeVideoUrl} onClose={() => setVideoOpen(false)} />
      )}
      {queueOpen && (
        <div className="fixed right-0 bottom-36 w-[85vw] sm:w-72 max-h-[55vh] sm:max-h-[60vh] bg-black border border-emerald-500/20 shadow-2xl z-50 flex flex-col font-mono" data-testid="queue-panel">
          <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-500/10 bg-emerald-500/5">
            <span className="text-[10px] text-emerald-400 font-bold">QUEUE</span>
            <div className="flex items-center gap-1">
              {upcomingTracks.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-emerald-500/50 hover:text-emerald-400"
                  onClick={() => { clearQueue(); toast({ title: "Queue cleared" }); }}
                  data-testid="button-clear-queue"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-emerald-500/50 hover:text-emerald-400"
                onClick={() => setQueueOpen(false)}
                data-testid="button-close-queue"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <div className="p-2">
              <p className="text-[9px] text-emerald-500/40 uppercase px-2 py-1">NOW PLAYING</p>
              <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/10">
                <div className="w-7 h-7 bg-emerald-950 overflow-hidden flex-shrink-0">
                  {currentTrack.coverImage ? (
                    <img src={currentTrack.coverImage} alt="" className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-emerald-400 text-[9px] font-bold">{currentTrack.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {isUrlTrack ? (
                    <p className="text-[10px] font-bold truncate text-violet-400">{truncateUrl(sourceUrl, 35)}</p>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold truncate text-emerald-400">{currentTrack.title.toUpperCase()}</p>
                      <p className="text-[9px] text-emerald-500/40 truncate">{currentTrack.artist?.name}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {upcomingTracks.length > 0 && (
              <div className="p-2 pt-0">
                <p className="text-[9px] text-emerald-500/40 uppercase px-2 py-1">NEXT ({upcomingTracks.length})</p>
                <div className="space-y-0.5">
                  {upcomingTracks.map((track, i) => {
                    const actualIndex = queueIndex + 1 + i;
                    const isFirst = i === 0;
                    const isLast = i === upcomingTracks.length - 1;
                    return (
                      <div
                        key={`${track.id}-${actualIndex}`}
                        className="flex items-center gap-1 p-1 sm:p-1.5 hover:bg-emerald-500/5 group/item cursor-pointer transition-colors"
                        onClick={() => playFromQueue(actualIndex)}
                        data-testid={`queue-track-${actualIndex}`}
                      >
                        <div className="flex flex-col items-center flex-shrink-0 w-6">
                          <button
                            className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${isFirst ? "text-emerald-900 cursor-default" : "text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20"}`}
                            onClick={(e) => { e.stopPropagation(); if (!isFirst) moveInQueue(actualIndex, actualIndex - 1); }}
                            disabled={isFirst}
                            data-testid={`button-queue-up-${actualIndex}`}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-[9px] text-emerald-500/40 font-mono font-bold leading-none">{i + 1}</span>
                          <button
                            className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${isLast ? "text-emerald-900 cursor-default" : "text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 active:bg-emerald-500/20"}`}
                            onClick={(e) => { e.stopPropagation(); if (!isLast) moveInQueue(actualIndex, actualIndex + 1); }}
                            disabled={isLast}
                            data-testid={`button-queue-down-${actualIndex}`}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          {isVideoUrl(track.audioUrl) || isVideoUrl((track as any)?.videoUrl || "") ? (
                            <p className="text-[10px] text-violet-400 truncate">{truncateUrl((track as any)?.videoUrl || track.audioUrl, 30)}</p>
                          ) : (
                            <>
                              <p className="text-[10px] text-white truncate">{track.title}</p>
                              <p className="text-[9px] text-emerald-500/40 truncate">{track.artist?.name}</p>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/item:opacity-100 text-emerald-500/40 flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); removeFromQueue(actualIndex); }}
                          data-testid={`button-remove-queue-${actualIndex}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {broadcast && (
        <div className="fixed bottom-36 left-0 right-0 h-6 bg-black/95 border-t border-red-500/20 z-50 font-mono flex items-center justify-center gap-4 px-4" data-testid="broadcast-status-bar">
          <div className="flex items-center gap-2">
            <Wifi className="h-3 w-3 text-red-400 animate-pulse" />
            <span className="text-[9px] text-red-400 font-extrabold tracking-widest">CONTINUOUS BROADCAST</span>
          </div>
          <span className="text-[9px] text-emerald-500/40">|</span>
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 text-amber-400/70" />
            <span className="text-[9px] text-amber-400 font-bold">{getShowLabel(currentShow)}</span>
          </div>
          <span className="text-[9px] text-emerald-500/40">|</span>
          <span className="text-[9px] text-emerald-500/60">MARKET-ONLY FEED</span>
          <span className="text-[9px] text-emerald-500/40">|</span>
          <span className="text-[9px] text-lime-400 font-bold">AUTOPILOT LOCKED</span>
          <span className="text-[9px] text-emerald-500/40">|</span>
          <span className="text-[9px] text-emerald-500/60">AD-BRIDGE</span>
          <span className="text-[9px] text-emerald-500/40">|</span>
          <div className="flex items-center gap-1" data-testid="signal-strength-indicator">
            <span className={`w-1.5 h-1.5 rounded-full ${
              signalStrength === "GREEN" ? "bg-lime-400 shadow-[0_0_6px_rgba(132,204,22,0.6)]" :
              signalStrength === "RED" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse" :
              "bg-emerald-800"
            }`} />
            <span className={`text-[9px] font-extrabold ${
              signalStrength === "GREEN" ? "text-lime-400" :
              signalStrength === "RED" ? "text-red-400" :
              "text-emerald-500/60"
            }`}>
              SIGNAL {signalStrength}
            </span>
          </div>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 z-50 font-mono" data-testid="music-player">
        <div className="w-full bg-black border-y border-emerald-500/30 py-1 overflow-hidden whitespace-nowrap select-none" data-testid="singing-ticker">
          <div className="animate-marquee inline-flex items-center text-xs md:text-sm">
            <span className="text-lime-400 font-black px-4 uppercase italic drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]">⚡ AITITRADE GLOBAL FLOOR: $1,000.00 ▲</span>
            <span className="text-cyan-400 font-mono font-bold px-4 border-l border-emerald-500/20">ASSET_LOAD: LIVE [STABLE]</span>
            <span className="text-green-400 font-black px-4 border-l border-emerald-500/20 uppercase drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">💰 CASH APP ONLY: $AITITRADEBROKERAGE</span>
            <span className="text-red-500 font-bold px-4 border-l border-emerald-500/20 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">● SIGNAL: 97.7 THE FLAME LIVE</span>
            <span className="text-amber-400 font-bold px-4 border-l border-emerald-500/20">KINETIC SPLIT — G. SMOOTH MANDATE</span>
            <span className="text-emerald-400 font-black px-4 border-l border-emerald-500/20 uppercase italic drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">STIMULATION ACTIVE :: BLESSING POOL: ONLINE</span>
            <span className="text-violet-400 font-bold px-4 border-l border-emerald-500/20">NO PAYPAL :: DIRECT SETTLEMENT</span>
            <span className="text-lime-400 font-black px-8 uppercase italic drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]">⚡ AITITRADE GLOBAL FLOOR: $1,000.00 ▲</span>
            <span className="text-cyan-400 font-mono font-bold px-4 border-l border-emerald-500/20">ASSET_LOAD: LIVE [STABLE]</span>
            <span className="text-green-400 font-black px-4 border-l border-emerald-500/20 uppercase drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]">💰 CASH APP ONLY: $AITITRADEBROKERAGE</span>
            <span className="text-red-500 font-bold px-4 border-l border-emerald-500/20 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">● SIGNAL: 97.7 THE FLAME LIVE</span>
            <span className="text-amber-400 font-bold px-4 border-l border-emerald-500/20">KINETIC SPLIT — G. SMOOTH MANDATE</span>
            <span className="text-emerald-400 font-black px-4 border-l border-emerald-500/20 uppercase italic drop-shadow-[0_0_6px_rgba(52,211,153,0.4)]">STIMULATION ACTIVE :: BLESSING POOL: ONLINE</span>
            <span className="text-violet-400 font-bold px-4 border-l border-emerald-500/20">NO PAYPAL :: DIRECT SETTLEMENT</span>
          </div>
        </div>
      <div className="bg-zinc-950 border-t border-emerald-500/30 shadow-[0_-10px_40px_rgba(0,0,0,0.9)]" style={{ boxShadow: "0 -4px 30px rgba(34,197,94,0.08), 0 -1px 0 rgba(52,211,153,0.2)" }}>
        <div className="px-2 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 max-w-screen-2xl mx-auto overflow-hidden">

          <div className="relative group w-20 h-20 md:w-24 md:h-24 border-2 border-emerald-500/40 rounded-sm overflow-hidden flex-shrink-0" style={{ boxShadow: isPlaying ? "0 0 20px rgba(34,197,94,0.25), 0 0 40px rgba(34,197,94,0.08)" : "0 0 8px rgba(34,197,94,0.1)" }} data-testid="deck-a-art">
            {currentTrack.coverImage ? (
              <img src={currentTrack.coverImage} alt={currentTrack.title} className={`w-full h-full object-cover ${isPlaying ? "animate-[spin_8s_linear_infinite]" : ""}`} />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br from-emerald-900/40 via-black to-lime-900/30 flex items-center justify-center ${isPlaying ? "animate-[spin_8s_linear_infinite]" : ""}`}>
                <span className="text-emerald-400 text-2xl font-black drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">{currentTrack.title[0]}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-green-500/10 mix-blend-color pointer-events-none" />
            {isPlaying && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-500 animate-pulse" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1.5">
              <div className="min-w-0 flex-1">
                {isUrlTrack ? (
                  <>
                    <h2 className="text-white font-black italic text-base md:text-xl tracking-tighter uppercase truncate" data-testid="text-current-track-title">
                      STREAMED MEDIA <span className="text-violet-400 not-italic text-xs md:text-sm drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]">// URL_LOADED</span>
                    </h2>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[9px] md:text-[10px] tracking-wider truncate max-w-full overflow-hidden block text-violet-400 hover:text-violet-300 underline underline-offset-2"
                      data-testid="text-current-track-url"
                      title={sourceUrl}
                    >
                      {truncateUrl(sourceUrl, 70)}
                    </a>
                    <p className="font-mono text-[8px] text-emerald-500/40 mt-0.5" data-testid="text-current-track-artist">
                      <span className="text-emerald-400">MP4/VIDEO</span>
                      <span className="text-emerald-500/40"> | </span>
                      <span className="text-amber-400">NON-NATIVE</span>
                      <span className="text-emerald-500/40"> | </span>
                      <span className="text-emerald-400">97.7 THE FLAME</span>
                      {broadcast && broadcastUptime > 0 && (
                        <span className="text-amber-400/70 ml-2">
                          UPTIME: {Math.floor(broadcastUptime / 3600)}:{String(Math.floor((broadcastUptime % 3600) / 60)).padStart(2, "0")}:{String(broadcastUptime % 60).padStart(2, "0")}
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-white font-black italic text-base md:text-xl tracking-tighter uppercase truncate" data-testid="text-current-track-title">
                      {currentTrack.title.toUpperCase()} <span className="text-lime-400 not-italic text-xs md:text-sm drop-shadow-[0_0_6px_rgba(132,204,22,0.5)]">// ASSET_ACTIVE</span>
                    </h2>
                    <p className="font-mono text-[9px] md:text-[10px] uppercase tracking-widest truncate max-w-full overflow-hidden" data-testid="text-current-track-artist">
                      <span className="text-amber-400 font-bold">{currentTrack.artist?.name}</span>
                      <span className="text-emerald-500/40"> | </span>
                      <span className="text-cyan-400">TICKER: <span className="text-lime-400 font-bold">{ticker}</span></span>
                      <span className="text-emerald-500/40"> | </span>
                      <span className="text-emerald-400">MARKET: <span className="text-emerald-300 font-bold">AITITRADE_SOVEREIGN</span></span>
                      {broadcast && broadcastUptime > 0 && (
                        <span className="text-amber-400/70 ml-2">
                          UPTIME: {Math.floor(broadcastUptime / 3600)}:{String(Math.floor((broadcastUptime % 3600) / 60)).padStart(2, "0")}:{String(broadcastUptime % 60).padStart(2, "0")}
                        </span>
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-3 hidden md:block">
                <div className="flex items-center gap-1.5 justify-end">
                  <Radio className="h-3 w-3 text-red-500 animate-pulse" />
                  <p className="text-[10px] text-lime-400 font-extrabold drop-shadow-[0_0_6px_rgba(132,204,22,0.5)]" data-testid="text-radio-station-label">97.7 THE FLAME</p>
                  {broadcast && (
                    <span className="text-[8px] font-extrabold text-red-400 bg-red-500/15 border border-red-500/40 px-1.5 py-0.5 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" data-testid="badge-broadcast-live">● LIVE</span>
                  )}
                  {broadcast && (
                    <span className="text-[8px] font-bold text-amber-400" data-testid="text-show-name">{getShowLabel(currentShow)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    signalStrength === "GREEN" ? "bg-lime-400 shadow-[0_0_10px_rgba(132,204,22,0.8)]" :
                    signalStrength === "RED" ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" :
                    "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                  }`} data-testid="signal-dot" />
                  <p className={`text-lg font-black animate-pulse ${
                    signalStrength === "GREEN" ? "text-lime-400 drop-shadow-[0_0_10px_rgba(132,204,22,0.6)]" :
                    signalStrength === "RED" ? "text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" :
                    "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  }`} data-testid="signal-strength-display">SIGNAL: {signalStrength === "GREEN" ? "100%" : signalStrength === "RED" ? "WEAK" : "TUNING..."}</p>
                </div>
              </div>
            </div>

            <div className="w-full flex items-center gap-2 mb-2">
              <span className="text-[10px] text-emerald-500 font-bold w-8 text-right">{formatTime(progress)}</span>
              <Slider
                value={[progress]}
                max={duration || 100}
                step={1}
                onValueChange={([value]) => seekTo(value)}
                className="flex-1"
                data-testid="slider-progress"
              />
              <span className="text-[10px] text-emerald-500 font-bold w-8">{formatTime(duration)}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 h-9 md:h-10">
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${shuffle ? "text-emerald-400" : "text-emerald-500/40"} hover:text-emerald-400`} onClick={toggleShuffle} data-testid="button-shuffle">
                  <Shuffle className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400/70 hover:text-emerald-400" onClick={prevTrack} data-testid="button-prev-track">
                  <SkipBack className="h-3.5 w-3.5" />
                </Button>
                <button onClick={togglePlay} className="h-8 w-8 rounded-full bg-lime-500 hover:bg-lime-400 text-black flex items-center justify-center transition-colors" style={{ boxShadow: isPlaying ? "0 0 16px rgba(132,204,22,0.6), 0 0 30px rgba(132,204,22,0.2)" : "0 0 8px rgba(132,204,22,0.3)" }} data-testid="button-play-pause">
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400/70 hover:text-emerald-400" onClick={nextTrack} data-testid="button-next-track">
                  <SkipForward className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${repeat !== "off" ? "text-emerald-400" : "text-emerald-500/40"} hover:text-emerald-400`} onClick={toggleRepeat} data-testid="button-repeat">
                  {repeat === "one" ? <Repeat1 className="h-3 w-3" /> : <Repeat className="h-3 w-3" />}
                </Button>
              </div>

              <button
                onClick={() => window.open("https://cash.app/app/JNXGD73", "_blank", "noopener,noreferrer")}
                className="bg-emerald-900/30 border border-emerald-500/40 text-lime-400 font-bold text-[9px] sm:text-[10px] hover:bg-emerald-800/40 hover:text-white transition-all uppercase flex items-center justify-center gap-1 min-w-0 px-1"
                style={{ boxShadow: "0 0 10px rgba(34,197,94,0.15)" }}
                data-testid="button-quick-acquire"
              >
                <DollarSign className="h-3 w-3 flex-shrink-0 text-green-400" /> <span className="truncate">Open Brokerage</span>
              </button>

              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={toggleAutopilot}
                  className={`flex-1 h-full flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-wider transition-all border ${
                    autopilot ? "bg-lime-500/20 border-lime-500/50 text-lime-400" : "border-emerald-500/20 text-emerald-400/70 hover:border-lime-500/40 hover:text-lime-400 bg-emerald-950"
                  }`}
                  data-testid="button-autopilot-toggle"
                >
                  <Radio className="h-3 w-3" /> {autopilot ? "AUTO ON" : "AUTOPILOT"}
                </button>
                <button
                  onClick={toggleBroadcast}
                  className={`flex-1 h-full flex items-center justify-center gap-1 text-[9px] font-extrabold uppercase tracking-wider transition-all border ${
                    broadcast ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse" : "border-emerald-500/20 text-emerald-400/70 hover:border-red-500/40 hover:text-red-400 bg-emerald-950"
                  }`}
                  data-testid="button-broadcast-toggle"
                >
                  <Wifi className="h-3 w-3" /> {broadcast ? "LIVE" : "BROADCAST"}
                </button>
              </div>

              <div className="hidden md:flex bg-black/80 border border-emerald-500/30 items-center justify-center overflow-hidden relative" style={{ boxShadow: "inset 0 0 15px rgba(34,197,94,0.05)" }}>
                <span className="text-emerald-400 font-mono text-[9px] font-bold whitespace-nowrap animate-[marquee_12s_linear_infinite] absolute drop-shadow-[0_0_4px_rgba(52,211,153,0.3)]" data-testid="text-floor-data">
                  ⚡ FLOOR_CEILING: $1,000.00 | KINETIC SPLIT PROTECTED | $AITITRADEBROKERAGE ⚡
                </span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-center gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="Queue" className={`h-7 w-7 ${queueOpen ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "text-emerald-500/50"} hover:text-emerald-400 relative`} onClick={() => setQueueOpen(!queueOpen)} data-testid="button-toggle-queue">
                <ListMusic className="h-3.5 w-3.5" />
                {upcomingTracks.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 text-[8px] text-black flex items-center justify-center font-bold shadow-[0_0_6px_rgba(52,211,153,0.6)]">{upcomingTracks.length > 9 ? "9+" : upcomingTracks.length}</span>
                )}
              </Button>
              {hasVideo && (
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${videoOpen ? "text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]" : "text-violet-500/50"} hover:text-violet-400`} onClick={() => setVideoOpen(!videoOpen)} title="Video" data-testid="button-toggle-video">
                  {videoOpen ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                </Button>
              )}
              {currentTrack.artist && (
                <TipJarDialog
                  artistId={currentTrack.artist.id}
                  artistName={currentTrack.artist.name}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500/50 hover:text-yellow-400 hover:drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" title="Tip Asset Architect" data-testid="button-tip-player">
                      <DollarSign className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${orderMakerOpen ? "text-lime-400 drop-shadow-[0_0_8px_rgba(132,204,22,0.6)]" : "text-lime-500/50"} hover:text-lime-400`}
                onClick={() => setOrderMakerOpen(!orderMakerOpen)}
                title="Direct Order Maker"
                data-testid="button-toggle-order-maker"
              >
                <Zap className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-violet-500/50 hover:text-violet-400 hover:drop-shadow-[0_0_6px_rgba(139,92,246,0.5)]" title="Buy Song" onClick={() => setShowBuyDialog(true)} data-testid="button-buy-current">
                <ShoppingCart className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500/50 hover:text-emerald-400" onClick={() => setVolume(volume === 0 ? 0.7 : 0)} data-testid="button-volume-toggle">
                {volume === 0 ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Slider value={[volume * 100]} max={100} step={1} onValueChange={([value]) => setVolume(value / 100)} className="w-16" data-testid="slider-volume" />
            </div>
          </div>
        </div>
      </div>
      </div>
      {showBuyDialog && currentTrack && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowBuyDialog(false)}>
          <div className="bg-black border-2 border-violet-500/60 font-mono max-w-sm w-full shadow-2xl shadow-violet-500/20 relative" onClick={e => e.stopPropagation()} data-testid="radio-buy-song-dialog">
            <div className="border-b border-violet-500/30 px-4 py-2.5 flex items-center justify-between bg-violet-950/80">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-violet-400" />
                <span className="text-[11px] text-violet-400 font-bold tracking-wider">BUY SONG — CASH APP</span>
              </div>
              <button onClick={() => setShowBuyDialog(false)} className="text-violet-500/40 hover:text-violet-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border border-violet-400/20 bg-violet-950/30 p-3 text-center">
                <p className="text-[9px] sm:text-[10px] text-violet-400 font-black tracking-wider truncate">97.7 THE FLAME — SONG PURCHASE</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-emerald-950/60 border border-violet-500/15 p-2.5">
                  <p className="text-[8px] text-violet-500/40 tracking-wider">SONG</p>
                  <p className="text-sm text-violet-400 font-bold mt-0.5 truncate">{currentTrack.title}</p>
                  <p className="text-[7px] text-emerald-500/60 mt-0.5 truncate">{currentTrack.artist?.name || "G. SMOOTH"}</p>
                </div>
                <div className="bg-emerald-950/60 border border-violet-500/15 p-2.5">
                  <p className="text-[8px] text-violet-500/40 tracking-wider">PRICE</p>
                  <p className="text-xl text-violet-400 font-black mt-0.5">$2.50</p>
                </div>
              </div>
              <div className="border-2 border-green-500/40 bg-green-950/30 p-3 text-center">
                <p className="text-[9px] text-green-400/70 tracking-wider mb-1">SEND PAYMENT TO</p>
                <p className="text-lg sm:text-2xl text-green-400 font-black tracking-normal sm:tracking-wider truncate">$AITITRADEBROKERAGE</p>
                <p className="text-[8px] text-green-500/50 mt-1">VIA CASH APP</p>
              </div>
              <div className="border border-emerald-500/20 bg-emerald-950/50 p-2.5 text-center">
                <p className="text-[8px] text-emerald-500/60 tracking-wider">INCLUDE IN CASH APP NOTE</p>
                <p className="text-[10px] text-white font-bold mt-1">SONG: {currentTrack.title}</p>
              </div>
              <button
                onClick={() => setShowBuyDialog(false)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black py-3 text-sm tracking-wider transition-colors"
                data-testid="button-radio-buy-close"
              >
                <DollarSign className="h-4 w-4 inline mr-1" />
                SEND $2.50 VIA CASH APP
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
