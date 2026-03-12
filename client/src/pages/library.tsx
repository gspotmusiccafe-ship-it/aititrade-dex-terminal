import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Music, ListMusic, User, Plus, Heart } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Playlist, Artist } from "@shared/schema";

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link href={`/playlist/${playlist.id}`}>
      <Card className="cursor-pointer overflow-hidden border-border/30 bg-card/60 hover:bg-card/90 hover:border-primary/20 transition-all duration-200" data-testid={`playlist-card-${playlist.id}`}>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center shadow-lg ring-1 ring-white/5">
              {playlist.coverImage ? (
                <img src={playlist.coverImage} alt={playlist.name} className="w-full h-full object-cover" />
              ) : (
                <ListMusic className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{playlist.name}</h3>
              <p className="text-sm text-muted-foreground">Playlist</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FollowedArtistCard({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artist/${artist.id}`}>
      <Card className="cursor-pointer overflow-hidden border-border/30 bg-card/60 hover:bg-card/90 hover:border-primary/20 transition-all duration-200" data-testid={`followed-artist-${artist.id}`}>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4">
            <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center shadow-lg ring-1 ring-white/5">
              {artist.profileImage ? (
                <img src={artist.profileImage} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <User className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{artist.name}</h3>
              <p className="text-sm text-muted-foreground">Artist</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function LibraryPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const { data: playlists, isLoading: loadingPlaylists } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: isAuthenticated,
  });

  const { data: followedArtists, isLoading: loadingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/user/followed-artists"],
    enabled: isAuthenticated,
  });

  const { data: likedTracksCount } = useQuery<{ count: number }>({
    queryKey: ["/api/user/liked-tracks/count"],
    enabled: isAuthenticated,
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/playlists", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setShowCreateDialog(false);
      setNewPlaylistName("");
      toast({ title: "Playlist created", description: "Your new playlist is ready." });
    },
    onError: () => {
      toast({ title: "Failed to create playlist", variant: "destructive" });
    },
  });

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    createPlaylistMutation.mutate(newPlaylistName.trim());
  };

  if (authLoading) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full pb-28 px-6 py-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Music className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Library</h2>
          <p className="text-muted-foreground mb-6">
            Sign in to save your favorite songs, create playlists, and follow artists
          </p>
          <Button asChild className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20" data-testid="button-login-library">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Library</h1>
        <Button size="icon" variant="ghost" onClick={() => setShowCreateDialog(true)} data-testid="button-create-playlist">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Playlist</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Playlist name"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
            data-testid="input-playlist-name"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-playlist">
              Cancel
            </Button>
            <Button
              onClick={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
              data-testid="button-confirm-create-playlist"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="playlists" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="playlists">Playlists</TabsTrigger>
          <TabsTrigger value="artists">Artists</TabsTrigger>
        </TabsList>

        <TabsContent value="playlists" className="space-y-4">
          {/* Liked Songs Card */}
          <Link href="/liked">
            <Card className="cursor-pointer overflow-hidden bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/20 hover:border-purple-500/30 transition-all duration-200" data-testid="card-liked-songs">
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                    <Heart className="h-6 w-6 text-white fill-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">Liked Songs</h3>
                    <p className="text-sm text-muted-foreground">
                      {likedTracksCount?.count || 0} songs
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {loadingPlaylists ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : playlists && playlists.length > 0 ? (
            playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ListMusic className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No playlists yet</p>
              <Button variant="ghost" className="mt-2" onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-playlist">
                <Plus className="h-4 w-4 mr-1" />
                Create your first playlist
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="artists" className="space-y-4">
          {loadingArtists ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : followedArtists && followedArtists.length > 0 ? (
            followedArtists.map((artist) => (
              <FollowedArtistCard key={artist.id} artist={artist} />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No followed artists yet</p>
              <p className="text-sm mt-1">Follow artists to keep up with their music</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
