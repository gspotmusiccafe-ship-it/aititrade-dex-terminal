import { useState, useEffect, useRef, useCallback } from "react";
import { SiSpotify } from "react-icons/si";
import { Globe, Pause, SkipForward, ChevronDown, ChevronUp, Activity, Zap, Lock, Volume2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import rotation from "@/lib/global-rotation.json";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

interface HeartbeatLog {
  timestamp: string;
  verified: boolean;
  asset: string;
}

interface WebPlayerState {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  contextUri: string;
}

export default function GlobalRadio() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [tunedIn, setTunedIn] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [playerState, setPlayerState] = useState<WebPlayerState | null>(null);
  const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
  const [verifiedStreaming, setVerifiedStreaming] = useState(false);
  const [volume, setVolume] = useState(0.5);

  const playerRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);

  const assets = rotation.rotation;
  const currentAsset = assets[currentAssetIndex];
  const currentAssetRef = useRef(currentAsset);
  currentAssetRef.current = currentAsset;

  const { data: spotifyProfile } = useQuery<{ connected: boolean; isPremium?: boolean }>({
    queryKey: ["/api/spotify/me"],
    retry: false,
  });

  const { data: royaltyPool } = useQuery<{
    trustVaultRate: string;
    trustVaultAmount: number;
    currentTrustValuation: number;
  }>({
    queryKey: ["/api/royalty-pool"],
  });

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

    if (window.Spotify) {
      setSdkReady(true);
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      setSdkReady(true);
    };

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
      toast({
        title: "TOKEN ERROR",
        description: "Could not retrieve Spotify access token. Reconnect Spotify from Radio & Jam.",
        variant: "destructive",
      });
      return;
    }

    if (playerRef.current) {
      playerRef.current.disconnect();
    }

    const player = new window.Spotify.Player({
      name: "AITIFY Global Radio",
      getOAuthToken: async (cb: (token: string) => void) => {
        const freshToken = await fetchToken();
        cb(freshToken || token);
      },
      volume: volume,
    });

    player.addListener("ready", ({ device_id }: { device_id: string }) => {
      setDeviceId(device_id);
    });

    player.addListener("not_ready", () => {
      setDeviceId(null);
    });

    player.addListener("player_state_changed", (state: any) => {
      if (!state) {
        setPlayerState(null);
        setVerifiedStreaming(false);
        return;
      }
      const track = state.track_window?.current_track;
      const contextUri = state.context?.uri || "";
      const isPlaying = !state.paused;

      if (track) {
        setPlayerState({
          trackName: track.name || "Unknown",
          artistName: track.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          albumArt: track.album?.images?.[0]?.url || null,
          isPlaying,
          progressMs: state.position || 0,
          durationMs: state.duration || 0,
          contextUri,
        });
      }

      const asset = currentAssetRef.current;
      const contextMatch = contextUri === asset.spotifyUri;
      setVerifiedStreaming(isPlaying && contextMatch);
    });

    player.addListener("initialization_error", ({ message }: { message: string }) => {
      console.error("[GlobalRadio] Init error:", message);
    });

    player.addListener("authentication_error", ({ message }: { message: string }) => {
      console.error("[GlobalRadio] Auth error:", message);
      toast({ title: "SPOTIFY AUTH ERROR", description: "Token expired. Please reconnect Spotify.", variant: "destructive" });
    });

    player.addListener("account_error", ({ message }: { message: string }) => {
      console.error("[GlobalRadio] Account error:", message);
      toast({ title: "SPOTIFY PREMIUM REQUIRED", description: "Web Playback SDK requires a Spotify Premium account.", variant: "destructive" });
    });

    const connected = await player.connect();
    if (connected) {
      playerRef.current = player;
    } else {
      toast({ title: "SDK CONNECTION FAILED", description: "Could not connect Spotify Web Playback SDK.", variant: "destructive" });
    }

    return player;
  }, [sdkReady, fetchToken, toast, volume]);

  const startPlayback = useCallback(async (asset: typeof assets[number], devId: string) => {
    const token = tokenRef.current || (await fetchToken());
    if (!token || !devId) return;

    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context_uri: asset.spotifyUri }),
    });

    if (!res.ok && res.status !== 204) {
      const errText = await res.text().catch(() => "");
      console.error("[GlobalRadio] Play error:", res.status, errText);
      if (res.status === 403) {
        toast({ title: "PREMIUM REQUIRED", description: "Spotify Premium is required for Web Playback.", variant: "destructive" });
      } else if (res.status === 401) {
        tokenRef.current = null;
        const newToken = await fetchToken();
        if (newToken) {
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${newToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ context_uri: asset.spotifyUri }),
          });
        }
      }
    }
  }, [fetchToken, toast]);

  const sendHeartbeat = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    try {
      const state = await player.getCurrentState();
      if (!state) {
        setVerifiedStreaming(false);
        setHeartbeatLogs(prev => [{
          timestamp: new Date().toISOString(),
          verified: false,
          asset: currentAssetRef.current.ticker,
        }, ...prev].slice(0, 10));
        return;
      }

      const isPlaying = !state.paused;
      const contextUri = state.context?.uri || "";
      const asset = currentAssetRef.current;
      const contextMatch = contextUri === asset.spotifyUri;
      const verified = isPlaying && contextMatch;

      setVerifiedStreaming(verified);

      const track = state.track_window?.current_track;
      const log: HeartbeatLog = {
        timestamp: new Date().toISOString(),
        verified,
        asset: asset.ticker,
      };
      setHeartbeatLogs(prev => [log, ...prev].slice(0, 10));

      if (verified && track) {
        fetch("/api/logs/radio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            trackName: track.name,
            isrc: `GLBL-${asset.ticker}`,
            showName: "GLOBAL RADIO — SPOTIFY VERIFIED STREAMING",
            status: "SPOTIFY_STREAM",
            duration: 30,
            spotifyContext: contextUri,
            spotifyTrackUri: track.uri || "",
          }),
        }).catch(() => {});
      }
    } catch {
      setVerifiedStreaming(false);
    }
  }, []);

  useEffect(() => {
    if (tunedIn) {
      heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [tunedIn, sendHeartbeat]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, []);

  const handleTuneIn = async () => {
    if (!spotifyProfile?.connected) {
      toast({
        title: "SPOTIFY NOT CONNECTED",
        description: "Connect your Spotify Premium account from the Radio & Jam page first.",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);

    try {
      if (!playerRef.current || !deviceId) {
        await initPlayer();
        let attempts = 0;
        const waitForDevice = (): Promise<string> => new Promise((resolve, reject) => {
          const check = setInterval(() => {
            attempts++;
            const el = document.querySelector("[data-device-id]");
            const devId = el?.getAttribute("data-device-id");
            if (devId) { clearInterval(check); resolve(devId); }
            if (attempts > 30) { clearInterval(check); reject(new Error("timeout")); }
          }, 200);
        });

        await new Promise<void>((resolve) => {
          const checkDevId = setInterval(() => {
            if (deviceId) { clearInterval(checkDevId); resolve(); }
          }, 200);
          setTimeout(() => { clearInterval(checkDevId); resolve(); }, 8000);
        });
      }
    } catch (e) {
      console.error("[GlobalRadio] Init failed:", e);
    }

    setConnecting(false);
  };

  useEffect(() => {
    if (deviceId && connecting) {
      setConnecting(false);
      setTunedIn(true);
      startPlayback(currentAsset, deviceId);
      toast({
        title: "GLOBAL RADIO — TUNED IN",
        description: `Streaming ${currentAsset.ticker} via Spotify Web Playback SDK`,
      });
    }
  }, [deviceId]);

  const handlePause = () => {
    if (playerRef.current) {
      playerRef.current.togglePlay();
    }
  };

  const handleNextAsset = (idx?: number) => {
    const nextIdx = idx !== undefined ? idx : (currentAssetIndex + 1) % assets.length;
    setCurrentAssetIndex(nextIdx);
    if (tunedIn && deviceId) {
      startPlayback(assets[nextIdx], deviceId);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (playerRef.current) {
      playerRef.current.setVolume(val);
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const isConnected = spotifyProfile?.connected;

  return (
    <div className="bg-black border-2 border-amber-500/40 font-mono" data-testid="global-radio-container">
      {deviceId && <span data-device-id={deviceId} className="hidden" />}

      <div
        className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border-b border-amber-500/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid="global-radio-header"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <SiSpotify className="h-6 w-6 text-green-500" />
            {verifiedStreaming && (
              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="text-amber-400 font-extrabold text-sm tracking-wide">GLOBAL RADIO</h2>
            <p className="text-[9px] text-green-400/80">SPOTIFY VERIFIED STREAMING — ROYALTY ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {verifiedStreaming ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30" data-testid="verified-streaming-badge">
              <SiSpotify className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[9px] text-green-400 font-extrabold">SPOTIFY VERIFIED STREAMING</span>
            </div>
          ) : tunedIn ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30">
              <SiSpotify className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[9px] text-amber-400 font-extrabold">SDK CONNECTED</span>
            </div>
          ) : null}
          {expanded ? <ChevronUp className="h-4 w-4 text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {!isConnected ? (
            <div className="text-center py-6 border border-amber-500/10 bg-amber-500/5">
              <Lock className="h-8 w-8 text-amber-400/40 mx-auto mb-2" />
              <p className="text-amber-400 font-extrabold text-sm mb-1">SPOTIFY PREMIUM REQUIRED</p>
              <p className="text-zinc-500 text-[10px] mb-3">Connect your Spotify Premium account from Radio & Jam to unlock Verified Streaming</p>
              <a href="/radio" className="inline-block px-4 py-2 border border-green-500/30 text-green-400 text-[10px] font-bold hover:bg-green-500/10 transition-colors" data-testid="link-connect-spotify">
                <SiSpotify className="inline h-3 w-3 mr-1" /> CONNECT SPOTIFY →
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1">
                {assets.map((asset, i) => (
                  <button
                    key={asset.ticker}
                    onClick={() => handleNextAsset(i)}
                    className={`text-center py-2 px-1 border transition-all ${
                      i === currentAssetIndex
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-zinc-800 hover:border-amber-500/30 text-zinc-500 hover:text-amber-400"
                    }`}
                    data-testid={`button-rotation-asset-${i}`}
                  >
                    <p className="text-[7px] font-extrabold truncate">${asset.ticker}</p>
                    {i === currentAssetIndex && verifiedStreaming && (
                      <Activity className="h-2.5 w-2.5 text-green-400 mx-auto mt-0.5 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              <div className="border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-extrabold text-lg">${currentAsset.ticker}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold flex items-center gap-0.5">
                      <Globe className="h-2.5 w-2.5" /> GLOBAL
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-500">{currentAsset.title}</span>
                </div>

                {playerState && tunedIn ? (
                  <div className="flex items-center gap-3 mb-3">
                    {playerState.albumArt && (
                      <img src={playerState.albumArt} alt="" className="h-12 w-12 border border-amber-500/20" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{playerState.trackName}</p>
                      <p className="text-zinc-500 text-[10px] truncate">{playerState.artistName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-zinc-600">{formatMs(playerState.progressMs)}</span>
                        <div className="flex-1 h-1 bg-zinc-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${playerState.durationMs ? (playerState.progressMs / playerState.durationMs) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-zinc-600">{formatMs(playerState.durationMs)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 py-2 text-center">
                    <p className="text-zinc-600 text-[10px]">
                      {connecting ? "INITIALIZING SPOTIFY WEB PLAYBACK SDK..." : "PRESS TUNE IN TO START SPOTIFY VERIFIED STREAMING"}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {!tunedIn ? (
                    <button
                      onClick={handleTuneIn}
                      disabled={connecting}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm transition-colors disabled:opacity-50"
                      data-testid="button-tune-in"
                    >
                      <SiSpotify className="h-5 w-5" />
                      {connecting ? "CONNECTING SDK..." : "TUNE IN"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePause}
                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-extrabold text-sm transition-colors"
                        data-testid="button-pause-stream"
                      >
                        <Pause className="h-4 w-4" /> {playerState?.isPlaying ? "PAUSE" : "RESUME"}
                      </button>
                      <button
                        onClick={() => handleNextAsset()}
                        className="px-4 py-3 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                        data-testid="button-next-asset"
                      >
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>

                {tunedIn && (
                  <div className="flex items-center gap-2 mt-2">
                    <Volume2 className="h-3 w-3 text-zinc-500" />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="flex-1 h-1 accent-green-500"
                      data-testid="input-volume"
                    />
                    <span className="text-[9px] text-zinc-500 w-8 text-right">{Math.round(volume * 100)}%</span>
                  </div>
                )}
              </div>

              {royaltyPool && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
                    <p className="text-[8px] text-zinc-500">VAULT RATE</p>
                    <p className="text-xs font-extrabold text-amber-400">{royaltyPool.trustVaultRate}</p>
                  </div>
                  <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
                    <p className="text-[8px] text-zinc-500">TRUST VAULT</p>
                    <p className="text-xs font-extrabold text-lime-400">${royaltyPool.trustVaultAmount.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
                    <p className="text-[8px] text-zinc-500">VALUATION</p>
                    <p className="text-xs font-extrabold text-amber-400">${royaltyPool.currentTrustValuation.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {heartbeatLogs.length > 0 && (
                <div className="border border-zinc-800 bg-zinc-900/50">
                  <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center gap-2">
                    <Activity className="h-3 w-3 text-green-400" />
                    <span className="text-[9px] text-green-400 font-extrabold">HEARTBEAT SYNC — 30s VERIFICATION</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto">
                    {heartbeatLogs.map((log, i) => (
                      <div key={i} className="px-3 py-1 flex items-center justify-between text-[8px] border-b border-zinc-800/50 last:border-0">
                        <span className="text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-zinc-500">{log.asset}</span>
                        <span className={log.verified ? "text-green-400 font-extrabold" : "text-red-400 font-extrabold"}>
                          {log.verified ? "✓ VERIFIED" : "✗ CONTEXT MISMATCH"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-2 py-1.5 border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-2">
                  <SiSpotify className="h-4 w-4 text-green-500" />
                  <span className="text-[9px] text-green-400 font-extrabold">WEB PLAYBACK SDK</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-amber-400" />
                  <span className="text-[9px] text-amber-400 font-extrabold">18-50% ROYALTY CREDIT</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
