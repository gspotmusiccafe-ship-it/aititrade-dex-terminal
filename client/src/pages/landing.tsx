import { useState, useRef, useEffect, useCallback } from "react";
import { Music2, Play, Pause, Crown, Clock, Headphones, Users, ArrowRight, Star, CheckCircle2, SkipForward, SkipBack, Volume2, VolumeX, Disc3, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
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
    title: "2 Weeks Before Everyone",
    description: "Discover new AI music 2 weeks before it drops on Spotify, Amazon Music, Deezer, YouTube, and Anghami",
  },
  {
    icon: Headphones,
    title: "All-AI Music Catalog",
    description: "A curated catalog of AI-generated music across every genre — discover the future of sound",
  },
  {
    icon: Users,
    title: "Support AI Artists",
    description: "AI artists earn more per stream while you enjoy exclusive content and early releases",
  },
];

const membershipTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Listen to released music", "Follow artists & like tracks", "Tip artists via PayPal", "Buy songs", "AITIFY MUSIC RADIO 97.7 THE FLAME"],
    highlight: false,
  },
  {
    name: "Silver",
    price: "$1.99",
    period: "/month",
    features: [
      "Listen to released music",
      "Follow artists",
      "Create unlimited playlists",
    ],
    highlight: false,
  },
  {
    name: "Bronze",
    price: "$3.99",
    period: "/month",
    features: [
      "Released + pre-release music",
      "Create unlimited playlists",
      "Watch music videos",
      "High quality audio",
    ],
    highlight: true,
  },
  {
    name: "Gold",
    price: "$49.99",
    period: " to join",
    features: [
      "Everything in Bronze + $9.99/mo",
      "Unlimited track uploads",
      "Upload music videos (MP3/YouTube)",
      "AI Lyrics Generator",
      "Aitify Music Production Team",
      "Professional audio mastering",
      "Distribution to all platforms",
      "Marketing & promotions",
      "Aitify Music Store (25% retention)",
      "Tip Jar from fans via PayPal",
      "Leaderboard ranking & tier badges",
      "Analytics dashboard",
      "Lossless audio quality",
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
      toast({ title: "Account created!", description: "Welcome to AITIFY MUSIC RADIO" });
      onSuccess?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/login", { email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!" });
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
    <Card className="bg-card/80 backdrop-blur-xl border-border/30 shadow-2xl shadow-primary/10 w-full max-w-sm">
      <CardContent className="p-6">
        <div className="flex gap-2 mb-6">
          <Button
            variant={mode === "login" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => { setMode("login"); setError(""); }}
            data-testid="tab-login"
          >
            Log In
          </Button>
          <Button
            variant={mode === "signup" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => { setMode("signup"); setError(""); }}
            data-testid="tab-signup"
          >
            Sign Up
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                  data-testid="input-display-name"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
                data-testid="input-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium" data-testid="text-auth-error">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending} data-testid="button-auth-submit">
            {isPending ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-border/30">
          <p className="text-xs text-muted-foreground text-center mb-3">Or continue with</p>
          <Button variant="outline" className="w-full gap-2 border-[#1DB954]/30 hover:bg-[#1DB954]/10 text-[#1DB954]" asChild data-testid="button-spotify-login">
            <a href="/api/login/spotify">
              <SiSpotify className="h-4 w-4" />
              Log in with Spotify
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
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
                List Assets
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
              &gt; SOVEREIGN MUSIC EXCHANGE | STREAM ASSETS 2 WEEKS PRE-MARKET |
              SETTLEMENT RATE: $0.00025/STREAM | SECTORS: $MUSE $DYNM $FLAME
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1">CLASS: MUSICAL EQUITY</span>
              <span className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-1">CEO POS: $99</span>
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1">INVESTOR POS: $25</span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1">FINANCING: $475 TERMS</span>
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
              &gt; INVESTOR $25 | CEO $99 | FINANCING AVAILABLE AT $475 TERMS
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-6xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <div
                key={index}
                className={`relative overflow-hidden transition-all border ${
                  tier.highlight
                    ? "border-emerald-500/60 bg-black"
                    : "border-emerald-500/20 bg-black hover:border-emerald-500/40"
                }`}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
              >
                {tier.highlight && (
                  <div className="bg-emerald-500/20 text-emerald-400 text-center py-1 text-[9px] font-bold uppercase tracking-wider border-b border-emerald-500/30">
                    RECOMMENDED POSITION
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-4">
                    <h3 className="font-bold text-sm mb-1 text-emerald-400 tracking-tight">{tier.name.toUpperCase()}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{tier.price}</span>
                      <span className="text-emerald-500/40 text-[10px]">{tier.period}</span>
                    </div>
                    {tier.name !== "Free" && (
                      <p className="text-[9px] text-yellow-400/70 mt-1">$475 FINANCING TERMS AVAILABLE</p>
                    )}
                  </div>

                  <ul className="space-y-2 mb-5">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-emerald-500/60">
                        <span className="text-emerald-400 mt-0.5">▸</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.name !== "Free" ? (
                    <button
                      className={`w-full py-2 text-[10px] font-bold transition-colors ${tier.highlight ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                      onClick={() => openAuth("signup")}
                    >
                      ACQUIRE POSITION
                    </button>
                  ) : (
                    <button
                      className="w-full py-2 text-[10px] font-bold border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      onClick={() => openAuth("signup")}
                    >
                      OPEN FREE ACCOUNT
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Artists CTA Section */}
      <section id="artists" className="py-20 px-4 sm:px-6 lg:px-8 bg-black border-t border-emerald-500/10">
        <div className="max-w-4xl mx-auto text-center font-mono">
          <Crown className="h-10 w-10 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight mb-4 text-emerald-400">
            LIST YOUR ASSETS ON THE EXCHANGE
          </h2>
          <p className="text-emerald-500/50 mb-8 max-w-2xl mx-auto text-sm">
            &gt; Upload sovereign music assets | Set pre-release dates | Earn settlement at $0.00025/stream
          </p>
          <button onClick={() => openAuth("signup")} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-xs font-bold transition-colors">
            APPLY FOR ARTIST LISTING
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
