import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import { Radio as RadioIcon, Sun, Sunrise, CloudSun, Sunset, Moon, Play, Pause, ExternalLink, Music, Music2, Users, Heart, Share2, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, ListPlus, Bookmark, LogIn, LogOut, BarChart3, Clock, Headphones, Eye, Plus, Trash2, Power, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function extractSpotifyOpenUrl(url: string): string | null {
  try {
    let spotifyUrl = url.trim();
    if (spotifyUrl.startsWith("spotify:")) {
      const parts = spotifyUrl.split(":");
      if (parts.length >= 3) {
        return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      }
    }
    const match = spotifyUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
    if (match) return `https://open.spotify.com/${match[1]}/${match[2]}`;
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

function SpotifyControls({ showId, spotifyUrl }: { showId: number; spotifyUrl: string }) {
  const { toast } = useToast();
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "context" | "track">("off");
  const [isPlaying, setIsPlaying] = useState(false);
  const [deviceActive, setDeviceActive] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<{
    trackName: string; artistName: string; albumArt: string | null;
    progressMs: number; durationMs: number;
  } | null>(null);
  const progressRef = useRef<number>(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const { data: playerState } = useQuery<any>({
    queryKey: ["/api/spotify/player"],
    enabled: isPlaying,
    refetchInterval: isPlaying ? 5000 : false,
    staleTime: 3000,
  });

  useEffect(() => {
    if (playerState && playerState.is_playing && playerState.item) {
      const item = playerState.item;
      setNowPlaying({
        trackName: item.name || "Unknown Track",
        artistName: item.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
        albumArt: item.album?.images?.[2]?.url || item.album?.images?.[0]?.url || null,
        progressMs: playerState.progress_ms || 0,
        durationMs: item.duration_ms || 0,
      });
      progressRef.current = playerState.progress_ms || 0;
      setDisplayProgress(playerState.progress_ms || 0);
      if (playerState.shuffle_state !== undefined) setShuffleOn(playerState.shuffle_state);
      if (playerState.repeat_state) setRepeatMode(playerState.repeat_state as any);
    } else if (playerState && !playerState.is_playing) {
      setIsPlaying(false);
    }
  }, [playerState]);

  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const interval = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 1000, nowPlaying.durationMs);
      setDisplayProgress(progressRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, nowPlaying?.durationMs]);

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const openUrl = extractSpotifyOpenUrl(spotifyUrl);

  const handleNoDevice = (action: string) => {
    if (openUrl) {
      toast({
        title: `${action} — Open Spotify First`,
        description: "Click 'Play in Spotify App' to start playback, then use these controls.",
      });
    } else {
      toast({ title: `${action} failed`, description: "Open Spotify on your computer and start playing first.", variant: "destructive" });
    }
  };

  const playInApp = useMutation({
    mutationFn: async () => {
      const uri = spotifyUrl.trim();
      let contextUri: string | undefined;
      let uris: string[] | undefined;

      const match = uri.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
      if (match) {
        const spotifyUri = `spotify:${match[1]}:${match[2]}`;
        if (match[1] === "track") {
          uris = [spotifyUri];
        } else {
          contextUri = spotifyUri;
        }
      }

      return apiRequest("POST", "/api/spotify/play", { context_uri: contextUri, uris });
    },
    onSuccess: () => {
      setIsPlaying(true);
      setDeviceActive(true);
      toast({ title: "Playing in Spotify App", description: "Controls are now active — use shuffle, skip, and repeat below." });
    },
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE" && openUrl) {
        toast({ title: "Opening Spotify", description: "Opening playlist in Spotify — once it's playing, come back and controls will work." });
        window.open(openUrl, "_blank");
      } else {
        toast({ title: "Playback failed", description: "Open Spotify on this device first.", variant: "destructive" });
      }
    },
  });

  const pausePlayback = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/spotify/pause"),
    onSuccess: () => {
      setIsPlaying(false);
      toast({ title: "Paused" });
    },
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE") handleNoDevice("Pause");
    },
  });

  const skipNext = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/next"),
    onSuccess: () => toast({ title: "Skipped to next" }),
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE") handleNoDevice("Skip");
      else toast({ title: "Skip failed", variant: "destructive" });
    },
  });

  const skipPrev = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/previous"),
    onSuccess: () => toast({ title: "Previous track" }),
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE") handleNoDevice("Previous");
      else toast({ title: "Previous failed", variant: "destructive" });
    },
  });

  const toggleShuffle = useMutation({
    mutationFn: (state: boolean) => apiRequest("PUT", "/api/spotify/shuffle", { state }),
    onSuccess: (_data, state) => {
      setShuffleOn(state);
      toast({ title: state ? "Shuffle ON" : "Shuffle OFF" });
    },
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE") handleNoDevice("Shuffle");
      else toast({ title: "Shuffle failed", variant: "destructive" });
    },
  });

  const setRepeat = useMutation({
    mutationFn: (state: string) => apiRequest("PUT", "/api/spotify/repeat", { state }),
    onSuccess: (_data, state) => {
      setRepeatMode(state as any);
      const labels: Record<string, string> = { off: "Repeat OFF", context: "Repeat ALL", track: "Repeat ONE" };
      toast({ title: labels[state] || "Repeat updated" });
    },
    onError: (e: any) => {
      if (e.message === "NO_ACTIVE_DEVICE") handleNoDevice("Repeat");
      else toast({ title: "Repeat failed", variant: "destructive" });
    },
  });

  const cycleRepeat = () => {
    const next = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
    setRepeat.mutate(next);
  };

  const RepeatIcon = repeatMode === "track" ? Repeat1 : Repeat;

  return (
    <div className="border-t border-border/30" data-testid={`spotify-controls-${showId}`}>
      <div className="flex items-center justify-center gap-1 py-2 px-4">
        <Button
          size="sm"
          className="gap-1.5 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white border-0 rounded-full h-8 px-4"
          onClick={() => {
            if (isPlaying) {
              pausePlayback.mutate();
            } else {
              playInApp.mutate();
            }
          }}
          disabled={playInApp.isPending || pausePlayback.isPending}
          data-testid={`button-play-app-${showId}`}
        >
          <SiSpotify className="h-3.5 w-3.5" />
          {isPlaying ? "Pause" : "Play in Spotify App"}
        </Button>
      </div>

      {nowPlaying && (
        <div className="px-4 pb-1" data-testid={`now-playing-show-${showId}`}>
          <div className="flex items-center gap-3">
            {nowPlaying.albumArt ? (
              <img src={nowPlaying.albumArt} alt="" className="h-10 w-10 rounded shadow-md flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <Music2 className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" data-testid={`now-playing-show-track-${showId}`}>{nowPlaying.trackName}</p>
              <p className="text-[10px] text-muted-foreground truncate" data-testid={`now-playing-show-artist-${showId}`}>{nowPlaying.artistName}</p>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono flex-shrink-0" data-testid={`now-playing-show-time-${showId}`}>
              {formatMs(displayProgress)} / {formatMs(nowPlaying.durationMs)}
            </div>
          </div>
          <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1DB954] rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${nowPlaying.durationMs > 0 ? Math.min((displayProgress / nowPlaying.durationMs) * 100, 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-2 px-4 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-full ${shuffleOn ? "text-[#1DB954] bg-[#1DB954]/10" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => toggleShuffle.mutate(!shuffleOn)}
          disabled={toggleShuffle.isPending}
          data-testid={`button-shuffle-${showId}`}
          title={shuffleOn ? "Shuffle ON" : "Shuffle OFF"}
        >
          <Shuffle className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => skipPrev.mutate()}
          disabled={skipPrev.isPending}
          data-testid={`button-previous-${showId}`}
          title="Previous"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full bg-white text-black hover:bg-white/90"
          onClick={() => {
            if (isPlaying) pausePlayback.mutate();
            else playInApp.mutate();
          }}
          disabled={playInApp.isPending || pausePlayback.isPending}
          data-testid={`button-playpause-${showId}`}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => skipNext.mutate()}
          disabled={skipNext.isPending}
          data-testid={`button-skip-${showId}`}
          title="Next"
        >
          <SkipForward className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-full ${repeatMode !== "off" ? "text-[#1DB954] bg-[#1DB954]/10" : "text-muted-foreground hover:text-foreground"}`}
          onClick={cycleRepeat}
          disabled={setRepeat.isPending}
          data-testid={`button-repeat-${showId}`}
          title={repeatMode === "off" ? "Repeat OFF" : repeatMode === "context" ? "Repeat ALL" : "Repeat ONE"}
        >
          <RepeatIcon className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center pb-2">
        {repeatMode !== "off" && <span className="text-[#1DB954] font-medium mr-2">{repeatMode === "track" ? "Repeat 1" : "Repeat All"}</span>}
        {shuffleOn && <span className="text-[#1DB954] font-medium mr-2">Shuffle</span>}
        Controls your Spotify app
      </p>
    </div>
  );
}

function ShowCard({ show }: { show: RadioShow }) {
  const config = SLOT_CONFIG[show.slot] || SLOT_CONFIG.morning;
  const Icon = config.icon;
  const embedUrl = extractSpotifyEmbedUrl(show.spotifyPlaylistUrl);
  const openUrl = extractSpotifyOpenUrl(show.spotifyPlaylistUrl);

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
            <Button variant="outline" size="sm" className="gap-1.5 border-[#1DB954]/30 hover:bg-[#1DB954]/10 shrink-0" asChild data-testid={`button-open-spotify-${show.id}`}>
              <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer">
                <SiSpotify className="h-4 w-4 text-[#1DB954]" />
                Open in Spotify
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
          {show.description && (
            <p className="text-sm text-muted-foreground mt-2 ml-[52px]">{show.description}</p>
          )}
        </div>

        {embedUrl && (
          <div className="p-4 pb-0">
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

        {embedUrl && <SpotifyControls showId={show.id} spotifyUrl={show.spotifyPlaylistUrl} />}

        {!embedUrl && openUrl && (
          <div className="p-6 text-center">
            <Button className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" asChild data-testid={`button-listen-${show.id}`}>
              <a href={openUrl} target="_blank" rel="noopener noreferrer">
                <Play className="h-4 w-4" />
                Listen on Spotify
              </a>
            </Button>
          </div>
        )}

        {!embedUrl && !openUrl && (
          <div className="p-6 text-center">
            <Button className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" asChild data-testid={`button-listen-${show.id}`}>
              <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer">
                <Play className="h-4 w-4" />
                Listen on Spotify
              </a>
            </Button>
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
  const [shuffleOn, setShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "context" | "track">("off");
  const [isPlaying, setIsPlaying] = useState(false);
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

  const playNowMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/jam-sessions/${session.id}/play-now`),
    onSuccess: () => {
      setIsPlaying(true);
      toast({ title: "Playing on Spotify", description: `Now playing "${session.spotifyName || session.name}" on your Spotify` });
    },
    onError: (err: any) => {
      if (err.message === "NO_ACTIVE_DEVICE") {
        const uri = session.spotifyUri;
        let openUrl = uri;
        if (uri.startsWith("spotify:")) {
          const parts = uri.split(":");
          if (parts.length >= 3) openUrl = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
        }
        const match = openUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
        if (match) {
          toast({ title: "Opening in Spotify", description: "No active Spotify device found. Opening the playlist in Spotify for you — come back and try again once it's playing." });
          window.open(openUrl.split("?")[0], "_blank");
        } else {
          toast({ title: "No Spotify Device", description: "Open Spotify on your phone or computer and start playing first.", variant: "destructive" });
        }
      } else {
        toast({ title: "Playback Failed", description: err.message || "Something went wrong", variant: "destructive" });
      }
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/next"),
    onSuccess: () => toast({ title: "Skipped to next" }),
    onError: () => {},
  });

  const skipPrevMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/previous"),
    onSuccess: () => toast({ title: "Previous track" }),
    onError: () => {},
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/spotify/pause"),
    onSuccess: () => { setIsPlaying(false); toast({ title: "Paused" }); },
    onError: () => {},
  });

  const toggleShuffleMutation = useMutation({
    mutationFn: (state: boolean) => apiRequest("PUT", "/api/spotify/shuffle", { state }),
    onSuccess: (_data, state) => { setShuffleOn(state); toast({ title: state ? "Shuffle ON" : "Shuffle OFF" }); },
    onError: () => toast({ title: "Shuffle failed", variant: "destructive" }),
  });

  const setRepeatMutation = useMutation({
    mutationFn: (state: string) => apiRequest("PUT", "/api/spotify/repeat", { state }),
    onSuccess: (_data, state) => {
      setRepeatMode(state as any);
      const labels: Record<string, string> = { off: "Repeat OFF", context: "Repeat ALL", track: "Repeat ONE" };
      toast({ title: labels[state] || "Repeat updated" });
    },
    onError: () => toast({ title: "Repeat failed", variant: "destructive" }),
  });

  const cycleRepeat = () => {
    const next = repeatMode === "off" ? "context" : repeatMode === "context" ? "track" : "off";
    setRepeatMutation.mutate(next);
  };

  const JamRepeatIcon = repeatMode === "track" ? Repeat1 : Repeat;

  const [nowPlaying, setNowPlaying] = useState<{
    trackName: string; artistName: string; albumArt: string | null;
    progressMs: number; durationMs: number; isActive: boolean;
  } | null>(null);
  const progressRef = useRef<number>(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const { data: playerState } = useQuery<any>({
    queryKey: ["/api/spotify/player"],
    enabled: isPlaying,
    refetchInterval: isPlaying ? 5000 : false,
    staleTime: 3000,
  });

  useEffect(() => {
    if (playerState && playerState.is_playing && playerState.item) {
      const item = playerState.item;
      setNowPlaying({
        trackName: item.name || "Unknown Track",
        artistName: item.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
        albumArt: item.album?.images?.[2]?.url || item.album?.images?.[0]?.url || null,
        progressMs: playerState.progress_ms || 0,
        durationMs: item.duration_ms || 0,
        isActive: true,
      });
      progressRef.current = playerState.progress_ms || 0;
      setDisplayProgress(playerState.progress_ms || 0);
      setIsPlaying(true);
      if (playerState.shuffle_state !== undefined) setShuffleOn(playerState.shuffle_state);
      if (playerState.repeat_state) setRepeatMode(playerState.repeat_state as any);
    } else if (playerState && !playerState.is_playing) {
      setIsPlaying(false);
      if (nowPlaying) {
        setNowPlaying({ ...nowPlaying, isActive: false });
      }
    }
  }, [playerState]);

  useEffect(() => {
    if (!isPlaying || !nowPlaying) return;
    const interval = setInterval(() => {
      progressRef.current = Math.min(progressRef.current + 1000, nowPlaying.durationMs);
      setDisplayProgress(progressRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, nowPlaying?.durationMs]);

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const engageMutation = useMutation({
    mutationFn: (data: { action: string; trackName?: string; trackArtist?: string }) =>
      apiRequest("POST", `/api/jam-sessions/${session.id}/engagement`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
      if (showStats) refetchEngagement();

      if (vars.action === "play") {
        toast({ title: "Played", description: `Play recorded for "${session.name}"` });
      } else if (vars.action === "skip") {
        skipMutation.mutate();
        toast({ title: "Skipped", description: "Skipping to next track on Spotify" });
      } else if (vars.action === "share") {
        // Share handling is done directly in handleShare() before the mutation
      } else if (vars.action === "save") {
        toast({ title: "Saved", description: `"${session.name}" saved to your engagement history` });
      } else if (vars.action === "like") {
        toast({ title: "Liked", description: `You liked "${session.name}"` });
      } else if (vars.action === "add_to_playlist") {
        toast({ title: "Added to Playlist", description: `"${session.name}" engagement recorded` });
      } else {
        toast({ title: "Recorded", description: `Action recorded for "${session.name}"` });
      }
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

  const handleShare = async () => {
    const shareUrl = session.spotifyUri.startsWith("spotify:")
      ? `https://open.spotify.com/${session.spotifyUri.split(":")[1]}/${session.spotifyUri.split(":")[2]}`
      : session.spotifyUri;
    const cleanUrl = shareUrl.split("?")[0];
    const shareText = `Check out "${session.spotifyName || session.name}" on Spotify!`;

    engageMutation.mutate({ action: "share", trackName: session.spotifyName || session.name });

    try {
      if (navigator.share) {
        await navigator.share({ title: session.spotifyName || session.name, text: shareText, url: cleanUrl });
      } else {
        await navigator.clipboard.writeText(`${shareText}\n${cleanUrl}`);
        toast({ title: "Link copied!", description: "Spotify link copied to your clipboard — paste it in a text, email, or DM!" });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${cleanUrl}`);
        toast({ title: "Link copied!", description: "Spotify link copied to your clipboard — paste it in a text, email, or DM!" });
      } catch {
        window.open(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(cleanUrl)}`, "_blank");
      }
    }
  };

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
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap">
            <Button
              size="sm"
              className="gap-1.5 bg-[#1DB954] hover:bg-[#1DB954]/90 text-white border-0 col-span-2"
              onClick={() => playNowMutation.mutate()}
              disabled={playNowMutation.isPending}
              data-testid={`button-play-spotify-${session.id}`}
            >
              <Play className="h-3.5 w-3.5" />
              Play on Spotify
            </Button>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid={`button-join-${session.id}`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Join
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
                className="gap-1.5 col-span-2 sm:ml-auto"
                onClick={() => { setShowStats(!showStats); if (!showStats) refetchEngagement(); }}
                data-testid={`button-stats-${session.id}`}
              >
                <Eye className="h-3.5 w-3.5" />
                {showStats ? "Hide Stats" : "View Stats"}
              </Button>
            )}
          </div>

          <div className="border border-border/30 rounded-lg p-2">
            {nowPlaying && (
              <div className="mb-2 px-2" data-testid={`now-playing-${session.id}`}>
                <div className="flex items-center gap-3">
                  {nowPlaying.albumArt ? (
                    <img src={nowPlaying.albumArt} alt="" className="h-10 w-10 rounded shadow-md flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Music2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" data-testid={`now-playing-track-${session.id}`}>{nowPlaying.trackName}</p>
                    <p className="text-[10px] text-muted-foreground truncate" data-testid={`now-playing-artist-${session.id}`}>{nowPlaying.artistName}</p>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono flex-shrink-0" data-testid={`now-playing-time-${session.id}`}>
                    {formatMs(displayProgress)} / {formatMs(nowPlaying.durationMs)}
                  </div>
                </div>
                <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1DB954] rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${nowPlaying.durationMs > 0 ? Math.min((displayProgress / nowPlaying.durationMs) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 py-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-full ${shuffleOn ? "text-[#1DB954] bg-[#1DB954]/10" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => toggleShuffleMutation.mutate(!shuffleOn)}
                disabled={toggleShuffleMutation.isPending}
                data-testid={`button-jam-shuffle-${session.id}`}
                title={shuffleOn ? "Shuffle ON" : "Shuffle OFF"}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => skipPrevMutation.mutate()}
                disabled={skipPrevMutation.isPending}
                data-testid={`button-jam-previous-${session.id}`}
                title="Previous"
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full bg-white text-black hover:bg-white/90"
                onClick={() => { if (isPlaying) pauseMutation.mutate(); else playNowMutation.mutate(); }}
                disabled={playNowMutation.isPending || pauseMutation.isPending}
                data-testid={`button-jam-playpause-${session.id}`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => { skipMutation.mutate(); engageMutation.mutate({ action: "skip", trackName: session.spotifyName || session.name }); }}
                disabled={skipMutation.isPending}
                data-testid={`button-jam-skip-${session.id}`}
                title="Next"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 rounded-full ${repeatMode !== "off" ? "text-[#1DB954] bg-[#1DB954]/10" : "text-muted-foreground hover:text-foreground"}`}
                onClick={cycleRepeat}
                disabled={setRepeatMutation.isPending}
                data-testid={`button-jam-repeat-${session.id}`}
                title={repeatMode === "off" ? "Repeat OFF" : repeatMode === "context" ? "Repeat ALL" : "Repeat ONE"}
              >
                <JamRepeatIcon className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {repeatMode !== "off" && <span className="text-[#1DB954] font-medium mr-2">{repeatMode === "track" ? "Repeat 1" : "Repeat All"}</span>}
              {shuffleOn && <span className="text-[#1DB954] font-medium mr-2">Shuffle</span>}
              Controls your Spotify app
            </p>
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
                  onClick={() => action === "share" ? handleShare() : engageMutation.mutate({ action, trackName: session.spotifyName || session.name })}
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

function CreateJamSessionForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [spotifyUri, setSpotifyUri] = useState("");
  const [spotifyType, setSpotifyType] = useState("playlist");
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/jam-sessions", {
        name: name.trim(),
        spotifyUri: spotifyUri.trim(),
        spotifyName: name.trim(),
        spotifyType,
        scheduledTime,
        daysOfWeek: selectedDays.join(","),
      }),
    onSuccess: () => {
      toast({ title: "Jam Session Created", description: `"${name}" is now active` });
      setName("");
      setSpotifyUri("");
      setScheduledTime("12:00");
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
      onCreated();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <Card className="border-[#1DB954]/30 bg-[#1DB954]/5">
      <CardContent className="p-4 space-y-4">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#1DB954]" />
          Create a Jam Session
        </h3>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="jam-name" className="text-xs">Session Name</Label>
            <Input
              id="jam-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Friday Night Vibes"
              className="mt-1"
              data-testid="input-jam-name"
            />
          </div>

          <div>
            <Label htmlFor="jam-uri" className="text-xs">Spotify Link or URI</Label>
            <Input
              id="jam-uri"
              value={spotifyUri}
              onChange={e => setSpotifyUri(e.target.value)}
              placeholder="https://open.spotify.com/playlist/... or spotify:playlist:..."
              className="mt-1"
              data-testid="input-jam-uri"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Paste a Spotify track, album, or playlist link</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="jam-type" className="text-xs">Content Type</Label>
              <Select value={spotifyType} onValueChange={setSpotifyType}>
                <SelectTrigger className="mt-1" data-testid="select-jam-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playlist">Playlist</SelectItem>
                  <SelectItem value="album">Album</SelectItem>
                  <SelectItem value="track">Track</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="jam-time" className="text-xs">Scheduled Time</Label>
              <Input
                id="jam-time"
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                className="mt-1"
                data-testid="input-jam-time"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Days Active</Label>
            <div className="flex gap-1 mt-1">
              {DAY_NAMES.map((day, i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant={selectedDays.includes(i) ? "default" : "outline"}
                  className="h-8 w-10 text-xs p-0"
                  onClick={() => toggleDay(i)}
                  data-testid={`button-day-${i}`}
                >
                  {day}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2"
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || !spotifyUri.trim() || selectedDays.length === 0 || createMutation.isPending}
          data-testid="button-create-jam"
        >
          <Plus className="h-4 w-4" />
          {createMutation.isPending ? "Creating..." : "Create Jam Session"}
        </Button>
      </CardContent>
    </Card>
  );
}

function MyJamSessions() {
  const { toast } = useToast();

  const { data: mySessions, isLoading } = useQuery<JamSession[]>({
    queryKey: ["/api/jam-sessions"],
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/jam-sessions/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/jam-sessions/${id}`),
    onSuccess: () => {
      toast({ title: "Deleted", description: "Jam session removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions/active"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!mySessions || mySessions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">Your Jam Sessions</h3>
      {mySessions.map(session => {
        const scheduleDays = session.daysOfWeek ? session.daysOfWeek.split(",").map(d => DAY_NAMES[parseInt(d)]).join(", ") : "Every day";
        return (
          <div key={session.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3" data-testid={`my-session-${session.id}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime12(session.scheduledTime)} · {scheduleDays}
              </p>
            </div>
            <Badge variant={session.isActive ? "default" : "secondary"} className="text-xs">
              {session.isActive ? "Active" : "Inactive"}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => toggleMutation.mutate(session.id)}
              disabled={toggleMutation.isPending}
              data-testid={`button-toggle-${session.id}`}
            >
              <Power className={`h-4 w-4 ${session.isActive ? "text-green-400" : "text-muted-foreground"}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(session.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${session.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function SpotifyConnectionPanel() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: spotifyProfile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/spotify/me"],
    retry: false,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/disconnect"),
    onSuccess: () => {
      toast({ title: "Disconnected", description: "Spotify account disconnected" });
      queryClient.invalidateQueries({ queryKey: ["/api/spotify/me"] });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isConnected = spotifyProfile && !spotifyProfile.error && spotifyProfile.connected;

  if (profileLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!isConnected) {
    return (
      <Card className="border-[#1DB954]/30 mb-6">
        <CardContent className="py-6 text-center">
          <SiSpotify className="h-12 w-12 mx-auto mb-3 text-[#1DB954]" />
          <h3 className="font-bold text-lg mb-1">Spotify Connection Issue</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Your Spotify connection needs to be refreshed. Please log out and log back in to reconnect.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      <Card className="border-[#1DB954]/20 bg-[#1DB954]/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[#1DB954] flex items-center justify-center">
                <SiSpotify className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium" data-testid="text-spotify-name">
                  {spotifyProfile.name || spotifyProfile.display_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {spotifyProfile.product === "premium" || spotifyProfile.isPremium ? "Spotify Premium" : "Spotify Free"} · Connected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-[#1DB954]/30"
                onClick={() => setShowCreate(!showCreate)}
                data-testid="button-toggle-create-jam"
              >
                <Plus className="h-3.5 w-3.5" />
                {showCreate ? "Cancel" : "New Jam Session"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showCreate && <CreateJamSessionForm onCreated={() => setShowCreate(false)} />}

      <MyJamSessions />
    </div>
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
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1DB954]/10 via-[#1DB954]/3 to-transparent" />
        <div className="relative px-6 py-8">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1DB954]/20 to-[#1DB954]/5 flex items-center justify-center">
              <RadioIcon className="h-7 w-7 text-[#1DB954]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight" data-testid="text-radio-title">Radio & Jam Sessions</h1>
              <p className="text-muted-foreground font-medium">Radio shows & live jam sessions — Powered by Spotify</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6">

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

            {user && <SpotifyConnectionPanel />}

            {!user && (
              <Card className="mb-6 border-primary/20">
                <CardContent className="py-6 text-center">
                  <LogIn className="h-10 w-10 mx-auto mb-3 text-primary/50" />
                  <p className="text-sm text-muted-foreground">Sign in to connect Spotify and create jam sessions</p>
                </CardContent>
              </Card>
            )}

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
                    {user ? "Connect your Spotify account above to create your first jam session and start tracking engagement." : "Sign in and connect Spotify to create jam sessions."}
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
