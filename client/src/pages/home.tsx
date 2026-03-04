import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Clock, TrendingUp, Star, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrackCard } from "@/components/track-card";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { TrackWithArtist, AlbumWithArtist, Artist } from "@shared/schema";

function SectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg bg-card/50">
          <Skeleton className="aspect-square rounded-md mb-4" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function TrackListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
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
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();
  const autoPlayedRef = useRef(false);

  const { data: featuredTracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
  });

  useEffect(() => {
    if (featuredTracks && featuredTracks.length > 0 && !autoPlayedRef.current && !currentTrack) {
      autoPlayedRef.current = true;
      playTrack(featuredTracks[0], featuredTracks);
    }
  }, [featuredTracks]);

  const { data: prereleaseTracks, isLoading: loadingPrerelease } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/prerelease"],
  });

  const { data: newReleases, isLoading: loadingReleases } = useQuery<AlbumWithArtist[]>({
    queryKey: ["/api/albums/new"],
  });

  const { data: topArtists, isLoading: loadingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/artists/top"],
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const handlePlayFeatured = () => {
    if (featuredTracks && featuredTracks.length > 0) {
      playTrack(featuredTracks[0], featuredTracks);
    }
  };

  return (
    <div className="min-h-full pb-28">
      {/* Header Section with Gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
        <div className="relative px-6 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-greeting">
            {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground">Discover new AI music 2 weeks before Spotify, Amazon Music, Deezer, YouTube & Anghami</p>
        </div>
      </div>

      <div className="px-6 space-y-10">
        {/* Early Access Section - Premium Feature */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Early Access</h2>
            <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
              Members Only
            </Badge>
          </div>

          {loadingPrerelease ? (
            <TrackListSkeleton count={3} />
          ) : prereleaseTracks && prereleaseTracks.length > 0 ? (
            <div className="space-y-1 bg-card/30 rounded-lg p-3">
              {prereleaseTracks.slice(0, 5).map((track, index) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  index={index}
                  queue={prereleaseTracks}
                  showCover={true}
                />
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6 text-center">
              <Star className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">Get Early Access</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to Premium to hear new releases 2 weeks before everyone else
              </p>
              <Button size="sm" asChild>
                <a href="/membership">Learn More</a>
              </Button>
            </div>
          )}
        </section>

        {/* Featured Tracks */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Trending Now</h2>
            </div>
            {featuredTracks && featuredTracks.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handlePlayFeatured} data-testid="button-play-all-featured">
                <Play className="h-4 w-4 mr-1" />
                Play All
              </Button>
            )}
          </div>

          {loadingTracks ? (
            <TrackListSkeleton count={5} />
          ) : featuredTracks && featuredTracks.length > 0 ? (
            <div className="space-y-1 bg-card/30 rounded-lg p-3">
              {featuredTracks.slice(0, 10).map((track, index) => (
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
        </section>

        {/* New Releases */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">New Releases</h2>
            </div>
            <Button variant="ghost" size="sm" asChild data-testid="link-see-all-albums">
              <Link href="/browse/albums">See All</Link>
            </Button>
          </div>

          {loadingReleases ? (
            <SectionSkeleton count={5} />
          ) : newReleases && newReleases.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {newReleases.slice(0, 5).map((album) => (
                <AlbumCard key={album.id} album={album} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No new releases yet</p>
            </div>
          )}
        </section>

        {/* Top Artists */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Popular Artists</h2>
            <Button variant="ghost" size="sm" asChild data-testid="link-see-all-artists">
              <Link href="/browse/artists">See All</Link>
            </Button>
          </div>

          {loadingArtists ? (
            <SectionSkeleton count={5} />
          ) : topArtists && topArtists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {topArtists.slice(0, 5).map((artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No artists yet</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
