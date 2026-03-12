import { useState, useRef, useEffect, useCallback } from "react";
import { Music2, Play, Pause, Crown, Clock, Headphones, Users, ArrowRight, Star, CheckCircle2, SkipForward, SkipBack, Volume2, VolumeX, Disc3 } from "lucide-react";
import logoImage from "@assets/AITIFY_MUSIC_RADIO_LOGO_IMAGE_1773164873830.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";

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
  const [wantAutoPlay, setWantAutoPlay] = useState(false);
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

  const skipTo = useCallback((index: number, autoPlay = false) => {
    if (!playlist.length) return;
    const next = ((index % playlist.length) + playlist.length) % playlist.length;
    setPlayError(null);
    setCurrentIndex(next);
    setIsLoaded(false);
    setCurrentTime(0);
    setDuration(0);
    setWantAutoPlay(autoPlay || isPlaying);
  }, [playlist.length, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = current.audioUrl;
    audio.volume = isMuted ? 0 : volume;
    audio.load();
  }, [currentIndex, current?.audioUrl]);

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
    const onCanPlay = () => {
      setIsLoaded(true);
      if (wantAutoPlay) {
        const p = audio.play();
        if (p !== undefined) {
          p.then(() => { setIsPlaying(true); setWantAutoPlay(false); })
            .catch(() => { setWantAutoPlay(false); setIsPlaying(false); });
        }
      }
    };
    const onEnded = () => skipTo(currentIndex + 1, true);
    const onError = () => {
      setIsPlaying(false);
      setIsLoaded(false);
      if (playlist.length > 1) {
        setTimeout(() => skipTo(currentIndex + 1, false), 500);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [currentIndex, skipTo, wantAutoPlay]);

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
    features: ["Listen on AITIFY MUSIC RADIO 97.7 THE FLAME", "No login required"],
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
      "Everything in Bronze",
      "$9.99/month to stay active",
      "Unlimited track uploads",
      "MP3/YouTube video uploads",
      "Marketing & promotions",
      "Music distribution",
      "Advanced analytics",
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY Music Radio" className="w-9 h-9 rounded-lg object-cover" />
              <span className="font-bold text-xl">AITIFY MUSIC RADIO</span>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#artists" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                For Artists
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild data-testid="button-login">
                <a href="/api/login">Log in</a>
              </Button>
              <Button asChild className="bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 border-0 shadow-lg shadow-primary/20" data-testid="button-signup">
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section — AITIFY MUSIC RADIO 97.7 THE FLAME */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="text-xs mb-4 inline-flex">
              <Star className="h-3 w-3 mr-1 text-yellow-500" />
              The All-AI Music Platform
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3" data-testid="text-radio-hero-title">
              AITIFY MUSIC RADIO{" "}
              <span className="text-primary">97.7 THE FLAME</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The world's first all-AI music radio. Tune in free — hear AI-generated music 2 weeks before 
              Spotify, Amazon Music, Deezer, YouTube, and Anghami.
            </p>
          </div>

          <div className="max-w-lg mx-auto mb-8">
            <HeroPlayer />
          </div>

          <div className="text-center space-y-4">
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" variant="outline" asChild>
                <a href="#pricing">
                  Upgrade for Full Access
                  <ArrowRight className="h-4 w-4 ml-2" />
                </a>
              </Button>
              <Button size="lg" asChild data-testid="button-hero-cta">
                <a href="/api/login">
                  <Headphones className="h-5 w-5 mr-2" />
                  Log In for More
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-6 justify-center pt-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-background"
                  />
                ))}
              </div>
              <div className="text-sm">
                <span className="font-semibold">10,000+</span>
                <span className="text-muted-foreground"> music lovers tuned in</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-card/60 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose AITIFY MUSIC RADIO?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We're building a new music experience that puts artists and listeners first
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/60 border-border/30 hover:border-primary/20 hover:-translate-y-1 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works for you. Upgrade anytime for early access to new AI music.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                  tier.highlight
                    ? "border-primary/50 bg-card/80 shadow-xl shadow-primary/10"
                    : "bg-card/60 border-border/30 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
                }`}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground text-center py-1.5 text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}
                <CardContent className={`p-6 ${tier.highlight ? "pt-10" : ""}`}>
                  <div className="mb-6">
                    <h3 className="font-semibold text-xl mb-2">{tier.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground text-sm">{tier.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.name !== "Free" && (
                    <Button
                      className={`w-full ${tier.highlight ? "bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 border-0 shadow-lg shadow-primary/20" : ""}`}
                      variant={tier.highlight ? "default" : "outline"}
                      asChild
                    >
                      <a href="/api/login">
                        Start Free Trial
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Artists CTA Section */}
      <section id="artists" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="max-w-4xl mx-auto text-center">
          <Crown className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Are You an AI Music Artist?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your AI-generated music, set pre-release dates, and let fans hear it 
            2 weeks before Spotify, Amazon Music, Deezer, YouTube, and Anghami. Build your audience first on AITIFY.
          </p>
          <Button size="lg" asChild>
            <a href="/api/login">
              Join as Artist
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/20 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY Music Radio" className="w-8 h-8 rounded-lg object-cover" />
              <span className="font-bold">AITIFY MUSIC RADIO</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Get music first. Support artists directly.
            </p>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} AITIFY MUSIC RADIO. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
