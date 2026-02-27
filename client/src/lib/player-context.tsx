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
}

interface PlayerContextType extends PlayerState {
  playTrack: (track: TrackWithArtist, queue?: TrackWithArtist[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  addToQueue: (track: TrackWithArtist) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
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
    repeat: "off",
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
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

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, progress: audio.currentTime }));
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration }));
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
                  setState(s => ({ ...s, isPlaying: false }));
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
                  setState(s => ({ ...s, isPlaying: false }));
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
      });
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
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
        }).catch((err) => {
          console.error("Audio play failed:", err.message);
          setState(prev => ({ ...prev, isPlaying: false }));
        });
      }
      setState(prev => ({
        ...prev,
        currentTrack: track,
        isPlaying: true,
        progress: 0,
        queue: queue || [track],
        queueIndex: queue ? queue.findIndex(t => t.id === track.id) : 0,
      }));
    }
  }, [reportPlay]);

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

  const nextTrack = useCallback(() => {
    setState(prev => {
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
                setState(s => ({ ...s, isPlaying: false }));
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
                setState(s => ({ ...s, isPlaying: false }));
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
    });
  }, [getNextIndex, reportPlay]);

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
        toggleShuffle,
        toggleRepeat,
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
