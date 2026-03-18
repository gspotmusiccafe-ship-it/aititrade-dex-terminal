import { useState, useEffect, useRef, useCallback } from "react";
import { SiSpotify } from "react-icons/si";
import { Pause, Play, SkipForward, SkipBack, Activity, Zap, Lock, Volume2, VolumeX, Radio, Music } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { TrackWithArtist, GlobalRotation } from "@shared/schema";
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

function VUMeter({ level, label }: { level: number; label: string }) {
  const bars = 12;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-[2px] h-16 items-end">
        {Array.from({ length: bars }).map((_, i) => {
          const threshold = (i / bars) * 100;
          const active = level > threshold;
          const color = i >= 10 ? "bg-red-500" : i >= 7 ? "bg-amber-400" : "bg-lime-400";
          return (
            <div
              key={i}
              className={`w-[5px] transition-all duration-100 ${active ? color : "bg-zinc-800"}`}
              style={{ height: `${((i + 1) / bars) * 100}%`, opacity: active ? 1 : 0.3 }}
            />
          );
        })}
      </div>
      <span className="text-[7px] text-zinc-600 font-extrabold tracking-wider">{label}</span>
    </div>
  );
}

function Turntable({ isActive, isPlaying, albumArt, deckLabel, trackName, artistName, ticker }: {
  isActive: boolean;
  isPlaying: boolean;
  albumArt: string | null;
  deckLabel: string;
  trackName: string;
  artistName: string;
  ticker: string;
}) {
  return (
    <div className={`flex-1 border ${isActive ? "border-lime-500/40" : "border-zinc-800"} bg-zinc-950 p-3 relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[9px] font-extrabold tracking-widest ${isActive ? "text-lime-400" : "text-zinc-600"}`}>{deckLabel}</span>
        {isActive && isPlaying && (
          <span className="text-[7px] font-extrabold text-red-400 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />ON AIR
          </span>
        )}
      </div>

      <div className="flex items-center justify-center mb-3">
        <div className={`relative w-28 h-28 rounded-full border-2 ${isActive ? "border-lime-500/30" : "border-zinc-800"} bg-black flex items-center justify-center overflow-hidden`}>
          <div className={`absolute inset-0 rounded-full ${isActive && isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }}>
            {albumArt ? (
              <img src={albumArt} alt="" className="w-full h-full object-cover rounded-full opacity-60" />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-900 to-black" />
            )}
            <div className="absolute inset-0 rounded-full" style={{
              background: "repeating-radial-gradient(circle, transparent 0px, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 4px)"
            }} />
          </div>
          <div className="absolute w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 z-10 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-lime-400/60" />
          </div>
          {isActive && (
            <div className="absolute -right-1 top-8 w-10 h-[2px] bg-zinc-600 origin-left rotate-[30deg] z-20">
              <div className="absolute right-0 -top-[3px] w-2 h-2 bg-zinc-500 rounded-full" />
            </div>
          )}
        </div>
      </div>

      <div className="text-center min-h-[32px]">
        {trackName ? (
          <>
            <p className="text-[10px] font-extrabold text-white truncate">{trackName.toUpperCase()}</p>
            <p className="text-[8px] text-zinc-500 truncate">{artistName}</p>
          </>
        ) : (
          <p className={`text-[10px] ${isActive ? "text-lime-400/50" : "text-zinc-700"}`}>{ticker}</p>
        )}
      </div>
    </div>
  );
}

export default function GlobalRadio() {
  const { toast } = useToast();
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
  const [tunedIn, setTunedIn] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [playerState, setPlayerState] = useState<WebPlayerState | null>(null);
  const [heartbeatLogs, setHeartbeatLogs] = useState<HeartbeatLog[]>([]);
  const [verifiedStreaming, setVerifiedStreaming] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [crossfade, setCrossfade] = useState(50);
  const [vuLeft, setVuLeft] = useState(0);
  const [vuRight, setVuRight] = useState(0);
  const playerRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const vuIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        audioUrl: item.audioUrl || "",
        coverImage: item.coverImage || "",
        artistName: item.artistName || "",
      }))
    : rotation.rotation;
  const currentAsset = assets[currentAssetIndex % assets.length] || assets[0];
  const nextAssetIndex = (currentAssetIndex + 1) % assets.length;
  const nextAsset = assets[nextAssetIndex];
  const currentAssetRef = useRef(currentAsset);
  currentAssetRef.current = currentAsset;

  const { data: featuredTracks } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/featured"],
    staleTime: 60000,
  });

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

  useEffect(() => {
    if (tunedIn && playerState?.isPlaying) {
      vuIntervalRef.current = setInterval(() => {
        const base = 40 + Math.random() * 35;
        const leftBias = crossfade <= 50 ? 1 : 1 - (crossfade - 50) / 50 * 0.6;
        const rightBias = crossfade >= 50 ? 1 : 1 - (50 - crossfade) / 50 * 0.6;
        setVuLeft(Math.min(100, base * leftBias + Math.random() * 15));
        setVuRight(Math.min(100, base * rightBias + Math.random() * 15));
      }, 120);
    } else {
      if (vuIntervalRef.current) clearInterval(vuIntervalRef.current);
      setVuLeft(0);
      setVuRight(0);
    }
    return () => { if (vuIntervalRef.current) clearInterval(vuIntervalRef.current); };
  }, [tunedIn, playerState?.isPlaying, crossfade]);

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
      name: "AITIFY Global Radio",
      getOAuthToken: async (cb: (token: string) => void) => {
        const freshToken = await fetchToken();
        cb(freshToken || token);
      },
      volume: volume,
    });

    player.addListener("ready", ({ device_id }: { device_id: string }) => setDeviceId(device_id));
    player.addListener("not_ready", () => setDeviceId(null));
    player.addListener("player_state_changed", (state: any) => {
      if (!state) { setPlayerState(null); setVerifiedStreaming(false); return; }
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
      setVerifiedStreaming(isPlaying && contextUri === asset.spotifyUri);
    });

    player.addListener("initialization_error", ({ message }: { message: string }) => console.error("[GlobalRadio] Init error:", message));
    player.addListener("authentication_error", ({ message }: { message: string }) => {
      console.error("[GlobalRadio] Auth error:", message);
      toast({ title: "SPOTIFY AUTH ERROR", description: "Token expired. Reconnect Spotify.", variant: "destructive" });
    });
    player.addListener("account_error", ({ message }: { message: string }) => {
      console.error("[GlobalRadio] Account error:", message);
      toast({ title: "SPOTIFY PREMIUM REQUIRED", description: "Web Playback SDK requires Spotify Premium.", variant: "destructive" });
    });

    const connected = await player.connect();
    if (connected) playerRef.current = player;
    else toast({ title: "SDK CONNECTION FAILED", description: "Could not connect Spotify Web Playback SDK.", variant: "destructive" });
    return player;
  }, [sdkReady, fetchToken, toast, volume]);

  const startPlayback = useCallback(async (asset: typeof assets[number], devId: string) => {
    const token = tokenRef.current || (await fetchToken());
    if (!token || !devId) return;
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devId}`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ context_uri: asset.spotifyUri }),
    });
    if (!res.ok && res.status !== 204) {
      if (res.status === 403) toast({ title: "PREMIUM REQUIRED", description: "Spotify Premium required for Web Playback.", variant: "destructive" });
      else if (res.status === 401) {
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
        setHeartbeatLogs(prev => [{ timestamp: new Date().toISOString(), verified: false, asset: currentAssetRef.current.ticker }, ...prev].slice(0, 10));
        return;
      }
      const isPlaying = !state.paused;
      const contextUri = state.context?.uri || "";
      const asset = currentAssetRef.current;
      const verified = isPlaying && contextUri === asset.spotifyUri;
      setVerifiedStreaming(verified);
      const track = state.track_window?.current_track;
      setHeartbeatLogs(prev => [{ timestamp: new Date().toISOString(), verified, asset: asset.ticker }, ...prev].slice(0, 10));
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
    if (tunedIn) heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    else { if (heartbeatRef.current) clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [tunedIn, sendHeartbeat]);

  useEffect(() => { return () => { if (playerRef.current) playerRef.current.disconnect(); }; }, []);

  const handleTuneIn = async () => {
    if (!spotifyProfile?.connected) {
      toast({ title: "SPOTIFY NOT CONNECTED", description: "Connect Spotify Premium from Radio & Jam first.", variant: "destructive" });
      return;
    }
    setConnecting(true);
    try {
      if (!playerRef.current) {
        await initPlayer();
      }
    } catch (e) { console.error("[GlobalRadio] Init failed:", e); }
  };

  useEffect(() => {
    if (deviceId && !tunedIn) {
      setConnecting(false);
      setTunedIn(true);
      startPlayback(currentAsset, deviceId);
      toast({ title: "GLOBAL RADIO — ON AIR", description: `Deck A loaded: ${currentAsset.ticker}` });
    }
  }, [deviceId]);

  const handlePause = () => { if (playerRef.current) playerRef.current.togglePlay(); };

  const handleNextAsset = (idx?: number) => {
    const nextIdx = idx !== undefined ? idx : (currentAssetIndex + 1) % assets.length;
    setCurrentAssetIndex(nextIdx);
    if (tunedIn && deviceId) startPlayback(assets[nextIdx], deviceId);
  };

  const handleVolumeChange = (val: number) => {
    setVolumeState(val);
    if (playerRef.current) playerRef.current.setVolume(val);
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const isConnected = spotifyProfile?.connected;

  const deckAAsset = assets[currentAssetIndex % assets.length] || null;
  const deckBAsset = assets.length > 1 ? assets[(currentAssetIndex + 1) % assets.length] : null;

  return (
    <div className="bg-black border border-lime-500/20 font-mono" data-testid="global-radio-container">
      {deviceId && <span data-device-id={deviceId} className="hidden" />}

      <div className="bg-zinc-950 border-b border-lime-500/10 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-lime-400" />
            <div>
              <h2 className="text-lime-400 font-extrabold text-sm tracking-widest">GLOBAL RADIO</h2>
              <p className="text-[8px] text-zinc-600">DUAL-DECK BROADCAST CONSOLE</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {verifiedStreaming && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30" data-testid="verified-streaming-badge">
              <SiSpotify className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[8px] text-green-400 font-extrabold">SPOTIFY VERIFIED</span>
            </div>
          )}
          {tunedIn && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] text-red-400 font-extrabold">ON AIR</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {assets.map((asset, i) => (
              <button
                key={asset.ticker + i}
                onClick={() => handleNextAsset(i)}
                className={`flex-shrink-0 px-2 py-1 border text-[8px] font-extrabold transition-all ${
                  i === currentAssetIndex
                    ? "border-lime-400 bg-lime-500/10 text-lime-400 shadow-[0_0_8px_rgba(132,204,22,0.2)]"
                    : "border-zinc-800 text-zinc-600 hover:border-lime-500/30 hover:text-lime-400"
                }`}
                data-testid={`button-rotation-asset-${i}`}
              >
                ${asset.ticker}
                {i === currentAssetIndex && verifiedStreaming && (
                  <Activity className="inline h-2 w-2 text-green-400 ml-1 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <Turntable
              isActive={true}
              isPlaying={tunedIn && !!playerState?.isPlaying}
              albumArt={playerState?.albumArt || deckAAsset?.coverImage || null}
              deckLabel="DECK A"
              trackName={playerState?.trackName || deckAAsset?.title?.toUpperCase() || ""}
              artistName={playerState?.artistName || deckAAsset?.artistName || ""}
              ticker={currentAsset.ticker}
            />

            <div className="flex flex-col items-center justify-between py-2 min-w-[80px]">
              <VUMeter level={vuLeft} label="L" />
              <VUMeter level={vuRight} label="R" />

              <div className="flex flex-col items-center gap-1 w-full mt-1">
                <span className="text-[7px] text-zinc-600 font-extrabold">XFADER</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={crossfade}
                  onChange={(e) => setCrossfade(parseInt(e.target.value))}
                  className="w-full h-1 accent-lime-400 cursor-pointer"
                  data-testid="input-crossfade"
                />
                <div className="flex justify-between w-full">
                  <span className="text-[6px] text-zinc-700">A</span>
                  <span className="text-[6px] text-zinc-700">B</span>
                </div>
              </div>
            </div>

            <Turntable
              isActive={false}
              isPlaying={false}
              albumArt={deckBAsset?.coverImage || null}
              deckLabel="DECK B"
              trackName={deckBAsset?.title?.toUpperCase() || ""}
              artistName={deckBAsset?.artistName || ""}
              ticker={nextAsset.ticker}
            />
          </div>

          {!tunedIn && deckAAsset && (
            <div className="border border-lime-500/10 bg-lime-500/5 p-2">
              <div className="flex items-center gap-2">
                <Music className="h-3 w-3 text-lime-400" />
                <span className="text-[9px] text-lime-400 font-extrabold flex-1 truncate">
                  {deckAAsset.title?.toUpperCase()} — {deckAAsset.artistName || "UNKNOWN"}
                </span>
                <span className="text-[8px] text-zinc-600">QUEUED</span>
              </div>
            </div>
          )}

          {playerState && tunedIn && (
            <div className="border border-lime-500/10 bg-lime-500/5 p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] text-lime-400 font-extrabold flex-1 truncate">
                  {playerState.trackName.toUpperCase()} — {playerState.artistName}
                </span>
                <span className="text-[9px] text-zinc-600">{formatMs(playerState.progressMs)} / {formatMs(playerState.durationMs)}</span>
              </div>
              <div className="h-1 bg-zinc-800 rounded overflow-hidden">
                <div
                  className="h-full bg-lime-500 transition-all"
                  style={{ width: `${playerState.durationMs ? (playerState.progressMs / playerState.durationMs) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {isConnected ? (
              !tunedIn ? (
                <button
                  onClick={handleTuneIn}
                  disabled={connecting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-lime-600 hover:bg-lime-700 text-black font-extrabold text-sm transition-colors disabled:opacity-50"
                  data-testid="button-tune-in"
                >
                  <SiSpotify className="h-5 w-5" />
                  {connecting ? "CONNECTING SDK..." : "GO LIVE — SPOTIFY"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleNextAsset((currentAssetIndex - 1 + assets.length) % assets.length)}
                    className="px-3 py-2.5 border border-lime-500/20 text-lime-400 hover:bg-lime-500/10 transition-colors"
                    data-testid="button-prev-asset"
                  >
                    <SkipBack className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handlePause}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-lime-500/30 text-lime-400 hover:bg-lime-500/10 font-extrabold text-sm transition-colors"
                    data-testid="button-pause-stream"
                  >
                    {playerState?.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {playerState?.isPlaying ? "PAUSE" : "RESUME"}
                  </button>
                  <button
                    onClick={() => handleNextAsset()}
                    className="px-3 py-2.5 border border-lime-500/20 text-lime-400 hover:bg-lime-500/10 transition-colors"
                    data-testid="button-next-asset"
                  >
                    <SkipForward className="h-4 w-4" />
                  </button>
                </>
              )
            ) : (
              <a
                href="/api/login/spotify"
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-green-500/30 text-green-400 font-extrabold text-[11px] hover:bg-green-500/10 transition-colors"
                data-testid="link-connect-spotify"
              >
                <SiSpotify className="h-4 w-4" /> CONNECT SPOTIFY TO GO LIVE
              </a>
            )}
          </div>

          {tunedIn && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleVolumeChange(volume === 0 ? 0.5 : 0)}
                className="text-zinc-500 hover:text-lime-400 transition-colors"
                data-testid="button-volume-mute"
              >
                {volume === 0 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-1 accent-lime-400"
                data-testid="input-volume"
              />
              <span className="text-[9px] text-zinc-600 w-8 text-right font-extrabold">{Math.round(volume * 100)}%</span>
            </div>
          )}

          {royaltyPool && (
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center p-2 border border-lime-500/10 bg-lime-500/5">
                <p className="text-[7px] text-zinc-600 font-extrabold">VAULT RATE</p>
                <p className="text-xs font-extrabold text-lime-400">{royaltyPool.trustVaultRate}</p>
              </div>
              <div className="text-center p-2 border border-lime-500/10 bg-lime-500/5">
                <p className="text-[7px] text-zinc-600 font-extrabold">TRUST VAULT</p>
                <p className="text-xs font-extrabold text-lime-400">${royaltyPool.trustVaultAmount.toLocaleString()}</p>
              </div>
              <div className="text-center p-2 border border-lime-500/10 bg-lime-500/5">
                <p className="text-[7px] text-zinc-600 font-extrabold">VALUATION</p>
                <p className="text-xs font-extrabold text-lime-400">${royaltyPool.currentTrustValuation.toLocaleString()}</p>
              </div>
            </div>
          )}

          {heartbeatLogs.length > 0 && (
            <div className="border border-zinc-800">
              <div className="px-3 py-1 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950">
                <Activity className="h-2.5 w-2.5 text-lime-400" />
                <span className="text-[8px] text-lime-400 font-extrabold">HEARTBEAT — 30s SYNC</span>
              </div>
              <div className="max-h-20 overflow-y-auto">
                {heartbeatLogs.slice(0, 5).map((log, i) => (
                  <div key={i} className="px-3 py-0.5 flex items-center justify-between text-[7px] border-b border-zinc-900 last:border-0">
                    <span className="text-zinc-700">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-zinc-600">{log.asset}</span>
                    <span className={log.verified ? "text-lime-400 font-extrabold" : "text-red-400 font-extrabold"}>
                      {log.verified ? "✓ VERIFIED" : "✗ MISMATCH"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-2 py-1.5 border border-lime-500/10 bg-zinc-950">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-lime-400" />
              <span className="text-[8px] text-lime-400 font-extrabold">97.7 THE FLAME</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-lime-400" />
              <span className="text-[8px] text-lime-400 font-extrabold">18-50% ROYALTY CREDIT</span>
            </div>
          </div>
        </div>
    </div>
  );
}
