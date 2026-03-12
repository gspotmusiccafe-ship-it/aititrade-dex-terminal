import { useState } from "react";
import { Play, Pause, Clock, ShoppingCart, Star, Heart, ListPlus, ListEnd } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const { currentTrack, isPlaying, playTrack, togglePlay, addToQueue } = usePlayer();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isCurrentTrack = currentTrack?.id === track.id;
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const { data: isLiked } = useQuery<{ liked: boolean }>({
    queryKey: ["/api/user/liked-tracks", track.id, "check"],
    queryFn: () => fetch(`/api/user/liked-tracks/${track.id}/check`, { credentials: "include" }).then(r => r.json()),
    enabled: isAuthenticated,
  });

  const { data: playlists } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/playlists"],
    enabled: isAuthenticated && playlistOpen,
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
    onError: (err: Error) => {
      const msg = err?.message || "";
      if (msg.includes("Upgrade")) {
        toast({ title: "Membership Required", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg || "Could not save track", variant: "destructive" });
      }
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      await apiRequest("POST", `/api/playlists/${playlistId}/tracks`, { trackId: track.id });
    },
    onSuccess: (_data, playlistId) => {
      const playlist = playlists?.find(p => p.id === playlistId);
      toast({ title: "Added to playlist", description: `"${track.title}" added to ${playlist?.name || "playlist"}` });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "tracks"] });
      setPlaylistOpen(false);
    },
    onError: () => {
      toast({ title: "Already in playlist", description: "This track is already in the selected playlist.", variant: "destructive" });
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

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToQueue(track);
    toast({ title: "Added to queue", description: `"${track.title}" added to end of queue` });
  };

  const handleBuySong = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open("https://payhip.com/aitifymusicstore", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 ${
        isCurrentTrack ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/10" : "hover:bg-card/80 border border-transparent hover:border-border/30"
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
        onClick={handleAddToQueue}
        title="Add to Queue"
        data-testid={`button-add-to-queue-${track.id}`}
      >
        <ListEnd className="h-4 w-4" />
      </Button>

      <Popover open={playlistOpen} onOpenChange={(open) => {
        if (open && !isAuthenticated) {
          toast({ title: "Sign in required", description: "Log in to add tracks to playlists.", variant: "destructive" });
          return;
        }
        setPlaylistOpen(open);
      }}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
            title="Add to Playlist"
            data-testid={`button-add-to-playlist-${track.id}`}
          >
            <ListPlus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-medium px-2 py-1 mb-1">Add to Playlist</p>
          {playlists && playlists.length > 0 ? (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2"
                  onClick={() => addToPlaylistMutation.mutate(pl.id)}
                  disabled={addToPlaylistMutation.isPending}
                  data-testid={`button-playlist-option-${pl.id}`}
                >
                  <ListPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{pl.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-2">
              No playlists yet. Create one in your Library.
            </p>
          )}
        </PopoverContent>
      </Popover>

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
