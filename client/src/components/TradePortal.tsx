import { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, DollarSign, Clock, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export interface PortalConfig {
  name: string;
  tbi: number;
  mbb: number;
  early: number;
  pool: number;
}

const FALLBACK_PORTALS: PortalConfig[] = [
  { name: "STANDARD",  tbi: 2.00,  mbb: 3.00, early: 1.50, pool: 1000 },
  { name: "MICRO_700", tbi: 5.00,  mbb: 3.35, early: 2.00, pool: 700 },
  { name: "MID_2K",    tbi: 10.00, mbb: 3.75, early: 2.85, pool: 2000 },
  { name: "PRO_20",    tbi: 20.00, mbb: 3.75, early: 2.85, pool: 2000 },
  { name: "PRO_30",    tbi: 30.00, mbb: 3.75, early: 2.85, pool: 3000 },
  { name: "HIGH_50",   tbi: 50.00, mbb: 3.75, early: 2.85, pool: 5000 },
];

let cachedPortals: PortalConfig[] = FALLBACK_PORTALS;

export function setPortalCache(portals: PortalConfig[]) {
  if (portals.length > 0) cachedPortals = portals;
}

export function getPortal(amount: number): PortalConfig {
  const sorted = [...cachedPortals].sort((a, b) => b.tbi - a.tbi);
  for (const portal of sorted) {
    if (amount >= portal.tbi) return portal;
  }
  return sorted[sorted.length - 1] || FALLBACK_PORTALS[0];
}

export function usePortalConfigs() {
  const query = useQuery<PortalConfig[]>({
    queryKey: ["/api/exchange/portals"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      setPortalCache(query.data);
    }
  }, [query.data]);

  return query;
}

interface TradePortalProps {
  unitPrice: number;
  grossSales: number;
  ticker: string;
  orderId?: string;
  onAcceptDiscount?: () => void;
  onHoldForMbbp?: () => void;
}

export function TradePortal({ unitPrice, grossSales, ticker, orderId, onAcceptDiscount, onHoldForMbbp }: TradePortalProps) {
  const [offerVisible, setOfferVisible] = useState(false);
  const [settling, setSettling] = useState(false);

  const portal = getPortal(unitPrice);
  const poolLabel = portal.pool >= 1000 ? `$${(portal.pool / 1000).toFixed(0)}K` : `$${portal.pool}`;
  const fillPct = Math.min(100, parseFloat(((grossSales / portal.pool) * 100).toFixed(1)));
  const isNearClose = fillPct >= 75;

  useEffect(() => {
    if (!isNearClose) return;
    const timer = setTimeout(() => setOfferVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [isNearClose]);

  const handleAcceptDiscount = async () => {
    if (!orderId) {
      onAcceptDiscount?.();
      setOfferVisible(false);
      return;
    }
    setSettling(true);
    try {
      await apiRequest("POST", "/api/engine/discount-exit", { orderId });
      onAcceptDiscount?.();
      setOfferVisible(false);
    } catch (e) {
      console.error("Discount exit failed:", e);
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
        <span className="text-[9px] text-emerald-500/60">{ticker}</span>
      </div>

      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        <div className="bg-emerald-950/60 p-1.5 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/60 font-bold">ENTRY</p>
          <p className="text-[11px] text-lime-400 font-extrabold" data-testid="portal-tbi">${unitPrice.toFixed(2)}</p>
        </div>
        <div className="bg-emerald-950/60 p-1.5 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/60 font-bold">PRICE</p>
          <p className="text-[11px] text-amber-400 font-extrabold" data-testid="portal-price">$0.01–$1.00</p>
        </div>
        <div className="bg-emerald-950/60 p-1.5 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/60 font-bold">MBBP</p>
          <p className="text-[11px] text-cyan-400 font-extrabold" data-testid="portal-mbbp">CLOSE+$1</p>
        </div>
        <div className="bg-emerald-950/60 p-1.5 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/60 font-bold">FLOOR</p>
          <p className="text-[11px] text-white font-extrabold" data-testid="portal-floor">{poolLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 text-center mb-2">
        <div className="bg-emerald-950/50 p-1 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/40">CLOSE AT</p>
          <p className="text-[10px] text-lime-400 font-bold" data-testid="portal-close-at">1K VOL</p>
        </div>
        <div className="bg-emerald-950/50 p-1 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/40">SETTLEMENT</p>
          <p className="text-[10px] text-cyan-400 font-bold" data-testid="portal-settlement">FIFO QUEUE</p>
        </div>
        <div className="bg-emerald-950/50 p-1 border border-emerald-500/15">
          <p className="text-[8px] text-emerald-500/40">DISCOUNT</p>
          <p className="text-[10px] text-yellow-400 font-bold" data-testid="portal-discount">SETTLES FIRST</p>
        </div>
      </div>

      {offerVisible && (
        <div className="mt-2 animate-pulse bg-emerald-950 p-3 border border-yellow-500/30" data-testid="discount-offer-panel">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3 text-yellow-400" />
            <p className="text-yellow-400 font-bold text-[11px]">DISCOUNT EXIT AVAILABLE</p>
          </div>
          <p className="text-[10px] text-emerald-400/70 mb-2">
            Take a <span className="text-yellow-400 font-bold">discount exit</span> now and settle first in queue?
          </p>
          <div className="flex gap-2">
            <button
              className="bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1 text-[10px] font-bold transition-colors disabled:opacity-50"
              onClick={handleAcceptDiscount}
              disabled={settling}
              data-testid="btn-accept-discount"
            >
              <DollarSign className="h-3 w-3 inline mr-0.5" />ACCEPT DISCOUNT
            </button>
            <button
              className="border border-emerald-500/30 text-emerald-400/70 px-3 py-1 text-[10px] font-bold hover:bg-emerald-500/10 transition-colors"
              onClick={() => { onHoldForMbbp?.(); setOfferVisible(false); }}
              data-testid="btn-hold-mbbp"
            >
              <Clock className="h-3 w-3 inline mr-0.5" />HOLD FOR MBBP
            </button>
          </div>
          <p className="text-[8px] mt-2 text-emerald-500/60 italic flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" />
            Discounters settle first in the FIFO queue. MBBP holders wait for market close.
          </p>
        </div>
      )}
    </div>
  );
}

export function LivingTicker({ unitPrice, currentFloor }: { unitPrice: number; currentFloor: number }) {
  const portal = getPortal(unitPrice);
  const poolLabel = portal.pool >= 1000 ? `$${(portal.pool / 1000).toFixed(0)}K` : `$${portal.pool}`;
  const status = currentFloor >= portal.pool ? "SETTLING..." : "MARKET OPEN";

  return (
    <div className="bg-black text-lime-400 p-2 font-mono text-[10px] border-b border-lime-900 flex items-center gap-4" data-testid="living-ticker">
      <span>FLOOR: ${currentFloor.toFixed(2)} / {poolLabel}</span>
      <span className={`${currentFloor >= portal.pool ? "text-red-400" : "text-yellow-500"}`}>
        {status}
      </span>
      <span className="animate-pulse text-lime-500">●</span>
      <span className="text-emerald-500/40 ml-auto">{portal.name.replace(/_/g, " ")} | $0.01–$1.00 | MBBP=CLOSE+$1</span>
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
        <h3 className="text-emerald-500/60 text-xs uppercase tracking-widest">House Treasury</h3>
        <p className="text-3xl font-mono text-lime-400 mt-2" data-testid="treasury-balance">{stats.formattedBalance}</p>
        <p className="text-[10px] text-emerald-500/40 mt-1">House pool from all cycles</p>
      </div>
      <div className="border border-emerald-500/15 p-4 bg-black">
        <h3 className="text-emerald-500/60 text-xs uppercase tracking-widest">Active Floor Volume</h3>
        <p className="text-3xl font-mono text-white mt-2" data-testid="treasury-volume">{stats.activeFloorVolume}</p>
      </div>
      <div className="border border-emerald-500/15 p-4 bg-black">
        <h3 className="text-emerald-500/60 text-xs uppercase tracking-widest">System Efficiency</h3>
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
  const cls = colorMap[portal.name] || "text-emerald-400/70 border-emerald-500/30/30";

  return (
    <span className={`text-[8px] font-extrabold border px-1.5 py-0.5 ${cls}`} data-testid="portal-badge">
      {portal.name.replace(/_/g, " ")} · {poolLabel}
    </span>
  );
}
