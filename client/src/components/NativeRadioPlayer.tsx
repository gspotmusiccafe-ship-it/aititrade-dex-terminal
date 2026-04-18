import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Volume2, VolumeX, Disc3, Music2, Radio as RadioIcon, SkipForward } from "lucide-react";

interface TrackData {
  id: string;
  title: string;
  audioUrl: string;
  coverImage: string | null;
  artist: { name: string; profileImage: string | null } | null;
}

interface Station {
  id: string;
  label: string;
  tagline: string;
  streamUrl: string | null;
  isNative: boolean;
  color: string;
}

const STREAM_STATIONS: Station[] = [
  {
    id: "aitify-native",
    label: "97.7 THE FLAME",
    tagline: "AITIFY Native Catalog · The Penny Is King",
    streamUrl: null,
    isNative: true,
    color: "#34d399",
  },
  {
    id: "hiphop",
    label: "HIP HOP",
    tagline: "Hip-Hop · Trap · Bangers",
    streamUrl: "https://stream.laut.fm/hiphop24",
    isNative: false,
    color: "#f472b6",
  },
  {
    id: "rnb",
    label: "R&B SOUL",
    tagline: "Smooth R&B · Soul · Late-Night Drives",
    streamUrl: "https://ice1.somafm.com/lush-128-mp3",
    isNative: false,
    color: "#a78bfa",
  },
  {
    id: "jazz",
    label: "JAZZ",
    tagline: "Sonic Universe · Jazz Fusion · Smooth",
    streamUrl: "https://ice1.somafm.com/sonicuniverse-128-mp3",
    isNative: false,
    color: "#fbbf24",
  },
  {
    id: "country",
    label: "COUNTRY",
    tagline: "Country Hits · Outlaw · Modern Twang",
    streamUrl: "https://stream.laut.fm/countryradio",
    isNative: false,
    color: "#f87171",
  },
  {
    id: "backyard-boogie",
    label: "BACKYARD BOOGIE",
    tagline: "Instrumental Hip-Hop · Future Soul · Liquid Trap",
    streamUrl: "https://ice1.somafm.com/fluid-128-mp3",
    isNative: false,
    color: "#fb923c",
  },
  {
    id: "bluetooth",
    label: "BLUETOOTH",
    tagline: "Downtempo Beats · Grooves · Chill Sessions",
    streamUrl: "https://ice1.somafm.com/groovesalad-128-mp3",
    isNative: false,
    color: "#22d3ee",
  },
];

const STORAGE_KEY = "aitify_radio_v1";

export default function NativeRadioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stationId, setStationId] = useState<string>(() => {
    if (typeof window === "undefined") return "aitify-native";
    return localStorage.getItem(STORAGE_KEY + ".station") || "aitify-native";
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [nativeIdx, setNativeIdx] = useState(0);
  const [bufferState, setBufferState] = useState<"loading" | "live" | "error">("loading");
  const nativeIdxRef = useRef(0);

  const station = STREAM_STATIONS.find(s => s.id === stationId) || STREAM_STATIONS[0];

  const { data: tracks } = useQuery<TrackData[]>({
    queryKey: ["/api/tracks/featured"],
    enabled: station.isNative,
  });
  const playlist = (tracks || []).filter(t => t.audioUrl);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  nativeIdxRef.current = nativeIdx;

  const currentNativeTrack = station.isNative ? playlist[nativeIdx % Math.max(1, playlist.length)] : null;

  const sourceUrl = station.isNative
    ? (currentNativeTrack?.audioUrl || null)
    : station.streamUrl;

  // Persist station choice
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY + ".station", stationId);
  }, [stationId]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
  }, [isMuted, volume]);

  // Source binding + autoplay-resume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !sourceUrl) return;
    setBufferState("loading");
    if (audio.src !== sourceUrl) {
      audio.src = sourceUrl;
      audio.preload = "auto";
      audio.load();
    }
    const tryPlay = () => audio.play().then(() => { setIsPlaying(true); setBufferState("live"); }).catch(() => setIsPlaying(false));
    tryPlay();
  }, [sourceUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlaying = () => { setIsPlaying(true); setBufferState("live"); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setBufferState("loading");
    const onError = () => {
      setBufferState("error");
      setIsPlaying(false);
      // Auto-recover live streams after 3s
      if (!station.isNative && station.streamUrl) {
        setTimeout(() => {
          audio.src = station.streamUrl + "?cb=" + Date.now();
          audio.load();
          audio.play().catch(() => {});
        }, 3000);
      } else {
        // Skip native track on error
        const pl = playlistRef.current;
        if (pl.length > 1) {
          const next = (nativeIdxRef.current + 1) % pl.length;
          nativeIdxRef.current = next;
          setNativeIdx(next);
        }
      }
    };
    const onEnded = () => {
      // Only fires for native tracks (live streams never end)
      const pl = playlistRef.current;
      if (pl.length > 0) {
        const next = (nativeIdxRef.current + 1) % pl.length;
        nativeIdxRef.current = next;
        setNativeIdx(next);
      }
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [station.id, station.streamUrl, station.isNative]);

  // Watchdog: if not playing and not paused-by-user, try resume every 10s
  const userPausedRef = useRef(false);
  useEffect(() => {
    const iv = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !sourceUrl || userPausedRef.current) return;
      if (audio.paused && !isPlaying) {
        audio.play().catch(() => {});
      }
    }, 10000);
    return () => clearInterval(iv);
  }, [sourceUrl, isPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      userPausedRef.current = true;
      audio.pause();
    } else {
      userPausedRef.current = false;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const skipNative = useCallback(() => {
    const pl = playlistRef.current;
    if (!pl.length) return;
    const next = (nativeIdxRef.current + 1) % pl.length;
    nativeIdxRef.current = next;
    setNativeIdx(next);
  }, []);

  const coverSrc = station.isNative
    ? (currentNativeTrack?.coverImage || currentNativeTrack?.artist?.profileImage || null)
    : null;

  const nowPlayingTitle = station.isNative
    ? (currentNativeTrack?.title || "AITIFY NATIVE")
    : station.label;
  const nowPlayingSub = station.isNative
    ? (currentNativeTrack?.artist?.name || "AITITRADE")
    : station.tagline;

  return (
    <div className="fixed top-[74px] left-0 right-0 z-40 font-mono" data-testid="native-radio-player">
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />

      <div className="bg-black/95 backdrop-blur-sm border-b border-emerald-500/20">
        {/* Station selector strip */}
        <div className="flex items-stretch gap-0 border-b border-emerald-500/20 overflow-x-auto scrollbar-hide bg-black">
          {STREAM_STATIONS.map(s => {
            const active = s.id === stationId;
            return (
              <button
                key={s.id}
                onClick={() => { setStationId(s.id); userPausedRef.current = false; }}
                className={`flex-shrink-0 px-4 py-2.5 text-[11px] sm:text-xs font-extrabold tracking-wider border-r border-emerald-500/20 transition-colors whitespace-nowrap ${
                  active ? "bg-emerald-500/20 text-white" : "text-emerald-300/80 hover:text-white hover:bg-emerald-500/10"
                }`}
                style={active ? { borderBottom: `3px solid ${s.color}`, color: s.color } : {}}
                data-testid={`btn-station-${s.id}`}
              >
                {active && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle animate-pulse" style={{ background: s.color }} />}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Now playing bar */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2.5 h-10">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Disc3 className={`h-3 w-3 ${isPlaying ? "animate-spin" : ""}`} style={{ color: station.color, animationDuration: "2s" }} />
            <span className="text-[8px] font-extrabold tracking-widest hidden sm:inline" style={{ color: station.color }}>{station.label}</span>
          </div>

          <div className="w-7 h-7 flex-shrink-0 bg-emerald-950 border border-emerald-500/20 overflow-hidden">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${station.color}15` }}>
                {station.isNative ? <Music2 className="h-3 w-3" style={{ color: station.color }} /> : <RadioIcon className="h-3 w-3" style={{ color: station.color }} />}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold truncate" style={{ color: station.color }}>{nowPlayingTitle.toUpperCase()}</p>
            <p className="text-[8px] text-emerald-500/60 truncate">{nowPlayingSub}</p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={togglePlay}
              className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center"
              data-testid="btn-radio-play"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </button>
            {station.isNative && (
              <button
                onClick={skipNative}
                disabled={!playlist.length}
                className="p-0.5 text-emerald-500/60 hover:text-lime-400 disabled:opacity-20"
                data-testid="btn-radio-skip"
                aria-label="Skip"
              >
                <SkipForward className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-0.5 text-emerald-500/40 hover:text-emerald-400/70 ml-1"
              data-testid="btn-radio-mute"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => { setVolume(parseInt(e.target.value) / 100); setIsMuted(false); }}
              className="hidden md:block w-16 h-1 accent-emerald-500"
              data-testid="input-radio-volume"
              aria-label="Volume"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[7px] flex-shrink-0">
            {bufferState === "live" && isPlaying && <span className="text-red-400 font-bold animate-pulse">● LIVE</span>}
            {bufferState === "loading" && <span className="text-amber-400 font-bold animate-pulse">BUFFERING</span>}
            {bufferState === "error" && <span className="text-red-500 font-bold">RECONNECTING</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
