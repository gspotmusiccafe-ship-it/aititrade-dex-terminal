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

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/market-data');
        const json = await res.json();
        setData(json.assets);
      } catch (err) {
        console.error("Market Feed Offline");
      }
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, []);

  const trade = async (id: number) => {
    const res = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({song_id: id})
    });
    const resJson = await res.json();
    setAudio(resJson.stream_url);
  };

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#0f0', fontFamily: 'monospace', overflowX: 'hidden' }}>
      
      {/* 🚀 THE KRAKEN TICKER TAPE */}
      <div style={{ background: '#111', borderBottom: '2px solid #333', padding: '10px 0', whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <div style={{ display: 'inline-block', animation: 'marquee 20s linear infinite' }}>
          {data.map(m => (
            <span key={m.id} style={{ margin: '0 40px', fontSize: '14px', fontWeight: 'bold' }}>
              {m.title}: <span style={{ color: m.is_closed ? '#f0f' : '#0f0' }}>${m.current_price.toFixed(2)}</span> ({m.current_pct}%)
            </span>
          ))}
          {/* Duplicate for seamless scrolling */}
          {data.map(m => (
            <span key={`dup-${m.id}`} style={{ margin: '0 40px', fontSize: '14px', fontWeight: 'bold' }}>
              {m.title}: <span style={{ color: m.is_closed ? '#f0f' : '#0f0' }}>${m.current_price.toFixed(2)}</span> ({m.current_pct}%)
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div style={{ padding: '40px' }}>
        <h1 style={{ color: '#fff', borderBottom: '2px solid #f0f', paddingBottom: '10px', marginTop: 0 }}>
          AITITRADE <span style={{color: '#f0f'}}>DEX TERMINAL</span>
        </h1>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '30px' }}>
          {PORTALS.map(p => {
            const mkt = data.find(d => d.id === p.id) || { current_price: 0, current_pct: 0, is_closed: false };
            const color = mkt.is_closed ? '#f0f' : '#0f0';
            return (
              <div key={p.id} style={{ width: '320px', background: '#111', border: `2px solid ${color}`, borderRadius: '15px', overflow: 'hidden' }}>
                <img src={p.img} style={{ width: '100%', height: '160px', objectFit: 'cover', opacity: 0.5 }} />
                <div style={{ padding: '20px' }}>
                  <h3 style={{ color: '#fff', margin: 0 }}>{p.title}</h3>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: color, margin: '10px 0' }}>
                    ${mkt.current_price.toFixed(2)}
                  </div>
                  <div style={{ height: '8px', background: '#222', borderRadius: '4px' }}>
                    <div style={{ width: `${mkt.current_pct}%`, height: '100%', background: color, boxShadow: `0 0 10px ${color}`, transition: 'width 0.5s ease' }} />
                  </div>
                  <button onClick={() => trade(p.id)} style={{ width: '100%', marginTop: '20px', padding: '15px', background: color, border: 'none', fontWeight: 'bold', cursor: 'pointer', color: '#000' }} >
                    {mkt.is_closed ? 'EXECUTE BUYBACK' : 'TRADE ASSET'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {audio && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', background: '#000', borderTop: '4px solid #f0f', padding: '20px', zIndex: 100 }}>
          <audio src={audio} autoPlay controls style={{ width: '100%', filter: 'invert(1)' }} />
        </div>
      )}
    </div>
  );
}
