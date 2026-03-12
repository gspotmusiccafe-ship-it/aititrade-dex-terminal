import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Clock, TrendingUp, Star, Disc3, Music, Headphones, Mic2, Guitar, Radio } from "lucide-react";
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

interface CategoryBoxProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}

function CategoryBox({ title, icon, color, active, count, onClick }: CategoryBoxProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left w-full group hover:-translate-y-0.5 ${
        active
          ? `border-transparent ring-2 ring-offset-2 ring-offset-background ${color} shadow-lg`
          : "border-border/50 hover:border-border bg-card/40 hover:bg-card/80"
      }`}
      style={active ? { background: `linear-gradient(135deg, var(--active-from), var(--active-to))` } : {}}
      data-testid={`category-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
        active ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-sm truncate ${active ? "text-white" : ""}`}>{title}</p>
        {count !== undefined && count > 0 && (
          <p className={`text-xs ${active ? "text-white/70" : "text-muted-foreground"}`}>{count} tracks</p>
        )}
      </div>
    </button>
  );
}

const CATEGORY_CONFIG = [
  { id: "trending", title: "Trending Now", icon: <TrendingUp className="h-5 w-5" />, gradient: "from-emerald-600 to-green-700", ring: "ring-emerald-500" },
  { id: "early-access", title: "Early Access", icon: <Star className="h-5 w-5" />, gradient: "from-amber-600 to-yellow-700", ring: "ring-amber-500" },
  { id: "rnb", title: "R&B / Soul", icon: <Headphones className="h-5 w-5" />, gradient: "from-purple-600 to-violet-700", ring: "ring-purple-500" },
  { id: "hiphop", title: "Hip-Hop", icon: <Mic2 className="h-5 w-5" />, gradient: "from-red-600 to-rose-700", ring: "ring-red-500" },
  { id: "pop", title: "Pop", icon: <Music className="h-5 w-5" />, gradient: "from-pink-600 to-fuchsia-700", ring: "ring-pink-500" },
  { id: "rock", title: "Rock", icon: <Guitar className="h-5 w-5" />, gradient: "from-orange-600 to-amber-700", ring: "ring-orange-500" },
  { id: "all", title: "All Music", icon: <Radio className="h-5 w-5" />, gradient: "from-blue-600 to-indigo-700", ring: "ring-blue-500" },
];

function filterByGenre(tracks: TrackWithArtist[], genreId: string): TrackWithArtist[] {
  if (genreId === "trending" || genreId === "all") return tracks;
  const genreMap: Record<string, string[]> = {
    "rnb": ["r&b", "rnb", "soul", "r & b"],
    "hiphop": ["hip-hop", "hiphop", "hip hop", "rap"],
    "pop": ["pop"],
    "rock": ["rock", "alternative", "indie"],
  };
  const keywords = genreMap[genreId] || [];
  return tracks.filter(t => {
    const g = (t.genre || "").toLowerCase();
    return keywords.some(k => g.includes(k));
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();
  const autoPlayedRef = useRef(false);
  const [activeCategory, setActiveCategory] = useState("trending");

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

  const displayTracks = activeCategory === "early-access"
    ? (prereleaseTracks || [])
    : filterByGenre(featuredTracks || [], activeCategory);

  const handlePlayCategory = () => {
    if (displayTracks.length > 0) {
      playTrack(displayTracks[0], displayTracks);
    }
  };

  const activeCfg = CATEGORY_CONFIG.find(c => c.id === activeCategory)!;

  const getCategoryCount = (id: string) => {
    if (id === "early-access") return prereleaseTracks?.length || 0;
    if (id === "trending" || id === "all") return featuredTracks?.length || 0;
    return filterByGenre(featuredTracks || [], id).length;
  };

  return (
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
        <div className="relative px-6 py-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-greeting">
            {getGreeting()}{user?.firstName ? `, ${user.firstName}` : ""}
          </h1>
          <p className="text-muted-foreground">Discover new AI music 2 weeks before Spotify, Amazon Music, Deezer, YouTube & Anghami</p>
        </div>
      </div>

      <div className="px-6 space-y-8">
        <section>
          <h2 className="text-lg font-bold mb-3 text-muted-foreground uppercase tracking-wider text-xs">Browse Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {CATEGORY_CONFIG.map((cat) => (
              <CategoryBox
                key={cat.id}
                title={cat.title}
                icon={cat.icon}
                color={cat.ring}
                active={activeCategory === cat.id}
                count={getCategoryCount(cat.id)}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        </section>

        <section>
          <div
            className={`rounded-xl overflow-hidden bg-gradient-to-br ${activeCfg.gradient} p-[1px]`}
            style={{ ["--active-from" as any]: undefined, ["--active-to" as any]: undefined }}
          >
            <div className="bg-background/95 rounded-xl">
              <div className={`flex items-center justify-between px-5 py-4 bg-gradient-to-r ${activeCfg.gradient} rounded-t-xl`}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center text-white">
                    {activeCfg.icon}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white" data-testid="text-active-category">
                      {activeCfg.title}
                    </h2>
                    <p className="text-xs text-white/70">
                      {activeCategory === "early-access"
                        ? "Members-only pre-release music"
                        : `${displayTracks.length} tracks available`}
                    </p>
                  </div>
                  {activeCategory === "early-access" && (
                    <Badge className="bg-white/20 text-white border-0 text-[10px] ml-2">
                      Members Only
                    </Badge>
                  )}
                </div>
                {displayTracks.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1"
                    onClick={handlePlayCategory}
                    data-testid="button-play-category"
                  >
                    <Play className="h-4 w-4" />
                    Play All
                  </Button>
                )}
              </div>

              <div className="p-4">
                {(activeCategory === "early-access" ? loadingPrerelease : loadingTracks) ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="w-10 h-10 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-48 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayTracks.length > 0 ? (
                  <div className="space-y-1">
                    {displayTracks.slice(0, 10).map((track, index) => (
                      <TrackCard
                        key={track.id}
                        track={track}
                        index={index}
                        queue={displayTracks}
                        showCover={true}
                      />
                    ))}
                  </div>
                ) : activeCategory === "early-access" ? (
                  <div className="text-center py-10">
                    <Star className="h-10 w-10 text-primary mx-auto mb-3 opacity-40" />
                    <h3 className="font-semibold mb-1">Get Early Access</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upgrade to Premium to hear new releases 2 weeks before everyone else
                    </p>
                    <Button size="sm" asChild>
                      <a href="/membership" data-testid="link-upgrade-early-access">Learn More</a>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <Disc3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-muted-foreground text-sm">No {activeCfg.title.toLowerCase()} tracks yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Check back soon for new music!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {newReleases && newReleases.length > 0 && (
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
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {newReleases.slice(0, 5).map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            )}
          </section>
        )}

        {topArtists && topArtists.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Popular Artists</h2>
              <Button variant="ghost" size="sm" asChild data-testid="link-see-all-artists">
                <Link href="/browse/artists">See All</Link>
              </Button>
            </div>
            {loadingArtists ? (
              <SectionSkeleton count={5} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {topArtists.slice(0, 5).map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
