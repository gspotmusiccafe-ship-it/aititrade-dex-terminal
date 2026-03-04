import { useQuery } from "@tanstack/react-query";
import { Play, TrendingUp, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCard } from "@/components/track-card";
import { usePlayer } from "@/lib/player-context";
import type { TrackWithArtist } from "@shared/schema";

export default function RadioPage() {
  const { playTrack, currentTrack } = usePlayer();

  const { data: featuredTracks, isLoading } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
  });

  const handlePlayAll = () => {
    if (featuredTracks && featuredTracks.length > 0) {
      playTrack(featuredTracks[0], featuredTracks);
    }
  };

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4">
            <Disc3 className={`h-8 w-8 text-primary ${currentTrack ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-radio-page-title">
            AITIFY MUSIC RADIO <span className="text-primary">97.7 THE FLAME</span>
          </h1>
          <p className="text-muted-foreground">
            All-AI music streaming — hit play and enjoy
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Now Playing</h2>
          </div>
          {featuredTracks && featuredTracks.length > 0 && (
            <Button variant="default" size="sm" onClick={handlePlayAll} data-testid="button-radio-play-all">
              <Play className="h-4 w-4 mr-1" />
              Play All
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-10 h-10 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : featuredTracks && featuredTracks.length > 0 ? (
          <div className="space-y-1 bg-card/30 rounded-lg p-3">
            {featuredTracks.map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                index={index}
                queue={featuredTracks}
                showCover={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Disc3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tracks available yet</p>
            <p className="text-sm">Check back soon for new music!</p>
          </div>
        )}
      </div>
    </div>
  );
}
