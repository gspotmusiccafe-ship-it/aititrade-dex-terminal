import { useQuery } from "@tanstack/react-query";

interface TickerAsset {
  id: string;
  title: string;
  artistName?: string;
  price: number;
  salesCount: number;
  playCount: number;
  ticker: string;
  isPrerelease?: boolean;
}

const FALLBACK_TICKER: TickerAsset[] = [
  { id: "f1", title: "VELOCITY PRIME", artistName: "AITIFY-GEN-1", price: 1.99, salesCount: 247, playCount: 8420, ticker: "VLCP", isPrerelease: true },
  { id: "f2", title: "NEURAL DRIFT", artistName: "AITIFY-GEN-1", price: 2.49, salesCount: 183, playCount: 6100, ticker: "NRLD", isPrerelease: false },
  { id: "f3", title: "QUANTUM BASS", artistName: "AITIFY-GEN-1", price: 1.49, salesCount: 312, playCount: 11200, ticker: "QNTB", isPrerelease: true },
  { id: "f4", title: "SOVEREIGN WAVE", artistName: "AITIFY-GEN-1", price: 3.99, salesCount: 95, playCount: 3800, ticker: "SVWV", isPrerelease: false },
  { id: "f5", title: "MINT PROTOCOL", artistName: "AITIFY-GEN-1", price: 2.99, salesCount: 156, playCount: 5600, ticker: "MNTP", isPrerelease: true },
  { id: "f6", title: "ALPHA SIGNAL", artistName: "AITIFY-GEN-1", price: 1.99, salesCount: 201, playCount: 7300, ticker: "ALSG", isPrerelease: false },
  { id: "f7", title: "CIRCUIT BREAK", artistName: "AITIFY-GEN-1", price: 4.99, salesCount: 67, playCount: 2100, ticker: "CRCB", isPrerelease: true },
  { id: "f8", title: "DATA STREAM", artistName: "AITIFY-GEN-1", price: 1.49, salesCount: 289, playCount: 9800, ticker: "DTST", isPrerelease: false },
];

function generateTicker(title: string): string {
  const words = title.replace(/[^a-zA-Z\s]/g, "").trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase();
  }
  return title.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase();
}

export function MarketTicker() {
  const { data: liveAssets } = useQuery<any[]>({
    queryKey: ["/api/market-ticker"],
    refetchInterval: 30000,
  });

  const { data: trackAssets } = useQuery<any[]>({
    queryKey: ["/api/tracks"],
    refetchInterval: 60000,
  });

  let assets: TickerAsset[] = [];

  if (trackAssets && trackAssets.length > 0) {
    assets = trackAssets.map((t: any) => ({
      id: t.id,
      title: t.title,
      artistName: t.artist?.name || t.artistName || "AITIFY-GEN-1",
      price: t.price || 1.99,
      salesCount: t.salesCount || 0,
      playCount: t.playCount || 0,
      ticker: generateTicker(t.title),
      isPrerelease: t.isPrerelease,
    }));
  }

  if (liveAssets && liveAssets.length > 0) {
    const royaltyItems: TickerAsset[] = liveAssets.map((a: any) => ({
      id: a.id,
      title: a.title,
      artistName: a.artistName || "AITIFY-GEN-1",
      price: 1.99,
      salesCount: a.streamCount || 0,
      playCount: a.streamCount || 0,
      ticker: generateTicker(a.title),
      isPrerelease: false,
    }));
    assets = [...assets, ...royaltyItems];
  }

  if (assets.length === 0) {
    assets = FALLBACK_TICKER;
  }

  const quadrupled = [...assets, ...assets, ...assets, ...assets];

  return (
    <div
      className="w-full bg-black border-b border-lime-500/40 overflow-hidden sticky top-0 z-50"
      style={{ height: "32px" }}
      data-testid="market-ticker-global"
    >
      <div className="animate-marquee flex items-center whitespace-nowrap h-full">
        {quadrupled.map((asset, i) => (
          <div key={`${asset.id}-${i}`} className="inline-flex items-center mx-5 space-x-2 text-xs font-mono uppercase flex-shrink-0">
            <span className="text-lime-400 font-extrabold">${asset.ticker}</span>
            <span className="text-white font-bold">{asset.title.slice(0, 16)}</span>
            <span className="text-lime-400 font-extrabold">${asset.price.toFixed(2)}</span>
            <span className="text-zinc-400">{asset.salesCount.toLocaleString()} UNITS</span>
            <span className="text-lime-500 font-bold">▲ {((asset.salesCount / 10) + 12).toFixed(1)}%</span>
            {asset.isPrerelease && (
              <span className="text-amber-400 font-extrabold text-[9px] border border-amber-500/40 px-1 py-0">PRE</span>
            )}
            <span className="text-zinc-700 ml-2">│</span>
          </div>
        ))}
      </div>
    </div>
  );
}
