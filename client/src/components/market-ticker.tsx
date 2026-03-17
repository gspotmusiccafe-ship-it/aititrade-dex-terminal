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

const FALLBACK_TICKER: TickerAsset[] = [];

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
    queryKey: ["/api/tracks/featured"],
    refetchInterval: 60000,
  });

  let assets: TickerAsset[] = [];

  if (trackAssets && trackAssets.length > 0) {
    assets = trackAssets.map((t: any) => ({
      id: t.id,
      title: t.title,
      artistName: t.artist?.name || t.artistName || "AITIFY-GEN-1",
      price: parseFloat(t.unitPrice || t.price || "3.50"),
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
      price: 3.50,
      salesCount: a.streamCount || 0,
      playCount: a.streamCount || 0,
      ticker: generateTicker(a.title),
      isPrerelease: false,
    }));
    assets = [...assets, ...royaltyItems];
  }

  if (assets.length === 0) {
    return (
      <div
        className="w-full bg-black border-b border-lime-500/40 overflow-hidden sticky top-0 z-50 flex items-center justify-center"
        style={{ height: "32px" }}
        data-testid="market-ticker-global"
      >
        <span className="text-emerald-500/40 text-[10px] font-mono">AITIFY SOVEREIGN EXCHANGE — AWAITING MARKET DATA</span>
      </div>
    );
  }

  const quadrupled = [...assets, ...assets, ...assets, ...assets];

  return (
    <div
      className="w-full bg-black border-b border-lime-500/40 overflow-hidden sticky top-0 z-50"
      style={{ height: "32px" }}
      data-testid="market-ticker-global"
    >
      <div className="animate-marquee flex items-center whitespace-nowrap h-full">
        {quadrupled.map((asset, i) => {
          const grossVol = asset.salesCount * asset.price;
          const poolPct = Math.min(100, (grossVol / 1000) * 100);
          const isFlash = poolPct >= 90 && poolPct < 100;
          const isPoolClosed = poolPct >= 100;
          return (
            <div key={`${asset.id}-${i}`} className="inline-flex items-center mx-5 space-x-2 text-xs font-mono uppercase flex-shrink-0">
              <span className={`font-extrabold ${isFlash ? "text-red-400" : "text-lime-400"}`}>${asset.ticker}</span>
              <span className="text-white font-bold">{asset.title.slice(0, 20)}</span>
              <span className="text-lime-400 font-extrabold">${asset.price.toFixed(2)}</span>
              <span className="text-emerald-300">ROI {((asset.salesCount * asset.price * 0.16) > 0 ? ((asset.salesCount * asset.price * 0.16) / asset.price * 100).toFixed(0) : "0")}%</span>
              <span className={`font-bold ${isFlash ? "text-red-400" : "text-lime-500"}`}>
                {isPoolClosed ? "SETTLED" : `${poolPct.toFixed(1)}% TO 1K`}
              </span>
              {isFlash && (
                <span className="text-red-400 font-extrabold text-[9px] border border-red-500/40 px-1 py-0 animate-pulse">⚡FLASH</span>
              )}
              {asset.isPrerelease && (
                <span className="text-amber-400 font-extrabold text-[9px] border border-amber-500/40 px-1 py-0">PRE</span>
              )}
              <span className="text-zinc-700 ml-2">│</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
