import { Play, Pause, Clock, ShoppingCart, Star, Heart } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

  const { data: isLiked } = useQuery<{ liked: boolean }>({
    queryKey: ["/api/user/liked-tracks", track.id, "check"],
    queryFn: () => fetch(`/api/user/liked-tracks/${track.id}/check`, { credentials: "include" }).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked?.liked) {
        await apiRequest("DELETE", `/api/user/liked-tracks/${track.id}`);
      } else {
        await apiRequest("POST", `/api/user/liked-tracks/${track.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/liked-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/liked-tracks", track.id, "check"] });
    },
  });

  const handlePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isCurrentTrack) {
      togglePlay();
    } else {
      playTrack(track, queue);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Log in to save tracks.", variant: "destructive" });
      return;
    }
    likeMutation.mutate();
  };

  const handleBuySong = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast({ title: "Store coming soon", description: "The music store will be available shortly." });
  };

  return (
    <div
      className={`group flex items-center gap-3 p-2 rounded-md hover-elevate cursor-pointer ${
        isCurrentTrack ? "bg-primary/10" : ""
      }`}
      onClick={() => handlePlay()}
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
        className={isLiked?.liked ? "text-primary" : "opacity-0 group-hover:opacity-100 transition-opacity"}
        onClick={handleLike}
        title={isLiked?.liked ? "Remove from Liked Songs" : "Save to Liked Songs"}
        data-testid={`button-like-track-${track.id}`}
      >
        <Heart className={`h-4 w-4 ${isLiked?.liked ? "fill-primary" : ""}`} />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleBuySong}
        title="Buy Song"
        data-testid={`button-buy-track-${track.id}`}
      >
        <ShoppingCart className="h-4 w-4" />
      </Button>
    </div>
  );
}
