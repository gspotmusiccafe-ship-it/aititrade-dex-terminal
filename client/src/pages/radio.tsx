import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import { Radio as RadioIcon, Sun, Sunrise, CloudSun, Sunset, Moon, Play, ExternalLink, Music, Users, Heart, Share2, SkipForward, ListPlus, Bookmark, LogIn, LogOut, BarChart3, Clock, Headphones, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { RadioShow, JamSession } from "@shared/schema";

const SLOT_CONFIG: Record<string, { label: string; icon: any; gradient: string; time: string }> = {
  morning: { label: "Morning Show", icon: Sunrise, gradient: "from-amber-500/20 to-yellow-500/20", time: "6 AM - 10 AM" },
  midday: { label: "Mid-Day Vibes", icon: Sun, gradient: "from-orange-500/20 to-red-500/20", time: "10 AM - 2 PM" },
  afternoon: { label: "Afternoon Drive", icon: CloudSun, gradient: "from-sky-500/20 to-blue-500/20", time: "2 PM - 6 PM" },
  evening: { label: "Evening Sessions", icon: Sunset, gradient: "from-purple-500/20 to-pink-500/20", time: "6 PM - 10 PM" },
  bedtime: { label: "Bedtime Music", icon: Moon, gradient: "from-indigo-500/20 to-violet-500/20", time: "10 PM - 6 AM" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function extractSpotifyEmbedUrl(url: string): string | null {
  try {
    let spotifyUrl = url.trim();
    if (spotifyUrl.startsWith("spotify:")) {
      const parts = spotifyUrl.split(":");
      if (parts.length >= 3) {
        spotifyUrl = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      }
    }
    const match = spotifyUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    }
    return null;
  } catch {
    return null;
  }
}

function formatTime12(time24: string) {
  const [h, m] = time24.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function ShowCard({ show }: { show: RadioShow }) {
  const config = SLOT_CONFIG[show.slot] || SLOT_CONFIG.morning;
  const Icon = config.icon;
  const embedUrl = extractSpotifyEmbedUrl(show.spotifyPlaylistUrl);

  return (
    <Card className="overflow-hidden border-border/50 hover:border-[#1DB954]/30 transition-colors" data-testid={`radio-show-${show.id}`}>
      <CardContent className="p-0">
        <div className={`p-4 bg-gradient-to-r ${config.gradient}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-background/80 flex items-center justify-center">
              <Icon className="h-5 w-5 text-[#1DB954]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate" data-testid={`text-show-name-${show.id}`}>{show.name}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{config.label}</Badge>
                <span className="text-xs text-muted-foreground">{config.time}</span>
              </div>
            </div>
            <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5 border-[#1DB954]/30 hover:bg-[#1DB954]/10" data-testid={`button-open-spotify-${show.id}`}>
                <SiSpotify className="h-4 w-4 text-[#1DB954]" />
                Open in Spotify
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
          {show.description && (
            <p className="text-sm text-muted-foreground mt-2 ml-[52px]">{show.description}</p>
          )}
        </div>

        {embedUrl && (
          <div className="p-4">
            <iframe
              src={embedUrl}
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
              data-testid={`embed-spotify-${show.id}`}
            />
          </div>
        )}

        {!embedUrl && (
          <div className="p-6 text-center">
            <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" data-testid={`button-listen-${show.id}`}>
                <Play className="h-4 w-4" />
                Listen on Spotify
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActiveSession extends JamSession {
  ownerName: string;
  activeListeners: number;
  totalEngagements: number;
}

interface EngagementStats {
  session: JamSession;
  engagements: any[];
  listeners: any[];
  stats: {
    actionCounts: Record<string, number>;
    uniqueListeners: number;
    totalEngagements: number;
    topTracks: { trackName: string; trackArtist: string; spotifyUri: string; total: number }[];
  };
}

function JamSessionCard({ session, userId }: { session: ActiveSession; userId: string }) {
  const { toast } = useToast();
  const [showStats, setShowStats] = useState(false);
  const isOwner = session.userId === userId;

  const { data: engagementData, refetch: refetchEngagement } = useQuery<EngagementStats>({
    queryKey: ["/api/jam-sessions", session.id, "engagement"],
    enabled: showStats && isOwner,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jam-sessions/${session.id}/join`),
    onSuccess: () => {
      toast({ title: "Joined session", description: `You joined "${session.name}"` });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jam-sessions/${session.id}/leave`),
    onSuccess: () => {
      toast({ title: "Left session", description: `You left "${session.name}"` });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const engageMutation = useMutation({
    mutationFn: (data: { action: string; trackName?: string; trackArtist?: string }) =>
      apiRequest("POST", `/api/jam-sessions/${session.id}/engagement`, data),
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = {
        play: "Played", save: "Saved", share: "Shared", like: "Liked", skip: "Skipped", add_to_playlist: "Added to playlist"
      };
      toast({ title: labels[vars.action] || "Recorded", description: `Action recorded for "${session.name}"` });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
      if (showStats) refetchEngagement();
    },
    onError: (err: Error) => {
      if (err.message.includes("join this session")) {
        toast({ title: "Join First", description: "Hit the Join Session button before tracking engagement", variant: "destructive" });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  const scheduleDays = session.daysOfWeek ? session.daysOfWeek.split(",").map(d => DAY_NAMES[parseInt(d)]).join(", ") : "Every day";

  const engagementActions = [
    { action: "play", icon: Play, label: "Play", color: "text-green-400" },
    { action: "like", icon: Heart, label: "Like", color: "text-red-400" },
    { action: "save", icon: Bookmark, label: "Save", color: "text-yellow-400" },
    { action: "share", icon: Share2, label: "Share", color: "text-blue-400" },
    { action: "skip", icon: SkipForward, label: "Skip", color: "text-orange-400" },
    { action: "add_to_playlist", icon: ListPlus, label: "Add to Playlist", color: "text-purple-400" },
  ];

  return (
    <Card className="overflow-hidden border-border/50 hover:border-primary/30 transition-colors" data-testid={`jam-session-${session.id}`}>
      <CardContent className="p-0">
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate" data-testid={`text-jam-name-${session.id}`}>{session.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {session.spotifyName && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <SiSpotify className="h-3 w-3 text-[#1DB954]" />
                    {session.spotifyName}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs capitalize">{session.spotifyType}</Badge>
                {isOwner && <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Your Session</Badge>}
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime12(session.scheduledTime)} · {scheduleDays}
                </span>
                <span className="flex items-center gap-1" data-testid={`text-listeners-${session.id}`}>
                  <Users className="h-3 w-3" />
                  {session.activeListeners} listening
                </span>
                <span className="flex items-center gap-1" data-testid={`text-engagements-${session.id}`}>
                  <BarChart3 className="h-3 w-3" />
                  {session.totalEngagements} actions
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hosted by {session.ownerName}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid={`button-join-${session.id}`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Join Session
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              data-testid={`button-leave-${session.id}`}
            >
              <LogOut className="h-3.5 w-3.5" />
              Leave
            </Button>
            {isOwner && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 ml-auto"
                onClick={() => { setShowStats(!showStats); if (!showStats) refetchEngagement(); }}
                data-testid={`button-stats-${session.id}`}
              >
                <Eye className="h-3.5 w-3.5" />
                {showStats ? "Hide Stats" : "View Stats"}
              </Button>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Track Your Engagement:</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {engagementActions.map(({ action, icon: Icon, label, color }) => (
                <Button
                  key={action}
                  size="sm"
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-primary/10"
                  onClick={() => engageMutation.mutate({ action, trackName: session.spotifyName || session.name })}
                  disabled={engageMutation.isPending}
                  data-testid={`button-engage-${action}-${session.id}`}
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-[10px]">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {showStats && isOwner && engagementData && (
            <div className="border-t border-border/50 pt-3 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-primary" />
                Engagement Dashboard
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold" data-testid={`stat-listeners-${session.id}`}>{engagementData.stats.uniqueListeners}</p>
                  <p className="text-[10px] text-muted-foreground">Unique Listeners</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold" data-testid={`stat-total-${session.id}`}>{engagementData.stats.totalEngagements}</p>
                  <p className="text-[10px] text-muted-foreground">Total Actions</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold">{engagementData.stats.actionCounts.play || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Plays</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold">{engagementData.stats.actionCounts.like || 0}</p>
                  <p className="text-[10px] text-muted-foreground">Likes</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(engagementData.stats.actionCounts).map(([action, total]) => (
                  <div key={action} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1">
                    <span className="text-xs capitalize">{action.replace("_", " ")}</span>
                    <Badge variant="secondary" className="text-xs">{String(total)}</Badge>
                  </div>
                ))}
              </div>

              {engagementData.stats.topTracks.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Top Played Tracks:</p>
                  <div className="space-y-1">
                    {engagementData.stats.topTracks.map((track, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-primary w-4">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{track.trackName || "Unknown"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{track.trackArtist || "Unknown"}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs ml-2">{String(track.total)} plays</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {engagementData.listeners.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-1">Listeners ({engagementData.listeners.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {engagementData.listeners.map((listener: any) => (
                      <Badge key={listener.id} variant="outline" className="text-xs">
                        {listener.userName || listener.userEmail || "Anonymous"}
                        {!listener.leftAt && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RadioPage() {
  const { user } = useAuth();
  const { data: shows, isLoading: showsLoading } = useQuery<RadioShow[]>({
    queryKey: ["/api/radio-shows"],
  });

  const { data: activeSessions, isLoading: sessionsLoading } = useQuery<ActiveSession[]>({
    queryKey: ["/api/jam-sessions/active"],
    staleTime: 0,
    refetchInterval: 30000,
  });

  const isLoading = showsLoading || sessionsLoading;

  if (isLoading) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <RadioIcon className="h-8 w-8 text-[#1DB954]" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-radio-title">Radio & Jam Sessions</h1>
            <p className="text-muted-foreground">Radio shows & live jam sessions - Powered by Spotify</p>
          </div>
        </div>

        <Tabs defaultValue="shows" className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="shows" data-testid="tab-shows" className="gap-1.5">
              <Music className="h-4 w-4" />
              Radio Shows
              {shows && shows.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{shows.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="jams" data-testid="tab-jams" className="gap-1.5">
              <Headphones className="h-4 w-4" />
              Jam Sessions
              {activeSessions && activeSessions.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{activeSessions.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shows">
            <div className="flex items-center gap-2 mb-6">
              <SiSpotify className="h-4 w-4 text-[#1DB954]" />
              <span className="text-sm text-muted-foreground">
                Click any show to stream directly on Spotify
              </span>
            </div>

            {shows && shows.length > 0 ? (
              <div className="space-y-6">
                {shows.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Music className="h-16 w-16 mx-auto mb-4 text-[#1DB954]/30" />
                  <h2 className="text-xl font-bold mb-2">No Shows Scheduled</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Radio shows are being set up. Check back soon for Morning, Mid-Day, Afternoon, Evening, and Bedtime playlists.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="jams">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">
                Join a jam session, interact with the music, and your engagement gets tracked
              </span>
            </div>

            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4">
                <p className="text-sm">
                  <span className="font-semibold">How it works:</span> Join a session, then use the action buttons (Play, Like, Save, Share, Skip, Add to Playlist) as you listen. 
                  Session owners can see all engagement stats including who joined, what actions they took, and which tracks were most popular.
                </p>
              </CardContent>
            </Card>

            {activeSessions && activeSessions.length > 0 ? (
              <div className="space-y-4">
                {activeSessions.map((session) => (
                  <JamSessionCard key={session.id} session={session} userId={user?.id || ""} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Headphones className="h-16 w-16 mx-auto mb-4 text-primary/30" />
                  <h2 className="text-xl font-bold mb-2">No Active Jam Sessions</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    There are no active jam sessions right now. Create one from your Spotify settings to start tracking engagement.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
