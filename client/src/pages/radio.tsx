import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import { Search, Play, Pause, Clock, Trash2, ToggleLeft, ToggleRight, Plus, Radio as RadioIcon, Loader2, Music, Disc3, ListMusic, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { JamSession } from "@shared/schema";

interface SpotifyProfile {
  connected: boolean;
  name?: string;
  email?: string;
  product?: string;
  isPremium?: boolean;
  image?: string;
  error?: string;
}

interface SpotifyTrackItem {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
}

interface SpotifyPlaylistItem {
  id: string;
  name: string;
  uri: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface SpotifyAlbumItem {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  artists: { name: string }[];
  release_date: string;
  total_tracks: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function RadioPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [scheduledTime, setScheduledTime] = useState("08:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [deleteConfirm, setDeleteConfirm] = useState<JamSession | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<SpotifyProfile>({
    queryKey: ["/api/spotify/me"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<JamSession[]>({
    queryKey: ["/api/jam-sessions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/jam-sessions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      setShowCreate(false);
      resetForm();
      toast({ title: "Jam session created!" });
    },
    onError: () => {
      toast({ title: "Failed to create jam session", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/jam-sessions/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/jam-sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      setDeleteConfirm(null);
      toast({ title: "Jam session deleted" });
    },
  });

  const playNowMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/jam-sessions/${id}/play-now`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      toast({ title: "Playback started on Spotify!" });
    },
    onError: () => {
      toast({ title: "Failed to start playback", description: "Make sure Spotify is open on one of your devices", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults(null);
    setSelectedItem(null);
    setSessionName("");
    setScheduledTime("08:00");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery.trim())}&type=track,playlist,album`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSearchResults(data);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const selectTrack = (track: SpotifyTrackItem) => {
    setSelectedItem({
      uri: track.uri,
      name: `${track.name} - ${track.artists.map(a => a.name).join(", ")}`,
      type: "track",
    });
    if (!sessionName) setSessionName(`${track.name} Session`);
  };

  const selectPlaylist = (playlist: SpotifyPlaylistItem) => {
    setSelectedItem({
      uri: playlist.uri,
      name: playlist.name,
      type: "playlist",
    });
    if (!sessionName) setSessionName(`${playlist.name} Session`);
  };

  const selectAlbum = (album: SpotifyAlbumItem) => {
    setSelectedItem({
      uri: album.uri,
      name: `${album.name} - ${album.artists.map(a => a.name).join(", ")}`,
      type: "album",
    });
    if (!sessionName) setSessionName(`${album.name} Session`);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleCreate = () => {
    if (!selectedItem || !sessionName.trim() || selectedDays.length === 0) return;
    createMutation.mutate({
      name: sessionName.trim(),
      spotifyUri: selectedItem.uri,
      spotifyName: selectedItem.name,
      spotifyType: selectedItem.type,
      scheduledTime,
      daysOfWeek: selectedDays.join(","),
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!profile?.connected) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <SiSpotify className="h-16 w-16 mx-auto text-[#1DB954]" />
              <h2 className="text-2xl font-bold">Connect Spotify</h2>
              <p className="text-muted-foreground max-w-md">
                Connect your Spotify Premium account to access AITIFY Music Radio and schedule automated jam sessions.
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.error || "Spotify is not connected. Please contact an administrator."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <RadioIcon className="h-8 w-8 text-[#1DB954]" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-radio-title">AITIFY Music Radio</h1>
            <p className="text-muted-foreground">Home of AI Music - Powered by Spotify</p>
          </div>
        </div>

        <Card className="mb-6 border-[#1DB954]/30 bg-[#1DB954]/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-[#1DB954] flex items-center justify-center overflow-hidden">
              {profile.image ? (
                <img src={profile.image} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <SiSpotify className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" data-testid="text-spotify-user-name">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <Badge className={profile.isPremium ? "bg-[#1DB954] text-white" : "bg-muted"} data-testid="badge-spotify-premium">
              {profile.isPremium ? "Premium" : profile.product || "Free"}
            </Badge>
          </CardContent>
        </Card>

        {!profile.isPremium && (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 text-center">
              <p className="text-yellow-600 font-medium">Spotify Premium Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scheduled playback requires a Spotify Premium account. Upgrade at spotify.com to use jam sessions.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#1DB954]" />
            Scheduled Jam Sessions
          </h2>
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="bg-[#1DB954] hover:bg-[#1DB954]/90" data-testid="button-create-jam-session">
            <Plus className="h-4 w-4 mr-2" />
            New Jam Session
          </Button>
        </div>

        {sessionsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card key={session.id} className={`transition-opacity ${session.isActive ? "" : "opacity-50"}`} data-testid={`jam-session-${session.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#1DB954]/20 to-primary/20 flex items-center justify-center">
                      {session.spotifyType === "playlist" ? (
                        <ListMusic className="h-6 w-6 text-[#1DB954]" />
                      ) : session.spotifyType === "album" ? (
                        <Disc3 className="h-6 w-6 text-[#1DB954]" />
                      ) : (
                        <Music className="h-6 w-6 text-[#1DB954]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-session-name-${session.id}`}>{session.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{session.spotifyName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {session.scheduledTime}
                        </span>
                        <div className="flex gap-0.5">
                          {DAY_NAMES.map((day, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] px-1 rounded ${session.daysOfWeek.split(",").includes(idx.toString()) ? "bg-[#1DB954]/20 text-[#1DB954]" : "text-muted-foreground/50"}`}
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                        {session.lastTriggered && (
                          <span className="text-xs text-muted-foreground">
                            Last: {new Date(session.lastTriggered).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => playNowMutation.mutate(session.id)}
                        disabled={playNowMutation.isPending}
                        className="text-[#1DB954] hover:text-[#1DB954]/80"
                        data-testid={`button-play-now-${session.id}`}
                      >
                        <Play className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleMutation.mutate(session.id)}
                        data-testid={`button-toggle-session-${session.id}`}
                      >
                        {session.isActive ? (
                          <ToggleRight className="h-5 w-5 text-[#1DB954]" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(session)}
                        className="text-destructive hover:text-destructive/80"
                        data-testid={`button-delete-session-${session.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <RadioIcon className="h-12 w-12 mx-auto mb-4 text-[#1DB954]/30" />
              <p className="font-medium mb-1">No jam sessions yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create a scheduled jam session to automatically start your favorite music at a set time every day
              </p>
              <Button onClick={() => { resetForm(); setShowCreate(true); }} className="bg-[#1DB954] hover:bg-[#1DB954]/90">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Jam Session
              </Button>
            </CardContent>
          </Card>
        )}

        <Dialog open={showCreate} onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SiSpotify className="h-5 w-5 text-[#1DB954]" />
                New Jam Session
              </DialogTitle>
              <DialogDescription>
                Search Spotify, pick a track or playlist, and schedule when it plays automatically
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Search Spotify</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search tracks, playlists, albums..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    data-testid="input-radio-search"
                  />
                  <Button onClick={handleSearch} disabled={searching} data-testid="button-radio-search">
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {selectedItem && (
                <div className="p-3 rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/5">
                  <div className="flex items-center gap-2">
                    <SiSpotify className="h-4 w-4 text-[#1DB954]" />
                    <span className="font-medium text-sm">Selected:</span>
                    <span className="text-sm truncate">{selectedItem.name}</span>
                    <Badge variant="outline" className="ml-auto">{selectedItem.type}</Badge>
                  </div>
                </div>
              )}

              {searchResults && (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {searchResults.tracks?.items?.map((track: SpotifyTrackItem) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedItem?.uri === track.uri ? "bg-[#1DB954]/10 border border-[#1DB954]/30" : ""}`}
                      onClick={() => selectTrack(track)}
                      data-testid={`radio-result-track-${track.id}`}
                    >
                      {track.album.images?.[0] ? (
                        <img src={track.album.images[track.album.images.length - 1].url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><Music className="h-4 w-4" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artists.map(a => a.name).join(", ")}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDuration(track.duration_ms)}</span>
                      <Badge variant="outline" className="text-[10px] py-0">Track</Badge>
                    </div>
                  ))}
                  {searchResults.playlists?.items?.filter(Boolean).map((playlist: SpotifyPlaylistItem) => (
                    <div
                      key={playlist.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedItem?.uri === playlist.uri ? "bg-[#1DB954]/10 border border-[#1DB954]/30" : ""}`}
                      onClick={() => selectPlaylist(playlist)}
                      data-testid={`radio-result-playlist-${playlist.id}`}
                    >
                      {playlist.images?.[0] ? (
                        <img src={playlist.images[playlist.images.length - 1]?.url || playlist.images[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><ListMusic className="h-4 w-4" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{playlist.tracks.total} tracks</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0">Playlist</Badge>
                    </div>
                  ))}
                  {searchResults.albums?.items?.filter(Boolean).map((album: SpotifyAlbumItem) => (
                    <div
                      key={album.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedItem?.uri === album.uri ? "bg-[#1DB954]/10 border border-[#1DB954]/30" : ""}`}
                      onClick={() => selectAlbum(album)}
                      data-testid={`radio-result-album-${album.id}`}
                    >
                      {album.images?.[0] ? (
                        <img src={album.images[album.images.length - 1]?.url || album.images[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center"><Disc3 className="h-4 w-4" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{album.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{album.artists.map((a: any) => a.name).join(", ")}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0">Album</Badge>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block">Session Name</label>
                <Input
                  placeholder="e.g., Morning Wake Up, Workout Jams..."
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  data-testid="input-session-name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Time</label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  data-testid="input-session-time"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Days</label>
                <div className="flex gap-2">
                  {DAY_NAMES.map((day, idx) => (
                    <Button
                      key={idx}
                      variant={selectedDays.includes(idx) ? "default" : "outline"}
                      size="sm"
                      className={selectedDays.includes(idx) ? "bg-[#1DB954] hover:bg-[#1DB954]/90" : ""}
                      onClick={() => toggleDay(idx)}
                      data-testid={`button-day-${idx}`}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedItem || !sessionName.trim() || selectedDays.length === 0 || createMutation.isPending}
                className="bg-[#1DB954] hover:bg-[#1DB954]/90"
                data-testid="button-confirm-create-session"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Jam Session</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
