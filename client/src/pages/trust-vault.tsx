import { useQuery } from "@tanstack/react-query";
import { Shield, Globe, Lock, TrendingUp, DollarSign, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { usePlayer } from "@/lib/player-context";

interface TrackWithArtist {
  id: string;
  title: string;
  unitPrice?: string;
  salesCount?: number;
  playCount?: number;
  releaseType?: string;
  artist?: { name: string };
  audioUrl?: string;
  coverImageUrl?: string;
}

interface RoyaltyPool {
  totalGlobalAssets: number;
  totalGlobalSales: number;
  trustVaultRate: string;
  trustVaultAmount: number;
  minterFeeRate: string;
  minterFeeAmount: number;
  platformAmount: number;
  currentTrustValuation: number;
  totalTrustUnits: number;
  perUnitShare: number;
  userShare: number;
  volatility: number;
}

export default function TrustVaultPage() {
  const [, navigate] = useLocation();
  const { playTrack } = usePlayer();

  const { data: vaultTracks, isLoading, error } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/tracks/trust-vault"],
  });

  const { data: royaltyPool } = useQuery<RoyaltyPool>({
    queryKey: ["/api/royalty-pool"],
  });

  if (error && (error as any)?.status === 403) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[80vh] bg-black p-6">
        <Card className="bg-black border-2 border-amber-500/40 max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
              <Lock className="h-8 w-8 text-amber-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-amber-400 font-mono mb-2">TRUST VAULT — LOCKED</h2>
            <p className="text-emerald-400/70 font-mono text-sm mb-6">
              Global Yield Assets and Royalty-Bearing positions are exclusive to Asset Trustees.
              Acquire your Trust Certificate to unlock the vault.
            </p>
            <div className="space-y-3">
              <div className="text-xs text-emerald-500/60 font-mono border border-emerald-500/15 p-3 bg-emerald-950/50">
                <p className="text-amber-400 font-extrabold mb-1">TRUST INVESTOR — ASSET TRUSTEE</p>
                <p>$500 TOTAL / $25 DOWN / 0% INTEREST / $19.79 MO × 24</p>
              </div>
              <button
                onClick={() => navigate("/membership")}
                className="w-full py-4 text-lg font-extrabold font-mono bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                data-testid="button-trust-vault-upgrade"
              >
                ACQUIRE TRUST — $25 DOWN
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tracks = vaultTracks || [];

  return (
    <div className="flex-1 bg-black min-h-screen">
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
              <Shield className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-amber-400 font-mono tracking-wide" data-testid="text-trust-vault-title">TRUST VAULT</h1>
              <p className="text-[10px] text-amber-500/60 font-mono">GLOBAL YIELD ASSETS — ROYALTY-BEARING — TRUSTEE EXCLUSIVE</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="text-emerald-500/60">ASSETS: <span className="text-amber-400 font-extrabold">{tracks.length}</span></span>
          </div>
        </div>
      </div>

      {royaltyPool && (
        <div className="px-4 py-3 border-b border-amber-500/10 bg-black">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">GLOBAL ASSETS</p>
              <p className="text-lg font-extrabold text-amber-400 font-mono">{royaltyPool.totalGlobalAssets}</p>
            </div>
            <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">GROSS SALES</p>
              <p className="text-lg font-extrabold text-amber-400 font-mono">${royaltyPool.totalGlobalSales.toLocaleString()}</p>
            </div>
            <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">VAULT RATE</p>
              <p className="text-lg font-extrabold text-amber-400 font-mono">{royaltyPool.trustVaultRate}</p>
            </div>
            <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">TRUST VAULT</p>
              <p className="text-lg font-extrabold text-lime-400 font-mono">${royaltyPool.trustVaultAmount.toLocaleString()}</p>
            </div>
            <div className="text-center p-2 border border-amber-500/10 bg-amber-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">TRUST UNITS</p>
              <p className="text-lg font-extrabold text-amber-400 font-mono">{royaltyPool.totalTrustUnits}</p>
            </div>
            <div className="text-center p-2 border border-lime-500/20 bg-lime-500/5">
              <p className="text-[9px] text-emerald-500/60 font-mono">YOUR SHARE</p>
              <p className="text-lg font-extrabold text-lime-400 font-mono">${royaltyPool.userShare.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-20 text-amber-400/50 font-mono text-sm">LOADING TRUST VAULT...</div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-20 border border-amber-500/10 bg-amber-500/5">
            <Globe className="h-12 w-12 text-amber-400/30 mx-auto mb-3" />
            <p className="text-amber-400 font-mono font-extrabold text-lg mb-1">NO GLOBAL ASSETS MINTED</p>
            <p className="text-emerald-500/60 font-mono text-xs">Global yield assets will appear here once minted by Asset Architects</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tracks.map((track) => {
              const price = parseFloat(track.unitPrice || "3.50");
              const sales = track.salesCount || 0;
              const grossSales = parseFloat((sales * price).toFixed(2));
              const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);

              return (
                <div
                  key={track.id}
                  className="bg-black border-2 border-amber-500/30 hover:border-amber-400/60 font-mono transition-all"
                  data-testid={`trust-asset-${track.id}`}
                >
                  <div className="border-b border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-extrabold text-sm">${ticker}</span>
                      <span className="text-[8px] px-1 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 font-extrabold flex items-center gap-0.5">
                        <Globe className="h-2.5 w-2.5" /> GLOBAL
                      </span>
                    </div>
                    <span className="text-amber-400 font-extrabold text-sm">${price.toFixed(2)}</span>
                  </div>

                  <div className="p-3">
                    <h3 className="text-white font-bold text-sm mb-1 truncate">{track.title}</h3>
                    <p className="text-emerald-500/60 text-[10px] mb-3">{track.artist?.name || "AITIFY-GEN-1"}</p>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div>
                        <p className="text-[8px] text-emerald-500/40">GROSS</p>
                        <p className="text-xs font-extrabold text-amber-400">${grossSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-emerald-500/40">UNITS</p>
                        <p className="text-xs font-extrabold text-white">{sales}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-emerald-500/40">YIELD</p>
                        <p className="text-xs font-extrabold text-lime-400">16%</p>
                      </div>
                    </div>

                    <div className="border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 mb-3 text-center">
                      <p className="text-[8px] text-amber-500/40">ROYALTY-BEARING — GLOBAL DISTRIBUTION</p>
                    </div>

                    <button
                      onClick={() => playTrack(track as any, tracks as any[])}
                      className="w-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[10px] font-bold py-2 text-center transition-colors flex items-center justify-center gap-1"
                      data-testid={`button-play-trust-${track.id}`}
                    >
                      <TrendingUp className="h-3 w-3" /> STREAM GLOBAL ASSET
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
