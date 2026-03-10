import { useState } from "react";
import { DollarSign, Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TipJarDialogProps {
  artistId: string;
  artistName: string;
  trigger?: React.ReactNode;
}

const TIP_PRESETS = [2, 5, 10, 20];

export function TipJarDialog({ artistId, artistName, trigger }: TipJarDialogProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTip = async () => {
    if (!isAuthenticated) {
      toast({ title: "Sign in required", description: "Log in to send tips.", variant: "destructive" });
      return;
    }
    const tipAmount = parseFloat(amount);
    if (!tipAmount || tipAmount < 1 || tipAmount > 500) {
      toast({ title: "Invalid amount", description: "Tip must be between $1 and $500.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const orderRes = await apiRequest("POST", "/api/tips/create-order", { amount: tipAmount.toFixed(2), artistId });
      const order = await orderRes.json();
      if (!order.id) throw new Error("Failed to create PayPal order");

      const approveLink = order.links?.find((l: any) => l.rel === "approve");
      if (approveLink) {
        const popup = window.open(approveLink.href, "PayPal", "width=500,height=600");
        const checkClosed = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            try {
              const captureRes = await apiRequest("POST", "/api/tips/capture", {
                orderID: order.id,
                artistId,
                amount: tipAmount.toFixed(2),
                message,
              });
              const result = await captureRes.json();
              if (result.status === "COMPLETED") {
                toast({ title: "Tip sent!", description: `You tipped ${artistName} $${tipAmount.toFixed(2)}` });
                setOpen(false);
                setAmount("5");
                setMessage("");
              } else {
                toast({ title: "Tip not completed", description: "The payment was not finalized.", variant: "destructive" });
              }
            } catch {
              toast({ title: "Could not verify tip", description: "Please check your PayPal account.", variant: "destructive" });
            }
            setLoading(false);
          }
        }, 500);
        setTimeout(() => {
          clearInterval(checkClosed);
          if (loading) setLoading(false);
        }, 120000);
      } else {
        throw new Error("No approval link returned");
      }
    } catch (error: any) {
      console.error("Tip error:", error);
      toast({ title: "Tip failed", description: error.message || "Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (o && !isAuthenticated) {
        toast({ title: "Sign in required", description: "Log in to send tips.", variant: "destructive" });
        return;
      }
      setOpen(o);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-tip-artist">
            <DollarSign className="h-4 w-4" />
            Tip
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Tip {artistName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Show your support with a tip. 100% goes to the artist.
          </p>

          <div className="flex gap-2">
            {TIP_PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={amount === String(preset) ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAmount(String(preset))}
                data-testid={`button-tip-preset-${preset}`}
              >
                ${preset}
              </Button>
            ))}
          </div>

          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              min="1"
              max="500"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8"
              placeholder="Custom amount"
              data-testid="input-tip-amount"
            />
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            className="resize-none"
            rows={2}
            maxLength={200}
            data-testid="input-tip-message"
          />

          <Button
            className="w-full gap-2"
            onClick={handleTip}
            disabled={loading || !amount || parseFloat(amount) < 1}
            data-testid="button-send-tip"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4" />
                Send ${parseFloat(amount || "0").toFixed(2)} Tip
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Powered by PayPal. Secure payment processing.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
