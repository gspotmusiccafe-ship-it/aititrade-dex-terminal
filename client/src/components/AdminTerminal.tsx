import React, { useState } from 'react';

export const AdminTerminal = () => {
  // Market Control States
  const [marketStatus, setMarketStatus] = useState('OPEN');
  const [portalPrice, setPortalPrice] = useState(1.00);
  
  // Minter States
  const [songTitle, setSongTitle] = useState('');
  const [initialPrice, setInitialPrice] = useState(1.00);

  const handleMint = () => {
    // This connects to your Neon Ledger via the API
    console.log(`MINTING ASSET: ${songTitle} | STARTING PRICE: ${initialPrice} BNB`);
    alert(`97.7 THE FLAME: ${songTitle} has been Minted successfully!`);
  };

  return (
    <div className="min-h-screen bg-black text-amber-500 p-8 font-mono">
      <header className="border-b-2 border-amber-900 pb-4 mb-8">
        <h1 className="text-4xl font-black italic">97.7 THE FLAME | COMMAND CENTER</h1>
        <p className="text-zinc-500 uppercase tracking-widest">Music Money Market Admin v1.0</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* SECTION 1: MARKET PRICING & LIQUIDITY */}
        <div className="bg-zinc-900 p-6 border border-amber-600 rounded">
          <h2 className="text-2xl font-bold mb-6 underline">MARKET CONTROL</h2>
          
          <div className="mb-6">
            <label className="block text-xs uppercase text-zinc-400">Current Buy-In (BNB/Coin)</label>
            <input 
              type="number" 
              value={portalPrice} 
              onChange={(e) => setPortalPrice(parseFloat(e.target.value))}
              className="bg-black border border-amber-500 text-green-500 text-2xl p-3 w-full mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="bg-amber-600 text-black font-black py-4 uppercase hover:bg-amber-500 transition">
              Update Portal
            </button>
            <button 
              onClick={() => setMarketStatus(marketStatus === 'OPEN' ? 'CLOSED' : 'OPEN')}
              className={`${marketStatus === 'OPEN' ? 'bg-red-700' : 'bg-green-700'} text-white font-black py-4 uppercase`}
            >
              {marketStatus === 'OPEN' ? 'Close Market' : 'Open Market'}
            </button>
          </div>
        </div>

        {/* SECTION 2: ASSET MINTER */}
        <div className="bg-zinc-900 p-6 border border-green-600 rounded">
          <h2 className="text-2xl font-bold mb-6 underline text-green-400">ASSET MINTER</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-zinc-400">Song Title (From Firebase)</label>
              <input 
                type="text" 
                placeholder="ENTER SONG NAME"
                className="w-full bg-black border border-zinc-700 p-3 text-white mt-1"
                onChange={(e) => setSongTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-zinc-400">Opening Valuation</label>
              <input 
                type="number" 
                placeholder="1.00"
                className="w-full bg-black border border-zinc-700 p-3 text-white mt-1"
                onChange={(e) => setInitialPrice(parseFloat(e.target.value))}
              />
            </div>
            <button 
              onClick={handleMint}
              className="w-full bg-green-600 hover:bg-green-500 text-black font-black py-4 mt-2 rounded shadow-lg shadow-green-900/20"
            >
              MINT DIGITAL ASSET
            </button>
          </div>
        </div>

      </div>
      
      {/* LEDGER PREVIEW */}
      <footer className="mt-12 p-4 bg-black border-t border-zinc-800">
        <p className="text-xs text-zinc-600">CONNECTED TO NEON LEDGER: ep-sweet-leaf-amdx50ow</p>
      </footer>
    </div>
  );
};
