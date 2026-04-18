import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle, Copy, ExternalLink, Loader2, QrCode, Search, ClipboardPaste } from "lucide-react";

// EIP-681 payment URI for BSC (chain id 56) — opens MetaMask mobile with prefilled amount when scanned
function buildPaymentUri(coin: string, contract: string | null, wallet: string, amountUsd: number): string {
  if (coin === "BNB") {
    // BNB amount in wei (assume 1 BNB = $600 ballpark — user will see/edit amount in their wallet)
    return `ethereum:${wallet}@56`;
  }
  // BEP-20 token transfer (USDC/USDT both 18 decimals on BSC)
  const amountWei = BigInt(Math.round(amountUsd * 1e6)) * BigInt(1e12); // 18 decimals
  return `ethereum:${contract}@56/transfer?address=${wallet}&uint256=${amountWei.toString()}`;
}
function qrUrl(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(data)}`;
}

type CryptoModalProps = {
  open: boolean;
  onClose: () => void;
  amountUsd: number;
  purpose: "portal_entry" | "portal_resale" | "floor_trade" | "music_stock";
  referenceId?: string;
  userId: string;
  userEmail?: string;
  onSettled?: () => void;
};

type Manifest = {
  coins: { symbol: string; contract: string | null; label: string }[];
  chain: string;
  manualThreshold: number;
  walletAddress: string;
  walletConfigured: boolean;
  autoEnabled: boolean;
  warning: string;
};

type InitiateResp = {
  ok: boolean;
  lane: "manual" | "auto";
  paymentId: number;
  wallet?: string;
  invoiceUrl?: string;
  contract?: string | null;
  amountUsd?: number;
  coin?: string;
  fallback?: boolean;
  notice?: string;
  warning?: string;
  instruction?: string;
};

export default function CryptoSettlementModal({ open, onClose, amountUsd, purpose, referenceId, userId, userEmail, onSettled }: CryptoModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [coin, setCoin] = useState<"USDC" | "USDT" | "BNB">(amountUsd >= 50 ? "USDC" : "BNB");
  const [step, setStep] = useState<"select" | "pay" | "submitted">("select");
  const [payment, setPayment] = useState<InitiateResp | null>(null);
  const [txHash, setTxHash] = useState("");

  const { data: manifest } = useQuery<Manifest>({ queryKey: ["/api/crypto/manifest"], enabled: open });

  useEffect(() => {
    if (!open) { setStep("select"); setPayment(null); setTxHash(""); }
  }, [open]);

  const initiate = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/crypto/initiate", { amountUsd, coin, purpose, referenceId, userId, userEmail }).then(r => r.json()),
    onSuccess: (data: InitiateResp) => {
      setPayment(data);
      if (data.lane === "auto" && data.invoiceUrl) {
        window.open(data.invoiceUrl, "_blank", "noopener,noreferrer");
        toast({ title: "Auto-Lane Invoice Opened", description: "Complete payment in the new tab. Settlement is automatic." });
        setStep("submitted");
      } else {
        setStep("pay");
        if (data.fallback) toast({ title: "Routed to Manual", description: data.notice || "Auto processor unavailable." });
      }
    },
    onError: (e: any) => toast({ title: "Could not start crypto payment", description: e.message, variant: "destructive" }),
  });

  const submitHash = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/crypto/submit-hash", { paymentId: payment!.paymentId, txHash }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Hash Submitted", description: "Awaiting admin verification (usually <2 min)." });
      qc.invalidateQueries({ queryKey: ["/api/crypto/my-payments"] });
      setStep("submitted");
      onSettled?.();
    },
    onError: (e: any) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  const lane = amountUsd >= (manifest?.manualThreshold ?? 50) ? "manual" : "auto";
  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast({ title: "Copied" }); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-crypto-settlement">
        <DialogHeader>
          <DialogTitle>Pay with Crypto — ${amountUsd.toFixed(2)}</DialogTitle>
          <DialogDescription>
            BNB Smart Chain (BEP-20) only · {lane === "manual" ? `Manual Lane (≥$${manifest?.manualThreshold ?? 50})` : `Auto Lane (<$${manifest?.manualThreshold ?? 50})`}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Chain Safety</AlertTitle>
              <AlertDescription className="text-xs">
                {manifest?.warning || "SEND ONLY VIA BNB SMART CHAIN (BEP-20). Sending via Ethereum or other chains will result in permanent loss of funds."}
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-sm font-semibold">Select Coin</Label>
              <RadioGroup value={coin} onValueChange={(v) => setCoin(v as any)} className="mt-2 space-y-2">
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover-elevate" data-testid="radio-coin-USDC">
                  <RadioGroupItem value="USDC" id="coin-usdc" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">USDC</span><Badge variant="secondary">Stable · Recommended ≥$500</Badge></div>
                    <p className="text-xs text-muted-foreground">Pegged 1:1 to USD. No price swings between send & confirm.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover-elevate" data-testid="radio-coin-USDT">
                  <RadioGroupItem value="USDT" id="coin-usdt" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">USDT</span><Badge variant="secondary">Universal liquidity</Badge></div>
                    <p className="text-xs text-muted-foreground">Most-held stablecoin worldwide. Same 1:1 USD peg.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover-elevate" data-testid="radio-coin-BNB">
                  <RadioGroupItem value="BNB" id="coin-bnb" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2"><span className="font-semibold">BNB</span><Badge variant="secondary">Recommended for $1–$4 floor</Badge></div>
                    <p className="text-xs text-muted-foreground">Native BSC gas. Price moves — fastest for micro-trades.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} data-testid="button-crypto-cancel">Cancel</Button>
              <Button onClick={() => initiate.mutate()} disabled={initiate.isPending} data-testid="button-crypto-continue">
                {initiate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue → {lane === "manual" ? "Wallet" : "Processor"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "pay" && payment && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>BNB Smart Chain (BEP-20) ONLY</AlertTitle>
              <AlertDescription className="text-xs">{payment.warning}</AlertDescription>
            </Alert>

            {/* 3-STEP VISUAL GUIDE — eliminates user error */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 border rounded-lg bg-muted/30">
                <QrCode className="h-5 w-5 mx-auto text-amber-500" />
                <div className="text-[10px] font-bold mt-1">1. SCAN</div>
                <div className="text-[9px] text-muted-foreground">Send total in MetaMask</div>
              </div>
              <div className="p-2 border rounded-lg bg-muted/30">
                <Search className="h-5 w-5 mx-auto text-amber-500" />
                <div className="text-[10px] font-bold mt-1">2. VERIFY</div>
                <div className="text-[9px] text-muted-foreground">Find tx on BscScan</div>
              </div>
              <div className="p-2 border rounded-lg bg-muted/30">
                <ClipboardPaste className="h-5 w-5 mx-auto text-amber-500" />
                <div className="text-[10px] font-bold mt-1">3. PASTE</div>
                <div className="text-[9px] text-muted-foreground">Hash → I HAVE PAID</div>
              </div>
            </div>

            <div className="p-3 border rounded-lg bg-muted/40">
              <Label className="text-xs uppercase">Send</Label>
              <div className="text-2xl font-bold" data-testid="text-crypto-amount">${payment.amountUsd?.toFixed(2)} of {payment.coin}</div>
              {payment.contract && (
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Contract: </span>
                  <code className="break-all">{payment.contract}</code>
                  <Button size="sm" variant="ghost" className="h-5 px-1 ml-1" onClick={() => copy(payment.contract!)} data-testid="button-copy-contract"><Copy className="h-3 w-3" /></Button>
                </div>
              )}
            </div>

            {/* QR CODE — dynamically encodes wallet + amount + token contract */}
            <div className="flex gap-3 p-3 border rounded-lg bg-white">
              <img
                src={qrUrl(buildPaymentUri(payment.coin!, payment.contract || null, payment.wallet!, payment.amountUsd!))}
                alt="BSC Payment QR"
                width={140}
                height={140}
                className="rounded"
                data-testid="img-payment-qr"
              />
              <div className="flex-1 text-xs text-zinc-700 space-y-1">
                <div className="font-bold text-zinc-900">Scan with MetaMask Mobile</div>
                <div>Auto-fills <span className="font-mono">${payment.amountUsd?.toFixed(2)} {payment.coin}</span> on BSC.</div>
                <div className="text-[10px] text-zinc-500">If your wallet doesn't auto-fill the amount, enter <span className="font-mono">${payment.amountUsd?.toFixed(2)}</span> manually.</div>
              </div>
            </div>

            <div className="p-3 border rounded-lg">
              <Label className="text-xs uppercase">Founder Wallet (BSC)</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs break-all flex-1" data-testid="text-founder-wallet">{payment.wallet}</code>
                <Button size="sm" variant="outline" onClick={() => copy(payment.wallet!)} data-testid="button-copy-wallet"><Copy className="h-3 w-3" /></Button>
              </div>
            </div>

            <div>
              <Label htmlFor="tx-hash" className="text-sm font-semibold">Transaction Hash *</Label>
              <Input id="tx-hash" placeholder="0x..." value={txHash} onChange={(e) => setTxHash(e.target.value.trim())} className="font-mono text-xs" data-testid="input-tx-hash" />

              {/* BSCSCAN HELPER LINK — Command #015 */}
              <div className="mt-2 text-xs text-muted-foreground">
                <p>Having trouble finding your hash?</p>
                <a
                  href={`https://bscscan.com/address/${payment.wallet}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline hover:opacity-80 inline-flex items-center gap-1"
                  data-testid="link-bscscan-helper"
                >
                  Click here to find your transaction on the Blockchain Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")} data-testid="button-back">Back</Button>
              <Button onClick={() => submitHash.mutate()} disabled={!txHash || submitHash.isPending} data-testid="button-submit-hash">
                {submitHash.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                I Have Paid
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "submitted" && (
          <div className="space-y-3 text-center py-4">
            <div className="text-lg font-semibold">{payment?.lane === "auto" ? "Awaiting Webhook" : "Awaiting Admin Verification"}</div>
            <p className="text-sm text-muted-foreground">
              {payment?.lane === "auto"
                ? "Your invoice was opened in a new tab. Settlement is automatic once the network confirms your payment."
                : "Admin has been notified. Your portal/trade activates once the tx hash is verified on BscScan (~1–2 min)."}
            </p>
            {txHash && (
              <a className="text-xs text-primary inline-flex items-center gap-1" target="_blank" rel="noreferrer" href={`https://bscscan.com/tx/${txHash}`} data-testid="link-bscscan">
                View Tx on BscScan <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <DialogFooter>
              <Button onClick={onClose} data-testid="button-crypto-done">Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
