import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Music, User, Disc, X, Play, Headphones, Mic2, Guitar, Radio, Sparkles, Piano, Globe, Disc3, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrackCard } from "@/components/track-card";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { usePlayer } from "@/lib/player-context";
import type { TrackWithArtist, AlbumWithArtist, Artist } from "@shared/schema";

const BROWSE_CATEGORIES = [
  { id: "all", title: "All Music", icon: <Radio className="h-5 w-5" />, gradient: "from-emerald-600 to-green-700", ring: "ring-emerald-500", keywords: [] },
  { id: "rnb", title: "R&B / Soul", icon: <Headphones className="h-5 w-5" />, gradient: "from-purple-600 to-violet-700", ring: "ring-purple-500", keywords: ["r&b", "rnb", "soul", "r & b"] },
  { id: "hiphop", title: "Hip-Hop", icon: <Mic2 className="h-5 w-5" />, gradient: "from-orange-500 to-amber-600", ring: "ring-orange-500", keywords: ["hip-hop", "hiphop", "hip hop", "rap"] },
  { id: "pop", title: "Pop", icon: <Music className="h-5 w-5" />, gradient: "from-pink-500 to-rose-600", ring: "ring-pink-500", keywords: ["pop"] },
  { id: "rock", title: "Rock", icon: <Guitar className="h-5 w-5" />, gradient: "from-red-600 to-rose-700", ring: "ring-red-500", keywords: ["rock", "alternative", "indie"] },
  { id: "electronic", title: "Electronic", icon: <Sparkles className="h-5 w-5" />, gradient: "from-cyan-500 to-blue-600", ring: "ring-cyan-500", keywords: ["electronic", "edm", "house", "techno", "dance"] },
  { id: "jazz", title: "Jazz", icon: <Piano className="h-5 w-5" />, gradient: "from-amber-600 to-yellow-700", ring: "ring-amber-500", keywords: ["jazz", "blues"] },
  { id: "country", title: "Country", icon: <Globe className="h-5 w-5" />, gradient: "from-yellow-500 to-orange-600", ring: "ring-yellow-500", keywords: ["country", "folk"] },
];

function filterByGenre(tracks: TrackWithArtist[], categoryId: string): TrackWithArtist[] {
  if (categoryId === "all") return tracks;
  const cat = BROWSE_CATEGORIES.find(c => c.id === categoryId);
  if (!cat || cat.keywords.length === 0) return tracks;
  return tracks.filter(t => {
    const g = (t.genre || "").toLowerCase();
    return cat.keywords.some(k => g.includes(k));
  });
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const { playTrack } = usePlayer();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const { data: searchResults, isLoading } = useQuery<{
    tracks: TrackWithArtist[];
    albums: AlbumWithArtist[];
    artists: Artist[];
  }>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" }).then(r => r.json()),
    enabled: debouncedQuery.length > 1,
  });

  const { data: allTracks, isLoading: loadingAll } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
  });

  const { data: topArtists } = useQuery<Artist[]>({
    queryKey: ["/api/artists/top"],
  });

  const hasResults =
    searchResults &&
    (searchResults.tracks.length > 0 ||
      searchResults.albums.length > 0 ||
      searchResults.artists.length > 0);

  const isSearching = debouncedQuery.length > 1;

  const browseTracks = filterByGenre(allTracks || [], activeCategory);
  const activeCfg = BROWSE_CATEGORIES.find(c => c.id === activeCategory)!;

  const handlePlayCategory = () => {
    if (browseTracks.length > 0) {
      playTrack(browseTracks[0], browseTracks);
    }
  };

  const getCategoryCount = (id: string) => filterByGenre(allTracks || [], id).length;

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4" data-testid="text-search-title">Search</h1>
        <div className="relative max-w-xl">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-10 h-12 text-base bg-card border-border/50"
            data-testid="input-search"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isSearching ? (
        <div>
          {isLoading ? (
            <div className="space-y-6">
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-12 h-12 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : hasResults ? (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="all" data-testid="tab-search-all">All</TabsTrigger>
                <TabsTrigger value="tracks" data-testid="tab-search-tracks">
                  <Music className="h-4 w-4 mr-1" />
                  Songs
                </TabsTrigger>
                <TabsTrigger value="albums" data-testid="tab-search-albums">
                  <Disc className="h-4 w-4 mr-1" />
                  Albums
                </TabsTrigger>
                <TabsTrigger value="artists" data-testid="tab-search-artists">
                  <User className="h-4 w-4 mr-1" />
                  Artists
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-8">
                {searchResults.tracks.length > 0 && (
                  <section>
                    <h3 className="font-semibold mb-3">Songs</h3>
                    <div className="space-y-1 bg-card/30 rounded-lg p-3">
                      {searchResults.tracks.slice(0, 5).map((track, index) => (
                        <TrackCard key={track.id} track={track} index={index} queue={searchResults.tracks} showCover={true} />
                      ))}
                    </div>
                  </section>
                )}
                {searchResults.albums.length > 0 && (
                  <section>
                    <h3 className="font-semibold mb-3">Albums</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {searchResults.albums.slice(0, 5).map((album) => (
                        <AlbumCard key={album.id} album={album} />
                      ))}
                    </div>
                  </section>
                )}
                {searchResults.artists.length > 0 && (
                  <section>
                    <h3 className="font-semibold mb-3">Artists</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {searchResults.artists.slice(0, 5).map((artist) => (
                        <ArtistCard key={artist.id} artist={artist} />
                      ))}
                    </div>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="tracks">
                <div className="space-y-1 bg-card/30 rounded-lg p-3">
                  {searchResults.tracks.map((track, index) => (
                    <TrackCard key={track.id} track={track} index={index} queue={searchResults.tracks} showCover={true} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="albums">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {searchResults.albums.map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="artists">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {searchResults.artists.map((artist) => (
                    <ArtistCard key={artist.id} artist={artist} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No results found for "{debouncedQuery}"</p>
              <p className="text-sm">Try searching for something else</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold mb-3 text-muted-foreground uppercase tracking-wider text-xs">Browse All</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {BROWSE_CATEGORIES.map((cat) => {
                const count = getCategoryCount(cat.id);
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left w-full group hover:-translate-y-0.5 ${
                      isActive
                        ? `border-transparent ring-2 ring-offset-2 ring-offset-background ${cat.ring} shadow-lg`
                        : "border-border/50 hover:border-border bg-card/40 hover:bg-card/80"
                    }`}
                    style={isActive ? { background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))` } : {}}
                    data-testid={`browse-category-${cat.id}`}
                  >
                    <div className={`flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${
                      isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    }`}>
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm truncate ${isActive ? "text-white" : ""}`}>{cat.title}</p>
                      {count > 0 && (
                        <p className={`text-xs ${isActive ? "text-white/70" : "text-muted-foreground"}`}>{count} tracks</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <div className={`rounded-xl overflow-hidden bg-gradient-to-br ${activeCfg.gradient} p-[1px]`}>
              <div className="bg-background/95 rounded-xl">
                <div className={`flex items-center justify-between px-5 py-4 bg-gradient-to-r ${activeCfg.gradient} rounded-t-xl`}>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center text-white">
                      {activeCfg.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white" data-testid="text-browse-active-category">
                        {activeCfg.title}
                      </h2>
                      <p className="text-xs text-white/70">{browseTracks.length} tracks available</p>
                    </div>
                  </div>
                  {browseTracks.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="bg-white/20 hover:bg-white/30 text-white border-0 gap-1"
                      onClick={handlePlayCategory}
                      data-testid="button-play-browse-category"
                    >
                      <Play className="h-4 w-4" />
                      Play All
                    </Button>
                  )}
                </div>

                <div className="p-4">
                  {loadingAll ? (
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
                  ) : browseTracks.length > 0 ? (
                    <div className="space-y-1">
                      {browseTracks.slice(0, 15).map((track, index) => (
                        <TrackCard key={track.id} track={track} index={index} queue={browseTracks} showCover={true} />
                      ))}
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

          {topArtists && topArtists.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Popular Artists</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {topArtists.slice(0, 5).map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
