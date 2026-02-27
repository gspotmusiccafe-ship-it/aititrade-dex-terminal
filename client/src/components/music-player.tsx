import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Shuffle, Repeat, Repeat1 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/lib/player-context";
import { useToast } from "@/hooks/use-toast";

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
    togglePlay,
    nextTrack,
    prevTrack,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();

  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    if (currentTrack) {
      fetch(`/api/user/liked-tracks/${currentTrack.id}/check`, { credentials: "include" })
        .then(res => {
          if (!res.ok) return { liked: false };
          return res.json();
        })
        .then(data => setIsLiked(data.liked))
        .catch(() => setIsLiked(false));
    }
  }, [currentTrack?.id]);

  const handleLike = async () => {
    if (!currentTrack || likeLoading) return;
    setLikeLoading(true);
    try {
      if (isLiked) {
        await fetch(`/api/user/liked-tracks/${currentTrack.id}`, { method: "DELETE", credentials: "include" });
        setIsLiked(false);
        toast({ title: "Removed from liked songs" });
      } else {
        await fetch(`/api/user/liked-tracks/${currentTrack.id}`, { method: "POST", credentials: "include" });
        setIsLiked(true);
        toast({ title: "Added to liked songs" });
      }
    } catch {
      toast({ title: "Please sign in to like tracks", variant: "destructive" });
    }
    setLikeLoading(false);
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Select a track to start playing</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 md:h-24 bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-xl border-t border-white/5 z-50" data-testid="music-player">
      <div className="h-full px-4 flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[300px]">
          <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-muted">
            {currentTrack.coverImage ? (
              <img
                src={currentTrack.coverImage}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <span className="text-primary text-lg font-bold">{currentTrack.title[0]}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate" data-testid="text-current-track-title">
              {currentTrack.title}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-current-track-artist">
              {currentTrack.artist?.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 hidden md:flex"
            onClick={handleLike}
            disabled={likeLoading}
            data-testid="button-like-track"
          >
            <Heart className={`h-4 w-4 ${isLiked ? "fill-primary text-primary" : ""}`} />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-1 flex-1 max-w-[600px]">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={`hidden md:flex hover:text-foreground ${shuffle ? "text-primary" : "text-muted-foreground"}`}
              onClick={toggleShuffle}
              data-testid="button-shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={prevTrack} data-testid="button-prev-track">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              onClick={togglePlay}
              className="h-10 w-10 rounded-full bg-white hover:bg-white/90 text-black"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={nextTrack} data-testid="button-next-track">
              <SkipForward className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`hidden md:flex hover:text-foreground ${repeat !== "off" ? "text-primary" : "text-muted-foreground"}`}
              onClick={toggleRepeat}
              data-testid="button-repeat"
            >
              {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          <div className="w-full flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(progress)}
            </span>
            <Slider
              value={[progress]}
              max={duration || 100}
              step={1}
              onValueChange={([value]) => seekTo(value)}
              className="flex-1"
              data-testid="slider-progress"
            />
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 flex-1 justify-end max-w-[200px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
            data-testid="button-volume-toggle"
          >
            {volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          <Slider
            value={[volume * 100]}
            max={100}
            step={1}
            onValueChange={([value]) => setVolume(value / 100)}
            className="w-24"
            data-testid="slider-volume"
          />
        </div>
      </div>
    </div>
  );
}
