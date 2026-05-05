import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/card";

interface Asset {
  id: number;
  title: string;
  floor: number;
  ceiling: number;
}

const InvestorPortal = () => {
  const [marketData, setMarketData] = useState<any[]>([]);

  // 1. POLL THE OSCILLATOR EVERY 5 SECONDS
  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch('https://aitify-oscillator.onrender.com/api/trade', {
          method: 'GET' // Ensure your app.py has a GET route for just data
        });
        const data = await res.json();
        setMarketData(data.assets);
      } catch (e) {
        console.error("Market Feed Offline");
      }
    };
    const interval = setInterval(fetchMarket, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-black min-h-screen text-green-400 font-mono">
      <h1 className="text-3xl mb-8 border-b border-green-900 pb-4">INVESTOR BUYBACK TERMINAL</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marketData.map((asset) => {
          const isOverPar = asset.current_price > 1.00;
          const profit = ((asset.current_price - asset.floor) / asset.floor * 100).toFixed(2);

          return (
            <Card key={asset.id} className="bg-zinc-900 border-2 border-green-900">
              <CardHeader>
                <CardTitle className="text-white">{asset.title}</CardTitle>
                <div className="text-xs text-zinc-500">ASSET ID: {asset.id}</div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl mb-4" style={{ color: isOverPar ? '#ff00ff' : '#00ff00' }}>
                  ${asset.current_price}
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Rapid Floor:</span> <span>${asset.floor}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold">
                    <span>Buyback Profit:</span> 
                    <span className={Number(profit) > 0 ? "text-cyan-400" : "text-red-500"}>
                      {profit}%
                    </span>
                  </div>
                </div>

                <Button 
                  className={`w-full mt-6 ${isOverPar ? 'bg-magenta-600' : 'bg-green-900'} text-black`}
                  disabled={!isOverPar}
                >
                  {isOverPar ? "EXECUTE BUYBACK" : "ACCUMULATING..."}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default InvestorPortal;
