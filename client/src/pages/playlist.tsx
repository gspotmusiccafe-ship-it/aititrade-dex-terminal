import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Play, Shuffle, ListMusic, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCard } from "@/components/track-card";
import { usePlayer } from "@/lib/player-context";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Playlist, TrackWithArtist } from "@shared/schema";

export default function PlaylistPage() {
  const [, params] = useRoute("/playlist/:id");
  const playlistId = params?.id;
  const { playTrack } = usePlayer();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: playlist, isLoading: loadingPlaylist } = useQuery<Playlist>({
    queryKey: ["/api/playlists", playlistId],
    queryFn: () => fetch(`/api/playlists/${playlistId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!playlistId,
  });

  const { data: tracks, isLoading: loadingTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/playlists", playlistId, "tracks"],
    queryFn: () => fetch(`/api/playlists/${playlistId}/tracks`, { credentials: "include" }).then(r => r.json()),
    enabled: !!playlistId,
  });

  const removeTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      await apiRequest("DELETE", `/api/playlists/${playlistId}/tracks/${trackId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "tracks"] });
      toast({ title: "Track removed from playlist" });
    },
  });

  const isOwner = playlist && user && playlist.userId === user.id;

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

  if (loadingPlaylist) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <Skeleton className="h-48 w-48 rounded-lg mb-6" />
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-full pb-28 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Playlist not found</h2>
          <p className="text-muted-foreground">This playlist doesn't exist or has been removed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="flex items-end gap-6 mb-8">
        <div className="w-48 h-48 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shadow-lg">
          {playlist.coverImage ? (
            <img src={playlist.coverImage} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="h-16 w-16 text-primary" />
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Playlist</p>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-playlist-name">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-muted-foreground mb-2">{playlist.description}</p>
          )}
          <p className="text-sm text-muted-foreground">{tracks?.length || 0} tracks</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Button
          size="lg"
          className="rounded-full h-14 w-14"
          onClick={handlePlayAll}
          disabled={!tracks || tracks.length === 0}
          data-testid="button-play-playlist"
        >
          <Play className="h-6 w-6 ml-0.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleShuffle}
          disabled={!tracks || tracks.length === 0}
          data-testid="button-shuffle-playlist"
        >
          <Shuffle className="h-5 w-5" />
        </Button>
      </div>

      {loadingTracks ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded" />
          ))}
        </div>
      ) : tracks && tracks.length > 0 ? (
        <div className="space-y-1 bg-card/30 rounded-lg p-3">
          {tracks.map((track, index) => (
            <div key={track.id} className="flex items-center gap-2">
              <div className="flex-1">
                <TrackCard track={track} index={index} queue={tracks} />
              </div>
              {isOwner && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeTrackMutation.mutate(track.id)}
                  data-testid={`button-remove-track-${track.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <ListMusic className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">This playlist is empty</p>
          <p className="text-sm">Search for songs and add them to your playlist</p>
        </div>
      )}
    </div>
  );
}
