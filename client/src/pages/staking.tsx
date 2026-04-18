import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Link } from "wouter";
import { Lock, Loader2, Timer, Crown, ChevronRight, Zap, TrendingUp, Globe } from "lucide-react";

interface StakePosition {
  id: number;
  principal: number;
  yieldPct: number;
  expectedYield: number;
  termDays: number;
  depositDate: string;
  unlockDate: string;
  daysRemaining: number;
  daysElapsed: number;
  progressPct: number;
  accruedYield: number;
  canWithdraw: boolean;
  status: string;
}

function Sovereign1KStakeCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cashTag, setCashTag] = useState("");

  const { data, isLoading } = useQuery<{ positions: StakePosition[] }>({
    queryKey: ["/api/stake/me"],
    enabled: !!user,
    refetchInterval: 5000,
  });

  const enrollMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stake/enroll", { amount: 1000, cashTag });
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "STAKE LOCKED", description: d.message });
      queryClient.invalidateQueries({ queryKey: ["/api/stake/me"] });
    },
    onError: (err: any) => toast({ title: "ENROLLMENT FAILED", description: err.message, variant: "destructive" }),
  });

  const withdrawMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/stake/withdraw/${id}`, {});
      return res.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "WITHDRAWAL APPROVED", description: d.message });
      queryClient.invalidateQueries({ queryKey: ["/api/stake/me"] });
    },
    onError: (err: any) => toast({ title: "WITHDRAWAL DENIED", description: err.message, variant: "destructive" }),
  });

  const positions = data?.positions ?? [];
  const totalPrincipal = positions.filter(p => p.status === "LOCKED").reduce((s, p) => s + p.principal, 0);
  const totalAccrued = positions.filter(p => p.status === "LOCKED").reduce((s, p) => s + p.accruedYield, 0);
  const totalExpected = positions.filter(p => p.status === "LOCKED").reduce((s, p) => s + p.expectedYield, 0);

  return (
    <div className="bg-gradient-to-br from-amber-950/40 via-black to-amber-950/20 border border-amber-500/30 rounded-lg p-5 mb-6" data-testid="card-sovereign-1k-stake">
      <div className="flex items-center gap-3 mb-4">
        <Crown className="h-7 w-7 text-amber-400" />
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">SOVEREIGN 1K STAKE</h2>
          <p className="text-amber-500/70 text-[10px] sm:text-[11px] tracking-widest font-bold">$1,000 PRINCIPAL · 20% YIELD · 180-DAY HOLD · ASSET-BACKED CATALOG</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] text-amber-500/60 tracking-widest">YIELD ON DEPOSIT</p>
          <p className="text-amber-400 font-black text-2xl">+$200</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-black/60 border border-amber-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">LOCKED PRINCIPAL</p>
          <p className="text-amber-400 font-black text-lg" data-testid="text-stake-principal">${totalPrincipal.toFixed(2)}</p>
        </div>
        <div className="bg-black/60 border border-lime-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">ACCRUED YIELD</p>
          <p className="text-lime-400 font-black text-lg" data-testid="text-stake-accrued">${totalAccrued.toFixed(2)}</p>
        </div>
        <div className="bg-black/60 border border-emerald-500/20 rounded p-3 text-center">
          <p className="text-[8px] text-amber-500/60 tracking-widest">EXPECTED PAYOUT</p>
          <p className="text-emerald-400 font-black text-lg" data-testid="text-stake-expected">${(totalPrincipal + totalExpected).toFixed(2)}</p>
        </div>
      </div>

      {user && (
        <div className="bg-black/40 border border-amber-500/15 rounded p-3 mb-4">
          <p className="text-[10px] text-amber-500/60 tracking-widest mb-2">ENROLL NEW STAKE — $1,000.00 EXACT</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={cashTag}
              onChange={(e) => setCashTag(e.target.value)}
              placeholder="$YourCashTag"
              className="flex-1 bg-black border border-amber-500/30 rounded px-3 py-2 text-amber-400 font-mono text-sm focus:outline-none focus:border-amber-400"
              data-testid="input-stake-cashtag"
            />
            <button
              onClick={() => enrollMut.mutate()}
              disabled={enrollMut.isPending}
              className="bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900 text-black font-black px-5 py-2 rounded text-sm tracking-wider transition-colors"
              data-testid="button-stake-enroll"
            >
              {enrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "LOCK $1,000"}
            </button>
          </div>
          <p className="text-[9px] text-amber-500/40 mt-2">
            Send $1,000 via Cash App to <span className="text-amber-400 font-bold">$AITITRADEBROKERAGE</span> after enrollment. Capital is locked 180 days; receive <span className="text-lime-400 font-bold">$1,200</span> at unlock.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin text-amber-500 inline" /></div>
      ) : positions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] text-amber-500/60 tracking-widest">YOUR STAKE POSITIONS</p>
          {positions.map(p => (
            <div key={p.id} className="bg-black/60 border border-amber-500/15 rounded p-3" data-testid={`row-stake-${p.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Lock className={`h-4 w-4 ${p.canWithdraw ? "text-lime-400" : "text-amber-500"}`} />
                  <div>
                    <p className="text-amber-400 font-bold text-sm">${p.principal.toFixed(2)} → ${(p.principal + p.expectedYield).toFixed(2)}</p>
                    <p className="text-[9px] text-amber-500/50">
                      Unlocks {new Date(p.unlockDate).toLocaleDateString()} · {p.yieldPct}% yield · <span className={p.status === "LOCKED" ? "text-amber-400" : "text-lime-400"}>{p.status}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px]">
                    <Timer className={`h-3 w-3 ${p.canWithdraw ? "text-lime-400" : "text-amber-500"}`} />
                    <span className={`font-mono font-bold ${p.canWithdraw ? "text-lime-400" : "text-amber-400"}`} data-testid={`text-stake-days-${p.id}`}>
                      {p.canWithdraw ? "UNLOCKED" : `${p.daysRemaining}d`}
                    </span>
                  </div>
                  <button
                    onClick={() => withdrawMut.mutate(p.id)}
                    disabled={!p.canWithdraw || withdrawMut.isPending || p.status !== "LOCKED"}
                    className="bg-lime-500 hover:bg-lime-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black px-3 py-1.5 rounded text-xs tracking-wider transition-colors"
                    data-testid={`button-stake-withdraw-${p.id}`}
                  >
                    WITHDRAW
                  </button>
                </div>
              </div>
              <div className="relative w-full bg-amber-950/50 h-2 rounded-full overflow-hidden border border-amber-500/15">
                <div
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${p.progressPct}%`,
                    background: `linear-gradient(90deg, #b45309 0%, #f59e0b 50%, #fde047 100%)`,
                    boxShadow: "0 0 6px rgba(245,158,11,0.5)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-amber-500/50 font-mono">DAY {p.daysElapsed} / {p.termDays}</span>
                <span className="text-[8px] text-lime-400 font-mono">+${p.accruedYield.toFixed(2)} ACCRUED ({p.progressPct.toFixed(1)}%)</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function StakingPage() {
  return (
    <div className="min-h-full bg-black pb-36 font-mono">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-black to-emerald-950/20" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Lock className="h-6 w-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">STAKING PORTALS</h1>
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ boxShadow: "0 0 8px #fbbf24" }} />
          </div>
          <p className="text-amber-500/60 text-sm max-w-xl">
            Lock capital. Earn yield. Asset-backed by the AITITRADE 200+ AI Song Catalog.
          </p>

          <div className="flex items-center gap-3 mt-4">
            <Link href="/" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 px-2.5 py-1.5 rounded hover:bg-emerald-500/10 transition-colors" data-testid="link-back-floor">
              <Zap className="h-3 w-3" /> TRADE FLOOR <ChevronRight className="h-2.5 w-2.5" />
            </Link>
            <Link href="/investor-portals" className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 border border-emerald-500/30 px-2.5 py-1.5 rounded hover:bg-emerald-500/10 transition-colors" data-testid="link-investor-portals">
              <Globe className="h-3 w-3" /> INVESTOR PORTALS <ChevronRight className="h-2.5 w-2.5" />
            </Link>
            <Link href="/music-market" className="text-[10px] text-lime-400 hover:text-lime-300 flex items-center gap-1 border border-lime-500/30 px-2.5 py-1.5 rounded hover:bg-lime-500/10 transition-colors" data-testid="link-music-market">
              <TrendingUp className="h-3 w-3" /> MUSIC MARKET <ChevronRight className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Sovereign1KStakeCard />

        <div className="bg-black/60 border border-emerald-500/15 rounded-lg p-4 text-center">
          <p className="text-emerald-500/70 text-[10px] tracking-widest mb-1">MORE STAKING TIERS</p>
          <p className="text-white text-sm">
            Looking for the <span className="text-amber-400 font-bold">Investor Portals</span> ($500 entry, 25% base, 24-month term) or the <span className="text-amber-400 font-bold">TSB Banker</span> ($1K lease, $40 strike per block, 180-day hold)?
          </p>
          <Link href="/investor-portals" className="inline-block mt-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black px-4 py-2 rounded text-xs tracking-wider transition-colors" data-testid="link-investor-portals-cta">
            VIEW INVESTOR PORTALS & TSB
          </Link>
        </div>
      </div>
    </div>
  );
}
