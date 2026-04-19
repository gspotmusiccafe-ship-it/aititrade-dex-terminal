import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, Volume2, VolumeX, Disc3, Music2, SkipForward } from "lucide-react";

interface TrackData {
  id: string;
  title: string;
  audioUrl: string;
  coverImage: string | null;
  artist: { name: string; profileImage: string | null } | null;
}

const STATION = {
  id: "aitify-native",
  label: "97.7 THE FLAME",
  tagline: "AITIFY Native Catalog · The Penny Is King",
  color: "#34d399",
};

const STORAGE_KEY = "aitify_radio_v1";
const FADE_MS = 800; // crossfade duration
const FADE_TAIL_MS = 1200; // start fade this many ms before track end

export default function NativeRadioPlayer() {
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const activeRef = useRef<"A" | "B">("A");
  const fadeTimerRef = useRef<number | null>(null);
  const transitionRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [nativeIdx, setNativeIdx] = useState(0);
  const [bufferState, setBufferState] = useState<"loading" | "live" | "error">("loading");

  const { data: tracks } = useQuery<TrackData[]>({
    queryKey: ["/api/tracks/featured"],
    refetchInterval: 60000,
  });
  const playlist = (tracks || []).filter(t => t.audioUrl);
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const nativeIdxRef = useRef(0);
  nativeIdxRef.current = nativeIdx;

  const currentTrack = playlist[nativeIdx % Math.max(1, playlist.length)] || null;
  const nextTrack = playlist.length > 0
    ? playlist[(nativeIdx + 1) % playlist.length]
    : null;

  const getActive = () => activeRef.current === "A" ? audioARef.current : audioBRef.current;
  const getInactive = () => activeRef.current === "A" ? audioBRef.current : audioARef.current;

  const targetVolume = isMuted ? 0 : volume;

  // Sync user volume to whichever element is currently active (when not crossfading)
  useEffect(() => {
    if (transitionRef.current) return;
    const active = getActive();
    const inactive = getInactive();
    if (active) active.volume = targetVolume;
    if (inactive) inactive.volume = 0;
  }, [targetVolume]);

  // Smoothly ramp volume on an audio element
  const rampVolume = (el: HTMLAudioElement, from: number, to: number, ms: number, onDone?: () => void) => {
    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      // ease-in-out cosine
      const eased = (1 - Math.cos(Math.PI * t)) / 2;
      el.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        el.volume = to;
        onDone && onDone();
      }
    };
    requestAnimationFrame(tick);
  };

  // Load a track into the inactive element and crossfade in
  const crossfadeTo = useCallback((url: string, advanceIdx: boolean) => {
    if (transitionRef.current || !url) return;
    const inactive = getInactive();
    const active = getActive();
    if (!inactive || !active) return;

    transitionRef.current = true;
    inactive.src = url;
    inactive.preload = "auto";
    inactive.volume = 0;
    inactive.load();

    const onCanPlay = () => {
      inactive.removeEventListener("canplay", onCanPlay);
      inactive.play().then(() => {
        const userVol = isMuted ? 0 : volume;
        rampVolume(inactive, 0, userVol, FADE_MS);
        rampVolume(active, active.volume, 0, FADE_MS, () => {
          try { active.pause(); } catch {}
          activeRef.current = activeRef.current === "A" ? "B" : "A";
          transitionRef.current = false;
          if (advanceIdx) {
            const pl = playlistRef.current;
            if (pl.length > 0) {
              const next = (nativeIdxRef.current + 1) % pl.length;
              nativeIdxRef.current = next;
              setNativeIdx(next);
            }
          }
          setIsPlaying(true);
          setBufferState("live");
        });
      }).catch(() => {
        transitionRef.current = false;
        setBufferState("error");
      });
    };

    if (inactive.readyState >= 3) {
      onCanPlay();
    } else {
      inactive.addEventListener("canplay", onCanPlay);
    }
  }, [isMuted, volume]);

  // Initial load: kick off active audio with first track
  useEffect(() => {
    if (!currentTrack?.audioUrl) return;
    const active = getActive();
    if (!active) return;
    if (active.src.endsWith(currentTrack.audioUrl) || active.src === currentTrack.audioUrl) return;
    active.src = currentTrack.audioUrl;
    active.preload = "auto";
    active.volume = isMuted ? 0 : volume;
    active.load();
    active.play().then(() => {
      setIsPlaying(true);
      setBufferState("live");
    }).catch(() => {
      setIsPlaying(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.audioUrl]);

  // Watchdog: monitor active element for end-approach + handle ended fallback
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (transitionRef.current) return;
      const active = getActive();
      if (!active || active.paused) return;
      if (!active.duration || isNaN(active.duration)) return;
      const remaining = (active.duration - active.currentTime) * 1000;
      if (remaining > 0 && remaining < FADE_TAIL_MS && nextTrack?.audioUrl) {
        crossfadeTo(nextTrack.audioUrl, true);
      }
    }, 200);
    return () => clearInterval(checkInterval);
  }, [crossfadeTo, nextTrack?.audioUrl]);

  // Setup ended/error listeners on both elements
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const handleEnded = (which: "A" | "B") => () => {
      // Only fire if this was the active element and crossfade didn't already advance us
      if (activeRef.current === which && !transitionRef.current && nextTrack?.audioUrl) {
        crossfadeTo(nextTrack.audioUrl, true);
      }
    };
    const handleError = (which: "A" | "B") => () => {
      if (activeRef.current === which) {
        setBufferState("error");
        setIsPlaying(false);
        // Try next track after 2s
        setTimeout(() => {
          if (nextTrack?.audioUrl) crossfadeTo(nextTrack.audioUrl, true);
        }, 2000);
      }
    };
    const handleWaiting = (which: "A" | "B") => () => {
      if (activeRef.current === which && !transitionRef.current) setBufferState("loading");
    };
    const handlePlaying = (which: "A" | "B") => () => {
      if (activeRef.current === which) setBufferState("live");
    };

    const onA_end = handleEnded("A"); const onB_end = handleEnded("B");
    const onA_err = handleError("A"); const onB_err = handleError("B");
    const onA_wait = handleWaiting("A"); const onB_wait = handleWaiting("B");
    const onA_play = handlePlaying("A"); const onB_play = handlePlaying("B");

    a.addEventListener("ended", onA_end);
    b.addEventListener("ended", onB_end);
    a.addEventListener("error", onA_err);
    b.addEventListener("error", onB_err);
    a.addEventListener("waiting", onA_wait);
    b.addEventListener("waiting", onB_wait);
    a.addEventListener("playing", onA_play);
    b.addEventListener("playing", onB_play);

    return () => {
      a.removeEventListener("ended", onA_end);
      b.removeEventListener("ended", onB_end);
      a.removeEventListener("error", onA_err);
      b.removeEventListener("error", onB_err);
      a.removeEventListener("waiting", onA_wait);
      b.removeEventListener("waiting", onB_wait);
      a.removeEventListener("playing", onA_play);
      b.removeEventListener("playing", onB_play);
    };
  }, [crossfadeTo, nextTrack?.audioUrl]);

  const userPausedRef = useRef(false);

  const togglePlay = useCallback(() => {
    const active = getActive();
    if (!active) return;
    if (isPlaying) {
      userPausedRef.current = true;
      // Smooth fade out instead of hard pause to avoid click
      rampVolume(active, active.volume, 0, 200, () => {
        try { active.pause(); } catch {}
        setIsPlaying(false);
      });
    } else {
      userPausedRef.current = false;
      active.volume = 0;
      active.play().then(() => {
        rampVolume(active, 0, isMuted ? 0 : volume, 200);
        setIsPlaying(true);
      }).catch(() => {});
    }
  }, [isPlaying, isMuted, volume]);

  const skipNative = useCallback(() => {
    if (nextTrack?.audioUrl) crossfadeTo(nextTrack.audioUrl, true);
  }, [crossfadeTo, nextTrack?.audioUrl]);

  // Watchdog: if not playing and not user-paused, try resume every 10s
  useEffect(() => {
    const iv = setInterval(() => {
      const active = getActive();
      if (!active || userPausedRef.current) return;
      if (active.paused && !isPlaying && currentTrack?.audioUrl) {
        active.play().catch(() => {});
      }
    }, 10000);
    return () => clearInterval(iv);
  }, [isPlaying, currentTrack?.audioUrl]);

  const coverSrc = currentTrack?.coverImage || currentTrack?.artist?.profileImage || null;
  const nowPlayingTitle = currentTrack?.title || "AITIFY NATIVE";
  const nowPlayingSub = currentTrack?.artist?.name || "AITITRADE";

  return (
    <div className="fixed top-[74px] left-0 right-0 z-40 font-mono" data-testid="native-radio-player">
      <audio ref={audioARef} preload="auto" crossOrigin="anonymous" />
      <audio ref={audioBRef} preload="auto" crossOrigin="anonymous" />

      <div className="bg-black/95 backdrop-blur-sm border-b border-emerald-500/20">
        {/* Station strip */}
        <div className="bg-black border-b border-emerald-500/20 px-4 py-2 flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: STATION.color }} />
          <span className="text-[12px] sm:text-sm font-extrabold tracking-wider" style={{ color: STATION.color }}>
            {STATION.label}
          </span>
          <span className="hidden sm:inline text-[9px] text-emerald-500/60 ml-2">{STATION.tagline}</span>
        </div>

        {/* Now playing bar */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2.5 h-10">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Disc3 className={`h-3 w-3 ${isPlaying ? "animate-spin" : ""}`} style={{ color: STATION.color, animationDuration: "2s" }} />
          </div>

          <div className="w-7 h-7 flex-shrink-0 bg-emerald-950 border border-emerald-500/20 overflow-hidden">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${STATION.color}15` }}>
                <Music2 className="h-3 w-3" style={{ color: STATION.color }} />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold truncate" style={{ color: STATION.color }}>{nowPlayingTitle.toUpperCase()}</p>
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
            <button
              onClick={skipNative}
              disabled={!playlist.length || transitionRef.current}
              className="p-0.5 text-emerald-500/60 hover:text-lime-400 disabled:opacity-20"
              data-testid="btn-radio-skip"
              aria-label="Skip"
            >
              <SkipForward className="h-3 w-3" />
            </button>
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
