import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";

const SONG_ASSETS = [
  { id: 0, title: "BETTER THAN GOOD", img: "/global-radio-container.png" },
  { id: 1, title: "I'M NOT HER", img: "/landing.png" },
  { id: 4, title: "SILENT CRIES", img: "/screenshot-5s.png" },
  { id: 5, title: "G-SPOT CLASSIC", img: "/screenshot-2s.png" },
];

export default function InvestorPortal() {
  const [market, setMarket] = useState<any[]>([]);
  const [streamUrl, setStreamUrl] = useState("");

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        const data = await res.json();
        setMarket(data.assets);
      } catch (e) { console.error("OFFLINE"); }
    };
    fetchMarket();
    const int = setInterval(fetchMarket, 5000);
    return () => clearInterval(int);
  }, []);

  const handleTrade = async (id: number) => {
    const res = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: id })
    });
    const data = await res.json();
    setStreamUrl(data.stream_url);
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-10">
      <header className="flex justify-between border-b-2 border-zinc-900 pb-5 mb-10">
        <h1 className="text-3xl font-black text-white italic">AITITRADE DEX <span className="text-magenta-500">TERMINAL</span></h1>
        <div className="text-right text-magenta-500 font-bold">97.7 THE FLAME LIVE</div>
      </header>

      {/* 🏦 THE TRADING CONTAINERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {SONG_ASSETS.map((song) => {
          const data = market.find(m => m.id === song.id) || { current_price: 0, current_pct: 0, is_closed: false };
          const glow = data.is_closed ? "border-magenta-500 shadow-[0_0_20px_#ff00ff]" : "border-zinc-800";

          return (
            <div key={song.id} className={`bg-zinc-950 border-2 rounded-2xl overflow-hidden ${glow} transition-all duration-500`}>
              <img src={song.img} className="w-full h-44 object-cover opacity-50 border-b border-zinc-900" />
              
              <div className="p-6">
                <h2 className="text-white text-xl font-bold mb-2">{song.title}</h2>
                <div className="flex justify-between items-baseline mb-4">
                  <span className={`text-4xl font-black ${data.is_closed ? 'text-magenta-500' : 'text-green-500'}`}>
                    ${data.current_price}
                  </span>
                  <span className="text-xs text-zinc-500 uppercase">{data.current_pct}% POS</span>
                </div>

                {/* THE OSCILLATOR BAR */}
                <div className="w-full h-2 bg-zinc-900 rounded-full mb-8">
                  <div 
                    className={`h-full transition-all duration-1000 ${data.is_closed ? 'bg-magenta-500' : 'bg-green-500'}`}
                    style={{ width: `${data.current_pct}%`, boxShadow: data.is_closed ? '0 0 15px #ff00ff' : 'none' }}
                  />
                </div>

                <Button 
                  onClick={() => handleTrade(song.id)}
                  className={`w-full h-14 text-lg font-black uppercase italic ${data.is_closed ? 'bg-magenta-600 hover:bg-magenta-400 text-white' : 'bg-green-600 hover:bg-green-400 text-black'}`}
                >
                  {data.is_closed ? 'Execute Buyback' : 'Trade Asset'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* RADIO DOCK */}
      {streamUrl && (
        <div className="fixed bottom-0 left-0 w-full bg-zinc-950 border-t-2 border-magenta-500 p-4 flex items-center gap-4">
          <div className="animate-pulse text-magenta-500 font-bold text-xs">ON AIR</div>
          <audio autoPlay controls src={streamUrl} className="w-full h-10 invert" />
        </div>
      )}
    </div>
  );
}
