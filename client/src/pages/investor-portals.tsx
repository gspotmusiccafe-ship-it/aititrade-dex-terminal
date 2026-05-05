import React, { useState, useEffect } from 'react';

const PORTALS = [
  { id: 0, title: "BETTER THAN GOOD", img: "/global-radio-container.png" },
  { id: 1, title: "I'M NOT HER", img: "/landing.png" },
  { id: 4, title: "SILENT CRIES", img: "/screenshot-5s.png" },
  { id: 5, title: "G-SPOT CLASSIC", img: "/screenshot-2s.png" },
];

export default function AititradeDEX() {
  const [data, setData] = useState<any[]>([]);
  const [audio, setAudio] = useState("");

  // 🏦 AUTOMATIC TICKER - STAYS IN BACKGROUND
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        if (!res.ok) throw new Error("Feed Down");
        const json = await res.json();
        setData(json.assets);
      } catch (err) {
        console.error("Connection to Regulator lost. Retrying...");
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, []);

  const trade = async (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // 🔥 THIS STOPS THE BROWSER FROM MOVING TO THE API PAGE
    try {
      const res = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({song_id: id})
      });
      const resJson = await res.json();
      setAudio(resJson.stream_url);
    } catch (err) {
      alert("Trade Execution Failed: Check Regulator Connection");
    }
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', padding: '40px', color: '#0f0', fontFamily: 'monospace' }}>
      <header style={{ borderBottom: '3px solid #f0f', paddingBottom: '20px', marginBottom: '40px' }}>
        <h1 style={{ color: '#fff', margin: 0, fontSize: '32px' }}>
          AITITRADE <span style={{color: '#f0f'}}>DEX TERMINAL</span>
        </h1>
        <p style={{ color: '#444', fontSize: '10px' }}>97.7 THE FLAME | REAL-TIME KINETIC FEED</p>
      </header>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
        {PORTALS.map(p => {
          const mkt = data.find(d => d.id === p.id) || { current_price: 0, current_pct: 0, is_closed: false };
          const isClosed = mkt.current_pct >= 60; // 🏦 BANKER'S CLOSE LOGIC
          const theme = isClosed ? '#f0f' : '#0f0';
          
          return (
            <div key={p.id} style={{ 
              width: '320px', 
              background: '#0a0a0a', 
              border: `2px solid ${theme}`, 
              borderRadius: '15px', 
              overflow: 'hidden',
              boxShadow: isClosed ? `0 0 25px ${theme}33` : 'none'
            }}>
              <div style={{ height: '160px', overflow: 'hidden' }}>
                <img src={p.img} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
              </div>

              <div style={{ padding: '25px' }}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '20px' }}>{p.title}</h3>
                <div style={{ fontSize: '36px', fontWeight: '900', color: theme, margin: '15px 0' }}>
                  ${(mkt.current_price || 0).toFixed(2)}
                </div>

                {/* THE PROGRESS BAR (KINETIC) */}
                <div style={{ width: '100%', height: '8px', background: '#222', borderRadius: '10px', marginBottom: '25px' }}>
                  <div style={{ 
                    width: `${mkt.current_pct}%`, 
                    height: '100%', 
                    background: theme, 
                    boxShadow: `0 0 15px ${theme}`, 
                    transition: 'width 1s ease' 
                  }} />
                </div>

                <button 
                  onClick={(e) => trade(e, p.id)} 
                  style={{ 
                    width: '100%', 
                    padding: '18px', 
                    background: theme, 
                    color: '#000', 
                    border: 'none', 
                    borderRadius: '5px',
                    fontWeight: '900', 
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  {isClosed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📻 THE FLAME AUDIO PLAYER */}
      {audio && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: 0, width: '100%', 
          background: '#000', borderTop: '5px solid #f0f', 
          padding: '25px', zIndex: 1000, display: 'flex', alignItems: 'center' 
        }}>
          <div style={{ color: '#f0f', fontWeight: 'bold', fontSize: '12px', marginRight: '20px' }}>ON AIR: 97.7 THE FLAME</div>
          <audio src={audio} autoPlay controls style={{ flexGrow: 1, filter: 'invert(1)' }} />
        </div>
      )}
    </div>
  );
}
