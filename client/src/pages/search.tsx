import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Music, User, Disc, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCard } from "@/components/track-card";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import type { TrackWithArtist, AlbumWithArtist, Artist } from "@shared/schema";

const genres = [
  { name: "Pop", color: "from-pink-500 to-rose-500" },
  { name: "Hip-Hop", color: "from-orange-500 to-amber-500" },
  { name: "Rock", color: "from-red-500 to-rose-600" },
  { name: "Electronic", color: "from-cyan-500 to-blue-500" },
  { name: "R&B", color: "from-purple-500 to-violet-500" },
  { name: "Jazz", color: "from-emerald-500 to-teal-500" },
  { name: "Classical", color: "from-slate-500 to-gray-500" },
  { name: "Country", color: "from-yellow-500 to-orange-500" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearch = (value: string) => {
    setQuery(value);
    // Simple debounce
    setTimeout(() => setDebouncedQuery(value), 300);
  };

  const { data: searchResults, isLoading } = useQuery<{
    tracks: TrackWithArtist[];
    albums: AlbumWithArtist[];
    artists: Artist[];
  }>({
    queryKey: ["/api/search", debouncedQuery],
    queryFn: () => fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { credentials: "include" }).then(r => r.json()),
    enabled: debouncedQuery.length > 1,
  });

  const hasResults =
    searchResults &&
    (searchResults.tracks.length > 0 ||
      searchResults.albums.length > 0 ||
      searchResults.artists.length > 0);

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Search</h1>
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

      {/* Search Results or Browse */}
      {debouncedQuery.length > 1 ? (
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
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="tracks">
                  <Music className="h-4 w-4 mr-1" />
                  Songs
                </TabsTrigger>
                <TabsTrigger value="albums">
                  <Disc className="h-4 w-4 mr-1" />
                  Albums
                </TabsTrigger>
                <TabsTrigger value="artists">
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
                        <TrackCard
                          key={track.id}
                          track={track}
                          index={index}
                          queue={searchResults.tracks}
                        />
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
                    <TrackCard
                      key={track.id}
                      track={track}
                      index={index}
                      queue={searchResults.tracks}
                    />
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
        /* Browse by Genre */
        <div>
          <h2 className="text-xl font-bold mb-4">Browse All</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {genres.map((genre) => (
              <div
                key={genre.name}
                className={`aspect-square rounded-lg bg-gradient-to-br ${genre.color} p-4 cursor-pointer hover-elevate overflow-hidden relative`}
                data-testid={`genre-${genre.name.toLowerCase()}`}
              >
                <h3 className="font-bold text-white text-lg">{genre.name}</h3>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
