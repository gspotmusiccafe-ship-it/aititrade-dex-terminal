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
  clearQueue: () => void;
  playFromQueue: (index: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  resumeAutoplay: () => void;
  toggleAutopilot: () => void;
  setAutopilotPool: (tracks: TrackWithArtist[]) => void;
  toggleBroadcast: () => void;
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
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoggedTrackRef = useRef<string | null>(null);

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

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = state.volume;
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.preload = "auto";

    preloadRef.current = new Audio();
    preloadRef.current.preload = "auto";
    preloadRef.current.volume = 0;

    const audio = audioRef.current;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = source;

      const bass = ctx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 200;
      bass.gain.value = 6;

      const subBass = ctx.createBiquadFilter();
      subBass.type = "peaking";
      subBass.frequency.value = 80;
      subBass.Q.value = 1.0;
      subBass.gain.value = 4;

      const lowMid = ctx.createBiquadFilter();
      lowMid.type = "peaking";
      lowMid.frequency.value = 400;
      lowMid.Q.value = 0.7;
      lowMid.gain.value = 1;

      const highMid = ctx.createBiquadFilter();
      highMid.type = "peaking";
      highMid.frequency.value = 3000;
      highMid.Q.value = 0.7;
      highMid.gain.value = -1;

      const presence = ctx.createBiquadFilter();
      presence.type = "highshelf";
      presence.frequency.value = 8000;
      presence.gain.value = 1;

      source.connect(bass);
      bass.connect(subBass);
      subBass.connect(lowMid);
      lowMid.connect(highMid);
      highMid.connect(presence);
      presence.connect(ctx.destination);
    } catch (e) {
      console.warn("Web Audio EQ not available, using direct playback");
    }

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

    const advanceQueue = (prev: PlayerState): PlayerState => {
      const nextIndex = getNextIndex(prev.queueIndex, prev.queue.length, prev.shuffle);

      if (nextIndex < prev.queue.length) {
        const nextT = prev.queue[nextIndex];
        if (audioRef.current && nextT) {
          playCountedRef.current = null;
          audioRef.current.src = nextT.audioUrl;
          const p = audioRef.current.play();
          if (p !== undefined) {
            p.then(() => reportPlay(nextT.id))
              .catch((err) => {
                console.error("Audio play failed:", err.message);
                setTimeout(() => setState(s => advanceQueue(s)), 500);
              });
          }
        }
        return {
          ...prev,
          currentTrack: nextT,
          queueIndex: nextIndex,
          isPlaying: true,
          progress: 0,
        };
      } else if (prev.autopilot && prev.autopilotPool.length > 0) {
        const playedIds = new Set(prev.queue.map(t => t.id));
        const available = prev.autopilotPool.filter(t => !playedIds.has(t.id) && t.audioUrl);
        const fallback = available.length > 0 ? available : prev.autopilotPool.filter(t => t.id !== prev.currentTrack?.id && t.audioUrl);
        if (fallback.length > 0) {
          const prerelease = fallback.filter(t => (t as any).isPrerelease);
          const priorityPool = prerelease.length > 0 ? prerelease : fallback;
          const pick = prev.shuffle
            ? priorityPool[Math.floor(Math.random() * priorityPool.length)]
            : priorityPool[0];
          const newQueue = [...prev.queue, pick];
          const newIndex = newQueue.length - 1;
          if (audioRef.current && pick) {
            playCountedRef.current = null;
            audioRef.current.src = pick.audioUrl;
            const p = audioRef.current.play();
            if (p !== undefined) {
              p.then(() => reportPlay(pick.id))
                .catch((err) => {
                  console.error("Audio play failed:", err.message);
                  setTimeout(() => setState(s => advanceQueue(s)), 500);
                });
            }
          }
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
        if (audioRef.current && firstTrack) {
          playCountedRef.current = null;
          audioRef.current.src = firstTrack.audioUrl;
          const p = audioRef.current.play();
          if (p !== undefined) {
            p.then(() => reportPlay(firstTrack.id))
              .catch((err) => {
                console.error("Audio play failed:", err.message);
                setTimeout(() => setState(s => advanceQueue(s)), 500);
              });
          }
        }
        return {
          ...prev,
          currentTrack: firstTrack,
          queueIndex: firstIndex,
          isPlaying: true,
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
    const handleError = () => {
      console.warn("Audio load error — skipping to next track");
      if (errorSkipTimeout) clearTimeout(errorSkipTimeout);
      errorSkipTimeout = setTimeout(() => {
        setState(prev => {
          if (prev.queue.length <= 1) return { ...prev, isPlaying: false };
          return advanceQueue(prev);
        });
      }, 500);
    };

    const handleStalled = () => {
      console.warn("Audio stalled — attempting recovery");
      if (audioRef.current && audioRef.current.src) {
        const currentSrc = audioRef.current.src;
        setTimeout(() => {
          if (audioRef.current && !audioRef.current.paused && audioRef.current.currentTime === 0) {
            audioRef.current.src = currentSrc;
            audioRef.current.play().catch(() => {
              setState(prev => advanceQueue(prev));
            });
          }
        }, 3000);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("stalled", handleStalled);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("stalled", handleStalled);
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

  const playTrack = useCallback((track: TrackWithArtist, queue?: TrackWithArtist[]) => {
    if (audioRef.current) {
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
      setState(prev => ({
        ...prev,
        currentTrack: track,
        isPlaying: true,
        progress: 0,
        autoplayBlocked: false,
        queue: queue || [track],
        queueIndex: queue ? queue.findIndex(t => t.id === track.id) : 0,
      }));
    }
  }, [reportPlay, resumeAudioContext]);

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

  const advanceQueueFn = useCallback((prev: PlayerState): PlayerState => {
    const nextIndex = getNextIndex(prev.queueIndex, prev.queue.length, prev.shuffle);

    if (nextIndex < prev.queue.length) {
      const nextT = prev.queue[nextIndex];
      if (audioRef.current && nextT) {
        playCountedRef.current = null;
        audioRef.current.src = nextT.audioUrl;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => reportPlay(nextT.id))
            .catch((err) => {
              console.error("Audio play failed:", err.message);
              setTimeout(() => setState(s => advanceQueueFn(s)), 500);
            });
        }
      }
      return {
        ...prev,
        currentTrack: nextT,
        queueIndex: nextIndex,
        isPlaying: true,
        progress: 0,
      };
    } else if (prev.autopilot && prev.autopilotPool.length > 0) {
      const playedIds = new Set(prev.queue.map(t => t.id));
      const available = prev.autopilotPool.filter(t => !playedIds.has(t.id) && t.audioUrl);
      const fallback = available.length > 0 ? available : prev.autopilotPool.filter(t => t.id !== prev.currentTrack?.id && t.audioUrl);
      if (fallback.length > 0) {
        const prerelease = fallback.filter(t => (t as any).isPrerelease);
        const priorityPool = prerelease.length > 0 ? prerelease : fallback;
        const pick = prev.shuffle
          ? priorityPool[Math.floor(Math.random() * priorityPool.length)]
          : priorityPool[0];
        const newQueue = [...prev.queue, pick];
        const newIdx = newQueue.length - 1;
        if (audioRef.current && pick) {
          playCountedRef.current = null;
          audioRef.current.src = pick.audioUrl;
          const p = audioRef.current.play();
          if (p !== undefined) {
            p.then(() => reportPlay(pick.id))
              .catch((err) => {
                console.error("Audio play failed:", err.message);
                setTimeout(() => setState(s => advanceQueueFn(s)), 500);
              });
          }
        }
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
      if (audioRef.current && firstTrack) {
        playCountedRef.current = null;
        audioRef.current.src = firstTrack.audioUrl;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => reportPlay(firstTrack.id))
            .catch((err) => {
              console.error("Audio play failed:", err.message);
              setTimeout(() => setState(s => advanceQueueFn(s)), 500);
            });
        }
      }
      return {
        ...prev,
        currentTrack: firstTrack,
        queueIndex: firstIndex,
        isPlaying: true,
        progress: 0,
      };
    }

    return { ...prev, isPlaying: false };
  }, [getNextIndex, reportPlay]);

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
      if (audioRef.current && prevT) {
        playCountedRef.current = null;
        audioRef.current.src = prevT.audioUrl;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => reportPlay(prevT.id))
            .catch((err) => {
              console.error("Audio play failed:", err.message);
              setState(s => ({ ...s, isPlaying: false }));
            });
        }
        setState(prev => ({
          ...prev,
          currentTrack: prevT,
          queueIndex: prevIndex,
          isPlaying: true,
          progress: 0,
        }));
      }
    }
  }, [state.queue, state.queueIndex, state.progress, reportPlay]);

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
      if (track && audioRef.current) {
        playCountedRef.current = null;
        audioRef.current.src = track.audioUrl;
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => reportPlay(track.id))
            .catch((err) => {
              console.error("Audio play failed:", err.message);
              setState(s => ({ ...s, isPlaying: false }));
            });
        }
        return { ...prev, currentTrack: track, queueIndex: index, isPlaying: true, progress: 0 };
      }
      return prev;
    });
  }, [reportPlay]);

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
      if (newBroadcast) {
        broadcastStartRef.current = Date.now();
        return { ...prev, broadcast: true, autopilot: true, repeat: "all", currentShow: getCurrentShow() };
      }
      if (adBridgeTimerRef.current) {
        clearInterval(adBridgeTimerRef.current);
        adBridgeTimerRef.current = null;
      }
      return { ...prev, broadcast: false, broadcastUptime: 0 };
    });
  }, []);

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

    const handlePause = () => {
      if (!state.broadcast || userPausedRef.current) return;

      if (adBridgeTimerRef.current) clearTimeout(adBridgeTimerRef.current);
      adBridgeTimerRef.current = setTimeout(() => {
        if (audio.paused && state.broadcast && audio.src && !userPausedRef.current) {
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
      }, 3000);
    };

    audio.addEventListener("pause", handlePause);
    return () => {
      audio.removeEventListener("pause", handlePause);
      if (adBridgeTimerRef.current) {
        clearTimeout(adBridgeTimerRef.current);
        adBridgeTimerRef.current = null;
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
        clearQueue,
        playFromQueue,
        toggleShuffle,
        toggleRepeat,
        resumeAutoplay,
        toggleAutopilot,
        setAutopilotPool,
        toggleBroadcast,
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
