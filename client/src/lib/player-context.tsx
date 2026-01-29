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
}

interface PlayerContextType extends PlayerState {
  playTrack: (track: TrackWithArtist, queue?: TrackWithArtist[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  addToQueue: (track: TrackWithArtist) => void;
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
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      nextTrack();
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
      audioRef.current.src = track.audioUrl;
      audioRef.current.play();
      setState(prev => ({
        ...prev,
        currentTrack: track,
        isPlaying: true,
        progress: 0,
        queue: queue || [track],
        queueIndex: queue ? queue.findIndex(t => t.id === track.id) : 0,
      }));
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (audioRef.current && state.currentTrack) {
      if (state.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }
  }, [state.isPlaying, state.currentTrack]);

  const nextTrack = useCallback(() => {
    if (state.queue.length > 0 && state.queueIndex < state.queue.length - 1) {
      const nextIndex = state.queueIndex + 1;
      const nextTrack = state.queue[nextIndex];
      if (audioRef.current && nextTrack) {
        audioRef.current.src = nextTrack.audioUrl;
        audioRef.current.play();
        setState(prev => ({
          ...prev,
          currentTrack: nextTrack,
          queueIndex: nextIndex,
          isPlaying: true,
          progress: 0,
        }));
      }
    } else {
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [state.queue, state.queueIndex]);

  const prevTrack = useCallback(() => {
    if (state.progress > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    
    if (state.queue.length > 0 && state.queueIndex > 0) {
      const prevIndex = state.queueIndex - 1;
      const prevTrack = state.queue[prevIndex];
      if (audioRef.current && prevTrack) {
        audioRef.current.src = prevTrack.audioUrl;
        audioRef.current.play();
        setState(prev => ({
          ...prev,
          currentTrack: prevTrack,
          queueIndex: prevIndex,
          isPlaying: true,
          progress: 0,
        }));
      }
    }
  }, [state.queue, state.queueIndex, state.progress]);

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
