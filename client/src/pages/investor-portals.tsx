import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";
import {
  Globe, TrendingUp, Users, DollarSign, Music, ExternalLink, Lock,
  ChevronRight, Loader2, CheckCircle, Zap, BarChart3, ArrowUpRight,
  Crown, Disc
} from "lucide-react";
import { SiSpotify } from "react-icons/si";

interface InvestorPortal {
  id: string;
  portalName: string;
  songTitle: string;
  spotifyUrl: string | null;
  spotifyUri: string | null;
  targetRaise: string;
  entryPrice: string;
  downPayment: string;
  monthlyPayment: string;
  termMonths: number;
  maxInvestors: number;
  currentInvestors: number;
  baseReturnPct: string;
  maxReturnPct: string;
  totalStreams: number;
  status: string;
  spotsRemaining: number;
  totalRaised: number;
  royaltyEarned: number;
  royaltyProgress: number;
  investors: Array<{
    id: string;
    displayName: string;
    status: string;
    downPaymentPaid: boolean;
    totalPaid: string;
    monthsPaid: number;
  }>;
}

function StreamProgress({ streams, royaltyEarned, royaltyProgress }: { streams: number; royaltyEarned: number; royaltyProgress: number }) {
  const pct = Math.min(royaltyProgress, 100);
  const target832 = 832.50;
  const earned = royaltyEarned;

  return (
    <div className="mt-3 p-2.5 bg-black/60 border border-emerald-500/15 rounded">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] text-emerald-500/60 font-bold tracking-widest">STREAM ROYALTY PROGRESS</span>
        <span className="text-[9px] text-emerald-400 font-mono font-bold">{streams.toLocaleString()} STREAMS</span>
      </div>
      <div className="relative w-full bg-emerald-950 h-3 rounded-full overflow-hidden border border-emerald-500/15">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #059669 0%, #10b981 40%, #34d399 70%, #6ee7b7 100%)`,
            boxShadow: "0 0 8px rgba(16,185,129,0.4)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[8px] font-black text-white drop-shadow-md">{pct.toFixed(2)}% TO 1M</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[8px] text-emerald-500/40 font-mono">EARNED: <span className="text-emerald-400">${earned.toFixed(2)}</span></span>
        <span className="text-[8px] text-emerald-500/40 font-mono">TARGET: <span className="text-amber-400">${target832.toFixed(2)}</span> (25% of $3,330)</span>
      </div>
    </div>
  );
}

function PortalCard({ portal, onJoin, joining }: { portal: InvestorPortal; onJoin: (id: string) => void; joining: boolean }) {
  const isFull = portal.status === "FILLED" || portal.spotsRemaining <= 0;
  const fillPct = ((portal.currentInvestors || 0) / (portal.maxInvestors || 10)) * 100;

  return (
    <div
      className="relative border rounded-lg overflow-hidden transition-all hover:scale-[1.01]"
      style={{
        borderColor: isFull ? "#78350f40" : "#065f4660",
        background: "linear-gradient(135deg, #0a0f1a 0%, #0d1117 50%, #0a0a0f 100%)",
        boxShadow: isFull ? "0 0 15px rgba(120,53,15,0.1)" : "0 0 20px rgba(16,185,129,0.08)",
      }}
      data-testid={`investor-portal-${portal.id}`}
    >
      <div className="px-4 py-3 border-b border-emerald-500/15/60 flex items-center justify-between"
        style={{ background: isFull ? "linear-gradient(90deg, #78350f10, transparent)" : "linear-gradient(90deg, #065f4620, transparent)" }}>
        <div className="flex items-center gap-2">
          <Globe className={`h-4 w-4 ${isFull ? "text-amber-500" : "text-emerald-400"}`} />
          <span className={`text-[11px] font-black tracking-wider ${isFull ? "text-amber-400" : "text-emerald-400"}`}>
            {portal.portalName}
          </span>
          {isFull && (
            <span className="text-[7px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black rounded">FILLED</span>
          )}
        </div>
        <span className="text-[9px] text-emerald-500/60 font-mono">${parseFloat(portal.targetRaise).toLocaleString()} FUND</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded bg-gradient-to-br from-emerald-900/40 to-black border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Disc className="h-7 w-7 text-emerald-400/60" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-black text-sm truncate">{portal.songTitle}</h3>
            <p className="text-emerald-500/60 text-[9px] mt-0.5">GLOBAL TRADING ASSET</p>
            {portal.spotifyUrl && (
              <a
                href={portal.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all hover:scale-105"
                style={{ backgroundColor: "#1DB95420", color: "#1DB954", border: "1px solid #1DB95440" }}
                data-testid={`btn-spotify-${portal.id}`}
              >
                <SiSpotify className="h-3 w-3" /> PLAY ON SPOTIFY <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-950/50 border border-emerald-500/15 rounded p-2 text-center">
            <p className="text-[7px] text-emerald-500/40 tracking-widest">ENTRY</p>
            <p className="text-emerald-400 font-black text-sm">${parseFloat(portal.entryPrice).toFixed(0)}</p>
          </div>
          <div className="bg-emerald-950/50 border border-emerald-500/15 rounded p-2 text-center">
            <p className="text-[7px] text-emerald-500/40 tracking-widest">DOWN</p>
            <p className="text-lime-400 font-black text-sm">${parseFloat(portal.downPayment).toFixed(0)}</p>
          </div>
          <div className="bg-emerald-950/50 border border-emerald-500/15 rounded p-2 text-center">
            <p className="text-[7px] text-emerald-500/40 tracking-widest">MONTHLY</p>
            <p className="text-amber-400 font-black text-sm">${parseFloat(portal.monthlyPayment).toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-emerald-950/40 border border-emerald-500/15 rounded p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-emerald-500/60 font-bold tracking-widest">O/I CAPACITY</span>
            <span className="text-[9px] font-mono">
              <span className="text-emerald-400 font-bold">{portal.currentInvestors || 0}</span>
              <span className="text-emerald-500/40"> / {portal.maxInvestors}</span>
            </span>
          </div>
          <div className="relative w-full bg-emerald-500/10 h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${fillPct}%`,
                background: isFull
                  ? "linear-gradient(90deg, #f59e0b, #d97706)"
                  : "linear-gradient(90deg, #10b981, #34d399)",
              }}
            />
          </div>
          <p className="text-[8px] text-emerald-500/40 mt-1 text-right">
            {portal.spotsRemaining > 0 ? `${portal.spotsRemaining} SPOTS LEFT` : "PORTAL FULL"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="border border-emerald-500/20 rounded p-2 bg-emerald-950/10">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[7px] text-emerald-500/60 tracking-widest">BASE RETURN</span>
            </div>
            <p className="text-emerald-400 font-black text-lg mt-0.5">{parseFloat(portal.baseReturnPct)}%</p>
            <p className="text-[7px] text-emerald-500/40">${(parseFloat(portal.entryPrice) * parseFloat(portal.baseReturnPct) / 100).toFixed(2)} ON ${parseFloat(portal.entryPrice).toFixed(0)}</p>
          </div>
          <div className="border border-amber-500/20 rounded p-2 bg-amber-950/10">
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-amber-400" />
              <span className="text-[7px] text-emerald-500/60 tracking-widest">MAX GROWTH</span>
            </div>
            <p className="text-amber-400 font-black text-lg mt-0.5">{parseFloat(portal.maxReturnPct)}%</p>
            <p className="text-[7px] text-emerald-500/40">{portal.termMonths} MONTH TERM</p>
          </div>
        </div>

        <StreamProgress
          streams={portal.totalStreams || 0}
          royaltyEarned={portal.royaltyEarned || 0}
          royaltyProgress={portal.royaltyProgress || 0}
        />

        <div className="text-[8px] text-emerald-500/40 bg-emerald-950/30 border border-emerald-500/15 rounded p-2 font-mono leading-relaxed">
          <span className="text-emerald-500/60 font-bold">TERMS:</span> ${parseFloat(portal.downPayment).toFixed(0)} DOWN + ${parseFloat(portal.monthlyPayment).toFixed(2)}/MO × {portal.termMonths} MO = ${parseFloat(portal.entryPrice).toFixed(0)} | 0% INTEREST | PAID VIA $AITITRADEBROKERAGE
        </div>

        {!isFull && (
          <button
            onClick={() => onJoin(portal.id)}
            disabled={joining}
            className="w-full py-3 rounded font-black text-sm text-white transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              boxShadow: "0 0 15px rgba(16,185,129,0.3)",
            }}
            data-testid={`btn-join-${portal.id}`}
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            BECOME OWNER/INVESTOR — ${parseFloat(portal.downPayment).toFixed(0)} DOWN
          </button>
        )}
      </div>
    </div>
  );
}

export default function InvestorPortalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: portals, isLoading } = useQuery<InvestorPortal[]>({
    queryKey: ["/api/investor-portals"],
    refetchInterval: 15000,
  });

  const joinMut = useMutation({
    mutationFn: async (portalId: string) => {
      const res = await apiRequest("POST", `/api/investor-portals/${portalId}/join`, {
        cashTag: (user as any)?.cashTag || "",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "APPLICATION SUBMITTED", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portals"] });
      setJoiningId(null);
    },
    onError: (err: any) => {
      toast({ title: "FAILED", description: err.message || "Could not join portal", variant: "destructive" });
      setJoiningId(null);
    },
  });

  const handleJoin = (portalId: string) => {
    setJoiningId(portalId);
    joinMut.mutate(portalId);
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-emerald-500/60 font-mono text-xs">LOADING INVESTOR PORTALS...</p>
        </div>
      </div>
    );
  }

  const totalRaised = portals?.reduce((sum, p) => sum + p.totalRaised, 0) || 0;
  const totalInvestors = portals?.reduce((sum, p) => sum + (p.currentInvestors || 0), 0) || 0;
  const totalStreams = portals?.reduce((sum, p) => sum + (p.totalStreams || 0), 0) || 0;
  const openPortals = portals?.filter(p => p.status === "OPEN").length || 0;

  return (
    <div className="min-h-full bg-black pb-36 font-mono">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-black to-cyan-950/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(16,185,129,0.06) 0%, transparent 50%),
                           radial-gradient(circle at 80% 50%, rgba(6,182,212,0.04) 0%, transparent 50%)`,
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">GLOBAL TRADING PORTALS</h1>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 8px #34d399" }} />
          </div>
          <p className="text-emerald-500/60 text-sm max-w-xl">
            Owner/Investor opportunities — $500 entry, 10 O/I per portal, 25% base return with up to 100% growth potential over 24 months.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-black/60 border border-emerald-500/20 rounded-lg p-3 text-center">
              <p className="text-[8px] text-emerald-500/60 tracking-widest">PORTALS OPEN</p>
              <p className="text-emerald-400 font-black text-xl">{openPortals}</p>
            </div>
            <div className="bg-black/60 border border-cyan-500/20 rounded-lg p-3 text-center">
              <p className="text-[8px] text-emerald-500/60 tracking-widest">TOTAL O/I</p>
              <p className="text-cyan-400 font-black text-xl">{totalInvestors}</p>
            </div>
            <div className="bg-black/60 border border-lime-500/20 rounded-lg p-3 text-center">
              <p className="text-[8px] text-emerald-500/60 tracking-widest">TOTAL RAISED</p>
              <p className="text-lime-400 font-black text-xl">${totalRaised.toLocaleString()}</p>
            </div>
            <div className="bg-black/60 border border-amber-500/20 rounded-lg p-3 text-center">
              <p className="text-[8px] text-emerald-500/60 tracking-widest">TOTAL STREAMS</p>
              <p className="text-amber-400 font-black text-xl">{totalStreams.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Link href="/" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 px-2.5 py-1.5 rounded hover:bg-emerald-500/10 transition-colors" data-testid="link-back-floor">
              <Zap className="h-3 w-3" /> TRADE FLOOR <ChevronRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {portals?.map((portal) => (
            <PortalCard
              key={portal.id}
              portal={portal}
              onJoin={handleJoin}
              joining={joiningId === portal.id && joinMut.isPending}
            />
          ))}
        </div>

        <div className="mt-8 bg-emerald-950/30 border border-emerald-500/15 rounded-lg p-4 text-center">
          <p className="text-emerald-500/60 text-[10px] font-mono leading-relaxed">
            ROYALTY CALCULATION: $3,330 PER 1M STREAMS × 25% BASE = $832.50 PER O/I
            <br />
            STREAM PROGRESS × 0.0025% = REAL-TIME YIELD TRACKING
            <br />
            ALL PAYMENTS VIA CASH APP — $AITITRADEBROKERAGE — 0% INTEREST
          </p>
        </div>
      </div>
    </div>
  );
}
