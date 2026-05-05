{/* 🏦 THE TRADING FLOOR: 4-COLUMN GRID */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4">
  {SONG_ASSETS.map((song) => {
    const liveData = market.find(m => m.id === song.id) || { current_price: 0, current_pct: 0, is_closed: false };
    const borderColor = liveData.is_closed ? "border-magenta-500 shadow-[0_0_15px_rgba(255,0,255,0.3)]" : "border-zinc-800";
    const statusText = liveData.is_closed ? "MARKET CLOSED" : "MARKET OPEN";

    return (
      <div key={song.id} className={`bg-zinc-950 border-2 rounded-xl overflow-hidden ${borderColor} transition-all duration-300`}>
        {/* ALBUM IMAGE CONTAINER */}
        <div className="relative h-40 w-full bg-zinc-900">
          <img src={song.img} alt={song.title} className="w-full h-full object-cover opacity-60" />
          <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-[10px] text-zinc-400">
            MF: @75%
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-white font-bold text-lg truncate mb-1">{song.title}</h3>
          
          <div className="flex justify-between items-end mb-4">
            <span className={`text-2xl font-black ${liveData.is_closed ? 'text-magenta-500' : 'text-green-500'}`}>
              ${liveData.current_price}
            </span>
            <span className="text-[10px] text-zinc-500">{liveData.current_pct}% POSITION</span>
          </div>

          {/* KINETIC OSCILLATOR BAR */}
          <div className="w-full h-1.5 bg-zinc-900 rounded-full mb-6 overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${liveData.is_closed ? 'bg-magenta-500 shadow-[0_0_10px_#ff00ff]' : 'bg-green-500'}`}
              style={{ width: `${liveData.current_pct}%` }}
            />
          </div>

          {/* TRADING BUTTON */}
          <Button 
            onClick={() => handleTrade(song.id)}
            className={`w-full font-bold uppercase tracking-widest ${liveData.is_closed ? 'bg-magenta-600 hover:bg-magenta-500 text-white' : 'bg-green-600 hover:bg-green-500 text-black'}`}
          >
            {liveData.is_closed ? 'Execute Buyback' : 'Trade Asset'}
          </Button>
        </div>
      </div>
    );
  })}
</div>
