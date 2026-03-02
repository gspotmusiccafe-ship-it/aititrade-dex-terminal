import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import { Search, Play, Pause, Clock, Trash2, ToggleLeft, ToggleRight, Plus, Radio as RadioIcon, Loader2, Music, Disc3, ListMusic, ExternalLink, Zap, Users, BarChart3, Heart, Share2, BookmarkPlus, SkipForward, Eye, ArrowLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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

interface EngagementOverview {
  sessions: (JamSession & { uniqueListeners: number; totalEngagements: number })[];
  totalListeners: number;
  totalEngagements: number;
}

interface SessionEngagementDetail {
  session: JamSession;
  engagements: {
    id: string;
    sessionId: string;
    userId: string;
    action: string;
    trackName: string | null;
    trackArtist: string | null;
    spotifyUri: string | null;
    metadata: string | null;
    createdAt: string;
  }[];
  listeners: {
    id: string;
    sessionId: string;
    userId: string;
    userName: string | null;
    userEmail: string | null;
    joinedAt: string;
    leftAt: string | null;
  }[];
  stats: {
    actionCounts: Record<string, number>;
    uniqueListeners: number;
    totalEngagements: number;
    topTracks: {
      trackName: string | null;
      trackArtist: string | null;
      spotifyUri: string | null;
      total: number;
    }[];
  };
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  play: { label: "Played", color: "text-[#1DB954]" },
  save: { label: "Saved", color: "text-blue-400" },
  share: { label: "Shared", color: "text-purple-400" },
  like: { label: "Liked", color: "text-red-400" },
  skip: { label: "Skipped", color: "text-yellow-400" },
  add_to_playlist: { label: "Added to Playlist", color: "text-cyan-400" },
};

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case "play": return <Play className="h-3.5 w-3.5" />;
    case "save": return <BookmarkPlus className="h-3.5 w-3.5" />;
    case "share": return <Share2 className="h-3.5 w-3.5" />;
    case "like": return <Heart className="h-3.5 w-3.5" />;
    case "skip": return <SkipForward className="h-3.5 w-3.5" />;
    case "add_to_playlist": return <ListMusic className="h-3.5 w-3.5" />;
    default: return <Activity className="h-3.5 w-3.5" />;
  }
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
  const [activeTab, setActiveTab] = useState("sessions");
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<SpotifyProfile>({
    queryKey: ["/api/spotify/me"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<JamSession[]>({
    queryKey: ["/api/jam-sessions"],
  });

  const { data: engagementOverview, isLoading: overviewLoading } = useQuery<EngagementOverview>({
    queryKey: ["/api/jam-sessions/engagement/overview"],
    enabled: activeTab === "tracker",
  });

  const { data: sessionDetail, isLoading: detailLoading } = useQuery<SessionEngagementDetail>({
    queryKey: [`/api/jam-sessions/${viewingSessionId}/engagement`],
    enabled: !!viewingSessionId,
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
    mutationFn: async (session: JamSession) => {
      await apiRequest("POST", `/api/jam-sessions/${session.id}/join`);
      await apiRequest("POST", `/api/jam-sessions/${session.id}/play-now`);
      await apiRequest("POST", `/api/jam-sessions/${session.id}/engagement`, {
        action: "play",
        trackName: session.spotifyName || session.name,
        spotifyUri: session.spotifyUri,
      });
      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/engagement/overview"] });
      toast({ title: "Playback started on Spotify!" });
    },
    onError: () => {
      toast({ title: "Failed to start playback", description: "Make sure Spotify is open on one of your devices", variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/jam-sessions/${id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      toast({ title: "Joined session!" });
    },
  });

  const engagementMutation = useMutation({
    mutationFn: async ({ sessionId, data }: { sessionId: string; data: any }) =>
      apiRequest("POST", `/api/jam-sessions/${sessionId}/engagement`, data),
    onSuccess: () => {
      if (viewingSessionId) {
        queryClient.invalidateQueries({ queryKey: [`/api/jam-sessions/${viewingSessionId}/engagement`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/engagement/overview"] });
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

  const recordEngagement = (sessionId: string, action: string, trackName?: string, trackArtist?: string, spotifyUri?: string) => {
    engagementMutation.mutate({
      sessionId,
      data: { action, trackName, trackArtist, spotifyUri },
    });
    toast({ title: `${ACTION_LABELS[action]?.label || action} recorded` });
  };

  const spotifyConnected = profile?.connected === true;
  const [retrying, setRetrying] = useState(false);

  const handleRetryConnection = async () => {
    setRetrying(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/spotify/me"] });
    } finally {
      setRetrying(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-full flex items-center justify-center pb-28">
        <div className="text-center">
          <div className="h-20 w-20 rounded-full bg-[#1DB954]/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <SiSpotify className="h-10 w-10 text-[#1DB954]" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Connecting to Spotify...</h2>
          <p className="text-muted-foreground text-sm">Checking your connection status</p>
        </div>
      </div>
    );
  }

  if (!spotifyConnected) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-lg mx-auto mt-12">
          <div className="text-center mb-10">
            <div className="h-24 w-24 rounded-full bg-[#1DB954] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#1DB954]/20">
              <SiSpotify className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-radio-title">AITIFY Music Radio</h1>
            <p className="text-muted-foreground">Home of AI Music — Powered by Spotify</p>
          </div>

          <Card className="border-[#1DB954]/20 bg-card/50 backdrop-blur">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold mb-3">Connect Your Spotify Account</h2>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                Link your Spotify Premium account to unlock automated jam sessions,
                scheduled playback, and engagement tracking across all your listening sessions.
              </p>

              <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1DB954]/5">
                  <div className="h-8 w-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Scheduled Jam Sessions</p>
                    <p className="text-xs text-muted-foreground">Auto-play your favorite music at set times</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1DB954]/5">
                  <div className="h-8 w-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Engagement Tracking</p>
                    <p className="text-xs text-muted-foreground">Track plays, saves, shares across sessions</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1DB954]/5">
                  <div className="h-8 w-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center flex-shrink-0">
                    <Users className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Listener Analytics</p>
                    <p className="text-xs text-muted-foreground">See who's tuning in to your sessions</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => {
                  window.open("https://accounts.spotify.com/login", "_blank", "noopener,noreferrer");
                }}
                className="w-full bg-[#1DB954] hover:bg-[#1DB954]/90 text-white font-semibold text-base rounded-full mb-3 h-12"
                data-testid="button-open-spotify-login"
              >
                <SiSpotify className="h-5 w-5 mr-2" />
                Log in to Spotify
              </Button>

              <Button
                onClick={handleRetryConnection}
                disabled={retrying}
                variant="outline"
                className="w-full border-[#1DB954]/30 text-[#1DB954] hover:bg-[#1DB954]/10 rounded-full h-11"
                data-testid="button-connect-spotify"
              >
                {retrying ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Checking connection...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Check Connection Status
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground mt-4">
                Log in to Spotify first, then check connection status. Requires Spotify Premium for playback.
              </p>
            </CardContent>
          </Card>
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
              {profile?.image ? (
                <img src={profile.image} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <SiSpotify className="h-6 w-6 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium" data-testid="text-spotify-user-name">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            <Badge className={profile?.isPremium ? "bg-[#1DB954] text-white" : "bg-muted"} data-testid="badge-spotify-premium">
              {profile?.isPremium ? "Premium" : profile?.product || "Free"}
            </Badge>
          </CardContent>
        </Card>

        {spotifyConnected && !profile?.isPremium && (
          <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 text-center">
              <p className="text-yellow-600 font-medium">Spotify Premium Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                Scheduled playback requires a Spotify Premium account. Upgrade at spotify.com to use jam sessions.
              </p>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sessions" className="flex items-center gap-2" data-testid="tab-sessions">
              <Zap className="h-4 w-4" />
              Jam Sessions
            </TabsTrigger>
            <TabsTrigger value="tracker" className="flex items-center gap-2" data-testid="tab-tracker">
              <BarChart3 className="h-4 w-4" />
              Account Tracker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4">
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
                            onClick={() => playNowMutation.mutate(session)}
                            disabled={playNowMutation.isPending}
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
                            className="text-destructive"
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
          </TabsContent>

          <TabsContent value="tracker" className="mt-4">
            {viewingSessionId && sessionDetail ? (
              <SessionDetailView
                detail={sessionDetail}
                loading={detailLoading}
                onBack={() => setViewingSessionId(null)}
                onRecordEngagement={recordEngagement}
                engagementPending={engagementMutation.isPending}
              />
            ) : (
              <EngagementOverviewView
                overview={engagementOverview}
                loading={overviewLoading}
                onViewSession={(id) => setViewingSessionId(id)}
              />
            )}
          </TabsContent>
        </Tabs>

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
                data-testid="button-save-jam-session"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Create Jam Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Jam Session</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirm?.name}"? This will stop any future scheduled playback.
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

function EngagementOverviewView({
  overview,
  loading,
  onViewSession,
}: {
  overview: EngagementOverview | undefined;
  loading: boolean;
  onViewSession: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-5 w-5 text-[#1DB954]" />
        <h2 className="text-xl font-semibold">Account Tracker</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-[#1DB954]/20">
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 mx-auto mb-2 text-[#1DB954]" />
            <p className="text-2xl font-bold" data-testid="text-total-listeners">{overview?.totalListeners || 0}</p>
            <p className="text-xs text-muted-foreground">Total Listeners</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="p-4 text-center">
            <Activity className="h-6 w-6 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold" data-testid="text-total-engagements">{overview?.totalEngagements || 0}</p>
            <p className="text-xs text-muted-foreground">Total Engagements</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20">
          <CardContent className="p-4 text-center">
            <Zap className="h-6 w-6 mx-auto mb-2 text-purple-400" />
            <p className="text-2xl font-bold" data-testid="text-total-sessions">{overview?.sessions?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Session Breakdown</h3>
        {!overview?.sessions?.length ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">No engagement data yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Engagement will be tracked when listeners join and interact with your jam sessions
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {overview.sessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:border-[#1DB954]/40 transition-colors"
                onClick={() => onViewSession(session.id)}
                data-testid={`tracker-session-${session.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1DB954]/20 to-primary/20 flex items-center justify-center">
                      {session.spotifyType === "playlist" ? (
                        <ListMusic className="h-5 w-5 text-[#1DB954]" />
                      ) : session.spotifyType === "album" ? (
                        <Disc3 className="h-5 w-5 text-[#1DB954]" />
                      ) : (
                        <Music className="h-5 w-5 text-[#1DB954]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{session.spotifyName}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-semibold text-[#1DB954]">{session.uniqueListeners}</p>
                        <p className="text-[10px] text-muted-foreground">listeners</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-blue-400">{session.totalEngagements}</p>
                        <p className="text-[10px] text-muted-foreground">actions</p>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionDetailView({
  detail,
  loading,
  onBack,
  onRecordEngagement,
  engagementPending,
}: {
  detail: SessionEngagementDetail;
  loading: boolean;
  onBack: () => void;
  onRecordEngagement: (sessionId: string, action: string, trackName?: string, trackArtist?: string, spotifyUri?: string) => void;
  engagementPending: boolean;
}) {
  const [detailTab, setDetailTab] = useState("overview");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-to-overview">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate" data-testid="text-detail-session-name">{detail.session.name}</h2>
          <p className="text-sm text-muted-foreground truncate">{detail.session.spotifyName}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-[#1DB954]/20">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-[#1DB954]" data-testid="text-detail-listeners">{detail.stats.uniqueListeners}</p>
            <p className="text-[10px] text-muted-foreground">Listeners</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-blue-400" data-testid="text-detail-plays">{detail.stats.actionCounts.play || 0}</p>
            <p className="text-[10px] text-muted-foreground">Plays</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-red-400" data-testid="text-detail-saves">{(detail.stats.actionCounts.save || 0) + (detail.stats.actionCounts.like || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Saved / Liked</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-purple-400" data-testid="text-detail-shares">{detail.stats.actionCounts.share || 0}</p>
            <p className="text-[10px] text-muted-foreground">Shares</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" data-testid="detail-tab-overview">Top Tracks</TabsTrigger>
          <TabsTrigger value="listeners" data-testid="detail-tab-listeners">
            Listeners ({detail.listeners.length})
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="detail-tab-activity">
            Activity ({detail.engagements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {detail.stats.topTracks.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Most Played Tracks</h3>
              {detail.stats.topTracks.map((track, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30" data-testid={`top-track-${idx}`}>
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">{idx + 1}</span>
                  <Music className="h-4 w-4 text-[#1DB954]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.trackName || "Unknown Track"}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.trackArtist || "Unknown Artist"}</p>
                  </div>
                  <Badge variant="outline" className="text-[#1DB954]">
                    <Play className="h-3 w-3 mr-1" />
                    {track.total}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No tracks played yet</p>
            </div>
          )}

          <Separator className="my-4" />

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Engagement Breakdown</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ACTION_LABELS).map(([action, { label, color }]) => (
                <div key={action} className="flex items-center gap-2 p-2 rounded bg-muted/20">
                  <span className={color}><ActionIcon action={action} /></span>
                  <span className="text-sm flex-1">{label}</span>
                  <span className="text-sm font-semibold">{detail.stats.actionCounts[action] || 0}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="listeners" className="mt-4">
          {detail.listeners.length > 0 ? (
            <div className="space-y-2">
              {detail.listeners.map((listener) => (
                <div key={listener.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30" data-testid={`listener-${listener.id}`}>
                  <div className="h-8 w-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center">
                    <Users className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{listener.userName || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground truncate">{listener.userEmail || listener.userId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Joined {formatTimeAgo(listener.joinedAt)}</p>
                    {listener.leftAt ? (
                      <Badge variant="outline" className="text-[10px]">Left</Badge>
                    ) : (
                      <Badge className="bg-[#1DB954] text-white text-[10px]">Active</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No listeners have joined this session yet</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {detail.engagements.length > 0 ? (
            <div className="space-y-1.5">
              {detail.engagements.map((engagement) => {
                const actionInfo = ACTION_LABELS[engagement.action] || { label: engagement.action, color: "text-muted-foreground" };
                return (
                  <div key={engagement.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20" data-testid={`engagement-${engagement.id}`}>
                    <span className={actionInfo.color}><ActionIcon action={engagement.action} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] py-0 ${actionInfo.color}`}>
                          {actionInfo.label}
                        </Badge>
                        {engagement.trackName && (
                          <span className="text-sm truncate">{engagement.trackName}</span>
                        )}
                      </div>
                      {engagement.trackArtist && (
                        <p className="text-xs text-muted-foreground truncate">{engagement.trackArtist}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(engagement.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No engagement activity recorded yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
