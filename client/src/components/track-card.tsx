import { Play, Pause, Clock, Download, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { TrackWithArtist } from "@shared/schema";

interface TrackCardProps {
  track: TrackWithArtist;
  index?: number;
  queue?: TrackWithArtist[];
  showArtist?: boolean;
  showCover?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TrackCard({ track, index, queue, showArtist = true, showCover = true }: TrackCardProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else {
      playTrack(track, queue);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Log in to download tracks.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/tracks/${track.id}/download`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Download failed" }));
        toast({ title: "Download unavailable", description: err.message, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${track.title}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `${track.title} is downloading.` });
    } catch {
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div
      className={`group flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer ${
        isCurrentTrack ? "bg-primary/10" : ""
      }`}
      data-testid={`track-card-${track.id}`}
    >
      {showCover && track.coverImage ? (
        <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
          <img src={track.coverImage} alt={track.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white"
              onClick={handlePlay}
              data-testid={`button-play-track-${track.id}`}
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-8 flex-shrink-0 text-center">
          <span className={`text-sm ${isCurrentTrack ? "text-primary" : "text-muted-foreground"} group-hover:hidden`}>
            {index !== undefined ? index + 1 : ""}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hidden group-hover:flex"
            onClick={handlePlay}
            data-testid={`button-play-track-${track.id}`}
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium text-sm truncate ${isCurrentTrack ? "text-primary" : ""}`}>
            {track.title}
          </p>
          {track.isPrerelease && (
            <Badge variant="secondary" className="bg-primary/20 text-primary text-xs px-1.5 py-0">
              <Star className="h-2.5 w-2.5 mr-0.5" />
              Early Access
            </Badge>
          )}
        </div>
        {showArtist && (
          <p className="text-xs text-muted-foreground truncate">{track.artist?.name}</p>
        )}
      </div>

      <div className="hidden md:block text-xs text-muted-foreground min-w-[80px] text-right">
        {track.playCount?.toLocaleString() || 0} plays
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {formatDuration(track.duration)}
      </div>

      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDownload}
        title="Download MP3"
        data-testid={`button-download-track-${track.id}`}
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
