import { useState } from "react";
import { Crown, Check, Zap, Shield, DollarSign, LogOut, ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

const CASH_APP_URL = "https://cash.app/$AITITRADEBROKERAGE";

const features = [
  "Full Sovereign Exchange access",
  "Trade ALL asset classes (native + global)",
  "2-Week Early Pre-release trading edge",
  "54/46 Floor Split on every position",
  "Dynamic buy-in pricing ($3-$25 by rank)",
  "Buy-back ROI: 80-133% per position",
  "Trust Certificate on all positions",
  "AI Lyrics Generator & Audio Mastering",
  "Distribution to Spotify, Amazon, YouTube",
  "97.7 THE FLAME + Global Radio access",
  "CEO CLASS — 12-Step Business Credit Program",
  "Leaderboard, analytics & sovereign badges",
  "Priority settlement queue",
  "Autopilot Radio DJ Console",
];

const terms = [
  { label: "Activation Fee", value: "$25 DOWN" },
  { label: "Monthly Commitment", value: "$19.79/MO" },
  { label: "Term", value: "24 MONTHS" },
  { label: "Interest", value: "0% APR" },
  { label: "Total Note", value: "$500 PROMISSORY" },
  { label: "Payment Method", value: "CASH APP ONLY" },
];

export default function MembershipPage() {
  const { isAuthenticated, logout } = useAuth();

  const { data: trustStatus } = useQuery<{ isMember: boolean; trustId?: number }>({
    queryKey: ["/api/trust/status"],
    enabled: isAuthenticated,
  });

  const isMember = !!trustStatus?.isMember;

  return (
    <div className="min-h-full pb-28 bg-black">
      {isAuthenticated && (
        <div className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-black/90 backdrop-blur border-b border-zinc-800">
          <span className="text-lime-400 font-mono font-extrabold text-sm tracking-widest">AITITRADE</span>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 text-sm font-mono font-extrabold transition-colors"
            data-testid="button-membership-logout"
          >
            <LogOut className="h-4 w-4" />
            LOG OUT
          </button>
        </div>
      )}

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-lime-500/5 via-transparent to-transparent" />
        <div className="relative px-6 py-12 text-center">
          <Badge variant="secondary" className="mb-4 bg-lime-500/10 text-lime-400 border-lime-500/20 font-mono">
            <Shield className="h-3 w-3 mr-1" />
            WELCOME TO AITITRADE — THE WORLD'S FIRST ALL AI-GENERATED DIGITAL AUDIO EXCHANGE
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4 text-white font-mono" data-testid="text-membership-title">
            ACTIVATE YOUR POSITION
          </h1>
          <p className="text-zinc-400 max-w-xl mx-auto text-sm font-mono">
            One account. Full exchange access. $25 down payment activates your sovereign trading position.
            $19.79/mo for 24 months via Cash App.
          </p>
          {isMember && (
            <div className="mt-4">
              <Badge className="text-sm px-4 py-1.5 bg-lime-500/20 text-lime-400 border border-lime-500/30 font-mono font-extrabold" data-testid="badge-current-tier">
                TRADING ACCOUNT ACTIVE
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="border border-lime-500/30 bg-black relative overflow-hidden">
          <div className="bg-lime-500/10 border-b border-lime-500/20 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-lime-400" />
              <span className="text-lime-400 font-mono font-extrabold text-sm tracking-wider">SOVEREIGN TRADER</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-lime-400 font-mono">$25</span>
              <span className="text-zinc-500 font-mono text-xs ml-1">DOWN</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {terms.map((term) => (
                <div key={term.label} className="border border-zinc-800 bg-zinc-900/50 p-3 text-center">
                  <p className="text-zinc-500 text-[10px] font-mono font-bold mb-1">{term.label}</p>
                  <p className="text-lime-400 text-xs font-mono font-extrabold">{term.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-zinc-500 text-[10px] font-mono font-bold tracking-wider mb-3">FULL ACCESS INCLUDES:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-lime-400" />
                    <span className="text-zinc-300 font-mono text-xs">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-6">
              {isMember ? (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-lime-400 font-mono font-extrabold text-sm">
                    <Shield className="h-4 w-4" />
                    YOUR TRADING ACCOUNT IS ACTIVE
                  </div>
                  <p className="text-zinc-500 text-[10px] font-mono">
                    Continue monthly payments via Cash App to maintain your position
                  </p>
                  <a
                    href={CASH_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-lime-400/60 hover:text-lime-400 text-xs font-mono transition-colors"
                    data-testid="link-cashapp-monthly"
                  >
                    <DollarSign className="h-3 w-3" />
                    SEND $19.79 MONTHLY PAYMENT
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="space-y-4">
                  <a
                    href={CASH_APP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                    data-testid="button-activate-cashapp"
                  >
                    <Button className="w-full bg-lime-600 hover:bg-lime-700 text-black border-0 font-extrabold shadow-lg shadow-lime-500/20 font-mono text-sm py-6">
                      <DollarSign className="h-4 w-4 mr-2" />
                      ACTIVATE — $25 DOWN VIA CASH APP
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </a>
                  <p className="text-center text-zinc-600 text-[10px] font-mono">
                    SEND $25 TO $AITITRADEBROKERAGE ON CASH APP — YOUR ACCOUNT WILL BE ACTIVATED WITHIN 24 HOURS
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/50 border-t border-zinc-800 px-6 py-4">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
              <span>54/46 FLOOR SPLIT ON ALL TRADES</span>
              <span>$1K SETTLEMENT CYCLE</span>
              <span>FIFO QUEUE</span>
            </div>
          </div>
        </div>

        {isAuthenticated && !isMember && (
          <div className="text-center mt-6 p-6 border border-emerald-800/50 bg-emerald-900/10">
            <UserPlus className="h-6 w-6 text-emerald-400/60 mx-auto mb-3" />
            <p className="text-emerald-400 text-xs font-mono font-bold mb-3 uppercase">
              Want to explore first?
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/create-trader", { method: "POST" });
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["/api/trust/status"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                    window.location.href = "/";
                  }
                } catch {}
              }}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-mono font-extrabold py-3 px-8 text-sm transition-colors"
              data-testid="button-create-trader"
            >
              <UserPlus className="h-4 w-4 inline mr-2" />
              CREATE TRADER — FREE TRIAL
            </button>
            <p className="text-zinc-600 text-[9px] font-mono mt-2">
              Trial access to the trading floor. Upgrade anytime via Cash App.
            </p>
          </div>
        )}

        <div className="text-center mt-8 p-6 border border-zinc-800 bg-zinc-900/30">
          <Zap className="h-6 w-6 text-lime-400/40 mx-auto mb-3" />
          <p className="text-zinc-400 text-xs font-mono mb-1">
            ALL PAYMENTS PROCESSED VIA CASH APP
          </p>
          <p className="text-zinc-600 text-[10px] font-mono">
            $AITITRADEBROKERAGE — SOVEREIGN DIGITAL ASSET EXCHANGE
          </p>
        </div>
      </div>
    </div>
  );
}
