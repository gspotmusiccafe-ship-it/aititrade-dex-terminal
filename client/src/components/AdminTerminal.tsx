// ASSET MINTER - CONVERTS FIREBASE SONGS TO MARKET ASSETS
const MintAssetPortal = () => {
  const [songTitle, setSongTitle] = useState('');
  const [initialPrice, setInitialPrice] = useState(1.00);

  const handleMint = () => {
    // This logs the "Creation" to your Neon Ledger
    console.log(`MINTING ASSET: ${songTitle} | STARTING PRICE: ${initialPrice} BNB`);
    alert(`${songTitle} is now a Live Digital Asset on 97.7 THE FLAME`);
  };

  return (
    <div className="mt-10 bg-zinc-900 p-6 border-l-4 border-green-500 rounded">
      <h2 className="text-xl font-bold text-green-400 mb-4 text-center">ASSET MINTING PRESS</h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-zinc-400">SONG TITLE (ASSET NAME)</label>
          <input 
            type="text" 
            placeholder="e.g. BETTER THAN GOOD"
            className="w-full bg-black border border-zinc-700 p-2 text-white"
            onChange={(e) => setSongTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">INITIAL COIN VALUE</label>
          <input 
            type="number" 
            placeholder="1.00"
            className="w-full bg-black border border-zinc-700 p-2 text-white"
            onChange={(e) => setInitialPrice(parseFloat(e.target.value))}
          />
        </div>
        <button 
          onClick={handleMint}
          className="w-full bg-green-600 hover:bg-green-500 text-black font-black py-3 rounded">
          MINT & PUSH TO MARKET
        </button>
      </div>
    </div>
  );
};
