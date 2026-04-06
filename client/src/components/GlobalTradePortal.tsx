import { useState, useEffect, useRef, useCallback } from "react";
import { SiSpotify } from "react-icons/si";
import { Play, Pause, SkipForward, SkipBack, Radio, Volume2, VolumeX, Loader2, ListMusic, Globe, Clock, Repeat } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { GlobalRotation } from "@shared/schema";
import rotation from "@/lib/global-rotation.json";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface WebPlayerState {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function formatSessionTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface GlobalTradePortalProps {
  portalIndex: number;
}

export default function GlobalTradePortal({ portalIndex }: GlobalTradePortalProps) {
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(portalIndex);
  const [tunedIn, setTunedIn] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [playerState, setPlayerState] = useState<WebPlayerState | null>(null);
  const [muted, setMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [autopilot, setAutopilot] = useState(true);
  const playerRef = useRef<any>(null);
  const tokenRef = useRef<string | null>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const { data: dbRotation } = useQuery<GlobalRotation[]>({
    queryKey: ["/api/global-rotation"],
    staleTime: 60000,
  });

  const assets = (dbRotation && dbRotation.length > 0)
    ? dbRotation.map(item => ({
        ticker: item.ticker,
        title: item.title,
        type: item.type,
        spotifyUri: item.spotifyUri || "",
        spotifyUrl: item.spotifyUrl || "",
        coverImage: item.coverImage || "",
        artistName: item.artistName || "",
      }))
    : rotation.rotation;

  const currentAsset = assets[currentIndex % (assets.length || 1)] || assets[0];

  const sessionStartRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scheduleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autopilotRef = useRef(true);
  const assetsRef = useRef(assets);
  const deviceIdRef = useRef<string | null>(null);
  const isAdvancingRef = useRef(false);
  const lastTrackRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  assetsRef.current = assets;
  deviceIdRef.current = deviceId;

  const { data: spotifyProfile } = useQuery<{ connected: boolean; isPremium?: boolean }>({
    queryKey: ["/api/spotify/me"],
    retry: false,
  });

  const logStreamEvent = useCallback((action: string, extra?: { trackName?: string; artistName?: string; ticker?: string; spotifyUri?: string; streamDurationMs?: number }) => {
    const asset = assets[currentIndexRef.current] || assets[0];
    fetch("/api/global-stream/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        trackName: extra?.trackName || asset.title,
        artistName: extra?.artistName || asset.artistName || "",
        ticker: extra?.ticker || asset.ticker,
        spotifyUri: extra?.spotifyUri || asset.spotifyUri,
        portalIndex,
        action,
        streamDurationMs: extra?.streamDurationMs || 0,
        sessionStartedAt: sessionStartRef.current,
      }),
    }).catch(() => {});
  }, [assets, portalIndex]);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/spotify/token", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      tokenRef.current = data.accessToken;
      return data.accessToken;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!spotifyProfile?.connected) return;
    if (window.Spotify) { setSdkReady(true); return; }
    window.onSpotifyWebPlaybackSDKReady = () => setSdkReady(true);
    if (!document.getElementById("spotify-sdk-script")) {
      const script = document.createElement("script");
      script.id = "spotify-sdk-script";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [spotifyProfile?.connected]);

  const initPlayer = useCallback(async () => {
    if (!sdkReady || !window.Spotify) return;
    const token = await fetchToken();
    if (!token) {
      toast({ title: "TOKEN ERROR", description: "Could not retrieve Spotify access token.", variant: "destructive" });
      return;
    }
    if (playerRef.current) playerRef.current.disconnect();

    const player = new window.Spotify.Player({
      name: `AITITRADE Global Portal ${portalIndex + 1}`,
      getOAuthToken: async (cb: (token: string) => void) => {
        const freshToken = await fetchToken();
        cb(freshToken || token);
      },
      volume: 0.5,
    });

    player.addListener("ready", ({ device_id }: { device_id: string }) => setDeviceId(device_id));
    player.addListener("not_ready", () => setDeviceId(null));
    player.addListener("player_state_changed", (state: any) => {
      if (!state) { setPlayerState(null); return; }
      const track = state.track_window?.current_track;
      if (track) {
        const trackName = track.name || "Unknown";
        const artistName = track.artists?.map((a: any) => a.name).join(", ") || "Unknown";
        setPlayerState({
          trackName,
          artistName,
          albumArt: track.album?.images?.[0]?.url || null,
          isPlaying: !state.paused,
          progressMs: state.position || 0,
          durationMs: state.duration || 0,
        });

        if (lastTrackRef.current && lastTrackRef.current !== trackName) {
          const elapsed = Date.now() - streamStartRef.current;
          logStreamEvent("TRACK_COMPLETE", {
            trackName: lastTrackRef.current,
            streamDurationMs: elapsed,
          });
          setSongsPlayed(prev => prev + 1);
          streamStartRef.current = Date.now();
        }
        if (!lastTrackRef.current) {
          streamStartRef.current = Date.now();
        }
        lastTrackRef.current = trackName;
      }
    });

    player.addListener("account_error", () => {
      toast({ title: "PREMIUM REQUIRED", description: "Spotify Premium required for Global Trading.", variant: "destructive" });
    });
    player.addListener("authentication_error", () => {
      toast({ title: "AUTH ERROR", description: "Reconnect Spotify.", variant: "destructive" });
    });

    const connected = await player.connect();
    if (connected) playerRef.current = player;
  }, [sdkReady, fetchToken, toast, portalIndex, logStreamEvent]);

  const startPlayback = useCallback(async (asset: typeof assets[number], devId: string) => {
    const token = tokenRef.current || (await fetchToken());
    if (!token || !devId || !asset.spotifyUri) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ context_uri: asset.spotifyUri }),
    });
  }, [fetchToken]);

  useEffect(() => {
    if (deviceId && !tunedIn) {
      setConnecting(false);
      setTunedIn(true);
      sessionStartRef.current = new Date().toISOString();
      streamStartRef.current = Date.now();
      startPlayback(currentAsset, deviceId);
      logStreamEvent("SESSION_START", { trackName: currentAsset.title });
      toast({ title: "GLOBAL PORTAL LIVE", description: `Now playing: ${currentAsset.title}` });
    }
  }, [deviceId]);

  useEffect(() => {
    if (tunedIn) {
      sessionTimerRef.current = setInterval(() => {
        if (sessionStartRef.current) {
          setSessionTime(Date.now() - new Date(sessionStartRef.current).getTime());
        }
      }, 1000);
    } else {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [tunedIn]);

  useEffect(() => {
    if (tunedIn && playerState?.isPlaying) {
      heartbeatRef.current = setInterval(() => {
        const elapsed = Date.now() - streamStartRef.current;
        logStreamEvent("STREAM_HEARTBEAT", {
          trackName: playerState?.trackName || currentAsset.title,
          artistName: playerState?.artistName || currentAsset.artistName,
          streamDurationMs: elapsed,
        });
      }, 30000);
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    }
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [tunedIn, playerState?.isPlaying, playerState?.trackName, logStreamEvent, currentAsset]);

  const advanceToNextAsset = useCallback(() => {
    if (isAdvancingRef.current || !autopilotRef.current) return;
    isAdvancingRef.current = true;
    const a = assetsRef.current;
    const nextIdx = (currentIndexRef.current + 1) % a.length;
    setCurrentIndex(nextIdx);
    const dev = deviceIdRef.current;
    streamStartRef.current = Date.now();
    lastTrackRef.current = null;
    setSongsPlayed(prev => prev + 1);
    logStreamEvent("AUTO_ADVANCE", { trackName: a[nextIdx]?.title, ticker: a[nextIdx]?.ticker });
    if (dev) startPlayback(a[nextIdx], dev);
    setTimeout(() => { isAdvancingRef.current = false; }, 2000);
  }, [startPlayback, logStreamEvent]);

  useEffect(() => {
    if (tunedIn && autopilot) {
      watchdogRef.current = setInterval(async () => {
        const player = playerRef.current;
        if (!player) return;
        try {
          const state = await player.getCurrentState();
          if (!state) return;
          const pos = state.position || 0;
          const dur = state.duration || 0;
          if (dur > 0 && pos > 0 && dur - pos < 2000 && !state.paused) {
            advanceToNextAsset();
          }
        } catch {}
      }, 1500);
    } else {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
    }
    return () => { if (watchdogRef.current) clearInterval(watchdogRef.current); };
  }, [tunedIn, autopilot, advanceToNextAsset]);

  useEffect(() => {
    if (portalIndex === 0 && tunedIn && deviceId) {
      scheduleCheckRef.current = setInterval(async () => {
        try {
          const res = await fetch("/api/playback-schedules/active", { credentials: "include" });
          if (!res.ok) return;
          const dueSchedules = await res.json();
          if (dueSchedules.length > 0) {
            const sched = dueSchedules[0];
            const matchingAsset = assetsRef.current.find((a: any) => a.spotifyUri === sched.spotifyUri);
            if (matchingAsset) {
              const idx = assetsRef.current.indexOf(matchingAsset);
              setCurrentIndex(idx);
              startPlayback(matchingAsset, deviceId);
              logStreamEvent("SCHEDULED_START", { trackName: sched.playlistTitle || sched.name, spotifyUri: sched.spotifyUri });
              toast({ title: "SCHEDULED PLAYBACK", description: `${sched.name} started on schedule` });
              fetch(`/api/playback-schedules/${sched.id}/triggered`, {
                method: "POST",
                credentials: "include",
              }).catch(() => {});
            } else {
              const token = tokenRef.current;
              if (token && deviceId) {
                await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                  method: "PUT",
                  headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ context_uri: sched.spotifyUri }),
                });
                logStreamEvent("SCHEDULED_START", { trackName: sched.playlistTitle || sched.name, spotifyUri: sched.spotifyUri });
                toast({ title: "SCHEDULED PLAYBACK", description: `${sched.name} started on schedule` });
                fetch(`/api/playback-schedules/${sched.id}/triggered`, {
                  method: "POST",
                  credentials: "include",
                }).catch(() => {});
              }
            }
          }
        } catch {}
      }, 60000);
    }
    return () => { if (scheduleCheckRef.current) clearInterval(scheduleCheckRef.current); };
  }, [portalIndex, tunedIn, deviceId, startPlayback, logStreamEvent, toast]);

  useEffect(() => { return () => { if (playerRef.current) playerRef.current.disconnect(); }; }, []);

  const handleStartTrading = async () => {
    if (!spotifyProfile?.connected) {
      toast({ title: "CONNECT SPOTIFY", description: "Connect Spotify Premium from sidebar to trade globally.", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      if (!playerRef.current) await initPlayer();
    } catch (e) {
      console.error("[GlobalPortal] Init failed:", e);
      setConnecting(false);
    }
  };

  const handleTogglePlay = () => {
    if (playerRef.current) {
      playerRef.current.togglePlay();
      logStreamEvent(playerState?.isPlaying ? "PAUSE" : "RESUME", {
        streamDurationMs: Date.now() - streamStartRef.current,
      });
    }
  };

  const handleNext = () => {
    const elapsed = Date.now() - streamStartRef.current;
    logStreamEvent("SKIP", { streamDurationMs: elapsed });
    const nextIdx = (currentIndex + 1) % assets.length;
    setCurrentIndex(nextIdx);
    streamStartRef.current = Date.now();
    lastTrackRef.current = null;
    setSongsPlayed(prev => prev + 1);
    if (tunedIn && deviceId) startPlayback(assets[nextIdx], deviceId);
    logStreamEvent("PLAY_START", { trackName: assets[nextIdx].title, ticker: assets[nextIdx].ticker });
  };

  const handlePrev = () => {
    const elapsed = Date.now() - streamStartRef.current;
    logStreamEvent("SKIP", { streamDurationMs: elapsed });
    const prevIdx = (currentIndex - 1 + assets.length) % assets.length;
    setCurrentIndex(prevIdx);
    streamStartRef.current = Date.now();
    lastTrackRef.current = null;
    if (tunedIn && deviceId) startPlayback(assets[prevIdx], deviceId);
    logStreamEvent("PLAY_START", { trackName: assets[prevIdx].title, ticker: assets[prevIdx].ticker });
  };

  const handleSelectAsset = (idx: number) => {
    const elapsed = Date.now() - streamStartRef.current;
    logStreamEvent("QUEUE_SELECT", { streamDurationMs: elapsed });
    setCurrentIndex(idx);
    streamStartRef.current = Date.now();
    lastTrackRef.current = null;
    setSongsPlayed(prev => prev + 1);
    if (tunedIn && deviceId) startPlayback(assets[idx], deviceId);
    logStreamEvent("PLAY_START", { trackName: assets[idx].title, ticker: assets[idx].ticker });
    setShowQueue(false);
  };

  const handleMute = () => {
    if (playerRef.current) {
      playerRef.current.setVolume(muted ? 0.5 : 0);
      setMuted(!muted);
    }
  };

  const progressPct = playerState?.durationMs ? (playerState.progressMs / playerState.durationMs) * 100 : 0;

  return (
    <div className="bg-black border border-emerald-500/20 hover:border-emerald-500/60 font-mono overflow-hidden transition-colors" data-testid={`global-trade-portal-${portalIndex}`}>
      <div className="border-b border-emerald-500/10 bg-emerald-500/5 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <SiSpotify className="h-3 w-3 text-green-400 flex-shrink-0" />
          <span className="font-bold text-xs sm:text-sm text-emerald-400 flex-shrink-0">{currentAsset.ticker}</span>
          <span className="text-[7px] sm:text-[9px] text-emerald-500/60 truncate">{currentAsset.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {tunedIn && playerState?.isPlaying ? (
            <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 font-extrabold animate-pulse">LIVE</span>
          ) : (
            <span className="text-[7px] sm:text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400/60 font-bold">GLOBAL</span>
          )}
        </div>
      </div>

      {!tunedIn ? (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1 mb-2 text-center">
            <div className="bg-emerald-950/60 p-1 sm:p-1.5 border border-emerald-500/15">
              <p className="text-[8px] sm:text-[10px] text-emerald-400/70 font-bold">TYPE</p>
              <p className="text-[10px] sm:text-xs text-amber-400 font-extrabold">GLOBAL</p>
            </div>
            <div className="bg-emerald-950/60 p-1 sm:p-1.5 border border-emerald-500/15">
              <p className="text-[8px] sm:text-[10px] text-emerald-400/70 font-bold">SOURCE</p>
              <p className="text-[10px] sm:text-xs text-green-400 font-extrabold">SPOTIFY</p>
            </div>
            <div className="bg-emerald-950/60 p-1 sm:p-1.5 border border-emerald-500/15">
              <p className="text-[8px] sm:text-[10px] text-emerald-400/70 font-bold">ACCESS</p>
              <p className="text-[10px] sm:text-xs text-emerald-300 font-extrabold">PREMIUM</p>
            </div>
          </div>
          <Button
            onClick={handleStartTrading}
            disabled={connecting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] h-8 sm:h-9"
            data-testid={`button-start-global-trading-${portalIndex}`}
          >
            {connecting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> CONNECTING...</>
            ) : (
              <><SiSpotify className="h-3.5 w-3.5 mr-1" /> TUNE IN</>
            )}
          </Button>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded border border-emerald-500/20 bg-zinc-950 flex-shrink-0 overflow-hidden">
              {playerState?.albumArt ? (
                <img src={playerState.albumArt} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Radio className="h-5 w-5 text-emerald-400/30" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-[10px] font-extrabold truncate">
                {playerState?.trackName?.toUpperCase() || currentAsset.title}
              </p>
              <p className="text-emerald-500/60 text-[8px] truncate">
                {playerState?.artistName || currentAsset.artistName || "GLOBAL ASSET"}
              </p>
              <p className="text-emerald-400 text-[7px] font-bold mt-0.5">
                {currentAsset.ticker} • GLOBAL
              </p>
            </div>
          </div>

          <div className="bg-emerald-950 rounded-sm h-1 overflow-hidden">
            <div className="bg-emerald-400 h-full transition-all duration-1000" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-[7px] text-emerald-500/40">
            <span>{formatTime(playerState?.progressMs || 0)}</span>
            <span>{formatTime(playerState?.durationMs || 0)}</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={handlePrev} className="text-emerald-500/60 hover:text-emerald-400 transition-colors" data-testid={`button-global-prev-${portalIndex}`}>
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={handleTogglePlay}
              className="w-9 h-9 rounded-full border border-emerald-500/40 bg-emerald-950/50 flex items-center justify-center text-emerald-400 hover:bg-emerald-900/50 transition-colors"
              data-testid={`button-global-play-${portalIndex}`}
            >
              {playerState?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
            <button onClick={handleNext} className="text-emerald-500/60 hover:text-emerald-400 transition-colors" data-testid={`button-global-next-${portalIndex}`}>
              <SkipForward className="h-4 w-4" />
            </button>
            <button onClick={handleMute} className="text-emerald-500/60 hover:text-emerald-400 transition-colors ml-2">
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => { setAutopilot(!autopilot); autopilotRef.current = !autopilot; }}
              className={`ml-1 transition-colors ${autopilot ? "text-emerald-400" : "text-emerald-500/60 hover:text-emerald-400"}`}
              title={autopilot ? "AUTOPILOT ON — auto-advances to next song" : "AUTOPILOT OFF"}
              data-testid={`button-global-autopilot-${portalIndex}`}
            >
              <Repeat className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowQueue(!showQueue)}
              className={`ml-1 transition-colors ${showQueue ? "text-emerald-400" : "text-emerald-500/60 hover:text-emerald-400"}`}
              data-testid={`button-global-queue-${portalIndex}`}
            >
              <ListMusic className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 py-1 bg-emerald-950/20 border border-emerald-500/10">
            <div className="flex items-center gap-1.5">
              <Clock className="h-2.5 w-2.5 text-emerald-400/60" />
              <span className="text-[7px] text-emerald-400/80 font-bold">{formatSessionTime(sessionTime)}</span>
            </div>
            <span className="text-[7px] text-emerald-500/60">{songsPlayed} PLAYED</span>
            <span className={`text-[7px] font-bold ${autopilot ? "text-emerald-400" : "text-emerald-500/40"}`}>
              {autopilot ? "AUTO ●" : "MANUAL"}
            </span>
          </div>

          {showQueue && (
            <div className="border border-emerald-500/20 bg-zinc-950 max-h-32 overflow-y-auto">
              <p className="text-[8px] text-emerald-400 font-extrabold px-2 py-1 border-b border-emerald-500/10">QUEUE — {assets.length} ASSETS</p>
              {assets.map((asset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectAsset(idx)}
                  className={`w-full text-left px-2 py-1 flex items-center gap-2 text-[8px] hover:bg-emerald-950/50 transition-colors ${idx === currentIndex ? "bg-emerald-950/30 text-emerald-400" : "text-emerald-500/60"}`}
                  data-testid={`queue-item-${portalIndex}-${idx}`}
                >
                  <span className="font-bold w-4">{idx + 1}</span>
                  <span className="truncate flex-1">{asset.title}</span>
                  <span className="text-[7px] opacity-60">{asset.ticker}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-emerald-500/15 px-2 sm:px-3 py-1 flex items-center justify-between bg-emerald-950/30">
        <span className="text-[7px] text-emerald-500/40 font-bold">{currentAsset.ticker} • GLOBAL RADIO</span>
        <span className="text-[7px] text-emerald-400/40 font-bold">97.7 THE FLAME</span>
      </div>
    </div>
  );
}
