import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Play, Shuffle, CheckCircle2, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrackCard } from "@/components/track-card";
import { AlbumCard } from "@/components/album-card";
import { usePlayer } from "@/lib/player-context";
import type { Artist, TrackWithArtist, AlbumWithArtist } from "@shared/schema";

export default function ArtistPage() {
  const [, params] = useRoute("/artist/:id");
  const artistId = params?.id;
  const { playTrack } = usePlayer();

  const { data: artist, isLoading: loadingArtist } = useQuery<Artist>({
    queryKey: ["/api/artists", artistId],
    enabled: !!artistId,
  });

  const { data: tracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/artists", artistId, "tracks"],
    enabled: !!artistId,
  });

  const { data: albums, isLoading: loadingAlbums } = useQuery<AlbumWithArtist[]>({
    queryKey: ["/api/artists", artistId, "albums"],
    enabled: !!artistId,
  });

  const handlePlayAll = () => {
    if (tracks && tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleShuffle = () => {
    if (tracks && tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  if (loadingArtist) {
    return (
      <div className="min-h-full pb-28">
        <Skeleton className="h-80 w-full" />
        <div className="px-6 py-8 space-y-4">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-full pb-28 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Artist not found</h2>
          <p className="text-muted-foreground">This artist doesn't exist or has been removed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28">
      {/* Hero Header */}
      <div className="relative h-80 overflow-hidden">
        {artist.coverImage ? (
          <img
            src={artist.coverImage}
            alt={artist.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-primary/20 to-transparent" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <div className="flex items-end gap-6">
            <div className="w-48 h-48 rounded-full overflow-hidden shadow-2xl flex-shrink-0 bg-gradient-to-br from-primary/30 to-accent/30">
              {artist.profileImage ? (
                <img src={artist.profileImage} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl font-bold text-primary">{artist.name[0]}</span>
                </div>
              )}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-2">
                {artist.verified && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified Artist
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3" data-testid="text-artist-name">
                {artist.name}
              </h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{(artist.monthlyListeners || 0).toLocaleString()} monthly listeners</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-6 flex items-center gap-4">
        <Button
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={handlePlayAll}
          disabled={!tracks || tracks.length === 0}
          data-testid="button-play-artist"
        >
          <Play className="h-6 w-6 ml-0.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleShuffle}
          disabled={!tracks || tracks.length === 0}
        >
          <Shuffle className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="rounded-full" data-testid="button-follow-artist">
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </Button>
      </div>

      {/* Bio */}
      {artist.bio && (
        <div className="px-6 pb-8">
          <p className="text-muted-foreground max-w-2xl">{artist.bio}</p>
        </div>
      )}

      {/* Popular Tracks */}
      <div className="px-6 pb-8">
        <h2 className="text-xl font-bold mb-4">Popular</h2>
        {loadingTracks ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : tracks && tracks.length > 0 ? (
          <div className="space-y-1 bg-card/30 rounded-lg p-3">
            {tracks.slice(0, 5).map((track, index) => (
              <TrackCard
                key={track.id}
                track={track}
                index={index}
                queue={tracks}
                showArtist={false}
                showCover={true}
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No tracks yet</p>
        )}
      </div>

      {/* Albums */}
      {albums && albums.length > 0 && (
        <div className="px-6 pb-8">
          <h2 className="text-xl font-bold mb-4">Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
