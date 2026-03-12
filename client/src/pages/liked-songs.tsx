import { useQuery } from "@tanstack/react-query";
import { Heart, Play, Clock, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCard } from "@/components/track-card";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import type { TrackWithArtist } from "@shared/schema";

export default function LikedSongsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { playTrack } = usePlayer();

  const { data: likedTracks, isLoading } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/user/liked-tracks"],
    enabled: isAuthenticated,
  });

  const handlePlayAll = () => {
    if (likedTracks && likedTracks.length > 0) {
      playTrack(likedTracks[0], likedTracks);
    }
  };

  const handleShuffle = () => {
    if (likedTracks && likedTracks.length > 0) {
      const shuffled = [...likedTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-full pb-28">
        <Skeleton className="h-64 w-full" />
        <div className="px-6 py-8 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full pb-28 px-6 py-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Heart className="h-10 w-10 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Liked Songs</h2>
          <p className="text-muted-foreground mb-6">
            Sign in to save your favorite tracks and access them anytime
          </p>
          <Button asChild className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/20 via-blue-600/10 to-transparent" />
        <div className="relative px-6 py-12">
          <div className="flex items-end gap-6">
            <div className="w-48 h-48 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-2xl shadow-purple-500/20 ring-1 ring-white/10">
              <Heart className="h-24 w-24 text-white fill-white" />
            </div>
            <div className="flex-1 pb-2">
              <p className="text-sm uppercase tracking-wide mb-2 text-purple-300/80">Playlist</p>
              <h1 className="text-4xl sm:text-5xl font-bold mb-4">Liked Songs</h1>
              <p className="text-muted-foreground">
                {likedTracks?.length || 0} songs
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 flex items-center gap-4">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 bg-gradient-to-br from-primary to-emerald-500 shadow-lg shadow-primary/25"
          onClick={handlePlayAll}
          disabled={!likedTracks || likedTracks.length === 0}
          data-testid="button-play-liked"
        >
          <Play className="h-6 w-6 ml-0.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleShuffle}
          disabled={!likedTracks || likedTracks.length === 0}
          data-testid="button-shuffle-liked"
        >
          <Shuffle className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-6">
        <div className="flex items-center gap-3 px-2 py-2 border-b border-border/30 text-xs text-muted-foreground uppercase tracking-wide">
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Title</div>
          <div className="hidden md:block w-20 text-right">Plays</div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
          </div>
          <div className="w-10" />
        </div>

        {isLoading ? (
          <div className="space-y-2 mt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : likedTracks && likedTracks.length > 0 ? (
          <div className="space-y-1 mt-2">
            {likedTracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                index={index}
                queue={likedTracks}
                showCover={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <Heart className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-lg text-muted-foreground">Songs you like will appear here</p>
            <p className="text-sm text-muted-foreground/70">Save songs by tapping the heart icon</p>
          </div>
        )}
      </div>
    </div>
  );
}
