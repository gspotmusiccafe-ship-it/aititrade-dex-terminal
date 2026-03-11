import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Music, Users, TrendingUp, Target, Flame, Star, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
interface ShowtownArtist {
  id: string;
  name: string;
  bio: string | null;
  profileImage: string | null;
  coverImage: string | null;
  verified: boolean;
  monthlyListeners: number;
  totalStreams: number;
  trackCount: number;
}

const STREAM_GOAL = 1_000_000;
const BONUS_RATE = 0.001;

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function ArtistCard({ artist, rank }: { artist: ShowtownArtist; rank: number }) {
  const progress = Math.min((artist.totalStreams / STREAM_GOAL) * 100, 100);
  const bonus = (artist.totalStreams * BONUS_RATE).toFixed(2);

  return (
    <Card
      className="overflow-hidden border-[#d4af37]/20 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] hover:border-[#d4af37]/60 transition-all duration-300 hover:-translate-y-1"
      data-testid={`showtown-artist-${artist.id}`}
    >
      <CardContent className="p-0">
        <div className="relative h-28 bg-gradient-to-r from-[#d4af37]/20 via-[#0a0a0a] to-[#d4af37]/10 overflow-hidden">
          {artist.coverImage && (
            <img
              src={artist.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
          )}
          <div className="absolute top-3 left-3">
            <div className="h-8 w-8 rounded-full bg-[#d4af37] flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-[#d4af37]/30">
              {rank}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
        </div>

        <div className="px-4 -mt-8 relative z-10">
          <div className="flex items-end gap-3">
            <Link href={`/artist/${artist.id}`}>
              <Avatar className="h-16 w-16 border-2 border-[#d4af37]/50 shadow-lg cursor-pointer hover:border-[#d4af37] transition-colors">
                <AvatarImage src={artist.profileImage || undefined} alt={artist.name} />
                <AvatarFallback className="bg-[#d4af37]/20 text-[#d4af37] text-xl font-bold">
                  {artist.name[0]}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0 pb-1">
              <Link href={`/artist/${artist.id}`}>
                <h3 className="font-bold text-lg truncate text-[#f5f5f5] hover:text-[#d4af37] transition-colors cursor-pointer" data-testid={`text-artist-name-${artist.id}`}>
                  {artist.name}
                </h3>
              </Link>
              <div className="flex items-center gap-2">
                {artist.verified && (
                  <Badge className="bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/30 text-[10px]">
                    <Star className="h-2.5 w-2.5 mr-0.5" /> Verified
                  </Badge>
                )}
                <span className="text-xs text-[#888]">{artist.trackCount} tracks</span>
              </div>
            </div>
          </div>
        </div>

        {artist.bio && (
          <p className="px-4 mt-2 text-xs text-[#888] italic line-clamp-2">{artist.bio}</p>
        )}

        <div className="mx-4 mt-3 bg-[#222] rounded-lg p-3 border-l-3 border-[#d4af37]" style={{ borderLeft: "3px solid #d4af37" }}>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#999] font-mono">In-House Streams</span>
              <span className="text-[#f5f5f5] font-bold font-mono" data-testid={`stat-streams-${artist.id}`}>
                {formatNumber(artist.totalStreams)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#999] font-mono">Aitify Bonus ($0.001)</span>
              <span className="text-[#d4af37] font-bold font-mono" data-testid={`stat-bonus-${artist.id}`}>
                ${bonus}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#999] font-mono">Target Goal</span>
              <span className="text-[#f5f5f5] font-mono">{formatNumber(STREAM_GOAL)}</span>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#888] mb-1">
              <span>Progress</span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d4af37] to-[#f0d060] rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-4">
          <Link href={`/artist/${artist.id}`}>
            <Button
              className="w-full bg-[#d4af37] hover:bg-[#f0d060] text-black font-bold gap-2 transition-all"
              data-testid={`button-view-artist-${artist.id}`}
            >
              <Play className="h-4 w-4" />
              VIEW ARTIST
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShowtownPage() {
  const { data: showtownArtists, isLoading } = useQuery<ShowtownArtist[]>({
    queryKey: ["/api/showtown/artists"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const totalStreams = showtownArtists?.reduce((sum, a) => sum + a.totalStreams, 0) || 0;
  const totalBonus = (totalStreams * BONUS_RATE).toFixed(2);
  const totalTracks = showtownArtists?.reduce((sum, a) => sum + a.trackCount, 0) || 0;

  if (isLoading) {
    return (
      <div className="min-h-full pb-28 px-6 py-8 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-40 w-full rounded-lg mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto">
        <div className="border-2 border-[#d4af37] rounded-lg p-6 text-center mb-8 shadow-[0_0_20px_rgba(212,175,55,0.15)] bg-gradient-to-b from-[#d4af37]/5 to-transparent">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Flame className="h-8 w-8 text-[#d4af37]" />
            <h1
              className="text-3xl md:text-4xl font-bold text-[#d4af37] tracking-[5px] uppercase"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
              data-testid="text-showtown-title"
            >
              Welcome to Showtown
            </h1>
            <Flame className="h-8 w-8 text-[#d4af37]" />
          </div>
          <p className="text-[#999] text-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            A City Built from Sound, Memory, and Imagination
          </p>
          <p className="text-[#d4af37]/70 text-xs mt-1 uppercase tracking-widest">
            97.7 THE FLAME · Stage Manager
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 text-center">
            <Users className="h-5 w-5 text-[#d4af37] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#f5f5f5] font-mono" data-testid="stat-total-artists">
              {showtownArtists?.length || 0}
            </p>
            <p className="text-xs text-[#888] uppercase tracking-wider">Artists</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 text-center">
            <Music className="h-5 w-5 text-[#d4af37] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#f5f5f5] font-mono" data-testid="stat-total-tracks">
              {totalTracks}
            </p>
            <p className="text-xs text-[#888] uppercase tracking-wider">Tracks</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 text-center">
            <TrendingUp className="h-5 w-5 text-[#d4af37] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#f5f5f5] font-mono" data-testid="stat-total-streams">
              {formatNumber(totalStreams)}
            </p>
            <p className="text-xs text-[#888] uppercase tracking-wider">Total Streams</p>
          </div>
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4 text-center">
            <Target className="h-5 w-5 text-[#d4af37] mx-auto mb-1" />
            <p className="text-2xl font-bold text-[#d4af37] font-mono" data-testid="stat-total-bonus">
              ${totalBonus}
            </p>
            <p className="text-xs text-[#888] uppercase tracking-wider">Platform Bonus</p>
          </div>
        </div>

        <h2
          className="text-xl font-bold text-[#f5f5f5] mb-4 tracking-wide uppercase"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          Current Production: "The Broadcast"
        </h2>

        {showtownArtists && showtownArtists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {showtownArtists.map((artist, index) => (
              <ArtistCard key={artist.id} artist={artist} rank={index + 1} />
            ))}
          </div>
        ) : (
          <Card className="border-[#333] bg-[#1a1a1a]">
            <CardContent className="py-16 text-center">
              <Music className="h-16 w-16 mx-auto mb-4 text-[#d4af37]/30" />
              <h3 className="text-xl font-bold text-[#f5f5f5] mb-2">No Artists on Stage Yet</h3>
              <p className="text-[#888]">
                Artists will appear here once approved. The show is just getting started.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-[#666]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            Aitify Bonus Rate: $0.001 per in-house stream · Goal: {formatNumber(STREAM_GOAL)} streams per artist
          </p>
        </div>
      </div>
    </div>
  );
}
