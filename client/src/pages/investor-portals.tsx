import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, TrendingUp, DollarSign } from "lucide-react";

// The AITIFY Asset Roster
const SONG_ASSETS = [
  { id: 0, title: "BETTER THAN GOOD", img: "/global-radio-container.png", file: "BETTER THAN GOOD (1).mp3" },
  { id: 1, title: "I'M NOT HER", img: "/landing.png", file: "I'M NOT HER.mp3" },
  { id: 4, title: "SILENT CRIES", img: "/screenshot-5s.png", file: "SILENT CRIES NOBODY HEARS.mp3" },
  { id: 5, title: "G-SPOT CLASSIC", img: "/screenshot-2s.png", file: "G_SPOT_RECORDS_THEME.mp3" },
];

const InvestorPortal = () => {
  const [market, setMarket] = useState<any[]>([]);
  const [streamUrl, setStreamUrl] = useState("");
  const [timeLeft, setTimeLeft] = useState(270);

  useEffect(() => {
    // 4.5 Minute Market Reset Clock
    const timer = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 270), 1000);
    
    // Kinetic Market Polling (5s)
    const fetchMarket = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        const data = await res.json();
        setMarket(data.assets);
      } catch (e) { console.error("OFFLINE"); }
    };
    
    fetchMarket();
    const marketInt = setInterval(fetchMarket, 5000);
    return () => { clearInterval(timer); clearInterval(marketInt); };
  }, []);

  const handleTrade = async (id: number) => {
    const res = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: id })
    });
    const data = await res.json();
    setStreamUrl(data.stream_url); // Radio Handshake
  };

  return (
    <div className="min-h-screen bg-[#050505] p-8 font-mono text-green-400">
      <div className="flex justify-between items-end border-b-2 border-zinc-800 pb-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">AITITRADE DEX</h1>
          <p className="text-zinc-500">97.7 THE FLAME | PREMIER AI MUSIC EXCHANGE</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-600">RAPID RESET</p>
          <p className="text-3xl font-bold text-magenta-500">
            {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, '0')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {SONG_ASSETS.map((song) => {
          const liveData = market.find(m => m.id === song.id) || { current_price: 1.00, current_pct: 0, is_closed: false };
          const statusColor = liveData.is_closed ? "#ff00ff" : "#00ff00";

          return (
            <Card key={song.id} className="bg-zinc-950 border-2 overflow-hidden transition-all duration-500" style={{ borderColor: statusColor + '33' }}>
              <div className="relative h-48 group">
                <img src={song.img} className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <p className="text-white font-bold text-lg">{song.title}</p>
                  <p className="text-[10px] text-zinc-500">MF: @75%</p>
                </div>
              </div>

              <CardContent className="p-6">
                <div className="flex justify-between items-baseline mb-4">
                  <span className="text-3xl font-bold" style={{ color: statusColor }}>${liveData.current_price}</span>
                  <span className="text-xs text-zinc-500">{liveData.current_pct}% POS</span>
                </div>

                {/* THE OSCILLATOR BAR */}
                <div className="h-1.5 w-full bg-zinc-900 rounded-full mb-6 overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000 shadow-[0_0_15px]"
                    style={{ width: `${liveData.current_pct}%`, backgroundColor: statusColor, boxShadow: `0 0 10px ${statusColor}` }}
                  />
                </div>

                <Button 
                  onClick={() => handleTrade(song.id)}
                  className="w-full font-bold h-12 transition-all hover:scale-105"
                  style={{ backgroundColor: statusColor, color: 'black' }}
                >
                  {liveData.is_closed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* THE RADIO DOCK */}
      {streamUrl && (
        <div className="fixed bottom-0 left-0 w-full bg-black border-t-2 border-magenta-600 p-6 flex items-center gap-6 z-50">
          <div className="flex-1">
            <p className="text-magenta-500 text-[10px] font-bold animate-pulse">LIVE BROADCAST: 97.7 THE FLAME</p>
            <audio autoPlay controls src={streamUrl} className="w-full h-10 mt-2 invert" />
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestorPortal;
