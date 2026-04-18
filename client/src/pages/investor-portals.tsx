import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";
import {
  Globe, TrendingUp, Users, DollarSign, Music, ExternalLink, Lock,
  ChevronRight, Loader2, CheckCircle, Zap, BarChart3, ArrowUpRight,
  Crown, Disc, Landmark, Timer
} from "lucide-react";

interface BankerData {
  position: number | null;
  totalStrikes: number;
  totalEarned: number;
  deposits: Array<{
    id: number;
    amount: number;
    depositDate: string;
    unlockDate: string;
    daysRemaining: number;
    canWithdraw: boolean;
    status: string;
  }>;
  ledger: Array<{ blockId: number | null; amount: number; createdAt: string | null; description: string | null }>;
}

function TsbBankerSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("1000");
  const [cashTag, setCashTag] = useState("");

  const { data: banker, isLoading } = useQuery<BankerData>({
    queryKey: ["/api/banker/me"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const enrollMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/banker/enroll", { amount: parseFloat(amount), cashTag });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "TSB ENROLLED", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/banker/me"] });
    },
    onError: (err: any) => toast({ title: "ENROLLMENT FAILED", description: err.message, variant: "destructive" }),
  });

  const withdrawMut = useMutation({
    mutationFn: async (depositId: number) => {
      const res = await apiRequest("POST", `/api/banker/withdraw/${depositId}`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "WITHDRAWAL APPROVED", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/banker/me"] });
    },
    onError: (err: any) => toast({ title: "WITHDRAWAL DENIED", description: err.message, variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <div className="mb-8 bg-gradient-to-br from-amber-950/40 via-black to-amber-950/20 border border-amber-500/30 rounded-lg p-5" data-testid="section-tsb-banker">
      <div className="flex items-center gap-3 mb-4">
        <Landmark className="h-6 w-6 text-amber-400" />
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">TSB — TRADE SETTLEMENT BANKER</h2>
          <p className="text-amber-500/70 text-[10px] tracking-widest">$40 STRIKE PER 1K BLOCK · 180-DAY SOVEREIGN HOLD · ASSET-BACKED BY 200+ AI CATALOG</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-black/60 border border-amber-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">QUEUE POSITION</p>
          <p className="text-amber-400 font-black text-xl" data-testid="text-banker-position">{banker?.position ?? "—"}</p>
        </div>
        <div className="bg-black/60 border border-lime-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">TOTAL STRIKES</p>
          <p className="text-lime-400 font-black text-xl" data-testid="text-banker-strikes">{banker?.totalStrikes ?? 0}</p>
        </div>
        <div className="bg-black/60 border border-emerald-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">RENT EARNED</p>
          <p className="text-emerald-400 font-black text-xl" data-testid="text-banker-earned">${(banker?.totalEarned ?? 0).toFixed(2)}</p>
        </div>
        <div className="bg-black/60 border border-cyan-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">ACTIVE DEPOSITS</p>
          <p className="text-cyan-400 font-black text-xl" data-testid="text-banker-deposits-count">
            {banker?.deposits.filter(d => d.status === "LOCKED").length ?? 0}
          </p>
        </div>
      </div>

      <div className="bg-black/40 border border-amber-500/15 rounded p-3 mb-4">
        <p className="text-[10px] text-amber-500/60 tracking-widest mb-2">ENROLL — LEASE CAPITAL TO THE FLOOR</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="number"
            min="1000"
            step="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$1,000 minimum"
            className="flex-1 bg-black border border-amber-500/30 rounded px-3 py-2 text-amber-400 font-mono text-sm focus:outline-none focus:border-amber-400"
            data-testid="input-banker-amount"
          />
          <input
            type="text"
            value={cashTag}
            onChange={(e) => setCashTag(e.target.value)}
            placeholder="$YourCashTag"
            className="flex-1 bg-black border border-amber-500/30 rounded px-3 py-2 text-amber-400 font-mono text-sm focus:outline-none focus:border-amber-400"
            data-testid="input-banker-cashtag"
          />
          <button
            onClick={() => enrollMut.mutate()}
            disabled={enrollMut.isPending || !amount || parseFloat(amount) < 1000}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900 disabled:text-amber-700 text-black font-black px-4 py-2 rounded text-sm tracking-wider transition-colors"
            data-testid="button-banker-enroll"
          >
            {enrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ENROLL"}
          </button>
        </div>
        <p className="text-[9px] text-amber-500/40 mt-2">
          Send via Cash App to <span className="text-amber-400 font-bold">$AITITRADEBROKERAGE</span> after enrollment. Capital is locked 180 days; rent strikes are credited live as blocks settle.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-amber-500 inline" /></div>
      ) : banker && banker.deposits.length > 0 ? (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] text-amber-500/60 tracking-widest">YOUR DEPOSITS</p>
          {banker.deposits.map(d => (
            <div key={d.id} className="bg-black/60 border border-amber-500/15 rounded p-3 flex items-center justify-between" data-testid={`row-deposit-${d.id}`}>
              <div className="flex items-center gap-3">
                <Lock className={`h-4 w-4 ${d.canWithdraw ? "text-lime-400" : "text-amber-500"}`} />
                <div>
                  <p className="text-amber-400 font-bold text-sm">${d.amount.toFixed(2)}</p>
                  <p className="text-[9px] text-amber-500/50">
                    Unlocks {new Date(d.unlockDate).toLocaleDateString()} · Status: <span className={d.status === "LOCKED" ? "text-amber-400" : "text-lime-400"}>{d.status}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Timer className={`h-3 w-3 ${d.canWithdraw ? "text-lime-400" : "text-amber-500"}`} />
                    <span className={`font-mono font-bold ${d.canWithdraw ? "text-lime-400" : "text-amber-400"}`} data-testid={`text-days-remaining-${d.id}`}>
                      {d.canWithdraw ? "UNLOCKED" : `${d.daysRemaining}d`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => withdrawMut.mutate(d.id)}
                  disabled={!d.canWithdraw || withdrawMut.isPending || d.status !== "LOCKED"}
                  className="bg-lime-500 hover:bg-lime-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black px-3 py-1.5 rounded text-xs tracking-wider transition-colors"
                  data-testid={`button-withdraw-${d.id}`}
                >
                  WITHDRAW
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {banker && banker.ledger.length > 0 && (
        <div>
          <p className="text-[10px] text-amber-500/60 tracking-widest mb-2">RECENT RENT STRIKES</p>
          <div className="bg-black/60 border border-amber-500/15 rounded max-h-40 overflow-y-auto">
            {banker.ledger.slice(0, 10).map((l, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 border-b border-amber-500/10 last:border-b-0" data-testid={`row-strike-${i}`}>
                <span className="text-[10px] text-amber-500/70 font-mono">{l.description || `Block #${l.blockId}`}</span>
                <span className="text-lime-400 font-bold text-xs">+${l.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
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
    userId: string | null;
    displayName: string;
    status: string;
    downPaymentPaid: boolean;
    listedForResale?: boolean;
    askPrice?: string | null;
  }>;
}

interface ResaleOffer {
  entryId: string;
  portalId: string;
  sellerName: string;
  askPrice: number;
  buyerPays: number;
  sellerNets: number;
  listedAt: string | null;
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

function PortalCard({ portal, onJoin, joining, currentUserId }: { portal: InvestorPortal; onJoin: (id: string) => void; joining: boolean; currentUserId: string | null }) {
  const { toast } = useToast();
  const isFull = portal.status === "FILLED" || portal.spotsRemaining <= 0;
  const fillPct = ((portal.currentInvestors || 0) / (portal.maxInvestors || 10)) * 100;
  const mySeat = portal.investors?.find(i => i.userId && currentUserId && i.userId === currentUserId);
  const portalResales = portal.investors?.filter(i => i.listedForResale && i.userId !== currentUserId) || [];
  const [askInput, setAskInput] = useState(parseFloat(portal.entryPrice).toFixed(2));

  const listMut = useMutation({
    mutationFn: async ({ entryId, askPrice }: { entryId: string; askPrice: string }) => {
      const res = await apiRequest("POST", `/api/investor-portals/entries/${entryId}/list-resale`, { askPrice: parseFloat(askPrice) });
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "SEAT LISTED", description: d.message });
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portals"] });
    },
    onError: (e: any) => toast({ title: "LIST FAILED", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", `/api/investor-portals/entries/${entryId}/cancel-resale`, {});
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "LISTING CANCELLED", description: d.message });
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portals"] });
    },
  });

  const buyMut = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiRequest("POST", `/api/investor-portals/buy-resale/${entryId}`, {});
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "P2P SEAT ACQUIRED", description: d.message });
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trust-vault/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit/p2p"] });
      if (d.cashAppUrl) window.open(d.cashAppUrl, "_blank");
    },
    onError: (e: any) => toast({ title: "P2P BUY FAILED", description: e.message, variant: "destructive" }),
  });

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
          <p className="text-[8px] mt-1 text-right">
            {portal.spotsRemaining > 0 ? (
              <span className="text-emerald-500/40">{portal.spotsRemaining} SPOTS LEFT</span>
            ) : portalResales.length > 0 ? (
              <span className="text-cyan-400 font-black tracking-wider">⚡ {portalResales.length} MARKET OFFER{portalResales.length === 1 ? "" : "S"} LIVE</span>
            ) : (
              <span className="text-amber-400/70 font-black tracking-wider">SECONDARY MARKET ONLY</span>
            )}
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

        {/* P2P RESALE — owner's seat management */}
        {mySeat && (
          <div className="border-2 border-violet-500/40 bg-violet-950/20 rounded p-2.5 space-y-2" data-testid={`my-seat-${portal.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-violet-400 font-black tracking-wider">YOUR SEAT — P2P RESALE</span>
              <span className="text-[7px] text-violet-500/60">2% TWO-WAY FEE → VAULT</span>
            </div>
            {!mySeat.downPaymentPaid ? (
              <p className="text-[9px] text-amber-400/70">Confirm down payment before listing for resale.</p>
            ) : mySeat.listedForResale ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[8px] text-violet-500/60">LISTED AT</p>
                  <p className="text-violet-400 font-black text-sm">${parseFloat(mySeat.askPrice || "0").toFixed(2)}</p>
                </div>
                <button
                  onClick={() => cancelMut.mutate(mySeat.id)}
                  disabled={cancelMut.isPending}
                  className="px-3 py-1.5 text-[9px] font-black bg-violet-950/60 hover:bg-violet-900/60 text-violet-300 border border-violet-500/40 rounded disabled:opacity-50"
                  data-testid={`btn-cancel-resale-${mySeat.id}`}
                >
                  {cancelMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "CANCEL LISTING"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={askInput}
                  onChange={e => setAskInput(e.target.value)}
                  placeholder="ASK $25-$500"
                  min="25"
                  max="500"
                  step="0.01"
                  className="flex-1 bg-black/60 border border-violet-500/30 rounded px-2 py-1.5 text-violet-300 text-[10px] font-mono placeholder:text-violet-500/30 focus:outline-none focus:border-violet-400"
                  data-testid={`input-ask-${mySeat.id}`}
                />
                <button
                  onClick={() => listMut.mutate({ entryId: mySeat.id, askPrice: askInput })}
                  disabled={listMut.isPending || !askInput || parseFloat(askInput) < 25}
                  className="px-3 py-1.5 text-[9px] font-black bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 rounded disabled:opacity-50"
                  data-testid={`btn-list-resale-${mySeat.id}`}
                >
                  {listMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "LIST FOR RESALE"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* P2P RESALE — buy a peer's seat */}
        {portalResales.length > 0 && (
          <div className="border-2 border-cyan-500/40 bg-cyan-950/20 rounded p-2.5 space-y-2" data-testid={`resale-board-${portal.id}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-cyan-400 font-black tracking-wider">P2P RESALE BOARD — BUY FROM OWNERS</span>
              <span className="text-[7px] text-cyan-500/60">+2% FEE</span>
            </div>
            {portalResales.map(offer => {
              const ask = parseFloat(offer.askPrice || "0");
              const fee = parseFloat((ask * 0.02).toFixed(2));
              const buyerPays = parseFloat((ask + fee).toFixed(2));
              return (
                <div key={offer.id} className="border border-cyan-500/20 bg-cyan-950/30 rounded px-2.5 py-2 space-y-1.5" data-testid={`resale-offer-${offer.id}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[8px] text-zinc-400 truncate">FROM {offer.displayName}</p>
                    <button
                      onClick={() => buyMut.mutate(offer.id)}
                      disabled={buyMut.isPending || !currentUserId}
                      className="px-2.5 py-1 text-[9px] font-black bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500 rounded disabled:opacity-50"
                      data-testid={`btn-buy-resale-${offer.id}`}
                    >
                      {buyMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "BUY SEAT"}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[8px] font-mono">
                    <div className="bg-black/40 border border-cyan-500/15 rounded px-1.5 py-1">
                      <p className="text-cyan-500/50">MARKET PRICE</p>
                      <p className="text-cyan-300 font-black text-[10px]">${ask.toFixed(2)}</p>
                    </div>
                    <div className="bg-black/40 border border-amber-500/15 rounded px-1.5 py-1">
                      <p className="text-amber-500/60">SOVEREIGN FEE 2%</p>
                      <p className="text-amber-300 font-black text-[10px]">+${fee.toFixed(2)}</p>
                    </div>
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded px-1.5 py-1">
                      <p className="text-emerald-500/60">TOTAL SETTLE</p>
                      <p className="text-emerald-300 font-black text-[10px]">${buyerPays.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isFull && !mySeat && (
          <>
            <a
              href={`https://cash.app/$AITITRADEBROKERAGE/${parseFloat(portal.downPayment).toFixed(2)}?note=INVESTOR%20PORTAL%20${encodeURIComponent(portal.songTitle)}%20DOWN%20PAYMENT`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded font-black text-xs text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, #00D632, #00C244)", boxShadow: "0 0 12px rgba(0,214,50,0.25)" }}
              data-testid={`btn-cashapp-down-${portal.id}`}
            >
              <DollarSign className="h-3.5 w-3.5" /> PAY ${parseFloat(portal.downPayment).toFixed(0)} DOWN VIA CASH APP
            </a>
            <a
              href={`https://cash.app/$AITITRADEBROKERAGE/${parseFloat(portal.monthlyPayment).toFixed(2)}?note=INVESTOR%20PORTAL%20${encodeURIComponent(portal.songTitle)}%20MONTHLY%20PAYMENT`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 rounded font-bold text-[10px] text-emerald-300 flex items-center justify-center gap-2 border border-emerald-500/30 bg-emerald-950/40 transition-all hover:bg-emerald-950/60"
              data-testid={`btn-cashapp-monthly-${portal.id}`}
            >
              <DollarSign className="h-3 w-3" /> PAY ${parseFloat(portal.monthlyPayment).toFixed(2)}/MO VIA CASH APP
            </a>
          </>
        )}

        {isFull && !mySeat && portalResales.length === 0 && (
          <div className="w-full py-3 rounded border-2 border-amber-500/40 bg-amber-950/20 text-center" data-testid={`portal-locked-${portal.id}`}>
            <p className="text-[10px] text-amber-400 font-black tracking-wider">⛔ SOLD OUT — SECONDARY MARKET ONLY</p>
            <p className="text-[8px] text-amber-500/60 mt-1">Awaiting owner listings. Entry now requires buying a seat from a current owner via P2P resale.</p>
          </div>
        )}

        {mySeat && mySeat.downPaymentPaid && parseFloat(mySeat.totalPaid || "0") < parseFloat(portal.entryPrice) && (
          <a
            href={`https://cash.app/$AITITRADEBROKERAGE/${parseFloat(portal.monthlyPayment).toFixed(2)}?note=INVESTOR%20PORTAL%20${encodeURIComponent(portal.songTitle)}%20MONTHLY%20PAYMENT`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 rounded font-bold text-[10px] text-emerald-300 flex items-center justify-center gap-2 border border-emerald-500/30 bg-emerald-950/40 transition-all hover:bg-emerald-950/60"
            data-testid={`btn-cashapp-monthly-mine-${portal.id}`}
          >
            <DollarSign className="h-3 w-3" /> CONTINUE MONTHLY ${parseFloat(portal.monthlyPayment).toFixed(2)} VIA CASH APP
          </a>
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
        <TsbBankerSection />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {portals?.map((portal) => (
            <PortalCard
              key={portal.id}
              portal={portal}
              onJoin={handleJoin}
              currentUserId={(user as any)?.id || null}
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
