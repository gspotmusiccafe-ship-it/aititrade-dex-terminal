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
  morning: { label: "MORNING SLOT", icon: Sunrise, gradient: "from-emerald-500/10 to-emerald-500/5", time: "6 AM - 10 AM" },
  midday: { label: "MID-DAY SLOT", icon: Sun, gradient: "from-emerald-500/10 to-emerald-500/5", time: "10 AM - 2 PM" },
  afternoon: { label: "AFTERNOON SLOT", icon: CloudSun, gradient: "from-emerald-500/10 to-emerald-500/5", time: "2 PM - 6 PM" },
  evening: { label: "EVENING SLOT", icon: Sunset, gradient: "from-emerald-500/10 to-emerald-500/5", time: "6 PM - 10 PM" },
  bedtime: { label: "BEDTIME SLOT", icon: Moon, gradient: "from-emerald-500/10 to-emerald-500/5", time: "10 PM - 6 AM" },
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
    <div className="border-t border-emerald-500/20 bg-black" data-testid={`spotify-controls-${showId}`}>
      <div className="flex items-center justify-center gap-1 py-2 px-4">
        <button
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-1.5 flex items-center transition-colors disabled:opacity-50"
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
          <SiSpotify className="h-3.5 w-3.5 mr-1.5" />
          {isPlaying ? "PAUSE" : "PLAY IN SPOTIFY"}
        </button>
      </div>

      {nowPlaying && (
        <div className="px-4 pb-1" data-testid={`now-playing-show-${showId}`}>
          <div className="flex items-center gap-3">
            {nowPlaying.albumArt ? (
              <img src={nowPlaying.albumArt} alt="" className="h-10 w-10 border border-emerald-500/20 flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Music2 className="h-5 w-5 text-emerald-500/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-400 truncate font-mono" data-testid={`now-playing-show-track-${showId}`}>{nowPlaying.trackName}</p>
              <p className="text-[10px] text-emerald-500/50 truncate font-mono" data-testid={`now-playing-show-artist-${showId}`}>{nowPlaying.artistName}</p>
            </div>
            <div className="text-[10px] text-emerald-500/60 font-mono flex-shrink-0" data-testid={`now-playing-show-time-${showId}`}>
              {formatMs(displayProgress)} / {formatMs(nowPlaying.durationMs)}
            </div>
          </div>
          <div className="mt-1.5 h-1 bg-zinc-900 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
              style={{ width: `${nowPlaying.durationMs > 0 ? Math.min((displayProgress / nowPlaying.durationMs) * 100, 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 py-2 px-4 pb-3">
        <button
          className={`h-8 w-8 flex items-center justify-center transition-colors ${shuffleOn ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-emerald-500/40 hover:text-emerald-400 border border-transparent"}`}
          onClick={() => toggleShuffle.mutate(!shuffleOn)}
          disabled={toggleShuffle.isPending}
          data-testid={`button-shuffle-${showId}`}
          title={shuffleOn ? "Shuffle ON" : "Shuffle OFF"}
        >
          <Shuffle className="h-4 w-4" />
        </button>

        <button
          className="h-8 w-8 flex items-center justify-center text-emerald-500/40 hover:text-emerald-400 transition-colors"
          onClick={() => skipPrev.mutate()}
          disabled={skipPrev.isPending}
          data-testid={`button-previous-${showId}`}
          title="Previous"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          className="h-9 w-9 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          onClick={() => {
            if (isPlaying) pausePlayback.mutate();
            else playInApp.mutate();
          }}
          disabled={playInApp.isPending || pausePlayback.isPending}
          data-testid={`button-playpause-${showId}`}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <button
          className="h-8 w-8 flex items-center justify-center text-emerald-500/40 hover:text-emerald-400 transition-colors"
          onClick={() => skipNext.mutate()}
          disabled={skipNext.isPending}
          data-testid={`button-skip-${showId}`}
          title="Next"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <button
          className={`h-8 w-8 flex items-center justify-center transition-colors ${repeatMode !== "off" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-emerald-500/40 hover:text-emerald-400 border border-transparent"}`}
          onClick={cycleRepeat}
          disabled={setRepeat.isPending}
          data-testid={`button-repeat-${showId}`}
          title={repeatMode === "off" ? "Repeat OFF" : repeatMode === "context" ? "Repeat ALL" : "Repeat ONE"}
        >
          <RepeatIcon className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[9px] text-emerald-500/30 text-center pb-2 font-mono">
        {repeatMode !== "off" && <span className="text-emerald-400 font-bold mr-2">{repeatMode === "track" ? "RPT 1" : "RPT ALL"}</span>}
        {shuffleOn && <span className="text-emerald-400 font-bold mr-2">SHFL</span>}
        SPOTIFY REMOTE
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
    <div className="overflow-hidden border border-emerald-500/20 bg-black hover:border-emerald-500/40 transition-colors font-mono" data-testid={`radio-show-${show.id}`}>
      <div>
        <div className={`p-4 bg-gradient-to-r ${config.gradient}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-emerald-400 truncate" data-testid={`text-show-name-${show.id}`}>{show.name.toUpperCase()}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-emerald-500/60 border border-emerald-500/20 px-1.5 py-0.5">{config.label}</span>
                <span className="text-[9px] text-emerald-500/40">{config.time}</span>
              </div>
            </div>
            <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-1 hover:bg-emerald-500/10 transition-colors" data-testid={`button-open-spotify-${show.id}`}>
              <SiSpotify className="h-3.5 w-3.5" />
              SPOTIFY
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
          {show.description && (
            <p className="text-[10px] text-emerald-500/50 mt-2 ml-[52px]">{show.description}</p>
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
          <div className="p-4 text-center">
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-2 transition-colors" data-testid={`button-listen-${show.id}`}>
              <Play className="h-3.5 w-3.5" />
              STREAM ON SPOTIFY
            </a>
          </div>
        )}

        {!embedUrl && !openUrl && (
          <div className="p-4 text-center">
            <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-4 py-2 transition-colors" data-testid={`button-listen-${show.id}`}>
              <Play className="h-3.5 w-3.5" />
              STREAM ON SPOTIFY
            </a>
          </div>
        )}
      </div>
    </div>
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

  const { data: mintStats } = useQuery<{ totalMints: number; mintCap: number; totalGross: number; assets: { id: string; title: string; mints: number; gross: number }[] }>({
    queryKey: ["/api/mints/total"],
    enabled: showStats,
    refetchInterval: 15000,
    staleTime: 0,
  });

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
    <div className="overflow-hidden border border-emerald-500/20 bg-black hover:border-emerald-500/40 transition-colors font-mono" data-testid={`jam-session-${session.id}`}>
      <div>
        <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-b border-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Headphones className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-emerald-400 truncate" data-testid={`text-jam-name-${session.id}`}>{session.name.toUpperCase()}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {session.spotifyName && (
                  <span className="text-[9px] text-emerald-500/60 border border-emerald-500/20 px-1.5 py-0.5 flex items-center gap-1">
                    <SiSpotify className="h-3 w-3 text-emerald-400" />
                    {session.spotifyName}
                  </span>
                )}
                <span className="text-[9px] text-emerald-500/40 border border-emerald-500/10 px-1.5 py-0.5 uppercase">{session.spotifyType}</span>
                {isOwner && <span className="text-[8px] text-yellow-400 border border-yellow-500/20 bg-yellow-500/5 px-1.5 py-0.5 font-bold">OWNER</span>}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-emerald-500/40">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime12(session.scheduledTime)} · {scheduleDays}
                </span>
                <span className="flex items-center gap-1" data-testid={`text-listeners-${session.id}`}>
                  <Users className="h-3 w-3" />
                  {session.activeListeners} LIVE
                </span>
                <span className="flex items-center gap-1" data-testid={`text-engagements-${session.id}`}>
                  <BarChart3 className="h-3 w-3" />
                  {session.totalEngagements} ACTIONS
                </span>
              </div>
              <p className="text-[9px] text-emerald-500/30 mt-1">HOST: {session.ownerName.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1 sm:flex-wrap">
            <button
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold px-3 py-1.5 flex items-center justify-center col-span-2 transition-colors disabled:opacity-50"
              onClick={() => playNowMutation.mutate()}
              disabled={playNowMutation.isPending}
              data-testid={`button-play-spotify-${session.id}`}
            >
              <Play className="h-3 w-3 mr-1" />
              PLAY ON SPOTIFY
            </button>
            <button
              className="gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-3 py-1.5 flex items-center justify-center hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid={`button-join-${session.id}`}
            >
              <LogIn className="h-3 w-3 mr-1" />
              JOIN
            </button>
            <button
              className="gap-1.5 border border-emerald-500/20 text-emerald-500/50 text-[9px] font-bold px-3 py-1.5 flex items-center justify-center hover:text-emerald-400 transition-colors disabled:opacity-50"
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              data-testid={`button-leave-${session.id}`}
            >
              <LogOut className="h-3 w-3 mr-1" />
              LEAVE
            </button>
            {isOwner && (
              <button
                className="gap-1.5 border border-yellow-500/20 text-yellow-400 text-[9px] font-bold px-3 py-1.5 flex items-center justify-center col-span-2 sm:ml-auto hover:bg-yellow-500/10 transition-colors"
                onClick={() => { setShowStats(!showStats); if (!showStats) refetchEngagement(); }}
                data-testid={`button-stats-${session.id}`}
              >
                <Eye className="h-3 w-3 mr-1" />
                {showStats ? "HIDE STATS" : "VIEW STATS"}
              </button>
            )}
          </div>

          <div className="border border-emerald-500/20 p-2">
            {nowPlaying && (
              <div className="mb-2 px-2" data-testid={`now-playing-${session.id}`}>
                <div className="flex items-center gap-3">
                  {nowPlaying.albumArt ? (
                    <img src={nowPlaying.albumArt} alt="" className="h-10 w-10 border border-emerald-500/20 flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Music2 className="h-5 w-5 text-emerald-500/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-400 truncate" data-testid={`now-playing-track-${session.id}`}>{nowPlaying.trackName}</p>
                    <p className="text-[10px] text-emerald-500/50 truncate" data-testid={`now-playing-artist-${session.id}`}>{nowPlaying.artistName}</p>
                  </div>
                  <div className="text-[10px] text-emerald-500/60 font-mono flex-shrink-0" data-testid={`now-playing-time-${session.id}`}>
                    {formatMs(displayProgress)} / {formatMs(nowPlaying.durationMs)}
                  </div>
                </div>
                <div className="mt-1.5 h-1 bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${nowPlaying.durationMs > 0 ? Math.min((displayProgress / nowPlaying.durationMs) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 py-1">
              <button
                className={`h-8 w-8 flex items-center justify-center transition-colors ${shuffleOn ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-emerald-500/40 hover:text-emerald-400 border border-transparent"}`}
                onClick={() => toggleShuffleMutation.mutate(!shuffleOn)}
                disabled={toggleShuffleMutation.isPending}
                data-testid={`button-jam-shuffle-${session.id}`}
                title={shuffleOn ? "Shuffle ON" : "Shuffle OFF"}
              >
                <Shuffle className="h-4 w-4" />
              </button>
              <button
                className="h-8 w-8 flex items-center justify-center text-emerald-500/40 hover:text-emerald-400 transition-colors"
                onClick={() => skipPrevMutation.mutate()}
                disabled={skipPrevMutation.isPending}
                data-testid={`button-jam-previous-${session.id}`}
                title="Previous"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                className="h-9 w-9 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                onClick={() => { if (isPlaying) pauseMutation.mutate(); else playNowMutation.mutate(); }}
                disabled={playNowMutation.isPending || pauseMutation.isPending}
                data-testid={`button-jam-playpause-${session.id}`}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <button
                className="h-8 w-8 flex items-center justify-center text-emerald-500/40 hover:text-emerald-400 transition-colors"
                onClick={() => { skipMutation.mutate(); engageMutation.mutate({ action: "skip", trackName: session.spotifyName || session.name }); }}
                disabled={skipMutation.isPending}
                data-testid={`button-jam-skip-${session.id}`}
                title="Next"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                className={`h-8 w-8 flex items-center justify-center transition-colors ${repeatMode !== "off" ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-emerald-500/40 hover:text-emerald-400 border border-transparent"}`}
                onClick={cycleRepeat}
                disabled={setRepeatMutation.isPending}
                data-testid={`button-jam-repeat-${session.id}`}
                title={repeatMode === "off" ? "Repeat OFF" : repeatMode === "context" ? "Repeat ALL" : "Repeat ONE"}
              >
                <JamRepeatIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[9px] text-emerald-500/30 text-center">
              {repeatMode !== "off" && <span className="text-emerald-400 font-bold mr-2">{repeatMode === "track" ? "RPT 1" : "RPT ALL"}</span>}
              {shuffleOn && <span className="text-emerald-400 font-bold mr-2">SHFL</span>}
              SPOTIFY REMOTE
            </p>
          </div>

          <div>
            <p className="text-[9px] text-emerald-500/40 mb-2 uppercase">Engagement Actions:</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
              {engagementActions.map(({ action, icon: Icon, label, color }) => (
                <button
                  key={action}
                  className="flex flex-col items-center gap-1 py-2 border border-emerald-500/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-colors disabled:opacity-50"
                  onClick={() => action === "share" ? handleShare() : engageMutation.mutate({ action, trackName: session.spotifyName || session.name })}
                  disabled={engageMutation.isPending}
                  data-testid={`button-engage-${action}-${session.id}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-[8px] text-emerald-500/50">{label.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          {showStats && isOwner && engagementData && (
            <div className="border-t border-emerald-500/20 pt-3 space-y-3">
              <h4 className="font-bold text-xs text-yellow-400 flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                ENGAGEMENT DASHBOARD
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-sm font-bold text-emerald-400" data-testid={`stat-listeners-${session.id}`}>{engagementData.stats.uniqueListeners}</p>
                  <p className="text-[8px] text-emerald-500/40">UNIQUE LISTENERS</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-sm font-bold text-emerald-400" data-testid={`stat-total-${session.id}`}>{engagementData.stats.totalEngagements}</p>
                  <p className="text-[8px] text-emerald-500/40">TOTAL ACTIONS</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-sm font-bold text-emerald-400">{engagementData.stats.actionCounts.play || 0}</p>
                  <p className="text-[8px] text-emerald-500/40">PLAYS</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-sm font-bold text-emerald-400">{engagementData.stats.actionCounts.like || 0}</p>
                  <p className="text-[8px] text-emerald-500/40">LIKES</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {Object.entries(engagementData.stats.actionCounts).map(([action, total]) => (
                  <div key={action} className="flex items-center justify-between bg-zinc-900 border border-emerald-500/10 px-2 py-1">
                    <span className="text-[9px] text-emerald-500/50 capitalize">{action.replace("_", " ")}</span>
                    <span className="text-[9px] text-emerald-400 font-bold">{String(total)}</span>
                  </div>
                ))}
              </div>

              {engagementData.stats.topTracks.length > 0 && (
                <div>
                  <p className="text-[9px] text-emerald-500/40 mb-1 uppercase">Top Played:</p>
                  <div className="space-y-0.5">
                    {engagementData.stats.topTracks.map((track, i) => (
                      <div key={i} className="flex items-center justify-between bg-zinc-900 border border-emerald-500/10 px-2 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[9px] font-bold text-emerald-400 w-3">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-[10px] text-emerald-400 font-bold truncate">{track.trackName || "Unknown"}</p>
                            <p className="text-[8px] text-emerald-500/40 truncate">{track.trackArtist || "Unknown"}</p>
                          </div>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-bold ml-2">{String(track.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {engagementData.listeners.length > 0 && (
                <div>
                  <p className="text-[9px] text-emerald-500/40 mb-1 uppercase">Listeners ({engagementData.listeners.length}):</p>
                  <div className="flex flex-wrap gap-1">
                    {engagementData.listeners.map((listener: any) => (
                      <span key={listener.id} className="text-[9px] border border-emerald-500/20 text-emerald-500/50 px-1.5 py-0.5 flex items-center gap-1">
                        {listener.userName || listener.userEmail || "Anonymous"}
                        {!listener.leftAt && <span className="w-1.5 h-1.5 bg-emerald-400 inline-block" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {showStats && mintStats && (
            <div className="border-t border-emerald-500/20 pt-3 space-y-3">
              <h4 className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                MINT LEDGER — AITITRADE EXCHANGE
              </h4>
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-lg font-black text-emerald-400" data-testid="stat-total-mints">{mintStats.totalMints}</p>
                  <p className="text-[8px] text-emerald-500/40">TOTAL MINTS</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-lg font-black text-yellow-400" data-testid="stat-mint-cap">{mintStats.mintCap}</p>
                  <p className="text-[8px] text-yellow-400/40">MINT CAP</p>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                  <p className="text-lg font-black text-white" data-testid="stat-total-gross">${mintStats.totalGross.toFixed(2)}</p>
                  <p className="text-[8px] text-emerald-500/40">GROSS LEDGER</p>
                </div>
              </div>
              <div className="w-full bg-zinc-900 border border-emerald-500/10 h-4 relative overflow-hidden">
                <div
                  className={`h-full transition-all ${mintStats.totalMints >= mintStats.mintCap * 0.6 ? "bg-yellow-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (mintStats.totalMints / mintStats.mintCap) * 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                  {mintStats.totalMints} / {mintStats.mintCap} MINTED ({((mintStats.totalMints / mintStats.mintCap) * 100).toFixed(1)}%)
                </span>
              </div>
              {mintStats.assets.filter(a => a.mints > 0).length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[9px] text-emerald-500/40 uppercase">Asset Breakdown:</p>
                  {mintStats.assets.filter(a => a.mints > 0).map(asset => (
                    <div key={asset.id} className="flex items-center justify-between bg-zinc-900 border border-emerald-500/10 px-2 py-1">
                      <span className="text-[10px] text-emerald-400 font-bold">${(asset.title || "").replace(/\s+/g, "").toUpperCase().slice(0, 8)}</span>
                      <div className="flex gap-3">
                        <span className="text-[9px] text-emerald-500/50">{asset.mints} MINTS</span>
                        <span className="text-[9px] text-white font-bold">${asset.gross.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
    <div className="border border-emerald-500/30 bg-emerald-500/5 font-mono">
      <div className="p-4 space-y-4">
        <h3 className="font-bold text-xs text-emerald-400 flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" />
          CREATE JAM SESSION
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

        <button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          onClick={() => createMutation.mutate()}
          disabled={!name.trim() || !spotifyUri.trim() || selectedDays.length === 0 || createMutation.isPending}
          data-testid="button-create-jam"
        >
          <Plus className="h-3.5 w-3.5" />
          {createMutation.isPending ? "CREATING..." : "CREATE JAM SESSION"}
        </button>
      </div>
    </div>
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
    <div className="space-y-1 font-mono">
      <h3 className="text-[9px] text-emerald-500/40 uppercase mb-2">Your Jam Sessions</h3>
      {mySessions.map(session => {
        const scheduleDays = session.daysOfWeek ? session.daysOfWeek.split(",").map(d => DAY_NAMES[parseInt(d)]).join(", ") : "Every day";
        return (
          <div key={session.id} className="flex items-center gap-3 bg-zinc-900 border border-emerald-500/10 p-2" data-testid={`my-session-${session.id}`}>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-400 font-bold truncate">{session.name.toUpperCase()}</p>
              <p className="text-[9px] text-emerald-500/40">
                {formatTime12(session.scheduledTime)} · {scheduleDays}
              </p>
            </div>
            <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${session.isActive ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-zinc-500 border-zinc-700"}`}>
              {session.isActive ? "ACTIVE" : "OFF"}
            </span>
            <button
              className="h-7 w-7 flex items-center justify-center hover:bg-emerald-500/10 transition-colors"
              onClick={() => toggleMutation.mutate(session.id)}
              disabled={toggleMutation.isPending}
              data-testid={`button-toggle-${session.id}`}
            >
              <Power className={`h-3.5 w-3.5 ${session.isActive ? "text-emerald-400" : "text-zinc-600"}`} />
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              onClick={() => deleteMutation.mutate(session.id)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${session.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
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
      <div className="border border-emerald-500/20 bg-black mb-6 font-mono">
        <div className="py-6 text-center">
          <SiSpotify className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
          <h3 className="font-bold text-xs text-emerald-400 mb-1">SPOTIFY CONNECTION REQUIRED</h3>
          <p className="text-[10px] text-emerald-500/50 mb-4 max-w-md mx-auto">
            CONNECTION EXPIRED — LOG OUT AND RE-AUTHENTICATE TO REFRESH
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6 font-mono">
      <div className="border border-emerald-500/20 bg-emerald-500/5">
        <div className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-emerald-600 flex items-center justify-center">
                <SiSpotify className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400" data-testid="text-spotify-name">
                  {(spotifyProfile.name || spotifyProfile.display_name || "").toUpperCase()}
                </p>
                <p className="text-[9px] text-emerald-500/40">
                  {spotifyProfile.product === "premium" || spotifyProfile.isPremium ? "PREMIUM" : "FREE"} · CONNECTED
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="gap-1.5 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-3 py-1.5 flex items-center hover:bg-emerald-500/10 transition-colors"
                onClick={() => setShowCreate(!showCreate)}
                data-testid="button-toggle-create-jam"
              >
                <Plus className="h-3 w-3 mr-1" />
                {showCreate ? "CANCEL" : "NEW SESSION"}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    <div className="min-h-full pb-28 bg-black">
      <div className="relative overflow-hidden mb-0 border-b border-emerald-500/20">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
        <div className="relative px-6 py-6">
          <div className="max-w-4xl mx-auto flex items-center gap-3 font-mono">
            <div className="h-10 w-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <RadioIcon className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-400" data-testid="text-radio-title">AITITRADE GLOBAL TRADING</h1>
              <p className="text-[10px] text-emerald-500/50">&gt; LIVE TRADING TERMINAL — RADIO SHOWS & SESSION CONTROL</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 font-mono">

        <div className="flex gap-1 mt-4 mb-4 border-b border-emerald-500/10 pb-2">
          <Tabs defaultValue="shows" className="w-full">
          <div className="flex gap-1 mb-4">
            <TabsList className="bg-transparent border-0 p-0 gap-1">
              <TabsTrigger value="shows" data-testid="tab-shows" className="gap-1.5 bg-transparent border border-emerald-500/20 text-emerald-500/50 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 text-[10px] font-bold px-3 py-1.5 rounded-none">
                <Music className="h-3.5 w-3.5" />
                RADIO SHOWS
                {shows && shows.length > 0 && <span className="ml-1 text-[9px] text-emerald-400">[{shows.length}]</span>}
              </TabsTrigger>
              <TabsTrigger value="jams" data-testid="tab-jams" className="gap-1.5 bg-transparent border border-emerald-500/20 text-emerald-500/50 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/40 text-[10px] font-bold px-3 py-1.5 rounded-none">
                <Headphones className="h-3.5 w-3.5" />
                JAM SESSIONS
                {activeSessions && activeSessions.length > 0 && <span className="ml-1 text-[9px] text-emerald-400">[{activeSessions.length}]</span>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="shows">
            <div className="flex items-center gap-2 mb-4">
              <SiSpotify className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-500/40">
                SELECT SHOW TO STREAM VIA SPOTIFY REMOTE
              </span>
            </div>

            {shows && shows.length > 0 ? (
              <div className="space-y-3">
                {shows.map((show) => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            ) : (
              <div className="border border-emerald-500/20 bg-black">
                <div className="py-12 text-center">
                  <Music className="h-12 w-12 mx-auto mb-3 text-emerald-500/20" />
                  <h2 className="text-sm font-bold text-emerald-400 mb-1">NO SHOWS SCHEDULED</h2>
                  <p className="text-[10px] text-emerald-500/40 max-w-md mx-auto">
                    RADIO SHOWS PENDING — CHECK BACK FOR MORNING, MID-DAY, AFTERNOON, EVENING, AND BEDTIME SLOTS
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="jams">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-500/40">
                JOIN SESSION — TRACK ENGAGEMENT — SPOTIFY REMOTE CONTROLS
              </span>
            </div>

            {user && <SpotifyConnectionPanel />}

            {!user && (
              <div className="mb-4 border border-emerald-500/20 bg-black">
                <div className="py-4 text-center">
                  <LogIn className="h-8 w-8 mx-auto mb-2 text-emerald-500/30" />
                  <p className="text-[10px] text-emerald-500/40">AUTHENTICATE TO CREATE JAM SESSIONS</p>
                </div>
              </div>
            )}

            <div className="mb-4 border border-emerald-500/10 bg-emerald-500/5 px-3 py-2">
              <p className="text-[10px] text-emerald-500/50">
                <span className="text-emerald-400 font-bold">PROTOCOL:</span> Join session → Use action buttons (Play, Like, Save, Share, Skip, Add to Playlist) → Session owners view engagement dashboard with full analytics.
              </p>
            </div>

            {activeSessions && activeSessions.length > 0 ? (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <JamSessionCard key={session.id} session={session} userId={user?.id || ""} />
                ))}
              </div>
            ) : (
              <div className="border border-emerald-500/20 bg-black">
                <div className="py-12 text-center">
                  <Headphones className="h-12 w-12 mx-auto mb-3 text-emerald-500/20" />
                  <h2 className="text-sm font-bold text-emerald-400 mb-1">NO ACTIVE SESSIONS</h2>
                  <p className="text-[10px] text-emerald-500/40 max-w-md mx-auto">
                    {user ? "CONNECT SPOTIFY ABOVE TO CREATE YOUR FIRST JAM SESSION" : "AUTHENTICATE AND CONNECT SPOTIFY TO CREATE SESSIONS"}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
