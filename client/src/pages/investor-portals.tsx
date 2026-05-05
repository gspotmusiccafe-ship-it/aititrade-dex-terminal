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
    <div style={{ backgroundColor: '#020202', minHeight: '100vh', color: '#00ff00', fontFamily: '"Courier New", monospace', padding: '50px' }}>
      
      {/* 📻 HEADER & RAPID FLOOR TIMER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #ff00ff', paddingBottom: '30px', marginBottom: '50px' }}>
        <div>
          <h1 style={{ color: 'white', fontSize: '42px', fontWeight: '900', margin: 0, letterSpacing: '-2px' }}>
            AITITRADE <span style={{ color: '#ff00ff' }}>DEX</span>
          </h1>
          <p style={{ color: '#555', margin: 0, fontSize: '12px' }}>PREMIER AI MUSIC EXCHANGE | 97.7 THE FLAME</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#ff00ff', fontSize: '10px', fontWeight: 'bold' }}>RAPID FLOOR RESET</div>
          <div style={{ color: 'white', fontSize: '36px', fontWeight: '900' }}>
            {Math.floor(resetClock/60)}:{(resetClock%60).toString().padStart(2, '0')}
          </div>
        </div>
      </header>

      {/* 🏦 THE TRADING FLOOR CONTAINERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px' }}>
        {SONG_ASSETS.map((song) => {
          const data = market.find(m => m.id === song.id) || { current_price: 0, current_pct: 0, is_closed: false };
          // Logic check: If price > 60% or marked closed, hit the pink switch
          const isClosed = data.is_closed || data.current_pct >= 60; 
          const theme = isClosed ? '#ff00ff' : '#00ff00';

          return (
            <div key={song.id} style={{ 
              backgroundColor: '#0a0a0a', 
              border: `2px solid ${theme}`, 
              borderRadius: '20px', 
              overflow: 'hidden', 
              boxShadow: isClosed ? `0 0 30px ${theme}33` : 'none',
              transition: 'all 0.5s ease'
            }}>
              {/* IMAGE PORTAL */}
              <div style={{ height: '200px', position: 'relative' }}>
                <img src={song.img} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent, #0a0a0a)' }} />
                <div style={{ position: 'absolute', top: '15px', right: '15px', background: theme, color: 'black', padding: '2px 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px' }}>
                  MF: @75%
                </div>
              </div>

              {/* DATA SECTION */}
              <div style={{ padding: '30px' }}>
                <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '900', margin: '0 0 5px 0' }}>{song.title}</h2>
                <div style={{ color: '#444', fontSize: '10px', marginBottom: '15px' }}>ASSET ID: {song.id}00XFLAME</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <span style={{ fontSize: '42px', fontWeight: '900', color: theme, letterSpacing: '-1px' }}>
                    ${data.current_price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '14px', color: '#666' }}>{data.current_pct}% POS</span>
                </div>

                {/* THE KINETIC OSCILLATOR */}
                <div style={{ width: '100%', height: '8px', backgroundColor: '#111', borderRadius: '10px', marginBottom: '30px', border: '1px solid #222' }}>
                  <div style={{ 
                    width: `${data.current_pct}%`, 
                    height: '100%', 
                    backgroundColor: theme, 
                    boxShadow: `0 0 15px ${theme}`,
                    transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' 
                  }} />
                </div>

                <button 
                  onClick={() => handleTrade(song.id)}
                  style={{ 
                    width: '100%', 
                    padding: '20px', 
                    background: theme, 
                    color: 'black', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontSize: '18px', 
                    fontWeight: '900', 
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}
                >
                  {isClosed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📻 97.7 THE FLAME RADIO DOCK */}
      {streamUrl && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: 0, width: '100%', 
          backgroundColor: '#000', borderTop: '5px solid #ff00ff', 
          padding: '25px', display: 'flex', alignItems: 'center', gap: '30px', zIndex: 1000 
        }}>
          <div style={{ color: '#ff00ff', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
            NOW PLAYING: 97.7 THE FLAME
          </div>
          <audio autoPlay controls src={streamUrl} style={{ width: '100%', height: '40px', filter: 'invert(1)' }} />
        </div>
      )}
    </div>
  );
}
