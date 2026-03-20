import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="bg-black border border-lime-500 text-white font-mono max-w-lg" data-testid="trust-tutorial-dialog">
        <DialogHeader>
          <DialogTitle className="text-lime-400 uppercase tracking-tighter underline">
            Sovereign Portal Instructions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <section>
            <h4 className="text-white font-bold underline">1. MINIMUM ENTRY</h4>
            <p className="text-zinc-400">All legacy $0.99 trades are retired. Minimum Buy-In (TBI) is now $2.00.</p>
          </section>

          <section>
            <h4 className="text-white font-bold underline">2. PORTAL SETTLEMENT</h4>
            <p className="text-zinc-400">Trades move through pools ($700 - $5,000). Larger TBI trades settle in larger pools.</p>
          </section>

          <section>
            <h4 className="text-white font-bold underline">3. THE EARLY EXIT (PAID FIRST)</h4>
            <p className="text-zinc-400">You may accept a "System Offer" (150%-285%) to get paid immediately. The house retains the remaining balance to fund global liquidity.</p>
          </section>

          <button
            onClick={closeTutorial}
            className="w-full bg-lime-600 text-black font-bold py-2 hover:bg-lime-400 mt-4 uppercase"
            data-testid="button-enter-trading-floor"
          >
            Enter Trading Floor
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
