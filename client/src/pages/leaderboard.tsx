import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, Flame, Medal, Crown, Star, Share2, Mail, MessageSquare, TrendingUp, BarChart3, DollarSign, Shield, Rocket, Lock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";

interface LeaderboardTrack {
  id: string;
  title: string;
  playCount: number;
  genre: string | null;
  coverImage: string | null;
  artistId: string;
  artistName: string;
  artistImage: string | null;
  likeCount: number;
  engagementScore: number;
  rank: string;
}

interface LeaderboardStats {
  totalStreams: number;
  totalArtists: number;
  totalTracks: number;
  topTrack: LeaderboardTrack | null;
}

const RANK_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Trophy; minScore: number }> = {
  platinum: { label: "PLATINUM", color: "text-cyan-300", bgColor: "bg-cyan-500/10 border-cyan-500/30", icon: Crown, minScore: 10000 },
  gold: { label: "GOLD", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/30", icon: Trophy, minScore: 5000 },
  silver: { label: "SILVER", color: "text-gray-300", bgColor: "bg-gray-400/10 border-gray-400/30", icon: Medal, minScore: 1000 },
  bronze: { label: "BRONZE", color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/30", icon: Star, minScore: 0 },
};

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getRank(score: number): string {
  if (score >= 10000) return "platinum";
  if (score >= 5000) return "gold";
  if (score >= 1000) return "silver";
  return "bronze";
}

function ShareButtons({ track }: { track: LeaderboardTrack }) {
  const shareText = `Check out "${track.title}" by ${track.artistName} on AITIFY Music Radio! 🎵`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/artist/${track.artistId}` : "";

  const handleEmail = () => {
    window.open(`mailto:?subject=${encodeURIComponent(`Listen to ${track.title}`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`);
  };

  const handleSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-primary/10"
        onClick={handleEmail}
        title="Share via Email"
        data-testid={`button-share-email-${track.id}`}
      >
        <Mail className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-primary/10"
        onClick={handleSMS}
        title="Share via SMS"
        data-testid={`button-share-sms-${track.id}`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function TopTrackShowcase({ track }: { track: LeaderboardTrack }) {
  const [imageIndex, setImageIndex] = useState(0);
  const rankConfig = RANK_CONFIG[track.rank] || RANK_CONFIG.bronze;
  const RankIcon = rankConfig.icon;

  useEffect(() => {
    if (!track.coverImage) return;
    const interval = setInterval(() => {
      setImageIndex(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [track.coverImage]);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-emerald-500/5 p-6 sm:p-8 mb-8" data-testid="section-top-track">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <div className={`absolute inset-0 rounded-xl blur-xl opacity-50 ${imageIndex % 2 === 0 ? "bg-primary/30" : "bg-emerald-500/30"} transition-colors duration-1000`} />
          <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden ring-2 ${imageIndex % 2 === 0 ? "ring-primary/50" : "ring-emerald-500/50"} transition-all duration-1000 relative`}>
            {track.coverImage ? (
              <img
                src={track.coverImage}
                alt={track.title}
                className={`w-full h-full object-cover transition-transform duration-1000 ${imageIndex % 2 === 0 ? "scale-100" : "scale-110"}`}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/30 to-emerald-500/20 flex items-center justify-center">
                <Flame className="h-16 w-16 text-primary/60 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
            <Badge className={`${rankConfig.bgColor} ${rankConfig.color} border gap-1 font-bold`}>
              <RankIcon className="h-3 w-3" />
              {rankConfig.label}
            </Badge>
            <Badge variant="outline" className="text-primary border-primary/30 gap-1">
              <Trophy className="h-3 w-3" />
              #1 Song
            </Badge>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-1" data-testid="text-top-track-title">
            {track.title}
          </h2>
          <Link href={`/artist/${track.artistId}`}>
            <p className="text-muted-foreground hover:text-primary transition-colors cursor-pointer" data-testid="text-top-track-artist">
              {track.artistName}
            </p>
          </Link>
          <div className="flex items-center gap-6 mt-3 justify-center sm:justify-start">
            <div>
              <p className="text-2xl font-black text-primary" data-testid="text-top-track-streams">
                {formatNumber(track.playCount)}
              </p>
              <p className="text-xs text-muted-foreground">streams</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-400">
                {formatNumber(track.likeCount)}
              </p>
              <p className="text-xs text-muted-foreground">likes</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">
                {formatNumber(track.engagementScore)}
              </p>
              <p className="text-xs text-muted-foreground">engagement</p>
            </div>
          </div>
          <div className="mt-3">
            <ShareButtons track={track} />
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground animate-pulse">
          Monthly Bonus for Highest Streamed Song
        </p>
      </div>
    </div>
  );
}

interface TraderLeaderboardEntry {
  rank: number;
  traderId: string;
  name: string;
  totalInvested: number;
  tradeCount: number;
  earlyExits: number;
  totalPayout: number;
  roi: number;
  avgPrice: number;
  tier: string;
}

interface TraderLeaderboardStats {
  totalVolume: number;
  totalTraders: number;
  totalTrades: number;
  topTrader: TraderLeaderboardEntry | null;
}

const TRADER_TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PLATINUM: { label: "PLATINUM", color: "text-cyan-300", bgColor: "bg-cyan-500/10 border-cyan-500/30" },
  GOLD: { label: "GOLD", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/30" },
  SILVER: { label: "SILVER", color: "text-gray-300", bgColor: "bg-gray-400/10 border-gray-400/30" },
  BRONZE: { label: "BRONZE", color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/30" },
};

function TradersLeaderboard() {
  const { data, isLoading } = useQuery<{ traders: TraderLeaderboardEntry[]; stats: TraderLeaderboardStats }>({
    queryKey: ["/api/leaderboard/traders"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const traders = data?.traders || [];
  const stats = data?.stats;

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="border-border/30 bg-card/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-lime-400" data-testid="stat-total-volume">${formatNumber(stats.totalVolume)}</p>
              <p className="text-xs text-muted-foreground">Total Volume</p>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-emerald-400" data-testid="stat-total-traders">{stats.totalTraders}</p>
              <p className="text-xs text-muted-foreground">Active Traders</p>
            </CardContent>
          </Card>
          <Card className="border-border/30 bg-card/60">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-yellow-400" data-testid="stat-total-trades">{stats.totalTrades}</p>
              <p className="text-xs text-muted-foreground">Total Trades</p>
            </CardContent>
          </Card>
        </div>
      )}

      {traders[0] && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-lime-500/30 bg-gradient-to-br from-lime-500/10 via-background to-emerald-500/5 p-6 sm:p-8 mb-8" data-testid="section-top-trader">
          <div className="absolute top-0 right-0 w-64 h-64 bg-lime-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-6">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-lime-500/30 to-emerald-500/20 flex items-center justify-center ring-2 ring-lime-500/50">
              <Crown className="h-10 w-10 text-lime-400" />
            </div>
            <div>
              <p className="text-xs text-lime-400 font-bold uppercase tracking-wider mb-1">#1 TOP TRADER</p>
              <p className="text-2xl font-black text-white">{traders[0].name}</p>
              <div className="flex gap-6 mt-2">
                <div><p className="text-xl font-black text-lime-400">${formatNumber(traders[0].totalInvested)}</p><p className="text-[10px] text-muted-foreground">invested</p></div>
                <div><p className="text-xl font-black text-yellow-400">{traders[0].tradeCount}</p><p className="text-[10px] text-muted-foreground">trades</p></div>
                <div><p className="text-xl font-black text-emerald-400">{traders[0].roi}%</p><p className="text-[10px] text-muted-foreground">ROI</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-lime-400" />
          <h2 className="text-xl font-black">Trader Rankings</h2>
        </div>

        {traders.map((trader, index) => {
          const tierConfig = TRADER_TIER_CONFIG[trader.tier] || TRADER_TIER_CONFIG.BRONZE;
          return (
            <Link key={trader.traderId} href={`/trader/${encodeURIComponent(trader.traderId)}`}>
              <div
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-colors hover:border-lime-500/30 cursor-pointer ${
                  index === 0
                    ? "bg-gradient-to-r from-lime-500/10 to-emerald-500/5 border-lime-500/30"
                    : "bg-card/60 border-border/30"
                }`}
                data-testid={`leaderboard-trader-${trader.traderId}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                  index === 0 ? "bg-lime-500 text-black" :
                  index === 1 ? "bg-yellow-500/20 text-yellow-500" :
                  index === 2 ? "bg-orange-500/20 text-orange-500" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {index + 1}
                </div>

                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5 text-lime-400/60" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm sm:text-base" data-testid={`text-trader-name-${trader.traderId}`}>
                    {trader.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {trader.tradeCount} trades · {trader.earlyExits} early exits
                  </p>
                </div>

                <Badge className={`${tierConfig.bgColor} ${tierConfig.color} border text-[10px] gap-0.5 hidden sm:flex`}>
                  {tierConfig.label}
                </Badge>

                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm text-lime-400" data-testid={`text-trader-invested-${trader.traderId}`}>
                    ${formatNumber(trader.totalInvested)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">invested</p>
                </div>

                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className={`font-bold text-sm ${trader.roi > 0 ? "text-emerald-400" : "text-emerald-500/60"}`}>
                    {trader.roi}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">ROI</p>
                </div>
              </div>
            </Link>
          );
        })}

        {traders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No trades yet — acquire positions on the trading floor to climb the ranks!</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SprintRow {
  rank: number;
  userId: string;
  displayName: string;
  realizedProfit: number;
  streamRoyalties: number;
  totalGains: number;
  percentToGoal: number;
  capped: boolean;
  cappedAt?: string;
}
interface SprintWinner { id: number; userId: string; displayName: string; realizedProfitAtWin: string; cycleAtWin: number | null; hitAt: string; }
interface SprintBonus { distributed: boolean; blockTen?: number; recipients?: string[]; total?: number; }

function SprintLeaderboard() {
  const { data, isLoading } = useQuery<{ target: number; rows: SprintRow[]; winners: SprintWinner[]; latestBonus: SprintBonus | null }>({
    queryKey: ["/api/leaderboard/sprint"],
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    );
  }

  const rows = data?.rows || [];
  const winners = data?.winners || [];
  const latestBonus = data?.latestBonus;

  return (
    <div>
      <div className="rounded-2xl border-2 border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 via-background to-orange-500/5 p-5 mb-6" data-testid="section-sprint-banner">
        <div className="flex items-center gap-3 mb-2">
          <Rocket className="h-7 w-7 text-yellow-400 animate-pulse" />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">FIRST TO $10,000</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Realized profit = <span className="text-emerald-400 font-bold">(Sell − Buy)</span> + Stream Royalties.
          First trader to <span className="text-yellow-400 font-bold">$10,000</span> wins. Capped until next season — protects the Trust Vault.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Every <span className="text-yellow-400">10th $1K cycle</span>, <span className="text-emerald-400">1% of the Trust Vault</span> drops to the top 3 as a Performance Bonus.
        </p>
      </div>

      {latestBonus?.distributed && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 mb-6" data-testid="banner-block-ten-bonus">
          <p className="text-emerald-400 font-bold text-sm">
            💰 Block-{latestBonus.blockTen} Bonus Just Distributed: ${latestBonus.total?.toFixed(2)} → Top {latestBonus.recipients?.length}
          </p>
        </div>
      )}

      {winners.length > 0 && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 mb-6" data-testid="section-recent-winners">
          <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
            <Crown className="h-4 w-4" /> RECENT 10K CHAMPIONS
          </p>
          <div className="space-y-1">
            {winners.map(w => (
              <div key={w.id} className="flex items-center justify-between text-sm" data-testid={`winner-${w.userId}`}>
                <span className="font-bold text-cyan-300">{w.displayName}</span>
                <span className="text-muted-foreground">${parseFloat(w.realizedProfitAtWin).toLocaleString()} • cycle {w.cycleAtWin || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rows.map(r => (
          <Card key={r.userId} className={`border ${r.capped ? "border-cyan-500/40 bg-cyan-500/5" : r.rank <= 3 ? "border-yellow-500/30 bg-yellow-500/5" : "border-border/30 bg-card/60"}`} data-testid={`sprint-row-${r.userId}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                  r.rank === 1 ? "bg-yellow-500 text-black" :
                  r.rank === 2 ? "bg-gray-300 text-black" :
                  r.rank === 3 ? "bg-orange-500 text-black" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {r.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate" data-testid={`text-sprint-name-${r.userId}`}>{r.displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Realized: ${r.realizedProfit.toLocaleString()} {r.streamRoyalties > 0 && <>· Royalties: ${r.streamRoyalties.toLocaleString()}</>}
                  </p>
                </div>
                {r.capped ? (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 gap-1" data-testid={`badge-capped-${r.userId}`}>
                    <Lock className="h-3 w-3" /> CAPPED
                  </Badge>
                ) : (
                  <div className="text-right">
                    <p className="font-black text-lg text-yellow-400" data-testid={`text-sprint-gains-${r.userId}`}>
                      ${r.totalGains.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ $10,000</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Progress value={r.percentToGoal} className="h-2" data-testid={`progress-sprint-${r.userId}`} />
                <p className="text-[10px] text-muted-foreground text-right">{r.percentToGoal.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Rocket className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>The race is open — start trading to claim the $10K throne.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState("sprint");

  const { data, isLoading } = useQuery<{ tracks: LeaderboardTrack[]; stats: LeaderboardStats }>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000,
  });

  if (isLoading && tab === "songs") {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-48 w-full rounded-2xl mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tracks = data?.tracks || [];
  const stats = data?.stats;
  const topTrack = tracks[0] || null;

  return (
    <div className="min-h-full pb-28 px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight" data-testid="text-leaderboard-title">
              Leaderboard
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Top performers on the exchange
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sprint" data-testid="tab-sprint-leaderboard">
              <Rocket className="h-4 w-4 mr-1.5" />
              10K Sprint
            </TabsTrigger>
            <TabsTrigger value="songs" data-testid="tab-songs-leaderboard">
              <Flame className="h-4 w-4 mr-1.5" />
              Songs
            </TabsTrigger>
            <TabsTrigger value="traders" data-testid="tab-traders-leaderboard">
              <TrendingUp className="h-4 w-4 mr-1.5" />
              Traders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sprint" className="mt-6">
            <SprintLeaderboard />
          </TabsContent>

          <TabsContent value="songs" className="mt-6">
            {stats && (
              <div className="grid grid-cols-3 gap-4 mb-8">
                <Card className="border-border/30 bg-card/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-black text-primary" data-testid="stat-total-streams">{formatNumber(stats.totalStreams)}</p>
                    <p className="text-xs text-muted-foreground">Total Streams</p>
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-black text-emerald-400" data-testid="stat-total-artists">{stats.totalArtists}</p>
                    <p className="text-xs text-muted-foreground">Artists</p>
                  </CardContent>
                </Card>
                <Card className="border-border/30 bg-card/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-black text-yellow-400" data-testid="stat-total-tracks">{stats.totalTracks}</p>
                    <p className="text-xs text-muted-foreground">Tracks</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {topTrack && <TopTrackShowcase track={topTrack} />}

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-black">Rankings</h2>
              </div>

              {tracks.map((track, index) => {
                const rankConfig = RANK_CONFIG[track.rank] || RANK_CONFIG.bronze;
                const RankIcon = rankConfig.icon;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-colors hover:border-primary/20 ${
                      index === 0
                        ? "bg-gradient-to-r from-primary/10 to-emerald-500/5 border-primary/30"
                        : "bg-card/60 border-border/30"
                    }`}
                    data-testid={`leaderboard-track-${track.id}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                      index === 0 ? "bg-primary text-primary-foreground" :
                      index === 1 ? "bg-yellow-500/20 text-yellow-500" :
                      index === 2 ? "bg-orange-500/20 text-orange-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>

                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                      {track.coverImage ? (
                        <img src={track.coverImage} alt={track.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
                          <Flame className="h-5 w-5 text-primary/40" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-sm sm:text-base" data-testid={`text-track-title-${track.id}`}>
                        {track.title}
                      </p>
                      <Link href={`/artist/${track.artistId}`}>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate hover:text-primary transition-colors cursor-pointer">
                          {track.artistName}
                        </p>
                      </Link>
                    </div>

                    <Badge className={`${rankConfig.bgColor} ${rankConfig.color} border text-[10px] gap-0.5 hidden sm:flex`}>
                      <RankIcon className="h-2.5 w-2.5" />
                      {rankConfig.label}
                    </Badge>

                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm" data-testid={`text-track-streams-${track.id}`}>
                        {formatNumber(track.playCount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">streams</p>
                    </div>

                    <ShareButtons track={track} />
                  </div>
                );
              })}

              {tracks.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No tracks yet — upload music to start climbing the charts!</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="traders" className="mt-6">
            <TradersLeaderboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
