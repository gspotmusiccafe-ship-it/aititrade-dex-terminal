import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DollarSign, Target, TrendingUp, Crown } from "lucide-react";

export function TrustTutorial() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem("hasSeenTrustTutorial");
    if (!hasSeen) setOpen(true);
  }, []);

  const closeTutorial = () => {
    localStorage.setItem("hasSeenTrustTutorial", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-black border-2 border-lime-500 text-white font-mono max-w-md p-0 overflow-hidden" data-testid="trust-tutorial-dialog">
        <div className="border-b border-lime-500/40 bg-lime-950/60 px-5 py-4 text-center">
          <h2 className="text-lime-400 font-black text-lg sm:text-xl tracking-tight uppercase">
            WELCOME TO AITITRADE
          </h2>
          <p className="text-lime-500/70 text-[10px] sm:text-xs tracking-widest mt-1">
            THE EXCHANGE WHERE THE
          </p>
          <p className="text-white font-black text-2xl sm:text-3xl mt-1 tracking-tight">
            "PENNY IS KING"
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-center mb-3">
            <p className="text-zinc-400 text-[10px] sm:text-xs tracking-wider uppercase font-bold">
              At AITITRADE we are goal oriented
            </p>
          </div>

          <div className="border border-lime-500/20 bg-lime-950/20 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-lime-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-4 w-4 text-lime-400" />
            </div>
            <div>
              <p className="text-[9px] text-lime-500/50 font-bold tracking-wider">GOAL 1</p>
              <p className="text-white font-black text-sm">Trade $1.00 into $10.00</p>
            </div>
          </div>

          <div className="border border-lime-500/20 bg-lime-950/20 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-lime-500/10 flex items-center justify-center flex-shrink-0">
              <Target className="h-4 w-4 text-lime-400" />
            </div>
            <div>
              <p className="text-[9px] text-lime-500/50 font-bold tracking-wider">GOAL 2</p>
              <p className="text-white font-black text-sm">Trade $10.00 into $100.00</p>
            </div>
          </div>

          <div className="border border-lime-500/20 bg-lime-950/20 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-lime-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-lime-400" />
            </div>
            <div>
              <p className="text-[9px] text-lime-500/50 font-bold tracking-wider">GOAL 3</p>
              <p className="text-white font-black text-sm">Trade $100.00 into $1,000</p>
            </div>
          </div>

          <div className="border border-lime-500/20 bg-lime-950/20 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-lime-500/10 flex items-center justify-center flex-shrink-0">
              <Crown className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-[9px] text-yellow-500/50 font-bold tracking-wider">GOAL 4</p>
              <p className="text-white font-black text-sm">Trade $1,000 into $10,000</p>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-lime-400/60 text-[10px] font-bold tracking-widest uppercase">
              The power of the penny is in effect
            </p>
          </div>

          <button
            onClick={closeTutorial}
            className="w-full bg-lime-600 hover:bg-lime-400 text-black font-black py-3 text-sm tracking-wider uppercase transition-colors mt-2"
            data-testid="button-enter-trading-floor"
          >
            ENTER TRADING FLOOR
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
