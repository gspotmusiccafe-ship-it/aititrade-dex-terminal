import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import type { TrackWithArtist } from "@shared/schema";

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
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playCountedRef = useRef<string | null>(null);

  const reportPlay = useCallback((trackId: string) => {
    if (playCountedRef.current !== trackId) {
      playCountedRef.current = trackId;
      fetch(`/api/tracks/${trackId}/play`, { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, []);

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

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, progress: audio.currentTime }));
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
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playTrack = useCallback((track: TrackWithArtist, queue?: TrackWithArtist[]) => {
    if (audioRef.current) {
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
  }, [reportPlay]);

  const resumeAutoplay = useCallback(() => {
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
    if (audioRef.current && state.currentTrack) {
      if (state.isPlaying) {
        audioRef.current.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
      } else {
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
