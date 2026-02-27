import { useState, useRef, useEffect, useCallback } from "react";
import { Music2, Play, Pause, Crown, Clock, Headphones, Users, ArrowRight, Star, CheckCircle2, SkipForward, SkipBack, Volume2, VolumeX, Disc3 } from "lucide-react";
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
    if (!audioRef.current || !current) return;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
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
        audio.play().then(() => { setIsPlaying(true); setWantAutoPlay(false); }).catch(() => setWantAutoPlay(false));
      }
    };
    const onEnded = () => skipTo(currentIndex + 1, true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
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
            2 Weeks Early
          </div>
        </div>

        <div className="p-4 bg-card/95 backdrop-blur-sm border-t border-border/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" data-testid="text-hero-track-title">
                {current?.title || "Select a track"}
              </p>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-hero-track-artist">
                {current?.artist?.name || "AITIFY MUSIC RADIO"}
              </p>
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
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={togglePlay}
                disabled={!playlist.length}
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30 shadow-lg"
                data-testid="button-hero-play"
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>
              <button
                onClick={() => skipTo(currentIndex + 1)}
                disabled={!playlist.length}
                className="p-2 rounded-full hover:bg-muted/50 transition-colors disabled:opacity-30"
                data-testid="button-hero-next"
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
    title: "2 Weeks Early Access",
    description: "Members get exclusive access to pre-release music 2 weeks before it hits other platforms",
  },
  {
    icon: Headphones,
    title: "High-Quality Streaming",
    description: "Crystal clear audio with lossless quality streaming for the best listening experience",
  },
  {
    icon: Users,
    title: "Support Artists Directly",
    description: "Artists earn more per stream while you enjoy exclusive content and early releases",
  },
];

const membershipTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Stream all released music", "Create up to 10 playlists", "Follow artists", "Standard audio quality"],
    highlight: false,
  },
  {
    name: "Silver",
    price: "$1.99",
    period: "/month",
    features: [
      "Unlimited released music",
      "5 pre-release previews/month",
      "Create unlimited playlists",
      "Standard audio quality",
    ],
    highlight: false,
  },
  {
    name: "Bronze",
    price: "$3.99",
    period: "/month",
    features: [
      "Unlimited released music",
      "20 pre-release previews/month",
      "10 MP3 downloads/month",
      "High quality audio",
    ],
    highlight: true,
  },
  {
    name: "Gold",
    price: "$6.99",
    period: "/month",
    features: [
      "Unlimited released music",
      "Unlimited pre-release previews",
      "Unlimited MP3 downloads",
      "Lossless audio quality",
      "No ads",
    ],
    highlight: false,
  },
  {
    name: "Artist Pro",
    price: "$19.99",
    period: "/month",
    features: [
      "Everything in Gold",
      "Unlimited track uploads",
      "Upload music videos",
      "Advanced analytics",
      "Fan engagement tools",
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary-foreground" />
              </div>
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
              <Button asChild data-testid="button-signup">
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1 text-yellow-500" />
                New: Early Access Memberships
              </Badge>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Get Music{" "}
                <span className="text-primary">First</span>
                <br />
                Before Anyone Else
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl">
                Stream exclusive pre-release music 2 weeks before it hits Spotify. 
                Support your favorite artists directly while enjoying early access to their latest releases.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild data-testid="button-hero-cta">
                  <a href="/api/login">
                    <Headphones className="h-5 w-5 mr-2" />
                    Join Free & Listen
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#pricing">
                    View Plans
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-4">
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
                  <span className="text-muted-foreground"> music lovers already joined</span>
                </div>
              </div>
            </div>

            <HeroPlayer />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50">
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
              <Card key={index} className="bg-card/50 border-border/50 hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
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
              Choose the plan that works for you. Upgrade anytime for early access.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative overflow-hidden ${
                  tier.highlight
                    ? "border-primary bg-primary/5"
                    : "bg-card/50 border-border/50"
                }`}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
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

                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    asChild
                  >
                    <a href="/api/login">
                      {tier.name === "Free" ? "Get Started" : "Start Free Trial"}
                    </a>
                  </Button>
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
            Are You an Artist?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your music and videos, set pre-release dates, and let your fans hear your work 
            2 weeks before anyone else. Build anticipation and reward your most dedicated listeners.
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
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Music2 className="h-4 w-4 text-primary-foreground" />
              </div>
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
