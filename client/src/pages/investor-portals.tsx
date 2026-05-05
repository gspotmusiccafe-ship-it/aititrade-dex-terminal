import React, { useState, useEffect } from 'react';

const ASSETS = [
  { id: 0, title: "BETTER THAN GOOD", img: "/global-radio-container.png" },
  { id: 1, title: "I'M NOT HER", img: "/landing.png" },
  { id: 4, title: "SILENT CRIES", img: "/screenshot-5s.png" },
  { id: 5, title: "G-SPOT CLASSIC", img: "/screenshot-2s.png" },
];

export default function AititradeTerminal() {
  const [market, setMarket] = useState<any[]>([]);
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        const json = await res.json();
        setMarket(json.assets);
      } catch (err) { console.error("FEED_OFFLINE"); }
    };
    sync();
    const interval = setInterval(sync, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: '#050505', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      
      {/* 🎰 THE PRO TICKER TAPE */}
      <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '12px 0', overflow: 'hidden' }}>
        <marquee scrollamount="8">
          {market.map(m => (
            <span key={m.id} style={{ margin: '0 40px', fontSize: '14px', letterSpacing: '1px' }}>
              <span style={{ color: '#555' }}>{m.title}</span> 
              <span style={{ color: m.is_closed ? '#f0f' : '#0f0', marginLeft: '10px', fontWeight: 'bold' }}>
                ${m.current_price.toFixed(2)}
              </span>
            </span>
          ))}
        </marquee>
      </div>

      <div style={{ padding: '40px 5%' }}>
        <header style={{ marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 900, margin: 0 }}>
            AITITRADE <span style={{ color: '#f0f' }}>DEX</span>
          </h1>
          <p style={{ color: '#0f0', fontSize: '12px', fontWeight: 'bold' }}>● 97.7 THE FLAME | KINETIC LOGIC ACTIVE</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
          {ASSETS.map(asset => {
            const live = market.find(m => m.id === asset.id) || { current_price: 0, current_pct: 0, is_closed: false };
            const theme = live.is_closed ? '#f0f' : '#0f0';
            
            return (
              <div key={asset.id} style={{ background: '#0f0f0f', border: `1px solid ${theme}`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ height: '160px', background: '#000', position: 'relative' }}>
                  <img src={asset.img} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
                </div>
                
                <div style={{ padding: '25px' }}>
                  <h2 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>{asset.title}</h2>
                  <div style={{ fontSize: '38px', fontWeight: 900, color: theme, marginBottom: '20px' }}>
                    ${live.current_price.toFixed(2)}
                  </div>

                  <div style={{ height: '6px', background: '#222', borderRadius: '3px', marginBottom: '20px' }}>
                    <div style={{ width: `${live.current_pct}%`, height: '100%', background: theme, boxShadow: `0 0 10px ${theme}` }} />
                  </div>

                  <button style={{ 
                    width: '100%', padding: '15px', background: theme, 
                    border: 'none', color: '#000', fontWeight: 'bold', 
                    textTransform: 'uppercase', cursor: 'pointer' 
                  }}>
                    {live.is_closed ? 'Execute Buyback' : 'Trade Asset'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
