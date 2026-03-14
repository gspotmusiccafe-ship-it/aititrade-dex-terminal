import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trophy, Flame, Medal, Crown, Star, Share2, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery<{ tracks: LeaderboardTrack[]; stats: LeaderboardStats }>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000,
  });

  if (isLoading) {
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
            Ranked by engagement — streams, likes, saves, and shares
          </p>
        </div>

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
      </div>
    </div>
  );
}
