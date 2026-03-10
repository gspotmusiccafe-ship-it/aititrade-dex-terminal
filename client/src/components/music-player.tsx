import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Heart, Shuffle, Repeat, Repeat1, ShoppingCart, ListPlus, ListMusic, X, Trash2, DollarSign } from "lucide-react";
import logoImage from "@assets/AITIFY_MUSIC_RADIO_LOGO_IMAGE_1773164873830.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TipJarDialog } from "@/components/tip-jar-dialog";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const { isAuthenticated } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

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

  const { data: playlists } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/playlists"],
    enabled: isAuthenticated && playlistOpen,
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: async (playlistId: string) => {
      if (!currentTrack) return;
      await apiRequest("POST", `/api/playlists/${playlistId}/tracks`, { trackId: currentTrack.id });
    },
    onSuccess: (_data, playlistId) => {
      const playlist = playlists?.find(p => p.id === playlistId);
      toast({ title: "Added to playlist", description: `"${currentTrack?.title}" added to ${playlist?.name || "playlist"}` });
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "tracks"] });
      setPlaylistOpen(false);
    },
    onError: () => {
      toast({ title: "Already in playlist", description: "This track is already in the selected playlist.", variant: "destructive" });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/user/liked-tracks"] });
    } catch {
      toast({ title: "Please sign in to like tracks", variant: "destructive" });
    }
    setLikeLoading(false);
  };

  const upcomingTracks = queue.slice(queueIndex + 1);

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex items-center justify-center gap-3">
        <img src={logoImage} alt="AITIFY" className="w-8 h-8 rounded-full object-cover" />
        <div className="text-center">
          <p className="text-sm font-semibold text-primary" data-testid="text-radio-station-name">AITIFY MUSIC RADIO 97.7 THE FLAME</p>
          <p className="text-xs text-muted-foreground">Tune in — music starts automatically</p>
        </div>
      </div>
    );
  }

  if (autoplayBlocked) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-xl border-t border-white/5 z-50 flex items-center justify-center gap-4 px-4">
        <div className="text-center">
          <p className="text-sm font-semibold text-primary" data-testid="text-radio-blocked-name">AITIFY MUSIC RADIO 97.7 THE FLAME</p>
          <p className="text-xs text-muted-foreground">{currentTrack.title} — {currentTrack.artist?.name}</p>
        </div>
        <Button
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          onClick={resumeAutoplay}
          data-testid="button-tune-in"
        >
          <Play className="h-4 w-4" />
          Tune In
        </Button>
      </div>
    );
  }

  return (
    <>
      {queueOpen && (
        <div className="fixed right-0 bottom-20 md:bottom-24 w-80 max-h-[60vh] bg-card border border-border rounded-tl-lg shadow-xl z-50 flex flex-col" data-testid="queue-panel">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-sm">Queue</h3>
            <div className="flex items-center gap-1">
              {upcomingTracks.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    clearQueue();
                    toast({ title: "Queue cleared" });
                  }}
                  title="Clear queue"
                  data-testid="button-clear-queue"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setQueueOpen(false)}
                data-testid="button-close-queue"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <div className="p-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1">Now Playing</p>
              <div className="flex items-center gap-2 p-2 rounded bg-primary/10">
                <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                  {currentTrack.coverImage ? (
                    <img src={currentTrack.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary text-xs font-bold">{currentTrack.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-primary">{currentTrack.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentTrack.artist?.name}</p>
                </div>
              </div>
            </div>

            {upcomingTracks.length > 0 && (
              <div className="p-2 pt-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 py-1">
                  Up Next ({upcomingTracks.length})
                </p>
                <div className="space-y-0.5">
                  {upcomingTracks.map((track, i) => {
                    const actualIndex = queueIndex + 1 + i;
                    return (
                      <div
                        key={`${track.id}-${actualIndex}`}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 group/item cursor-pointer"
                        onClick={() => playFromQueue(actualIndex)}
                        data-testid={`queue-track-${actualIndex}`}
                      >
                        <span className="text-xs text-muted-foreground w-4 text-center">{i + 1}</span>
                        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                          {track.coverImage ? (
                            <img src={track.coverImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary/60 text-xs font-bold">{track.title[0]}</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{track.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{track.artist?.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(actualIndex);
                          }}
                          title="Remove from queue"
                          data-testid={`button-remove-queue-${actualIndex}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {upcomingTracks.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">No upcoming tracks</p>
                <p className="text-xs text-muted-foreground mt-1">Add songs to your queue from any track</p>
              </div>
            )}
          </div>
        </div>
      )}

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
              <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider" data-testid="text-radio-station-label">97.7 THE FLAME</p>
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

          <div className="hidden md:flex items-center gap-2 flex-1 justify-end max-w-[250px]">
            <Button
              variant="ghost"
              size="icon"
              title="Queue"
              className={`relative ${queueOpen ? "text-primary" : ""}`}
              onClick={() => setQueueOpen(!queueOpen)}
              data-testid="button-toggle-queue"
            >
              <ListMusic className="h-4 w-4" />
              {upcomingTracks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                  {upcomingTracks.length > 9 ? "9+" : upcomingTracks.length}
                </span>
              )}
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
                  variant="ghost"
                  size="icon"
                  title="Add to Playlist"
                  data-testid="button-add-to-playlist-player"
                >
                  <ListPlus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <p className="text-sm font-medium px-2 py-1 mb-1">Add to Playlist</p>
                {playlists && playlists.length > 0 ? (
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2"
                        onClick={() => addToPlaylistMutation.mutate(pl.id)}
                        disabled={addToPlaylistMutation.isPending}
                        data-testid={`button-player-playlist-option-${pl.id}`}
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
            {currentTrack.artist && (
              <TipJarDialog
                artistId={currentTrack.artist.id}
                artistName={currentTrack.artist.name}
                trigger={
                  <Button variant="ghost" size="icon" title="Tip Artist" data-testid="button-tip-player">
                    <DollarSign className="h-4 w-4" />
                  </Button>
                }
              />
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Buy Song"
              onClick={() => {
                window.open("https://payhip.com/aitifymusicstore", "_blank", "noopener,noreferrer");
              }}
              data-testid="button-buy-current"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
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
    </>
  );
}
