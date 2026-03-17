import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ShoppingCart, ListMusic, X, Trash2, DollarSign } from "lucide-react";
import logoImage from "@assets/AITIFY_MUSIC_RADIO_LOGO_IMAGE_1773164873830.png";
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
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    removeFromQueue,
    clearQueue,
    playFromQueue,
    resumeAutoplay,
  } = usePlayer();

  const { toast } = useToast();
  const [queueOpen, setQueueOpen] = useState(false);

  const upcomingTracks = queue.slice(queueIndex + 1);

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-emerald-500/20 flex items-center justify-center gap-3 font-mono z-50">
        <img src={logoImage} alt="AITIFY" className="w-6 h-6 object-cover" />
        <div className="text-center">
          <p className="text-xs font-bold text-emerald-400" data-testid="text-radio-station-name">97.7 THE FLAME | SOVEREIGN EXCHANGE</p>
          <p className="text-[10px] text-emerald-500/40">AWAITING STREAM...</p>
        </div>
      </div>
    );
  }

  if (autoplayBlocked) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-emerald-500/20 z-50 flex items-center justify-center gap-4 px-4 font-mono">
        <div className="text-center">
          <p className="text-xs font-bold text-emerald-400" data-testid="text-radio-blocked-name">97.7 THE FLAME</p>
          <p className="text-[10px] text-emerald-500/50">{currentTrack.title} — {currentTrack.artist?.name}</p>
        </div>
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 text-[10px] font-bold flex items-center gap-1 transition-colors"
          onClick={resumeAutoplay}
          data-testid="button-tune-in"
        >
          <Play className="h-3 w-3" />
          TUNE IN
        </button>
      </div>
    );
  }

  const ticker = `$${(currentTrack.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 10)}`;

  return (
    <>
      {queueOpen && (
        <div className="fixed right-0 bottom-16 w-72 max-h-[60vh] bg-black border border-emerald-500/20 shadow-2xl z-50 flex flex-col font-mono" data-testid="queue-panel">
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
                <div className="w-7 h-7 bg-zinc-900 overflow-hidden flex-shrink-0">
                  {currentTrack.coverImage ? (
                    <img src={currentTrack.coverImage} alt="" className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full bg-emerald-500/10 flex items-center justify-center">
                      <span className="text-emerald-400 text-[9px] font-bold">{currentTrack.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold truncate text-emerald-400">{currentTrack.title.toUpperCase()}</p>
                  <p className="text-[9px] text-zinc-600 truncate">{currentTrack.artist?.name}</p>
                </div>
              </div>
            </div>

            {upcomingTracks.length > 0 && (
              <div className="p-2 pt-0">
                <p className="text-[9px] text-emerald-500/40 uppercase px-2 py-1">NEXT ({upcomingTracks.length})</p>
                <div className="space-y-0.5">
                  {upcomingTracks.map((track, i) => {
                    const actualIndex = queueIndex + 1 + i;
                    return (
                      <div
                        key={`${track.id}-${actualIndex}`}
                        className="flex items-center gap-2 p-1.5 hover:bg-emerald-500/5 group/item cursor-pointer transition-colors"
                        onClick={() => playFromQueue(actualIndex)}
                        data-testid={`queue-track-${actualIndex}`}
                      >
                        <span className="text-[9px] text-zinc-600 w-3 text-center">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-white truncate">{track.title}</p>
                          <p className="text-[9px] text-zinc-600 truncate">{track.artist?.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/item:opacity-100 text-zinc-600"
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

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-emerald-500/20 z-50 font-mono" data-testid="music-player">
        <div className="h-full px-3 flex items-center justify-between gap-3 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[280px]">
            <div className="w-10 h-10 bg-zinc-900 overflow-hidden flex-shrink-0 border border-emerald-500/10">
              {currentTrack.coverImage ? (
                <img src={currentTrack.coverImage} alt={currentTrack.title} className="w-full h-full object-cover opacity-80" />
              ) : (
                <div className="w-full h-full bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-emerald-400 text-sm font-bold">{currentTrack.title[0]}</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-emerald-500/50" data-testid="text-radio-station-label">97.7 THE FLAME</p>
              <p className="font-bold text-[11px] truncate text-emerald-400" data-testid="text-current-track-title">
                {currentTrack.title.toUpperCase()}
              </p>
              <p className="text-[9px] text-zinc-600 truncate" data-testid="text-current-track-artist">
                {currentTrack.artist?.name} <span className="text-emerald-500/30 ml-1">{ticker}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-0.5 flex-1 max-w-[500px]">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`hidden md:flex h-7 w-7 ${shuffle ? "text-emerald-400" : "text-zinc-600"} hover:text-emerald-400`}
                onClick={toggleShuffle}
                data-testid="button-shuffle"
              >
                <Shuffle className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-emerald-400" onClick={prevTrack} data-testid="button-prev-track">
                <SkipBack className="h-4 w-4" />
              </Button>
              <button
                onClick={togglePlay}
                className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-colors"
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-emerald-400" onClick={nextTrack} data-testid="button-next-track">
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`hidden md:flex h-7 w-7 ${repeat !== "off" ? "text-emerald-400" : "text-zinc-600"} hover:text-emerald-400`}
                onClick={toggleRepeat}
                data-testid="button-repeat"
              >
                {repeat === "one" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="w-full flex items-center gap-2">
              <span className="text-[9px] text-zinc-600 w-8 text-right">{formatTime(progress)}</span>
              <Slider
                value={[progress]}
                max={duration || 100}
                step={1}
                onValueChange={([value]) => seekTo(value)}
                className="flex-1"
                data-testid="slider-progress"
              />
              <span className="text-[9px] text-zinc-600 w-8">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1 flex-1 justify-end max-w-[200px]">
            <Button
              variant="ghost"
              size="icon"
              title="Queue"
              className={`h-7 w-7 ${queueOpen ? "text-emerald-400" : "text-zinc-600"} hover:text-emerald-400 relative`}
              onClick={() => setQueueOpen(!queueOpen)}
              data-testid="button-toggle-queue"
            >
              <ListMusic className="h-3.5 w-3.5" />
              {upcomingTracks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 text-[8px] text-black flex items-center justify-center font-bold">
                  {upcomingTracks.length > 9 ? "9+" : upcomingTracks.length}
                </span>
              )}
            </Button>
            {currentTrack.artist && (
              <TipJarDialog
                artistId={currentTrack.artist.id}
                artistName={currentTrack.artist.name}
                trigger={
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-600 hover:text-yellow-400" title="Tip Artist" data-testid="button-tip-player">
                    <DollarSign className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-600 hover:text-emerald-400"
              title="Buy"
              onClick={() => window.open("https://payhip.com/aitifymusicstore", "_blank", "noopener,noreferrer")}
              data-testid="button-buy-current"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-600 hover:text-emerald-400"
              onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              data-testid="button-volume-toggle"
            >
              {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[volume * 100]}
              max={100}
              step={1}
              onValueChange={([value]) => setVolume(value / 100)}
              className="w-20"
              data-testid="slider-volume"
            />
          </div>
        </div>
      </div>
    </>
  );
}
