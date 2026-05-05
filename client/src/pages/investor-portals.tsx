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
    <div style={{ backgroundColor: '#050505', minHeight: '100vh', color: '#00ff00', fontFamily: 'monospace', padding: '40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #222', paddingBottom: '20px', marginBottom: '40px' }}>
        <h1 style={{ color: 'white', fontSize: '32px', fontWeight: '900', fontStyle: 'italic', margin: 0 }}>
          AITITRADE <span style={{ color: '#ff00ff' }}>DEX TERMINAL</span>
        </h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '18px' }}>97.7 THE FLAME</div>
          <div style={{ color: '#333', fontSize: '10px' }}>LIVE KINETIC FEED</div>
        </div>
      </header>

      {/* 🏦 THE REAL TRADING GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
        {SONG_ASSETS.map((song) => {
          const data = market.find(m => m.id === song.id) || { current_price: 0, current_pct: 0, is_closed: false };
          const isClosed = data.is_closed || data.current_pct >= 60; // Forced logic check
          const accent = isClosed ? '#ff00ff' : '#00ff00';

          return (
            <div key={song.id} style={{ backgroundColor: '#111', border: `2px solid ${accent}`, borderRadius: '15px', overflow: 'hidden', boxShadow: isClosed ? `0 0 20px ${accent}44` : 'none' }}>
              <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                <img src={song.img} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.8)', padding: '2px 8px', fontSize: '10px', color: '#666' }}>MF: @75%</div>
              </div>
              
              <div style={{ padding: '25px' }}>
                <h2 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '20px', fontWeight: 'bold' }}>{song.title}</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '900', color: accent }}>${data.current_price}</span>
                  <span style={{ fontSize: '12px', color: '#555' }}>{data.current_pct}% POS</span>
                </div>

                {/* THE KINETIC OSCILLATOR */}
                <div style={{ width: '100%', height: '10px', backgroundColor: '#222', borderRadius: '5px', marginBottom: '25px', overflow: 'hidden' }}>
                  <div style={{ width: `${data.current_pct}%`, height: '100%', backgroundColor: accent, boxShadow: `0 0 10px ${accent}`, transition: 'width 1s ease' }} />
                </div>

                <button 
                  onClick={() => handleTrade(song.id)}
                  style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '5px', fontWeight: '900', fontSize: '16px', cursor: 'pointer', backgroundColor: accent, color: 'black', textTransform: 'uppercase' }}
                >
                  {isClosed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* RADIO DOCK */}
      {streamUrl && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: '#000', borderTop: '4px solid #ff00ff', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 100 }}>
          <div style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '12px' }}>ON AIR: 97.7 THE FLAME</div>
          <audio autoPlay controls src={streamUrl} style={{ flexGrow: 1, height: '35px', filter: 'invert(1)' }} />
        </div>
      )}
    </div>
  );
}
