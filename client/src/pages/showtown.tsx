import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Music, TrendingUp, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

const GSR_PORTFOLIO = [
  { name: "Black Neon Saints", subtitle: "The Rock & Roll Kings", status: "Headliner", isHeadliner: true },
  { name: "G. Smooth", subtitle: null, status: "Strategic", isHeadliner: false },
  { name: "J. Marie", subtitle: null, status: "Strategic", isHeadliner: false },
  { name: "Scarlett Rye", subtitle: null, status: "Strategic", isHeadliner: false },
  { name: "Country Smooth", subtitle: null, status: "Strategic", isHeadliner: false },
  { name: "Roselyn Reynolds", subtitle: null, status: "Strategic", isHeadliner: false },
  { name: "Gangsta Smooth", subtitle: null, status: "Strategic", isHeadliner: false },
];

function LeadAssetSection({ artists }: { artists: ShowtownArtist[] }) {
  const leadArtist = artists.find(
    (a) => a.name.toLowerCase().includes("g. soul") || a.name.toLowerCase().includes("g soul")
  );

  const totalStreams = leadArtist ? leadArtist.totalStreams : 0;
  const cycleProgress = ((totalStreams / STREAM_GOAL) * 100).toFixed(1);
  const isQualifying = totalStreams < STREAM_GOAL;

  return (
    <div
      className="border border-[#d4af37] rounded p-5 mb-8"
      style={{ backgroundColor: "#111" }}
      data-testid="section-lead-asset"
    >
      <h2
        className="text-[#d4af37] text-xl font-bold mt-0 mb-1 uppercase tracking-wider"
        style={{ fontFamily: "'Segoe UI', serif" }}
      >
        BDR Lead Asset: G. Soul
      </h2>
      <p className="text-[#999] italic text-sm mb-4">
        Phase 1: The Revival ({leadArtist ? leadArtist.trackCount : 6} Active Tracks)
      </p>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
        <div className="flex-1 border-l-2 border-[#d4af37] pl-4">
          <div className="text-[#aaa] text-xs uppercase tracking-wider mb-1">Global Spotify Streams</div>
          <div className="text-3xl font-bold text-white" data-testid="stat-soul-streams">
            {formatNumber(totalStreams)}
          </div>
        </div>
        <div className="flex-1 border-l-2 border-[#d4af37] pl-4">
          <div className="text-[#aaa] text-xs uppercase tracking-wider mb-1">Cycle Progress</div>
          <div className="text-3xl font-bold text-white" data-testid="stat-cycle-progress">
            {cycleProgress}%
          </div>
        </div>
        <div className="flex-1 border-l-2 border-[#d4af37] pl-4">
          <div className="text-[#aaa] text-xs uppercase tracking-wider mb-1">Status</div>
          <div
            className="text-3xl font-bold"
            style={{ color: isQualifying ? "#4CAF50" : "#d4af37" }}
            data-testid="stat-soul-status"
          >
            {isQualifying ? "QUALIFYING" : "QUALIFIED"}
          </div>
        </div>
      </div>

      <div className="mt-5 border border-[#d4af37] rounded-lg p-5" style={{ backgroundColor: "#111" }}>
        <h3 className="text-[#d4af37] uppercase tracking-[2px] font-bold text-base mb-4" data-testid="text-power-rankings">
          BDR Power Rankings
        </h3>
        <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-[#888] text-[11px] uppercase border-b border-[#333]">
              <th className="py-2 px-3">Rank</th>
              <th className="py-2">Track Title</th>
              <th className="py-2">Velocity (Daily)</th>
              <th className="py-2">Total Streams</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-[#222]">
              <td className="py-3 px-3 text-[#d4af37] font-bold">#1</td>
              <td className="py-3 font-bold text-white">Body Call</td>
              <td className="py-3 text-[#4CAF50]">+12% ↑</td>
              <td className="py-3 text-white" data-testid="power-rank-1-streams">—</td>
            </tr>
            <tr className="border-b border-[#222]">
              <td className="py-3 px-3 text-[#d4af37] font-bold">#2</td>
              <td className="py-3 font-bold text-white">I Got What You Need</td>
              <td className="py-3 text-[#4CAF50]">+8% ↑</td>
              <td className="py-3 text-white" data-testid="power-rank-2-streams">—</td>
            </tr>
            <tr className="border-b border-[#222]">
              <td className="py-3 px-3 text-[#d4af37] font-bold">#3</td>
              <td className="py-3 font-bold text-white">Honey Love</td>
              <td className="py-3 text-[#4CAF50]">+5% ↑</td>
              <td className="py-3 text-white" data-testid="power-rank-3-streams">—</td>
            </tr>
            <tr className="border-b border-[#222]">
              <td className="py-3 px-3 text-[#d4af37] font-bold">#4</td>
              <td className="py-3 font-bold text-white">I'm All You Need</td>
              <td className="py-3 text-[#888]">— steady</td>
              <td className="py-3 text-white" data-testid="power-rank-4-streams">—</td>
            </tr>
            <tr className="border-b border-[#222]">
              <td className="py-3 px-3 text-[#d4af37] font-bold">#5</td>
              <td className="py-3 font-bold text-white">Candy Land</td>
              <td className="py-3 text-[#888]">— steady</td>
              <td className="py-3 text-white" data-testid="power-rank-5-streams">—</td>
            </tr>
            <tr>
              <td className="py-3 px-3 text-[#d4af37] font-bold">#6</td>
              <td className="py-3 font-bold text-white">What It's Gon Be</td>
              <td className="py-3 text-[#888]">— steady</td>
              <td className="py-3 text-white" data-testid="power-rank-6-streams">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-5 border-t border-[#333] pt-4">
        <h4 className="text-[#888] text-[11px] uppercase tracking-widest mb-3">Current Rotation:</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-[#e0e0e0]">
          <div>● I Got What You Need</div>
          <div>● Body Call</div>
          <div>● I'm All You Need</div>
          <div>● Candy Land</div>
          <div>● Honey Love</div>
          <div>● What It's Gon Be</div>
        </div>
      </div>
    </div>
  );
}

function PortfolioCard({
  entry,
  linkedArtist,
  index,
}: {
  entry: (typeof GSR_PORTFOLIO)[0];
  linkedArtist?: ShowtownArtist;
  index: number;
}) {
  const cardContent = (
    <div
      className={`p-4 border rounded transition-all duration-300 hover:opacity-100 hover:border-[#d4af37] cursor-pointer ${
        entry.isHeadliner
          ? "border-[#ff3e3e] opacity-100"
          : "border-[#333] opacity-70"
      }`}
      style={{ backgroundColor: "#1a1a1a" }}
      data-testid={`fund-card-${index}`}
    >
      <span
        className="inline-block text-[10px] uppercase px-2 py-0.5 rounded-sm mb-2 tracking-wider"
        style={{ backgroundColor: "#333", color: "#ccc" }}
      >
        {entry.status}
      </span>
      <h4 className="text-white font-bold text-base mb-0">{entry.name}</h4>
      {entry.subtitle && (
        <p className="text-[#999] text-xs mt-1">{entry.subtitle}</p>
      )}
      {linkedArtist && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#d4af37]">
          <TrendingUp className="h-3 w-3" />
          <span>{formatNumber(linkedArtist.totalStreams)} streams</span>
          <span>·</span>
          <span>{linkedArtist.trackCount} tracks</span>
        </div>
      )}
    </div>
  );

  if (linkedArtist) {
    return <Link href={`/artist/${linkedArtist.id}`}>{cardContent}</Link>;
  }
  return cardContent;
}

export default function ShowtownPage() {
  const { data: showtownArtists, isLoading } = useQuery<ShowtownArtist[]>({
    queryKey: ["/api/showtown/artists"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="min-h-full pb-28 px-10 py-10" style={{ backgroundColor: "#050505" }}>
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-40 w-full rounded mb-10" />
          <Skeleton className="h-48 w-full rounded mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const artists = showtownArtists || [];

  const findLinked = (name: string) =>
    artists.find((a) => a.name.toLowerCase().includes(name.toLowerCase()));

  return (
    <div
      className="min-h-full pb-28 px-6 sm:px-10 py-10"
      style={{
        backgroundColor: "#050505",
        color: "#e0e0e0",
        fontFamily: "'Segoe UI', serif",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className="border-2 border-[#d4af37] rounded p-8 text-center mb-10"
          style={{
            background: "linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.85))",
          }}
          data-testid="section-marquee"
        >
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#d4af37] tracking-[8px] uppercase m-0"
            data-testid="text-showtown-title"
          >
            The Showtown Ledger
          </h1>
          <p className="text-[#ccc] mt-3 text-sm sm:text-base">
            A City Built from Sound, Memory, and Imagination
          </p>
          <div className="text-[#888] italic text-xs mt-2" data-testid="text-vault-status">
            GSR Fund: Strategic Release Mode Active
          </div>
        </div>

        <LeadAssetSection artists={artists} />

        <h3
          className="text-[#e0e0e0] text-base font-normal border-b border-[#333] pb-3 mb-5 uppercase tracking-wider"
          data-testid="text-portfolio-heading"
        >
          GSR Fund Portfolio (In the Vault)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {GSR_PORTFOLIO.map((entry, index) => {
            const nameParts = entry.name.toLowerCase().split(" ");
            const linkedArtist = artists.find((a) => {
              const aLower = a.name.toLowerCase();
              return nameParts.some((part) => part.length > 2 && aLower.includes(part));
            });

            return (
              <PortfolioCard
                key={index}
                entry={entry}
                linkedArtist={linkedArtist}
                index={index}
              />
            );
          })}
        </div>

        {artists.length > 0 && (
          <>
            <h3
              className="text-[#e0e0e0] text-base font-normal border-b border-[#333] pb-3 mb-5 mt-10 uppercase tracking-wider"
              data-testid="text-active-artists-heading"
            >
              Active Platform Artists ({artists.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {artists.map((artist) => (
                <Link key={artist.id} href={`/artist/${artist.id}`}>
                  <div
                    className="p-4 border border-[#333] rounded transition-all duration-300 hover:border-[#d4af37] cursor-pointer"
                    style={{ backgroundColor: "#1a1a1a" }}
                    data-testid={`showtown-artist-${artist.id}`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {artist.profileImage ? (
                        <img
                          src={artist.profileImage}
                          alt={artist.name}
                          className="h-10 w-10 rounded-full object-cover border border-[#d4af37]/40"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-[#d4af37]/20 flex items-center justify-center text-[#d4af37] font-bold text-sm">
                          {artist.name[0]}
                        </div>
                      )}
                      <div>
                        <h4 className="text-white font-bold text-sm" data-testid={`text-artist-name-${artist.id}`}>
                          {artist.name}
                        </h4>
                        <span className="text-[#888] text-xs">{artist.trackCount} tracks</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#888]">In-House Streams</span>
                        <span className="text-white font-bold" data-testid={`stat-streams-${artist.id}`}>
                          {formatNumber(artist.totalStreams)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#888]">Aitify Bonus</span>
                        <span className="text-[#d4af37] font-bold" data-testid={`stat-bonus-${artist.id}`}>
                          ${(artist.totalStreams * 0.001).toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-[#333] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#d4af37] to-[#f0d060] rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min((artist.totalStreams / STREAM_GOAL) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#666] text-right">
                        {((artist.totalStreams / STREAM_GOAL) * 100).toFixed(1)}% of {formatNumber(STREAM_GOAL)} goal
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
