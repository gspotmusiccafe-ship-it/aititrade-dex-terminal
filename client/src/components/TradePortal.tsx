import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, DollarSign, Clock, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export const TRADE_PORTALS = {
  STANDARD:    { tbi: 2.00,  mbb: 3.00, early: 1.50, pool: 1000 },
  MICRO_700:   { tbi: 5.00,  mbb: 3.35, early: 2.00, pool: 700 },
  MID_2K:      { tbi: 10.00, mbb: 3.75, early: 2.85, pool: 2000 },
  PRO_20:      { tbi: 20.00, mbb: 3.75, early: 2.85, pool: 2000 },
  PRO_30:      { tbi: 30.00, mbb: 3.75, early: 2.85, pool: 3000 },
  HIGH_50:     { tbi: 50.00, mbb: 3.75, early: 2.85, pool: 5000 },
};

type PortalName = keyof typeof TRADE_PORTALS;

export function getPortal(amount: number) {
  if (amount >= 50) return { name: "HIGH_50" as PortalName, ...TRADE_PORTALS.HIGH_50 };
  if (amount >= 30) return { name: "PRO_30" as PortalName, ...TRADE_PORTALS.PRO_30 };
  if (amount >= 20) return { name: "PRO_20" as PortalName, ...TRADE_PORTALS.PRO_20 };
  if (amount >= 10) return { name: "MID_2K" as PortalName, ...TRADE_PORTALS.MID_2K };
  if (amount >= 5) return { name: "MICRO_700" as PortalName, ...TRADE_PORTALS.MICRO_700 };
  return { name: "STANDARD" as PortalName, ...TRADE_PORTALS.STANDARD };
}

function calculateEarlyExit(buyIn: number, portal: typeof TRADE_PORTALS[PortalName]) {
  const earlyPayout = parseFloat((buyIn * portal.early).toFixed(2));
  const houseProfit = parseFloat(((buyIn * portal.mbb) - earlyPayout).toFixed(2));
  return { earlyPayout, houseProfit };
}

interface TradePortalProps {
  unitPrice: number;
  grossSales: number;
  ticker: string;
  orderId?: string;
  onAcceptEarly?: () => void;
  onHoldForMbb?: () => void;
}

export function TradePortal({ unitPrice, grossSales, ticker, orderId, onAcceptEarly, onHoldForMbb }: TradePortalProps) {
  const [offerVisible, setOfferVisible] = useState(false);
  const [settling, setSettling] = useState(false);

  const portal = getPortal(unitPrice);
  const { earlyPayout, houseProfit } = calculateEarlyExit(unitPrice, portal);
  const maxPayout = parseFloat((unitPrice * portal.mbb).toFixed(2));
  const poolLabel = portal.pool >= 1000 ? `$${(portal.pool / 1000).toFixed(0)}K` : `$${portal.pool}`;
  const fillPct = Math.min(100, parseFloat(((grossSales / portal.pool) * 100).toFixed(1)));
  const isNearClose = fillPct >= 75;

  useEffect(() => {
    if (!isNearClose) return;
    const timer = setTimeout(() => setOfferVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [isNearClose]);

  const handleAcceptEarly = async () => {
    if (!orderId) {
      onAcceptEarly?.();
      setOfferVisible(false);
      return;
    }
    setSettling(true);
    try {
      await apiRequest("POST", "/api/exchange/early-exit", { orderId });
      onAcceptEarly?.();
      setOfferVisible(false);
    } catch (e) {
      console.error("Early exit failed:", e);
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="bg-black border-l-4 border-lime-500 p-3 mt-3 font-mono" data-testid="trade-portal">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lime-500 text-[11px] font-extrabold underline flex items-center gap-1">
          <Shield className="h-3 w-3" /> TRADE PORTAL — {portal.name.replace(/_/g, " ")}
        </h3>
        <span className="text-[9px] text-zinc-500">{ticker}</span>
      </div>

      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
          <p className="text-[8px] text-zinc-500 font-bold">TBI</p>
          <p className="text-[11px] text-lime-400 font-extrabold" data-testid="portal-tbi">${unitPrice.toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
          <p className="text-[8px] text-zinc-500 font-bold">MBB</p>
          <p className="text-[11px] text-amber-400 font-extrabold" data-testid="portal-mbb">{(portal.mbb * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
          <p className="text-[8px] text-zinc-500 font-bold">EARLY</p>
          <p className="text-[11px] text-cyan-400 font-extrabold" data-testid="portal-early">{(portal.early * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-zinc-900/80 p-1.5 border border-zinc-800">
          <p className="text-[8px] text-zinc-500 font-bold">FLOOR</p>
          <p className="text-[11px] text-white font-extrabold" data-testid="portal-floor">{poolLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-center mb-2">
        <div className="bg-zinc-900/60 p-1 border border-zinc-800">
          <p className="text-[8px] text-zinc-600">MAX PAYOUT</p>
          <p className="text-[10px] text-lime-400 font-bold" data-testid="portal-max-payout">${maxPayout.toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900/60 p-1 border border-zinc-800">
          <p className="text-[8px] text-zinc-600">EARLY EXIT</p>
          <p className="text-[10px] text-cyan-400 font-bold" data-testid="portal-early-exit">${earlyPayout.toFixed(2)}</p>
        </div>
        <div className="bg-zinc-900/60 p-1 border border-zinc-800">
          <p className="text-[8px] text-zinc-600">HOUSE TAKE</p>
          <p className="text-[10px] text-red-400 font-bold" data-testid="portal-house-take">${houseProfit.toFixed(2)}</p>
        </div>
      </div>

      {offerVisible && (
        <div className="mt-2 animate-pulse bg-zinc-900 p-3 border border-yellow-500/30" data-testid="early-offer-panel">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 text-yellow-400" />
            <p className="text-yellow-400 font-bold text-[11px]">EARLY CLOSING OFFER DETECTED</p>
          </div>
          <p className="text-[10px] text-zinc-400 mb-2">
            The floor is moving. Take <span className="text-lime-400 font-bold">${earlyPayout.toFixed(2)}</span> now?
          </p>
          <div className="flex gap-2">
            <button
              className="bg-lime-600 hover:bg-lime-500 text-black px-3 py-1 text-[10px] font-bold transition-colors disabled:opacity-50"
              onClick={handleAcceptEarly}
              disabled={settling}
              data-testid="btn-accept-early"
            >
              <DollarSign className="h-3 w-3 inline mr-0.5" />ACCEPT & PAY FIRST
            </button>
            <button
              className="border border-zinc-500 text-zinc-400 px-3 py-1 text-[10px] font-bold hover:bg-zinc-800 transition-colors"
              onClick={() => { onHoldForMbb?.(); setOfferVisible(false); }}
              data-testid="btn-hold-mbb"
            >
              <Clock className="h-3 w-3 inline mr-0.5" />HOLD FOR BETTER OFFER
            </button>
          </div>
          <p className="text-[8px] mt-2 text-zinc-500 italic flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" />
            Accepting leaves {((portal.mbb - portal.early) * 100).toFixed(0)}% to the house treasury.
          </p>
        </div>
      )}
    </div>
  );
}

export function LivingTicker({ unitPrice, currentFloor }: { unitPrice: number; currentFloor: number }) {
  const portal = getPortal(unitPrice);
  const poolLabel = portal.pool >= 1000 ? `$${(portal.pool / 1000).toFixed(0)}K` : `$${portal.pool}`;
  const status = currentFloor >= portal.pool ? "SETTLING..." : "HOLDING FOR OFFER";

  return (
    <div className="bg-black text-lime-400 p-2 font-mono text-[10px] border-b border-lime-900 flex items-center gap-4" data-testid="living-ticker">
      <span>FLOOR ACCUMULATION: ${currentFloor.toFixed(2)} / {poolLabel}</span>
      <span className={`${currentFloor >= portal.pool ? "text-red-400" : "text-yellow-500"}`}>
        STATUS: {status}
      </span>
      <span className="animate-pulse text-lime-500">●</span>
      <span className="text-zinc-600 ml-auto">{portal.name.replace(/_/g, " ")}</span>
    </div>
  );
}

interface TreasuryStats {
  formattedBalance: string;
  activeFloorVolume: string;
  efficiency: string;
}

export function TreasuryMonitor({ stats }: { stats: TreasuryStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-zinc-950" data-testid="treasury-monitor">
      <div className="border border-lime-900 p-4 bg-black">
        <h3 className="text-zinc-500 text-xs uppercase tracking-widest">House Treasury</h3>
        <p className="text-3xl font-mono text-lime-400 mt-2" data-testid="treasury-balance">{stats.formattedBalance}</p>
        <p className="text-[10px] text-zinc-600 mt-1">Accumulated from Early Exit Splits</p>
      </div>
      <div className="border border-zinc-800 p-4 bg-black">
        <h3 className="text-zinc-500 text-xs uppercase tracking-widest">Active Floor Volume</h3>
        <p className="text-3xl font-mono text-white mt-2" data-testid="treasury-volume">{stats.activeFloorVolume}</p>
      </div>
      <div className="border border-zinc-800 p-4 bg-black">
        <h3 className="text-zinc-500 text-xs uppercase tracking-widest">System Efficiency</h3>
        <p className="text-3xl font-mono text-yellow-500 mt-2" data-testid="treasury-efficiency">{stats.efficiency}</p>
      </div>
    </div>
  );
}

export function PortalBadge({ unitPrice }: { unitPrice: number }) {
  const portal = getPortal(unitPrice);
  const poolLabel = portal.pool >= 1000 ? `$${(portal.pool / 1000).toFixed(0)}K` : `$${portal.pool}`;

  const colorMap: Record<string, string> = {
    MICRO_700: "text-lime-400 border-lime-500/30",
    STANDARD: "text-emerald-400 border-emerald-500/30",
    MID_2K: "text-cyan-400 border-cyan-500/30",
    PRO_20: "text-blue-400 border-blue-500/30",
    PRO_30: "text-violet-400 border-violet-500/30",
    HIGH_50: "text-amber-400 border-amber-500/30",
  };
  const cls = colorMap[portal.name] || "text-zinc-400 border-zinc-500/30";

  return (
    <span className={`text-[8px] font-extrabold border px-1.5 py-0.5 ${cls}`} data-testid="portal-badge">
      {portal.name.replace(/_/g, " ")} · {poolLabel}
    </span>
  );
}
