import { useState, useEffect, useRef, useCallback } from "react";
import { SiSpotify } from "react-icons/si";
import { Radio, Globe, Shield, Play, Pause, SkipForward, Volume2, VolumeX, ChevronDown, ChevronUp, Activity, Zap, Lock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import rotation from "@/lib/global-rotation.json";

type RotationAsset = typeof rotation.rotation[number];

interface SpotifyPlayerState {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}

interface HeartbeatLog {
  timestamp: string;
  verified: boolean;
  asset: string;
}

export default function GlobalRadio() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [tunedIn, setTunedIn] = useState(false);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
  const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
  const [verifiedStreaming, setVerifiedStreaming] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const assets = rotation.rotation;
  const currentAsset = assets[currentAssetIndex];

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

  const playMutation = useMutation({
    mutationFn: (asset: RotationAsset) => {
      return apiRequest("POST", "/api/spotify/play", {
        context_uri: asset.spotifyUri,
      });
    },
    onSuccess: () => {
      setTunedIn(true);
      setVerifiedStreaming(true);
      toast({
        title: "GLOBAL RADIO — TUNED IN",
        description: `Streaming ${currentAsset.ticker} via Spotify Premium`,
      });
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("NO_ACTIVE_DEVICE")) {
        toast({
          title: "NO ACTIVE DEVICE",
          description: "Open Spotify on your phone, desktop, or browser first — then try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "STREAMING ERROR",
          description: "Could not start Spotify playback. Ensure Spotify is connected.",
          variant: "destructive",
        });
      }
      setVerifiedStreaming(false);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/spotify/pause"),
    onSuccess: () => {
      setTunedIn(false);
      setVerifiedStreaming(false);
    },
  });

  const skipMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/spotify/next"),
  });

  const pollPlayerState = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/player", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.item) {
        const contextUri = data?.context?.uri || "";
        const contextMatch = contextUri === currentAsset.spotifyUri;
        setPlayerState({
          trackName: data.item.name || "Unknown",
          artistName: data.item.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          albumArt: data.item.album?.images?.[0]?.url || null,
          isPlaying: data.is_playing || false,
          progressMs: data.progress_ms || 0,
          durationMs: data.item.duration_ms || 0,
        });
        setVerifiedStreaming(data.is_playing === true && contextMatch);
      } else {
        setPlayerState(null);
        setVerifiedStreaming(false);
      }
    } catch {
      setVerifiedStreaming(false);
    }
  }, [currentAsset]);

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/player", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const isPlaying = data?.is_playing === true;

      const contextUri = data?.context?.uri || "";
      const contextMatch = contextUri === currentAsset.spotifyUri;
      const verified = isPlaying && contextMatch;

      setVerifiedStreaming(verified);

      if (isPlaying && data?.item) {
        setPlayerState({
          trackName: data.item.name || "Unknown",
          artistName: data.item.artists?.map((a: any) => a.name).join(", ") || "Unknown",
          albumArt: data.item.album?.images?.[0]?.url || null,
          isPlaying: true,
          progressMs: data.progress_ms || 0,
          durationMs: data.item.duration_ms || 0,
        });

        const log: HeartbeatLog = {
          timestamp: new Date().toISOString(),
          verified,
          asset: currentAsset.ticker,
        };
        setHeartbeatLogs(prev => [log, ...prev].slice(0, 10));

        if (verified) {
          fetch("/api/logs/radio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              trackName: data.item.name,
              isrc: `GLBL-${currentAsset.ticker}`,
              showName: "GLOBAL RADIO — VERIFIED STREAMING",
              status: "SPOTIFY_STREAM",
              duration: 30,
              spotifyContext: contextUri,
              spotifyTrackUri: data.item.uri || "",
            }),
          }).catch(() => {});
        }
      } else {
        const log: HeartbeatLog = {
          timestamp: new Date().toISOString(),
          verified: false,
          asset: currentAsset.ticker,
        };
        setHeartbeatLogs(prev => [log, ...prev].slice(0, 10));
      }
    } catch {
      setVerifiedStreaming(false);
    }
  }, [currentAsset]);

  useEffect(() => {
    if (tunedIn) {
      pollPlayerState();
      pollRef.current = setInterval(pollPlayerState, 5000);
      heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      pollRef.current = null;
      heartbeatRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [tunedIn, pollPlayerState, sendHeartbeat]);

  const handleTuneIn = () => {
    if (!spotifyProfile?.connected) {
      toast({
        title: "SPOTIFY NOT CONNECTED",
        description: "Connect your Spotify Premium account from the Radio & Jam page first.",
        variant: "destructive",
      });
      return;
    }
    playMutation.mutate(currentAsset);
  };

  const handlePause = () => {
    pauseMutation.mutate();
  };

  const handleNextAsset = () => {
    const nextIdx = (currentAssetIndex + 1) % assets.length;
    setCurrentAssetIndex(nextIdx);
    if (tunedIn) {
      playMutation.mutate(assets[nextIdx]);
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
      <div
        className="flex items-center justify-between px-4 py-3 bg-amber-500/5 border-b border-amber-500/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        data-testid="global-radio-header"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Globe className="h-6 w-6 text-amber-400" />
            {verifiedStreaming && (
              <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="text-amber-400 font-extrabold text-sm tracking-wide">GLOBAL RADIO</h2>
            <p className="text-[9px] text-amber-500/60">VERIFIED SPOTIFY STREAMING — ROYALTY ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {verifiedStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30" data-testid="verified-streaming-badge">
              <SiSpotify className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[9px] text-green-400 font-extrabold">VERIFIED STREAMING</span>
            </div>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-amber-400" /> : <ChevronDown className="h-4 w-4 text-amber-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {!isConnected ? (
            <div className="text-center py-6 border border-amber-500/10 bg-amber-500/5">
              <Lock className="h-8 w-8 text-amber-400/40 mx-auto mb-2" />
              <p className="text-amber-400 font-extrabold text-sm mb-1">SPOTIFY PREMIUM REQUIRED</p>
              <p className="text-zinc-500 text-[10px] mb-3">Connect your Spotify Premium account from Radio & Jam to unlock Global Streaming</p>
              <a href="/radio" className="inline-block px-4 py-2 border border-amber-500/30 text-amber-400 text-[10px] font-bold hover:bg-amber-500/10 transition-colors" data-testid="link-connect-spotify">
                CONNECT SPOTIFY →
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1">
                {assets.map((asset, i) => (
                  <button
                    key={asset.ticker}
                    onClick={() => {
                      setCurrentAssetIndex(i);
                      if (tunedIn) playMutation.mutate(assets[i]);
                    }}
                    className={`text-center py-2 px-1 border transition-all ${
                      i === currentAssetIndex
                        ? "border-amber-400 bg-amber-500/10 text-amber-400"
                        : "border-zinc-800 hover:border-amber-500/30 text-zinc-500 hover:text-amber-400"
                    }`}
                    data-testid={`button-rotation-asset-${i}`}
                  >
                    <p className="text-[7px] font-extrabold truncate">${asset.ticker}</p>
                    {i === currentAssetIndex && tunedIn && (
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
                    <p className="text-zinc-600 text-[10px]">{tunedIn ? "CONNECTING TO SPOTIFY..." : "PRESS TUNE IN TO START VERIFIED STREAMING"}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {!tunedIn ? (
                    <button
                      onClick={handleTuneIn}
                      disabled={playMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white font-extrabold text-sm transition-colors disabled:opacity-50"
                      data-testid="button-tune-in"
                    >
                      <SiSpotify className="h-5 w-5" />
                      {playMutation.isPending ? "CONNECTING..." : "TUNE IN"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handlePause}
                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 font-extrabold text-sm transition-colors"
                        data-testid="button-pause-stream"
                      >
                        <Pause className="h-4 w-4" /> PAUSE
                      </button>
                      <button
                        onClick={handleNextAsset}
                        className="px-4 py-3 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                        data-testid="button-next-asset"
                      >
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
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
                    <Activity className="h-3 w-3 text-amber-400" />
                    <span className="text-[9px] text-amber-400 font-extrabold">HEARTBEAT LOG</span>
                  </div>
                  <div className="max-h-28 overflow-y-auto">
                    {heartbeatLogs.map((log, i) => (
                      <div key={i} className="px-3 py-1 flex items-center justify-between text-[8px] border-b border-zinc-800/50 last:border-0">
                        <span className="text-zinc-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-zinc-500">{log.asset}</span>
                        <span className={log.verified ? "text-green-400 font-extrabold" : "text-red-400 font-extrabold"}>
                          {log.verified ? "✓ VERIFIED" : "✗ NOT PLAYING"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-2 py-1.5 border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <SiSpotify className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-[9px] text-zinc-500">SPOTIFY PREMIUM</span>
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
