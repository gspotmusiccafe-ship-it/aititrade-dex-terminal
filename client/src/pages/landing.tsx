import { useState, useRef, useEffect, useCallback } from "react";
import { Music2, Play, Pause, Crown, Clock, Headphones, Users, ArrowRight, Star, CheckCircle2, SkipForward, SkipBack, Volume2, VolumeX, Disc3, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { BLUEVINE_MINT_URL, BLUEVINE_TRUST_URL } from "@/lib/checkout-config";
import { SiSpotify } from "react-icons/si";
import { MarketTicker } from "@/components/market-ticker";
import logoImage from "@assets/AITIFY_MUSIC_RADIO_LOGO_IMAGE_1773164873830.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TrackData {
  id: string;
  title: string;
  audioUrl: string;
  coverImage: string | null;
  genre: string | null;
  artist: { name: string; profileImage: string | null } | null;
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function HeroPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);

  const { data: tracks } = useQuery<TrackData[]>({
    queryKey: ["/api/tracks/featured"],
  });

  const playlist = tracks?.filter((t) => t.audioUrl) || [];
  const current = playlist[currentIndex];

  useEffect(() => {
    if (tracks && currentIndex >= playlist.length && playlist.length > 0) {
      setCurrentIndex(0);
    }
  }, [tracks, playlist.length, currentIndex]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    setPlayError(null);
    if (!audio.src || audio.src === window.location.href) {
      audio.src = current.audioUrl;
      audio.load();
    }
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch((err: Error) => {
          console.error("Audio play failed:", err.message);
          if (err.name === "NotAllowedError") {
            setPlayError("Tap play again — your browser blocked autoplay");
          } else {
            setPlayError("Playback failed — try another track");
          }
          setIsPlaying(false);
        });
    }
  }, [current]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const playNextDirect = useCallback((audio: HTMLAudioElement, nextIndex: number) => {
    const pl = playlistRef.current;
    if (!pl.length) return;
    const idx = ((nextIndex % pl.length) + pl.length) % pl.length;
    const nextTrack = pl[idx];
    if (!nextTrack) return;
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    setCurrentTime(0);
    setDuration(0);
    setPlayError(null);
    audio.src = nextTrack.audioUrl;
    const p = audio.play();
    if (p !== undefined) {
      p.then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
          setPlayError("Tap play to continue listening");
        });
    }
  }, []);

  const skipTo = useCallback((index: number, autoPlay = false) => {
    const pl = playlistRef.current;
    if (!pl.length) return;
    const next = ((index % pl.length) + pl.length) % pl.length;
    const audio = audioRef.current;
    if (!audio) return;
    setPlayError(null);
    setCurrentIndex(next);
    currentIndexRef.current = next;
    setIsLoaded(false);
    setCurrentTime(0);
    setDuration(0);
    const nextTrack = pl[next];
    if (nextTrack && (autoPlay || isPlayingRef.current)) {
      audio.src = nextTrack.audioUrl;
      const p = audio.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
            setPlayError("Tap play to continue listening");
          });
      }
    } else if (nextTrack) {
      audio.src = nextTrack.audioUrl;
      audio.load();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => { setDuration(audio.duration); setIsLoaded(true); };
    const onEnded = () => {
      playNextDirect(audio, currentIndexRef.current + 1);
    };
    const onError = () => {
      setIsLoaded(false);
      if (playlistRef.current.length > 1) {
        setTimeout(() => playNextDirect(audio, currentIndexRef.current + 1), 300);
      } else {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [playNextDirect]);

  const seek = (val: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = val[0];
    setCurrentTime(val[0]);
  };

  const coverSrc = current?.coverImage || current?.artist?.profileImage || null;

  return (
    <div className="relative aspect-square max-w-lg mx-auto">
      <audio ref={audioRef} preload="metadata" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl blur-3xl" />

      <div className="relative h-full rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 overflow-hidden flex flex-col">
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black/20">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt={current?.title || "Album cover"}
              className={`w-full h-full object-cover transition-transform duration-700 ${isPlaying ? "scale-105" : "scale-100"}`}
              data-testid="img-hero-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Disc3 className={`h-24 w-24 text-primary/40 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
              <span className="text-xs text-muted-foreground">
                {playlist.length ? "No artwork" : "Loading tracks..."}
              </span>
            </div>
          )}
          {coverSrc && isPlaying && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          )}

          <div className="absolute top-3 right-3 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-medium shadow-lg">
            LIVE
          </div>
        </div>

        <div className="p-4 bg-card/95 backdrop-blur-sm border-t border-border/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider" data-testid="text-hero-radio-label">97.7 THE FLAME</p>
              <p className="text-sm font-semibold truncate" data-testid="text-hero-track-title">
                {current?.title || "Select a track"}
              </p>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-hero-track-artist">
                {current?.artist?.name || "AITIFY MUSIC RADIO"}
              </p>
              {playError && (
                <p className="text-xs text-destructive mt-0.5" data-testid="text-play-error">{playError}</p>
              )}
            </div>
            {current?.genre && (
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                {current.genre}
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.5}
              onValueChange={seek}
              className="cursor-pointer"
              data-testid="slider-hero-seek"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-full hover:bg-muted/50 transition-colors"
                data-testid="button-hero-mute"
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={(v) => { setVolume(v[0] / 100); if (isMuted) setIsMuted(false); }}
                className="w-16 cursor-pointer"
                data-testid="slider-hero-volume"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => skipTo(currentIndex - 1)}
                disabled={!playlist.length}
                className="p-2 rounded-full hover:bg-muted/50 transition-colors disabled:opacity-30"
                data-testid="button-hero-prev"
                aria-label="Previous track"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!playlist.length}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30 shadow-lg"
                data-testid="button-hero-play"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
              <button
                onClick={() => skipTo(currentIndex + 1)}
                disabled={!playlist.length}
                className="p-2 rounded-full hover:bg-muted/50 transition-colors disabled:opacity-30"
                data-testid="button-hero-next"
                aria-label="Next track"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            <div className="text-[10px] text-muted-foreground w-16 text-right">
              {playlist.length > 0 && `${currentIndex + 1} / ${playlist.length}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: Clock,
    title: "2-Week Early Trading Edge",
    description: "Discover and trade new AI assets 2 weeks before they hit the retail stream (Spotify, Amazon, YouTube)",
  },
  {
    icon: Headphones,
    title: "All-AI Asset Catalog",
    description: "A curated catalog of AI-generated high-velocity assets across every sector — the future of sovereign equity",
  },
  {
    icon: Users,
    title: "Support Asset Architects",
    description: "Asset Architects mint high-velocity assets and earn more per stream while you build positions in exclusive pre-market equity",
  },
];

const membershipTiers = [
  {
    name: "Front Page Investor",
    price: "FREE",
    period: "",
    stream: "free",
    features: [
      "Paper trading on 97.7 THE FLAME",
      "Stream AI-generated assets",
      "Free Spotify account required",
      "Landing page access only",
      "No inside exchange access",
    ],
    highlight: false,
  },
  {
    name: "Mint Factory CEO",
    price: "$9.99",
    period: "/month",
    stream: "mintor",
    features: [
      "Full Sovereign Exchange access",
      "Mint & trade all asset classes",
      "2-Week Early Pre-release trading",
      "16% Daily Trading Credit",
      "AI Lyrics Generator & Audio Mastering",
      "Distribution to Spotify, Amazon, YouTube",
      "Marketing & promotions",
      "Aitify Music Store — 25% retention",
      "Leaderboard, analytics & tier badges",
      "Lossless audio quality",
    ],
    highlight: true,
  },
  {
    name: "Asset Trustee",
    price: "$500",
    period: " total",
    stream: "trust",
    features: [
      "$25 DOWN / 0% INTEREST / $19.79 MO FOR 24 MONTHS",
      "Full Sovereign Exchange access",
      "All assets + pre-release papers",
      "Priority settlement queue",
      "High-Volatility asset trading",
      "Dual-status — hold with MINTOR tier",
      "Trust certificate on all positions",
      "High quality audio",
    ],
    highlight: false,
  },
];

function AuthForm({ mode: initialMode = "login", onSuccess }: { mode?: "login" | "signup"; onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/signup", { email, password, displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "✦ ACCOUNT CREATED", description: "Welcome to the Sovereign Exchange — upgrade to start trading" });
      onSuccess?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/login", { email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "✦ LOGIN VERIFIED", description: "Access granted — loading exchange..." });
      onSuccess?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup") {
      if (!displayName.trim()) { setError("Display name is required"); return; }
      signupMutation.mutate();
    } else {
      loginMutation.mutate();
    }
  };

  const isPending = signupMutation.isPending || loginMutation.isPending;

  return (
    <div className="bg-black border border-emerald-500/30 w-full max-w-sm font-mono shadow-2xl shadow-emerald-500/10">
      <div className="border-b border-emerald-500/20 px-4 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-emerald-500 font-bold">AITIFY INSIDER ACCESS TERMINAL</span>
      </div>
      <div className="p-5">
        <div className="flex gap-1 mb-5">
          <button
            className={`flex-1 text-[10px] font-bold py-1.5 transition-colors ${mode === "login" ? "bg-emerald-600 text-white" : "border border-emerald-500/20 text-emerald-500/50 hover:text-emerald-400"}`}
            onClick={() => { setMode("login"); setError(""); }}
            data-testid="tab-login"
          >
            LOG IN
          </button>
          <button
            className={`flex-1 text-[10px] font-bold py-1.5 transition-colors ${mode === "signup" ? "bg-emerald-600 text-white" : "border border-emerald-500/20 text-emerald-500/50 hover:text-emerald-400"}`}
            onClick={() => { setMode("signup"); setError(""); }}
            data-testid="tab-signup"
          >
            OPEN ACCOUNT
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <div className="space-y-1">
              <label htmlFor="displayName" className="text-[9px] text-emerald-500/60 uppercase">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/40" />
                <input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-black border border-emerald-500/20 text-emerald-400 text-xs pl-9 pr-3 py-2 placeholder:text-emerald-500/20 focus:border-emerald-500/50 focus:outline-none font-mono"
                  data-testid="input-display-name"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="text-[9px] text-emerald-500/60 uppercase">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/40" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-emerald-500/20 text-emerald-400 text-xs pl-9 pr-3 py-2 placeholder:text-emerald-500/20 focus:border-emerald-500/50 focus:outline-none font-mono"
                required
                data-testid="input-email"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[9px] text-emerald-500/60 uppercase">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/40" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-emerald-500/20 text-emerald-400 text-xs pl-9 pr-9 py-2 placeholder:text-emerald-500/20 focus:border-emerald-500/50 focus:outline-none font-mono"
                required
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500/40 hover:text-emerald-400"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[10px] text-red-400 font-bold border border-red-500/20 bg-red-500/5 px-2 py-1" data-testid="text-auth-error">{error}</p>
          )}

          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-2 transition-colors disabled:opacity-50" disabled={isPending} data-testid="button-auth-submit">
            {isPending ? "AUTHENTICATING..." : mode === "signup" ? "OPEN ACCOUNT" : "LOG IN"}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-emerald-500/10">
          <p className="text-[9px] text-emerald-500/30 text-center mb-2">EXTERNAL AUTHENTICATION</p>
          <a href="/api/login/spotify" className="w-full flex items-center justify-center gap-2 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold py-2 hover:bg-emerald-500/10 transition-colors" data-testid="button-spotify-login">
            <SiSpotify className="h-3.5 w-3.5" />
            AUTHENTICATE VIA SPOTIFY
          </a>
        </div>
      </div>
    </div>
  );
}

function AuthErrorBanner() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      const messages: Record<string, string> = {
        spotify_denied: "Spotify login was cancelled. Please try again.",
        token_failed: "Login failed. Please try again.",
        profile_failed: "Could not retrieve your Spotify profile. Please try again.",
        login_failed: "Login failed. Please try again.",
        server_error: "Something went wrong. Please try again later.",
        spotify_not_registered: "Your Spotify account is not yet authorized for AITIFY Music Radio. Please contact support to get access.",
      };
      setError(messages[authError] || "Login failed. Please try again.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  if (!error) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4" data-testid="auth-error-banner">
      <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{error}</p>
        <button onClick={() => setError(null)} className="text-white/80 hover:text-white shrink-0" data-testid="button-dismiss-error">✕</button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const openAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <MarketTicker />
      </div>
      <AuthErrorBanner />

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAuthModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <AuthForm mode={authMode} onSuccess={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

      <header className="fixed top-[30px] left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-emerald-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4 font-mono">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY" className="w-7 h-7 object-cover" />
              <span className="text-emerald-400 text-xs font-bold hidden sm:inline">AITIFY EXCHANGE</span>
            </div>

            <nav className="hidden md:flex items-center gap-4">
              <a href="#features" className="text-[10px] text-emerald-500/50 hover:text-emerald-400 transition-colors uppercase">
                Capabilities
              </a>
              <a href="#pricing" className="text-[10px] text-emerald-500/50 hover:text-emerald-400 transition-colors uppercase">
                Positions
              </a>
              <a href="#artists" className="text-[10px] text-emerald-500/50 hover:text-emerald-400 transition-colors uppercase">
                Asset Architects
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <button onClick={() => openAuth("login")} data-testid="button-login" className="text-emerald-400 text-[10px] font-bold px-3 py-1.5 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors">
                LOG IN
              </button>
              <button onClick={() => openAuth("signup")} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 transition-colors" data-testid="button-signup">
                OPEN ACCOUNT
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section — Bloomberg Terminal */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto font-mono">
          <div className="border border-emerald-500/30 bg-black p-6 sm:p-10 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-500 text-xs">SOVEREIGN EXCHANGE TERMINAL</span>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter mb-4 text-emerald-400" data-testid="text-radio-hero-title">
              AITIFY MUSIC RADIO{" "}
              <span className="text-yellow-400">97.7 THE FLAME</span>
            </h1>
            <p className="text-sm sm:text-base text-emerald-500/70 max-w-2xl font-mono">
              &gt; DISCOVER AND TRADE NEW AI ASSETS 2 WEEKS BEFORE THEY HIT THE RETAIL STREAM (SPOTIFY, AMAZON, YOUTUBE) |
              SETTLEMENT RATE: $0.00025/STREAM | SECTORS: $MUSE $DYNM $FLAME
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1">CLASS: AI-GENERATED EQUITY</span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-1">MINT FACTORY CEO: $99</span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1">EXCHANGE TRADER: $24.99</span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-1">ENTRY TRADER: $4.99</span>
              <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-1">FREE: FRONT PAGE ONLY</span>
            </div>
          </div>

          <div className="max-w-lg mx-auto mb-8">
            <HeroPlayer />
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" variant="outline" asChild className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-mono">
              <a href="#pricing">
                VIEW FINANCING TERMS
                <ArrowRight className="h-4 w-4 ml-2" />
              </a>
            </Button>
            <Button size="lg" onClick={() => openAuth("signup")} data-testid="button-hero-cta" className="bg-emerald-600 hover:bg-emerald-700 font-mono gap-1.5 border-0">
              OPEN TRADING ACCOUNT
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto font-mono">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-4 text-emerald-400">
              SOVEREIGN EXCHANGE CAPABILITIES
            </h2>
            <p className="text-emerald-500/60 max-w-2xl mx-auto text-sm">
              &gt; TRADE SOVEREIGN ASSETS | EARN SETTLEMENT | BUILD POSITIONS
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="bg-black border border-emerald-500/20 hover:border-emerald-500/50 transition-all p-5">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
                  <feature.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="font-bold text-sm mb-2 text-emerald-400">{feature.title.toUpperCase()}</h3>
                <p className="text-emerald-500/50 text-xs">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section — Financing Gate */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-7xl mx-auto font-mono">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-4 text-emerald-400">
              POSITION TIERS & FINANCING TERMS
            </h2>
            <p className="text-emerald-500/60 max-w-2xl mx-auto text-sm">
              &gt; DUAL-STREAM REVENUE MODEL | <span className="text-lime-400 font-bold">MINTOR $9.99/MO</span> | <span className="text-amber-400 font-bold">TRUST $25 DOWN</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {membershipTiers.map((tier, index) => {
              const isMintor = tier.stream === "mintor";
              const isTrust = tier.stream === "trust";
              const isFree = tier.stream === "free";
              const borderCls = isTrust
                ? "border-amber-500/60 bg-black hover:border-amber-500/80"
                : isMintor
                ? "border-lime-500/60 bg-black"
                : "border-zinc-700/40 bg-black hover:border-zinc-700/60";
              const titleCls = isTrust ? "text-amber-400" : isMintor ? "text-lime-400" : "text-zinc-400";
              const priceCls = isTrust ? "text-amber-300" : isMintor ? "text-lime-300" : "text-white";
              const bulletCls = isTrust ? "text-amber-400" : isMintor ? "text-lime-400" : "text-zinc-500";
              const featureCls = isTrust ? "text-amber-500/70" : isMintor ? "text-lime-500/70" : "text-zinc-500";

              return (
                <div
                  key={index}
                  className={`relative overflow-hidden transition-all border ${borderCls}`}
                  data-testid={`pricing-tier-${tier.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {isMintor && (
                    <div className="bg-lime-500/20 text-lime-400 text-center py-1.5 text-[10px] font-extrabold uppercase tracking-wider border-b border-lime-500/30">
                      ◆ MINTOR — MINT & TRADE
                    </div>
                  )}
                  {isTrust && (
                    <div className="bg-amber-500/20 text-amber-400 text-center py-1.5 text-[10px] font-extrabold uppercase tracking-wider border-b border-amber-500/30">
                      ◆ TRUST INVESTOR — $25 DOWN
                    </div>
                  )}
                  <div className="p-5">
                    <div className="mb-4">
                      <h3 className={`font-extrabold text-sm mb-1 tracking-tight ${titleCls}`}>{tier.name.toUpperCase()}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-black ${priceCls}`}>{tier.price}</span>
                        <span className={`text-[10px] ${featureCls}`}>{tier.period}</span>
                      </div>
                      {isFree && (
                        <p className="text-[9px] text-zinc-500 mt-1">PAPER TRADING ONLY — SPOTIFY ACCOUNT REQUIRED</p>
                      )}
                      {isMintor && (
                        <p className="text-[10px] text-lime-400/60 mt-1 font-bold">BLUEVINE RECURRING — CANCEL ANYTIME</p>
                      )}
                      {isTrust && (
                        <p className="text-[10px] text-amber-400/60 mt-1 font-bold">$25 DOWN / 0% INTEREST / $19.79 MO × 24</p>
                      )}
                    </div>

                    <ul className="space-y-2 mb-5">
                      {tier.features.map((feature, i) => (
                        <li key={i} className={`flex items-start gap-2 text-[11px] ${featureCls}`}>
                          <span className={`mt-0.5 ${isFree && feature.includes("No ") ? "text-red-400" : bulletCls}`}>▸</span>
                          <span className={`${isFree && feature.includes("No ") ? "text-red-400/60" : ""} ${feature.includes("$25 DOWN") || feature.includes("$19.79") ? "font-extrabold text-amber-400" : ""}`}>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isTrust && (
                      <p className="text-[9px] text-amber-500/50 mb-3 text-center font-bold">DUAL ACCESS — HOLD WITH MINTOR TIER</p>
                    )}

                    {isMintor ? (
                      <a
                        href={BLUEVINE_MINT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 text-[11px] font-extrabold text-center bg-lime-600 text-white hover:bg-lime-700 transition-colors"
                        data-testid="button-mintor-checkout"
                      >
                        ACTIVATE MINTOR — $9.99/MO
                      </a>
                    ) : isTrust ? (
                      <a
                        href={BLUEVINE_TRUST_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2.5 text-[11px] font-extrabold text-center bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                        data-testid="button-trust-checkout"
                      >
                        ACQUIRE TRUST — $25 DOWN
                      </a>
                    ) : (
                      <button
                        className="w-full py-2 text-[10px] font-bold border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
                        onClick={() => openAuth("signup")}
                      >
                        CREATE FREE ACCOUNT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Asset Architects CTA Section */}
      <section id="artists" className="py-20 px-4 sm:px-6 lg:px-8 bg-black border-t border-emerald-500/10">
        <div className="max-w-4xl mx-auto text-center font-mono">
          <Crown className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-4 text-emerald-400">
            BECOME AN ASSET ARCHITECT
          </h2>
          <p className="text-emerald-500/50 mb-8 max-w-2xl mx-auto text-sm">
            &gt; Mint high-velocity assets | Set 2-week pre-market dates | Earn settlement at $0.00025/stream | Autopilot priority rotation
          </p>
          <button onClick={() => openAuth("signup")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-xs font-bold transition-colors">
            APPLY FOR ASSET ARCHITECT LISTING
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-emerald-500/10 bg-black">
        <div className="max-w-7xl mx-auto font-mono">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY" className="w-6 h-6 object-cover" />
              <span className="text-emerald-400 text-xs font-bold">AITIFY SOVEREIGN EXCHANGE</span>
            </div>
            <p className="text-[10px] text-emerald-500/40">
              SETTLEMENT: $0.00025/STREAM | SECTORS: $MUSE $DYNM $FLAME | 97.7 THE FLAME
            </p>
            <p className="text-[10px] text-emerald-500/30">
              &copy; {new Date().getFullYear()} AITIFY MUSIC RADIO. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
