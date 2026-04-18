import { useState, useRef, useEffect, useCallback } from "react";
import { Music2, Play, Pause, Clock, Headphones, Users, ArrowRight, SkipForward, SkipBack, Volume2, VolumeX, Disc3, Mail, Lock, User, Eye, EyeOff, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Phone } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { MarketTicker } from "@/components/market-ticker";
import NativeRadioPlayer from "@/components/NativeRadioPlayer";
import logoImage from "@assets/a-bold-radio-station-logo-featuring-aiti_1n6BE9AnRHSDyOdG86KF_1775583562146.jpeg";
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

function MiniRadio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const indexRef = useRef(0);

  const { data: tracks } = useQuery<TrackData[]>({
    queryKey: ["/api/tracks/featured"],
  });

  const playlist = tracks?.filter((t) => t.audioUrl) || [];
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  indexRef.current = currentIndex;
  const current = playlist[currentIndex];

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (!audio.src || audio.src === window.location.href) {
      audio.src = current.audioUrl;
      audio.load();
    }
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [current]);

  const pause = useCallback(() => { audioRef.current?.pause(); setIsPlaying(false); }, []);
  const togglePlay = useCallback(() => { isPlaying ? pause() : play(); }, [isPlaying, play, pause]);

  const skipTo = useCallback((i: number) => {
    const pl = playlistRef.current;
    if (!pl.length) return;
    const next = ((i % pl.length) + pl.length) % pl.length;
    indexRef.current = next;
    setCurrentIndex(next);
    setCurrentTime(0);
    setDuration(0);
    const audio = audioRef.current;
    if (audio && pl[next]) {
      audio.src = pl[next].audioUrl;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : 0.7;
  }, [isMuted]);

  useEffect(() => {
    if (playlist.length > 0 && !isPlaying && audioRef.current) {
      const audio = audioRef.current;
      const track = playlist[0];
      if (track && (!audio.src || audio.src === window.location.href)) {
        audio.src = track.audioUrl;
        audio.load();
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [playlist.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnded = () => {
      const pl = playlistRef.current;
      const idx = indexRef.current;
      const next = (idx + 1) % (pl.length || 1);
      indexRef.current = next;
      setCurrentIndex(next);
      if (pl[next]) {
        audio.src = pl[next].audioUrl;
        audio.load();
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    };
    const onError = () => {
      const pl = playlistRef.current;
      const idx = indexRef.current;
      if (pl.length > 1) {
        const next = (idx + 1) % pl.length;
        indexRef.current = next;
        setCurrentIndex(next);
        if (pl[next]) {
          audio.src = pl[next].audioUrl;
          audio.load();
          audio.play().catch(() => {});
        }
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
  }, []);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const coverSrc = current?.coverImage || current?.artist?.profileImage || null;

  return (
    <div className="fixed top-[74px] left-0 right-0 z-40 font-mono" data-testid="mini-radio">
      <audio ref={audioRef} preload="metadata" />
      <div className="bg-black/95 backdrop-blur-sm border-b border-emerald-500/20">
        <div className="h-[2px] bg-emerald-950"><div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} /></div>
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-2.5 h-10">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Disc3 className={`h-3 w-3 text-lime-400 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "2s" }} />
            <span className="text-[8px] text-lime-400 font-extrabold tracking-widest hidden sm:inline">97.7 THE FLAME</span>
          </div>
          <div className="w-7 h-7 flex-shrink-0 bg-emerald-950 border border-emerald-500/20 overflow-hidden">
            {coverSrc ? (
              <img src={coverSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Music2 className="h-3 w-3 text-emerald-500/30" /></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-lime-400 font-extrabold truncate">{current?.title?.toUpperCase() || "ASSET RADIO"}</p>
            <p className="text-[8px] text-emerald-500/60 truncate">{current?.artist?.name || "AITIFY"}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => skipTo(currentIndex - 1)} disabled={!playlist.length} className="p-0.5 text-emerald-500/60 hover:text-lime-400 disabled:opacity-20" data-testid="mini-radio-prev"><SkipBack className="h-3 w-3" /></button>
            <button onClick={togglePlay} disabled={!playlist.length} className="w-7 h-7 bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-30" data-testid="mini-radio-play">
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
            </button>
            <button onClick={() => skipTo(currentIndex + 1)} disabled={!playlist.length} className="p-0.5 text-emerald-500/60 hover:text-lime-400 disabled:opacity-20" data-testid="mini-radio-next"><SkipForward className="h-3 w-3" /></button>
            <button onClick={() => setIsMuted(!isMuted)} className="p-0.5 text-emerald-500/40 hover:text-emerald-400/70 ml-1" data-testid="mini-radio-mute">
              {isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-0.5 text-[7px] text-emerald-500/40 flex-shrink-0">
            <span>{formatTime(currentTime)}</span><span>/</span><span>{formatTime(duration)}</span>
          </div>
          {isPlaying && <span className="text-[7px] text-red-400 font-bold animate-pulse flex-shrink-0">LIVE</span>}
        </div>
      </div>
    </div>
  );
}

function AuthForm({ mode: initialMode = "login", onSuccess }: { mode?: "login" | "signup"; onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [cashTag, setCashTag] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const signupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/signup", { email, password, displayName, phone, cashTag: cashTag.startsWith("$") ? cashTag : cashTag ? `$${cashTag}` : "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "ACCOUNT CREATED", description: "Welcome to the AITITRADE DEX — the place where the penny is KING" });
      onSuccess?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const loginMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/login", { email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "LOGIN VERIFIED", description: "Access granted — loading exchange..." });
      onSuccess?.();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup") {
      if (!displayName.trim()) { setError("Display name is required"); return; }
      if (!phone.trim()) { setError("Cell phone number is required"); return; }
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
        <span className="text-[10px] text-emerald-500 font-bold">AITITRADE ACCESS TERMINAL</span>
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

          {mode === "signup" && (
            <div className="space-y-1">
              <label htmlFor="phone" className="text-[9px] text-emerald-500/60 uppercase">Cell Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/40" />
                <input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-black border border-emerald-500/20 text-emerald-400 text-xs pl-9 pr-3 py-2 placeholder:text-emerald-500/20 focus:border-emerald-500/50 focus:outline-none font-mono"
                  data-testid="input-phone"
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-1">
              <label htmlFor="cashTag" className="text-[9px] text-emerald-500/60 uppercase">Cash App Tag</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500/40" />
                <input
                  id="cashTag"
                  type="text"
                  placeholder="$YourCashTag"
                  value={cashTag}
                  onChange={(e) => setCashTag(e.target.value)}
                  className="w-full bg-black border border-emerald-500/20 text-emerald-400 text-xs pl-9 pr-3 py-2 placeholder:text-emerald-500/20 focus:border-emerald-500/50 focus:outline-none font-mono"
                  data-testid="input-cashtag"
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

        {mode === "login" && (
          <button
            type="button"
            onClick={() => {
              setEmail("aitifymusic26@gmail.com");
              setPassword("Pookie@-1970");
            }}
            className="w-full mt-2 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400/70 hover:text-amber-400 text-[9px] font-bold py-1.5 transition-colors font-mono"
            data-testid="button-admin-autofill"
          >
            ADMIN LOGIN
          </button>
        )}
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

function OscillatorWave({ color, speed, amplitude, phase }: { color: string; speed: number; amplitude: number; phase: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 120);
    return () => clearInterval(iv);
  }, []);

  const points: string[] = [];
  for (let x = 0; x <= 200; x += 2) {
    const t = (tick * speed * 0.05) + phase;
    const y = 25 + Math.sin((x / 200) * Math.PI * 4 + t) * amplitude
              + Math.sin((x / 200) * Math.PI * 7 + t * 1.3) * (amplitude * 0.4)
              + Math.sin((x / 200) * Math.PI * 2 + t * 0.7) * (amplitude * 0.6);
    points.push(`${x},${Math.max(2, Math.min(48, y)).toFixed(1)}`);
  }
  const polyline = points.join(" ");
  const fillPoints = `0,50 ${polyline} 200,50`;

  return (
    <svg viewBox="0 0 200 50" className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`osc-fill-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#osc-fill-${color})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r="2.5" fill={color}>
        <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

const SIMULATED_TRADERS = ["TRADER-001", "TRADER-002", "TRADER-003", "TRADER-004", "TRADER-005", "TRADER-006", "TRADER-007", "TRADER-008", "TRADER-009", "TRADER-010", "TRADER-011", "TRADER-012", "TRADER-013", "TRADER-014", "TRADER-015"];
const FALLBACK_ASSETS = [
  "$CANDYMAN", "$DYNASTY", "$SUPANOVA", "$PRESSURE", "$SLIDETHRU",
  "$DRIP", "$BIGBAG", "$NOLIMIT", "$RUNITUP", "$CASHFLOW",
  "$HOTBOX", "$SOULFIRE", "$REALONES", "$GETIT", "$ONTHEFLOOR",
  "$MIDNIGHT", "$STACKDUP", "$WAVEMODE", "$HEATCHECK", "$GOMODE"
];
const SIMULATED_PORTALS = ["NANO $1", "MICRO $2", "PENNY $3.50", "MINI $5", "ENTRY $7.50", "STD $10", "MID $15", "PRO $25", "SOV $50"];

function toTicker(title: string): string {
  const clean = title.replace(/[^a-zA-Z0-9\s]/g, "").trim().toUpperCase();
  const words = clean.split(/\s+/);
  if (words.length === 1) return "$" + words[0].slice(0, 10);
  return "$" + words.map(w => w.slice(0, 5)).join("").slice(0, 12);
}

function LiveTradeFeed() {
  const [trades, setTrades] = useState<Array<{ id: number; trader: string; asset: string; portal: string; amount: string; time: string; type: string }>>([]);
  const [assetList, setAssetList] = useState<string[]>(FALLBACK_ASSETS);

  useEffect(() => {
    fetch("/api/tracks/featured")
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const tickers = data.map((t: any) => toTicker(t.title || t.name || "TRACK"));
          const unique = [...new Set(tickers)].filter(t => t.length > 1);
          if (unique.length >= 5) setAssetList(unique);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const seed = () => {
      const initial = [];
      for (let i = 0; i < 6; i++) {
        const ago = Math.floor(Math.random() * 300) + 10;
        initial.push({
          id: i,
          trader: pick(SIMULATED_TRADERS),
          asset: pick(assetList),
          portal: pick(SIMULATED_PORTALS),
          amount: (Math.random() * 48 + 2).toFixed(2),
          time: `${Math.floor(ago / 60)}m ${ago % 60}s ago`,
          type: Math.random() > 0.3 ? "BUY" : "SETTLE",
        });
      }
      setTrades(initial);
    };
    seed();

    const iv = setInterval(() => {
      setTrades(prev => {
        const newTrade = {
          id: Date.now(),
          trader: pick(SIMULATED_TRADERS),
          asset: pick(assetList),
          portal: pick(SIMULATED_PORTALS),
          amount: (Math.random() * 48 + 2).toFixed(2),
          time: "just now",
          type: Math.random() > 0.25 ? "BUY" : "SETTLE",
        };
        return [newTrade, ...prev.slice(0, 7)];
      });
    }, 4000 + Math.random() * 3000);

    return () => clearInterval(iv);
  }, [assetList]);

  return (
    <div className="border border-emerald-500/40 bg-black font-mono" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.08), inset 0 0 30px rgba(34,197,94,0.03)" }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-emerald-500/30 bg-emerald-500/10">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.6))" }} />
          <span className="text-[8px] sm:text-[9px] text-emerald-400 font-bold tracking-widest" style={{ textShadow: "0 0 8px rgba(52,211,153,0.4)" }}>LIVE TRADE FEED</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" style={{ boxShadow: "0 0 6px rgba(239,68,68,0.8), 0 0 12px rgba(239,68,68,0.4)" }} />
          <span className="text-[7px] text-red-400 font-bold animate-pulse" style={{ textShadow: "0 0 6px rgba(239,68,68,0.5)" }}>LIVE</span>
        </div>
      </div>
      <div className="max-h-[220px] overflow-hidden">
        {trades.map((trade, i) => (
          <div
            key={trade.id}
            className={`flex items-center justify-between px-3 py-1.5 border-b border-emerald-500/15/80 text-[9px] sm:text-[10px] ${i === 0 ? "bg-emerald-500/10 border-l-2 border-l-emerald-400" : "hover:bg-emerald-950/50"}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`px-1.5 py-0.5 font-extrabold text-[7px] border ${
                trade.type === "BUY"
                  ? "text-lime-400 border-lime-500/50 bg-lime-500/15"
                  : "text-amber-400 border-amber-500/50 bg-amber-500/15"
              }`} style={{
                boxShadow: trade.type === "BUY" ? "0 0 6px rgba(132,204,22,0.3)" : "0 0 6px rgba(245,158,11,0.3)",
                textShadow: trade.type === "BUY" ? "0 0 4px rgba(132,204,22,0.5)" : "0 0 4px rgba(245,158,11,0.5)"
              }}>{trade.type}</span>
              <span className="text-emerald-300/90 font-bold truncate">{trade.trader}</span>
              <span className="text-lime-400 font-extrabold" style={{ textShadow: "0 0 6px rgba(132,204,22,0.4)" }}>{trade.asset}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-cyan-500/70 text-[8px] font-bold">{trade.portal}</span>
              <span className="text-lime-300 font-bold" style={{ textShadow: "0 0 4px rgba(190,242,100,0.3)" }}>${trade.amount}</span>
              <span className="text-emerald-500/60 text-[7px] w-16 text-right">{trade.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StimulationBoard({ onSignup }: { onSignup: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const w1 = Math.sin((minuteOfDay / 1440) * Math.PI * 2) * 0.04;
  const w2 = Math.sin((now / 30000) * Math.PI * 2) * 0.02;
  const swing = w1 + w2 + Math.sin(tick * 0.3) * 0.01;

  const tbiBase = 7.00;
  const mbbBase = 21.00;
  const tbiLive = parseFloat((tbiBase * (1 + swing)).toFixed(2));
  const mbbLive = parseFloat((mbbBase * (1 + swing * 1.4)).toFixed(2));
  const mbbpRatio = parseFloat(((mbbLive / tbiLive) * 100).toFixed(1));
  const tbiPct = parseFloat(((swing) * 100).toFixed(1));
  const mbbPct = parseFloat(((swing * 1.4) * 100).toFixed(1));
  const signal = mbbPct >= 3 ? "BUY" : mbbPct <= -2 ? "SELL" : "STEADY";
  const signalColor = signal === "BUY" ? "text-lime-400 border-lime-500/40 bg-lime-500/10" : signal === "SELL" ? "text-red-400 border-red-500/40 bg-red-500/10" : "text-amber-400 border-amber-500/40 bg-amber-500/10";

  const tiers = [
    { name: "NANO", tbi: 1, color: "text-emerald-400/70" },
    { name: "MICRO", tbi: 2, color: "text-emerald-400" },
    { name: "PENNY", tbi: 3.5, color: "text-emerald-400" },
    { name: "MINI", tbi: 5, color: "text-lime-400" },
    { name: "ENTRY", tbi: 7.5, color: "text-lime-400" },
    { name: "STD", tbi: 10, color: "text-green-400" },
    { name: "MID", tbi: 15, color: "text-amber-400" },
    { name: "PRO", tbi: 25, color: "text-orange-400" },
    { name: "SOV", tbi: 50, color: "text-red-400" },
  ];

  return (
    <div className="font-mono">
      <div className="border border-emerald-500/40 bg-black shadow-lg shadow-emerald-500/5">
        <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-emerald-500/25 bg-emerald-500/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-sm shadow-lime-400" />
            <span className="text-[8px] sm:text-[9px] text-emerald-400 font-bold tracking-widest">24HR STIMULATION BOARD</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[7px] sm:text-[8px] px-1.5 py-0.5 border font-extrabold ${signalColor}`}>{signal}</span>
            <span className="text-[8px] text-emerald-500/40">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-emerald-500/10">
          <div className="bg-black p-2 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-emerald-500/70 font-bold tracking-wider">TBI OSCILLATOR</span>
              <span className={`text-[9px] sm:text-[10px] font-black ${tbiPct >= 0 ? "text-lime-400" : "text-red-400"}`}>
                {tbiPct >= 0 ? "+" : ""}{tbiPct}%
              </span>
            </div>
            <div className="h-14 sm:h-16 border border-emerald-500/20 bg-zinc-950 mb-1.5 overflow-hidden">
              <OscillatorWave color="#4ade80" speed={1.2} amplitude={12} phase={0} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-emerald-500/50 font-bold">BASE: $7.00</span>
              <span className="text-xs sm:text-sm text-lime-400 font-black">${tbiLive.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-black p-2 sm:p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-emerald-500/70 font-bold tracking-wider">MBBP MOMENTUM</span>
              <span className={`text-[9px] sm:text-[10px] font-black ${mbbPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {mbbPct >= 0 ? "+" : ""}{mbbPct}%
              </span>
            </div>
            <div className="h-14 sm:h-16 border border-emerald-500/20 bg-zinc-950 mb-1.5 overflow-hidden">
              <OscillatorWave color="#34d399" speed={0.8} amplitude={10} phase={2} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-emerald-500/50 font-bold">BASE: $21.00</span>
              <span className="text-xs sm:text-sm text-emerald-400 font-black">${mbbLive.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-px bg-emerald-500/10 border-t border-emerald-500/15">
          <div className="bg-black p-1.5 sm:p-2 text-center">
            <p className="text-[7px] text-emerald-500/60 font-bold">MBBP RATIO</p>
            <p className="text-[10px] sm:text-xs text-amber-400 font-black">{mbbpRatio}%</p>
          </div>
          <div className="bg-black p-1.5 sm:p-2 text-center">
            <p className="text-[7px] text-emerald-500/60 font-bold">SPLIT</p>
            <p className="text-[10px] sm:text-xs text-emerald-400 font-black">KINETIC</p>
          </div>
          <div className="bg-black p-1.5 sm:p-2 text-center">
            <p className="text-[7px] text-emerald-500/60 font-bold">SETTLEMENT</p>
            <p className="text-[10px] sm:text-xs text-lime-400 font-black">KINETIC/K</p>
          </div>
          <div className="bg-black p-1.5 sm:p-2 text-center">
            <p className="text-[7px] text-emerald-500/60 font-bold">PORTALS</p>
            <p className="text-[10px] sm:text-xs text-white font-black">81</p>
          </div>
        </div>

        <div className="border-t border-emerald-500/15 px-3 py-1.5 flex gap-1 overflow-x-auto scrollbar-hide bg-emerald-500/5">
          {tiers.map(t => (
            <span key={t.name} className={`text-[7px] sm:text-[8px] font-bold border border-emerald-500/20 px-1 sm:px-1.5 py-0.5 bg-black whitespace-nowrap flex-shrink-0 ${t.color}`}>
              {t.name} ${t.tbi}
            </span>
          ))}
        </div>
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
            <AuthForm mode={authMode} onSuccess={() => { setShowAuthModal(false); window.location.href = "/trader"; }} />
          </div>
        </div>
      )}

      <header className="fixed top-[30px] left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-b border-emerald-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-4 font-mono">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY" className="w-7 h-7 object-cover" />
              <span className="text-emerald-400 text-xs font-bold hidden sm:inline">AITITRADE DEX</span>
            </div>

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

      <NativeRadioPlayer />

      <section className="pt-[120px] pb-8 px-4 sm:px-6 lg:px-8 bg-black">
        <div className="max-w-5xl mx-auto font-mono">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-red-400 font-bold tracking-widest">POWERED BY 97.7 THE FLAME</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-white mb-2" data-testid="text-radio-hero-title">
              AITITRADE <span className="text-emerald-400">DEX</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-500/60 max-w-lg mx-auto font-bold tracking-wider">
              DIGITAL ASSET EXCHANGE — AI-POWERED MUSIC ASSETS
            </p>
          </div>

          <StimulationBoard onSignup={() => openAuth("signup")} />

          <div className="mt-4">
            <LiveTradeFeed />
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => openAuth("signup")}
              className="px-8 sm:px-12 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base tracking-wider transition-all border border-emerald-400/30"
              data-testid="button-hero-cta"
            >
              ENTER TRADING FLOOR
            </button>
            <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4 text-[8px] sm:text-[9px]">
              <span className="text-lime-400/80 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 inline-block" /> LIVE NOW
              </span>
              <span className="text-emerald-500/25">|</span>
              <span className="text-emerald-400/80 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> 81 PORTALS
              </span>
              <span className="text-emerald-500/25">|</span>
              <span className="text-amber-400/80 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" /> $2-$50 BUY-IN
              </span>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-emerald-500/10 bg-black">
        <div className="max-w-7xl mx-auto font-mono">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="AITIFY" className="w-5 h-5 object-cover" />
              <span className="text-emerald-400 text-xs font-bold truncate">AITITRADE DEX</span>
            </div>
            <p className="text-[10px] text-emerald-500/30">
              &copy; {new Date().getFullYear()} AITITRADE DEX
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
