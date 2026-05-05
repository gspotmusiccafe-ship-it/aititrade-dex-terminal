import React, { useState, useEffect } from 'react';

const SONG_ASSETS = [
  { id: 0, title: "BETTER THAN GOOD", img: "/global-radio-container.png" },
  { id: 1, title: "I'M NOT HER", img: "/landing.png" },
  { id: 4, title: "SILENT CRIES", img: "/screenshot-5s.png" },
  { id: 5, title: "G-SPOT CLASSIC", img: "/screenshot-2s.png" },
];

export default function InvestorPortal() {
  const [market, setMarket] = useState<any[]>([]);
  const [streamUrl, setStreamUrl] = useState("");
  const [resetClock, setResetClock] = useState(270);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        const data = await res.json();
        setMarket(data.assets);
      } catch (e) { console.error("DEX OFFLINE"); }
    };
    fetchMarket();
    const int = setInterval(fetchMarket, 5000);
    const clock = setInterval(() => setResetClock(c => c > 0 ? c - 1 : 270), 1000);
    return () => { clearInterval(int); clearInterval(clock); };
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
    <div style={{ backgroundColor: '#020202', minHeight: '100vh', color: '#00ff00', fontFamily: 'monospace', padding: '50px' }}>
      
      {/* 📻 HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #ff00ff', paddingBottom: '30px', marginBottom: '50px' }}>
        <div>
          <h1 style={{ color: 'white', fontSize: '42px', fontWeight: '900', margin: 0 }}>AITITRADE <span style={{ color: '#ff00ff' }}>DEX</span></h1>
          <p style={{ color: '#444', margin: 0 }}>97.7 THE FLAME | PREMIER AI MUSIC EXCHANGE</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#ff00ff', fontSize: '10px' }}>RAPID RESET</div>
          <div style={{ color: 'white', fontSize: '36px', fontWeight: '900' }}>
            {Math.floor(resetClock/60)}:{(resetClock%60).toString().padStart(2, '0')}
          </div>
        </div>
      </header>

      {/* 🏦 TRADING CONTAINERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '40px' }}>
        {SONG_ASSETS.map((song) => {
          const data = market.find(m => m.id === song.id) || { current_price: 0, current_pct: 0, is_closed: false };
          const isClosed = data.is_closed || data.current_pct >= 60;
          const theme = isClosed ? '#ff00ff' : '#00ff00';

          return (
            <div key={song.id} style={{ backgroundColor: '#0a0a0a', border: `2px solid ${theme}`, borderRadius: '20px', overflow: 'hidden', boxShadow: isClosed ? `0 0 30px ${theme}44` : 'none' }}>
              <img src={song.img} style={{ width: '100%', height: '180px', objectFit: 'cover', opacity: 0.4 }} />
              <div style={{ padding: '30px' }}>
                <h2 style={{ color: 'white', margin: '0 0 10px 0' }}>{song.title}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '900', color: theme }}>${data.current_price.toFixed(2)}</span>
                  <span style={{ fontSize: '12px', color: '#555' }}>{data.current_pct}%</span>
                </div>
                {/* OSCILLATOR */}
                <div style={{ width: '100%', height: '10px', backgroundColor: '#111', borderRadius: '5px', marginBottom: '30px' }}>
                  <div style={{ width: `${data.current_pct}%`, height: '100%', backgroundColor: theme, boxShadow: `0 0 15px ${theme}`, transition: 'width 1s ease' }} />
                </div>
                <button onClick={() => handleTrade(song.id)} style={{ width: '100%', padding: '20px', background: theme, color: 'black', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                  {isClosed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📻 RADIO DOCK */}
      {streamUrl && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: '#000', borderTop: '5px solid #ff00ff', padding: '20px', display: 'flex', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ color: '#ff00ff', fontWeight: 'bold', marginRight: '20px' }}>ON AIR</div>
          <audio autoPlay controls src={streamUrl} style={{ flexGrow: 1, filter: 'invert(1)' }} />
        </div>
      )}
    </div>
  );
}
