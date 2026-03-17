import { useQuery } from "@tanstack/react-query";

export function MarketTicker() {
  const { data: assets } = useQuery<any[]>({
    queryKey: ["/api/market-ticker"],
    refetchInterval: 60000,
  });

  if (!assets || assets.length === 0) return null;

  const doubled = [...assets, ...assets];

  return (
    <div className="w-full bg-black border-b border-emerald-500/40 py-1.5 overflow-hidden" data-testid="market-ticker-global">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((asset, i) => {
          const status = asset.isQualified ? "QUALIFIED" : "EMERGING";
          return (
            <div key={`${asset.id}-${i}`} className="inline-flex items-center mx-6 space-x-2 text-xs font-mono uppercase">
              <span className="text-emerald-400 font-bold">${asset.title.replace(/\s+/g, '').slice(0, 14)}</span>
              <span className="text-white">{(asset.streamCount || 0).toLocaleString()} VOL</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${status === 'QUALIFIED' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                {status}
              </span>
              <span className="text-emerald-600">▲ {status === 'QUALIFIED' ? '25%' : '16%'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
