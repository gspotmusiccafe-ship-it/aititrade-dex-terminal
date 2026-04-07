import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import type { TrackWithArtist } from "@shared/schema";

type BroadcastShow = "MORNING_MARKET" | "MIDDAY_EXCHANGE" | "EVENING_TRADE" | "LATE_NIGHT_VAULT";

function getCurrentShow(): BroadcastShow {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return "MORNING_MARKET";
  if (hour >= 12 && hour < 17) return "MIDDAY_EXCHANGE";
  if (hour >= 17 && hour < 22) return "EVENING_TRADE";
  return "LATE_NIGHT_VAULT";
}

function getShowLabel(show: BroadcastShow): string {
  switch (show) {
    case "MORNING_MARKET": return "MORNING MARKET OPEN";
    case "MIDDAY_EXCHANGE": return "MIDDAY EXCHANGE";
    case "EVENING_TRADE": return "EVENING TRADE FLOOR";
    case "LATE_NIGHT_VAULT": return "LATE NIGHT VAULT";
  }
}

function getNextShowTime(): { show: BroadcastShow; at: Date } {
  const now = new Date();
  const hour = now.getHours();
  const today = new Date(now);
  today.setMinutes(0, 0, 0);

  if (hour < 6) { today.setHours(6); return { show: "MORNING_MARKET", at: today }; }
  if (hour < 12) { today.setHours(12); return { show: "MIDDAY_EXCHANGE", at: today }; }
  if (hour < 17) { today.setHours(17); return { show: "EVENING_TRADE", at: today }; }
  if (hour < 22) { today.setHours(22); return { show: "LATE_NIGHT_VAULT", at: today }; }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  return { show: "MORNING_MARKET", at: tomorrow };
}

type SignalStrength = "GREEN" | "RED" | "IDLE";

interface PlayerState {
  currentTrack: TrackWithArtist | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  queue: TrackWithArtist[];
  queueIndex: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  autoplayBlocked: boolean;
  autopilot: boolean;
  autopilotPool: TrackWithArtist[];
  broadcast: boolean;
  currentShow: BroadcastShow;
  broadcastUptime: number;
  signalStrength: SignalStrength;
}

interface PlayerContextType extends PlayerState {
  playTrack: (track: TrackWithArtist, queue?: TrackWithArtist[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  addToQueue: (track: TrackWithArtist) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  playFromQueue: (index: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  resumeAutoplay: () => void;
  toggleAutopilot: () => void;
  setAutopilotPool: (tracks: TrackWithArtist[]) => void;
  toggleBroadcast: () => void;
  startBroadcastWithPool: (pool: TrackWithArtist[]) => void;
  getShowLabel: (show: BroadcastShow) => string;
  getNextShowTime: () => { show: BroadcastShow; at: Date };
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    progress: 0,
    duration: 0,
    queue: [],
    queueIndex: 0,
    shuffle: false,
    repeat: "all",
    autoplayBlocked: false,
    autopilot: false,
    autopilotPool: [],
    broadcast: false,
    currentShow: getCurrentShow(),
    broadcastUptime: 0,
    signalStrength: "IDLE",
  });

  const broadcastStartRef = useRef<number>(0);
  const adBridgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userPausedRef = useRef<boolean>(false);
  const broadcastRef = useRef<boolean>(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoggedTrackRef = useRef<string | null>(null);
  const errorRetryCountRef = useRef<number>(0);
  const lastProgressRef = useRef<number>(0);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const playCountedRef = useRef<string | null>(null);

  const reportPlay = useCallback((trackId: string) => {
    if (playCountedRef.current !== trackId) {
      playCountedRef.current = trackId;
      fetch(`/api/tracks/${trackId}/play`, { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, []);

  const sendLog = useCallback((endpoint: string, payload: Record<string, unknown>) => {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        const sig = data?.signal === "GREEN" ? "GREEN" : "RED";
        setState(prev => ({ ...prev, signalStrength: sig as SignalStrength }));
      })
      .catch(() => {
        setState(prev => ({ ...prev, signalStrength: "RED" as SignalStrength }));
      });
  }, []);

  const logTrackEnd = useCallback((track: TrackWithArtist, show: BroadcastShow, dur: number) => {
    sendLog("/api/logs/radio", {
      trackName: track.title,
      isrc: (track as any).isrc || `ATFY-${track.id}`,
      showName: getShowLabel(show),
      status: "COMPLETED",
      duration: Math.round(dur),
    });
  }, [sendLog]);

  const getNextIndex = useCallback((currentIndex: number, queueLength: number, shuffleOn: boolean): number => {
    if (shuffleOn && queueLength > 1) {
      let next = currentIndex;
      while (next === currentIndex) {
        next = Math.floor(Math.random() * queueLength);
      }
      return next;
    }
    return currentIndex + 1;
  }, []);

  const isYTUrl = (url: string) => /(?:youtube\.com|youtu\.be)/.test(url);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = state.volume;
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.preload = "auto";

    preloadRef.current = new Audio();
    preloadRef.current.preload = "auto";
    preloadRef.current.volume = 0;

    const audio = audioRef.current;

    const setupEQ = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;
        const source = ctx.createMediaElementSource(audio);
        sourceNodeRef.current = source;

        const preGain = ctx.createGain();
        preGain.gain.value = 0.88;

        const subRumble = ctx.createBiquadFilter();
        subRumble.type = "highpass";
        subRumble.frequency.value = 30;
        subRumble.Q.value = 0.5;

        const subBass = ctx.createBiquadFilter();
        subBass.type = "peaking";
        subBass.frequency.value = 60;
        subBass.Q.value = 1.0;
        subBass.gain.value = 6.0;

        const bass = ctx.createBiquadFilter();
        bass.type = "lowshelf";
        bass.frequency.value = 140;
        bass.gain.value = 5.0;

        const warmth = ctx.createBiquadFilter();
        warmth.type = "peaking";
        warmth.frequency.value = 280;
        warmth.Q.value = 0.8;
        warmth.gain.value = 3.0;

        const body = ctx.createBiquadFilter();
        body.type = "peaking";
        body.frequency.value = 450;
        body.Q.value = 0.6;
        body.gain.value = 1.5;

        const lowMid = ctx.createBiquadFilter();
        lowMid.type = "peaking";
        lowMid.frequency.value = 800;
        lowMid.Q.value = 0.7;
        lowMid.gain.value = 1.0;

        const midClarity = ctx.createBiquadFilter();
        midClarity.type = "peaking";
        midClarity.frequency.value = 2000;
        midClarity.Q.value = 0.5;
        midClarity.gain.value = 1.5;

        const presence = ctx.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 4000;
        presence.Q.value = 0.8;
        presence.gain.value = 2.0;

        const brilliance = ctx.createBiquadFilter();
        brilliance.type = "peaking";
        brilliance.frequency.value = 8000;
        brilliance.Q.value = 0.6;
        brilliance.gain.value = 1.5;

        const air = ctx.createBiquadFilter();
        air.type = "highshelf";
        air.frequency.value = 12000;
        air.gain.value = 2.5;

        const deEsser = ctx.createBiquadFilter();
        deEsser.type = "peaking";
        deEsser.frequency.value = 6500;
        deEsser.Q.value = 3.0;
        deEsser.gain.value = -2.0;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 8;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.120;

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -2;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.050;

        const stereoWidth = ctx.createStereoPanner();
        stereoWidth.pan.value = 0;

        const postGain = ctx.createGain();
        postGain.gain.value = 0.95;

        source.connect(preGain);
        preGain.connect(subRumble);
        subRumble.connect(subBass);
        subBass.connect(bass);
        bass.connect(warmth);
        warmth.connect(body);
        body.connect(lowMid);
        lowMid.connect(midClarity);
        midClarity.connect(presence);
        presence.connect(brilliance);
        brilliance.connect(air);
        air.connect(deEsser);
        deEsser.connect(compressor);
        compressor.connect(limiter);
        limiter.connect(stereoWidth);
        stereoWidth.connect(postGain);
        postGain.connect(ctx.destination);
      } catch (e) {
        console.warn("Web Audio EQ not available, using direct playback");
      }
    };

    audio.addEventListener("canplay", () => {
      if (!audioContextRef.current) {
        setupEQ();
      }
    }, { once: true });

    let preloadedUrl = "";
    const handleTimeUpdate = () => {
      setState(prev => {
        if (audio.duration && audio.currentTime > 0 && audio.duration - audio.currentTime < 15) {
          const nextIdx = prev.shuffle
            ? Math.floor(Math.random() * prev.queue.length)
            : (prev.queueIndex + 1 < prev.queue.length ? prev.queueIndex + 1 : (prev.repeat === "all" ? 0 : -1));
          if (nextIdx >= 0 && nextIdx < prev.queue.length) {
            const nextUrl = prev.queue[nextIdx].audioUrl;
            if (nextUrl && nextUrl !== preloadedUrl && preloadRef.current) {
              preloadedUrl = nextUrl;
              preloadRef.current.src = nextUrl;
              preloadRef.current.load();
            }
          }
        }
        return { ...prev, progress: audio.currentTime };
      });
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration }));
    };

    const playAudioTrack = (track: TrackWithArtist) => {
      if (!audioRef.current || isYTUrl(track.audioUrl)) return;
      playCountedRef.current = null;
      audioRef.current.src = track.audioUrl;
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => reportPlay(track.id))
          .catch((err) => {
            console.error("Audio play failed:", err.message);
            setTimeout(() => setState(s => advanceQueue(s)), 500);
          });
      }
    };

    const advanceQueue = (prev: PlayerState): PlayerState => {
      const nextIndex = getNextIndex(prev.queueIndex, prev.queue.length, prev.shuffle);

      if (nextIndex < prev.queue.length) {
        const nextT = prev.queue[nextIndex];
        if (nextT) playAudioTrack(nextT);
        return {
          ...prev,
          currentTrack: nextT,
          queueIndex: nextIndex,
          isPlaying: nextT ? !isYTUrl(nextT.audioUrl) : false,
          progress: 0,
        };
      } else if (prev.autopilot && prev.autopilotPool.length > 0) {
        const playedIds = new Set(prev.queue.map(t => t.id));
        const available = prev.autopilotPool.filter(t => !playedIds.has(t.id) && t.audioUrl && !isYTUrl(t.audioUrl));
        const fallback = available.length > 0 ? available : prev.autopilotPool.filter(t => t.id !== prev.currentTrack?.id && t.audioUrl && !isYTUrl(t.audioUrl));
        if (fallback.length > 0) {
          const prerelease = fallback.filter(t => (t as any).isPrerelease);
          const priorityPool = prerelease.length > 0 ? prerelease : fallback;
          const pick = prev.shuffle
            ? priorityPool[Math.floor(Math.random() * priorityPool.length)]
            : priorityPool[0];
          const newQueue = [...prev.queue, pick];
          const newIndex = newQueue.length - 1;
          if (pick) playAudioTrack(pick);
          return {
            ...prev,
            currentTrack: pick,
            queue: newQueue,
            queueIndex: newIndex,
            isPlaying: true,
            progress: 0,
          };
        }
      } else if (prev.repeat === "all" && prev.queue.length > 0) {
        const firstIndex = prev.shuffle ? Math.floor(Math.random() * prev.queue.length) : 0;
        const firstTrack = prev.queue[firstIndex];
        if (firstTrack) playAudioTrack(firstTrack);
        return {
          ...prev,
          currentTrack: firstTrack,
          queueIndex: firstIndex,
          isPlaying: firstTrack ? !isYTUrl(firstTrack.audioUrl) : false,
          progress: 0,
        };
      }

      return { ...prev, isPlaying: false };
    };

    const handleEnded = () => {
      setState(prev => {
        if (prev.currentTrack && prev.currentTrack.id !== lastLoggedTrackRef.current) {
          lastLoggedTrackRef.current = prev.currentTrack.id;
          logTrackEnd(prev.currentTrack, prev.currentShow, prev.duration);
        }

        if (prev.repeat === "one") {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            const p = audioRef.current.play();
            if (p !== undefined) {
              p.catch((err) => {
                console.error("Audio repeat play failed:", err.message);
                setState(s => ({ ...s, isPlaying: false }));
              });
            }
          }
          return prev;
        }

        return advanceQueue(prev);
      });
    };

    let errorSkipTimeout: ReturnType<typeof setTimeout> | null = null;
    const MAX_RETRIES = 3;

    const handleError = () => {
      if (errorSkipTimeout) clearTimeout(errorSkipTimeout);

      if (errorRetryCountRef.current < MAX_RETRIES) {
        errorRetryCountRef.current++;
        const retryDelay = errorRetryCountRef.current * 1500;
        console.warn(`[RADIO] Audio load error — retry ${errorRetryCountRef.current}/${MAX_RETRIES} in ${retryDelay}ms`);
        errorSkipTimeout = setTimeout(() => {
          if (audioRef.current && audioRef.current.src) {
            const src = audioRef.current.src;
            audioRef.current.src = "";
            audioRef.current.src = src;
            audioRef.current.load();
            const p = audioRef.current.play();
            if (p !== undefined) {
              p.then(() => {
                errorRetryCountRef.current = 0;
                setState(prev => ({ ...prev, isPlaying: true }));
              }).catch(() => handleError());
            }
          }
        }, retryDelay);
      } else {
        console.warn("[RADIO] Audio load error — max retries reached, advancing queue");
        errorRetryCountRef.current = 0;
        errorSkipTimeout = setTimeout(() => {
          setState(prev => advanceQueue(prev));
        }, 500);
      }
    };

    const handleStalled = () => {
      console.warn("[RADIO] Audio stalled — waiting for recovery");
      if (audioRef.current && audioRef.current.src) {
        const currentTime = audioRef.current.currentTime;
        setTimeout(() => {
          if (audioRef.current && audioRef.current.paused && !userPausedRef.current) {
            console.log("[RADIO] Stall recovery — resuming from", Math.floor(currentTime), "s");
            audioRef.current.load();
            audioRef.current.currentTime = currentTime;
            audioRef.current.play().catch(() => {
              setState(prev => advanceQueue(prev));
            });
          }
        }, 5000);
      }
    };

    const handleWaiting = () => {
      setTimeout(() => {
        if (audioRef.current && audioRef.current.readyState < 3 && !audioRef.current.paused) {
          console.warn("[RADIO] Extended buffering — resuming");
          audioRef.current.load();
          audioRef.current.play().catch(() => {});
        }
      }, 15000);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("waiting", handleWaiting);

    const handlePlaying = () => {
      errorRetryCountRef.current = 0;
    };
    audio.addEventListener("playing", handlePlaying);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      if (errorSkipTimeout) clearTimeout(errorSkipTimeout);
      audio.pause();
      if (preloadRef.current) {
        preloadRef.current.src = "";
        preloadRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const resumeAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
  }, []);

  const isYouTubeUrl = useCallback((url: string): boolean => {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  }, []);

  const playTrack = useCallback((track: TrackWithArtist, queue?: TrackWithArtist[]) => {
    const isYT = isYouTubeUrl(track.audioUrl);
    if (audioRef.current && !isYT) {
      resumeAudioContext();
      playCountedRef.current = null;
      audioRef.current.src = track.audioUrl;
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          reportPlay(track.id);
          setState(prev => ({ ...prev, autoplayBlocked: false }));
        }).catch((err) => {
          console.error("Audio play failed:", err.message);
          const isAutoplayBlock = err.name === "NotAllowedError";
          setState(prev => ({ ...prev, isPlaying: false, autoplayBlocked: isAutoplayBlock }));
        });
      }
    }
    if (isYT) {
      reportPlay(track.id);
    }
    setState(prev => ({
      ...prev,
      currentTrack: track,
      isPlaying: !isYT,
      progress: 0,
      autoplayBlocked: false,
      queue: queue || [track],
      queueIndex: queue ? queue.findIndex(t => t.id === track.id) : 0,
    }));
  }, [reportPlay, resumeAudioContext, isYouTubeUrl]);

  const resumeAutoplay = useCallback(() => {
    resumeAudioContext();
    if (audioRef.current && state.currentTrack) {
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          reportPlay(state.currentTrack!.id);
          setState(prev => ({ ...prev, isPlaying: true, autoplayBlocked: false }));
        }).catch((err) => {
          console.error("Resume autoplay failed:", err.message);
          setState(prev => ({ ...prev, isPlaying: false }));
        });
      }
    }
  }, [state.currentTrack, reportPlay]);

  const togglePlay = useCallback(() => {
    resumeAudioContext();
    if (audioRef.current && state.currentTrack) {
      if (state.isPlaying) {
        userPausedRef.current = true;
        audioRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
        userPausedRef.current = false;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => {
            setState(prev => ({ ...prev, isPlaying: true }));
          }).catch((err) => {
            console.error("Audio play failed:", err.message);
            setState(prev => ({ ...prev, isPlaying: false }));
          });
        }
      }
    }
  }, [state.isPlaying, state.currentTrack]);

  const safePlayAudio = useCallback((track: TrackWithArtist, onError: () => void) => {
    if (!audioRef.current || isYouTubeUrl(track.audioUrl)) return;
    playCountedRef.current = null;
    audioRef.current.src = track.audioUrl;
    const p = audioRef.current.play();
    if (p !== undefined) {
      p.then(() => reportPlay(track.id))
        .catch((err) => {
          console.error("Audio play failed:", err.message);
          setTimeout(onError, 500);
        });
    }
  }, [reportPlay, isYouTubeUrl]);

  const advanceQueueFn = useCallback((prev: PlayerState): PlayerState => {
    const nextIndex = getNextIndex(prev.queueIndex, prev.queue.length, prev.shuffle);

    if (nextIndex < prev.queue.length) {
      const nextT = prev.queue[nextIndex];
      if (nextT) safePlayAudio(nextT, () => setState(s => advanceQueueFn(s)));
      return {
        ...prev,
        currentTrack: nextT,
        queueIndex: nextIndex,
        isPlaying: nextT ? !isYouTubeUrl(nextT.audioUrl) : false,
        progress: 0,
      };
    } else if (prev.autopilot && prev.autopilotPool.length > 0) {
      const playedIds = new Set(prev.queue.map(t => t.id));
      const available = prev.autopilotPool.filter(t => !playedIds.has(t.id) && t.audioUrl && !isYouTubeUrl(t.audioUrl));
      const fallback = available.length > 0 ? available : prev.autopilotPool.filter(t => t.id !== prev.currentTrack?.id && t.audioUrl && !isYouTubeUrl(t.audioUrl));
      if (fallback.length > 0) {
        const prerelease = fallback.filter(t => (t as any).isPrerelease);
        const priorityPool = prerelease.length > 0 ? prerelease : fallback;
        const pick = prev.shuffle
          ? priorityPool[Math.floor(Math.random() * priorityPool.length)]
          : priorityPool[0];
        const newQueue = [...prev.queue, pick];
        const newIdx = newQueue.length - 1;
        if (pick) safePlayAudio(pick, () => setState(s => advanceQueueFn(s)));
        return {
          ...prev,
          currentTrack: pick,
          queue: newQueue,
          queueIndex: newIdx,
          isPlaying: true,
          progress: 0,
        };
      }
    } else if (prev.repeat === "all" && prev.queue.length > 0) {
      const firstIndex = prev.shuffle ? Math.floor(Math.random() * prev.queue.length) : 0;
      const firstTrack = prev.queue[firstIndex];
      if (firstTrack) safePlayAudio(firstTrack, () => setState(s => advanceQueueFn(s)));
      return {
        ...prev,
        currentTrack: firstTrack,
        queueIndex: firstIndex,
        isPlaying: firstTrack ? !isYouTubeUrl(firstTrack.audioUrl) : false,
        progress: 0,
      };
    }

    return { ...prev, isPlaying: false };
  }, [getNextIndex, safePlayAudio, isYouTubeUrl]);

  const nextTrack = useCallback(() => {
    setState(prev => advanceQueueFn(prev));
  }, [advanceQueueFn]);

  const prevTrack = useCallback(() => {
    if (state.progress > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    
    if (state.queue.length > 0 && state.queueIndex > 0) {
      const prevIndex = state.queueIndex - 1;
      const prevT = state.queue[prevIndex];
      if (prevT) {
        safePlayAudio(prevT, () => setState(s => ({ ...s, isPlaying: false })));
        setState(prev => ({
          ...prev,
          currentTrack: prevT,
          queueIndex: prevIndex,
          isPlaying: !isYouTubeUrl(prevT.audioUrl),
          progress: 0,
        }));
      }
    }
  }, [state.queue, state.queueIndex, state.progress, safePlayAudio, isYouTubeUrl]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setState(prev => ({ ...prev, volume }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setState(prev => ({ ...prev, progress: time }));
  }, []);

  const addToQueue = useCallback((track: TrackWithArtist) => {
    setState(prev => ({ ...prev, queue: [...prev.queue, track] }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setState(prev => {
      if (index === prev.queueIndex) return prev;
      const newQueue = [...prev.queue];
      newQueue.splice(index, 1);
      let newIndex = prev.queueIndex;
      if (index < prev.queueIndex) {
        newIndex = Math.max(0, prev.queueIndex - 1);
      }
      return { ...prev, queue: newQueue, queueIndex: Math.min(newIndex, newQueue.length - 1) };
    });
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || fromIndex >= prev.queue.length) return prev;
      if (toIndex < 0 || toIndex >= prev.queue.length) return prev;
      const newQueue = [...prev.queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      let newIndex = prev.queueIndex;
      if (prev.queueIndex === fromIndex) {
        newIndex = toIndex;
      } else if (fromIndex < prev.queueIndex && toIndex >= prev.queueIndex) {
        newIndex = prev.queueIndex - 1;
      } else if (fromIndex > prev.queueIndex && toIndex <= prev.queueIndex) {
        newIndex = prev.queueIndex + 1;
      }
      return { ...prev, queue: newQueue, queueIndex: newIndex };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => {
      const currentTrack = prev.currentTrack;
      if (currentTrack) {
        return { ...prev, queue: [currentTrack], queueIndex: 0 };
      }
      return { ...prev, queue: [], queueIndex: 0 };
    });
  }, []);

  const playFromQueue = useCallback((index: number) => {
    setState(prev => {
      const track = prev.queue[index];
      if (track) {
        safePlayAudio(track, () => setState(s => ({ ...s, isPlaying: false })));
        return { ...prev, currentTrack: track, queueIndex: index, isPlaying: !isYouTubeUrl(track.audioUrl), progress: 0 };
      }
      return prev;
    });
  }, [safePlayAudio, isYouTubeUrl]);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState(prev => {
      const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"];
      const currentIdx = modes.indexOf(prev.repeat);
      return { ...prev, repeat: modes[(currentIdx + 1) % modes.length] };
    });
  }, []);

  const toggleAutopilot = useCallback(() => {
    setState(prev => ({ ...prev, autopilot: !prev.autopilot }));
  }, []);

  const setAutopilotPool = useCallback((tracks: TrackWithArtist[]) => {
    setState(prev => ({ ...prev, autopilotPool: tracks }));
  }, []);

  const toggleBroadcast = useCallback(() => {
    setState(prev => {
      const newBroadcast = !prev.broadcast;
      broadcastRef.current = newBroadcast;
      if (newBroadcast) {
        broadcastStartRef.current = Date.now();
        return { ...prev, broadcast: true, autopilot: true, repeat: "all", currentShow: getCurrentShow() };
      }
      if (adBridgeTimerRef.current) {
        clearInterval(adBridgeTimerRef.current);
        adBridgeTimerRef.current = null;
      }
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      return { ...prev, broadcast: false, broadcastUptime: 0 };
    });
  }, []);

  const startBroadcastWithPool = useCallback((pool: TrackWithArtist[]) => {
    if (state.broadcast || state.isPlaying || pool.length === 0) return;
    const playable = pool.filter(t => t.audioUrl && !/(?:youtube\.com|youtu\.be)/.test(t.audioUrl));
    if (playable.length === 0) return;
    const shuffled = [...playable].sort(() => Math.random() - 0.5);
    const first = shuffled[0];
    broadcastRef.current = true;
    broadcastStartRef.current = Date.now();
    resumeAudioContext();
    if (audioRef.current && first) {
      playCountedRef.current = null;
      audioRef.current.src = first.audioUrl;
      const p = audioRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          reportPlay(first.id);
          setState(prev => ({ ...prev, autoplayBlocked: false }));
        }).catch(() => {
          setState(prev => ({ ...prev, autoplayBlocked: true }));
        });
      }
    }
    setState(prev => ({
      ...prev,
      broadcast: true,
      autopilot: true,
      repeat: "all",
      shuffle: true,
      currentShow: getCurrentShow(),
      autopilotPool: playable,
      queue: shuffled,
      queueIndex: 0,
      currentTrack: first,
      isPlaying: true,
      progress: 0,
    }));
  }, [state.broadcast, state.isPlaying, resumeAudioContext, reportPlay]);

  useEffect(() => {
    if (!state.broadcast || !state.currentTrack || !state.isPlaying) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    heartbeatRef.current = setInterval(() => {
      setState(prev => {
        if (prev.currentTrack && prev.isPlaying) {
          sendLog("/api/logs/heartbeat", {
            trackName: prev.currentTrack.title,
            isrc: (prev.currentTrack as any).isrc || `ATFY-${prev.currentTrack.id}`,
            showName: getShowLabel(prev.currentShow),
            status: "PLAYING",
            progress: Math.round(prev.progress),
            duration: Math.round(prev.duration),
          });
        }
        return prev;
      });
    }, 30000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [state.broadcast, state.currentTrack?.id, state.isPlaying, sendLog]);

  useEffect(() => {
    if (!state.broadcast) return;

    const showInterval = setInterval(() => {
      const newShow = getCurrentShow();
      setState(prev => {
        if (prev.currentShow !== newShow) {
          return { ...prev, currentShow: newShow };
        }
        return prev;
      });
    }, 60000);

    const uptimeInterval = setInterval(() => {
      if (broadcastStartRef.current > 0) {
        setState(prev => ({
          ...prev,
          broadcastUptime: Math.floor((Date.now() - broadcastStartRef.current) / 1000),
        }));
      }
    }, 1000);

    const poolRefreshInterval = setInterval(() => {
      fetch("/api/autopilot/pool", { credentials: "include" })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && Array.isArray(data) && data.length > 0) {
            setState(prev => ({ ...prev, autopilotPool: data }));
          }
        })
        .catch(() => {});
    }, 120000);

    return () => {
      clearInterval(showInterval);
      clearInterval(uptimeInterval);
      clearInterval(poolRefreshInterval);
    };
  }, [state.broadcast]);

  useEffect(() => {
    if (!state.broadcast || !audioRef.current) return;
    const audio = audioRef.current;

    let adBridgeCooldown = false;
    const handlePause = () => {
      if (!broadcastRef.current || userPausedRef.current || adBridgeCooldown) return;
      if (audio.ended) return;

      if (adBridgeTimerRef.current) clearTimeout(adBridgeTimerRef.current);
      adBridgeCooldown = true;
      adBridgeTimerRef.current = setTimeout(() => {
        if (audio.paused && !audio.ended && broadcastRef.current && audio.src && !userPausedRef.current) {
          console.log("[BROADCAST] Ad-Bridge: Resuming playback after interruption");
          const p = audio.play();
          if (p !== undefined) {
            p.then(() => {
              setState(prev => ({ ...prev, isPlaying: true }));
            }).catch(() => {
              setState(prev => advanceQueueFn(prev));
            });
          }
        }
        setTimeout(() => { adBridgeCooldown = false; }, 5000);
      }, 8000);
    };

    audio.addEventListener("pause", handlePause);

    let watchdogBusy = false;
    watchdogRef.current = setInterval(() => {
      if (!broadcastRef.current || !audio.src || userPausedRef.current || watchdogBusy) return;
      watchdogBusy = true;

      const currentProgress = audio.currentTime;
      if (audio.paused && !audio.ended && !userPausedRef.current) {
        console.warn("[RADIO] Watchdog: Audio paused unexpectedly — forcing resume");
        audio.play().then(() => {
          setState(prev => ({ ...prev, isPlaying: true }));
        }).catch(() => {
          console.warn("[RADIO] Watchdog: Resume failed — advancing queue");
          setState(prev => advanceQueueFn(prev));
        });
      } else if (currentProgress === lastProgressRef.current && !audio.paused && !audio.ended && audio.readyState >= 1) {
        console.warn("[RADIO] Watchdog: Playback stuck at", Math.floor(currentProgress), "s — reloading");
        const src = audio.src;
        audio.src = "";
        audio.src = src;
        audio.currentTime = currentProgress;
        audio.play().catch(() => {
          setState(prev => advanceQueueFn(prev));
        });
      }
      lastProgressRef.current = currentProgress;
      setTimeout(() => { watchdogBusy = false; }, 5000);
    }, 20000);

    return () => {
      audio.removeEventListener("pause", handlePause);
      if (adBridgeTimerRef.current) {
        clearTimeout(adBridgeTimerRef.current);
        adBridgeTimerRef.current = null;
      }
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
  }, [state.broadcast, advanceQueueFn]);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        setVolume,
        seekTo,
        addToQueue,
        removeFromQueue,
        moveInQueue,
        clearQueue,
        playFromQueue,
        toggleShuffle,
        toggleRepeat,
        resumeAutoplay,
        toggleAutopilot,
        setAutopilotPool,
        toggleBroadcast,
        startBroadcastWithPool,
        getShowLabel,
        getNextShowTime,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
