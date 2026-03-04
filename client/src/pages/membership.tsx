import { useState, useEffect, useRef, useCallback } from "react";
import { Crown, Check, Star, Zap, Headphones, Download, Loader2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const TIER_PRICES: Record<string, string> = {
  silver: "1.99",
  bronze: "3.99",
  gold: "6.99",
};

const TIER_NAMES: Record<string, string> = {
  silver: "Silver",
  bronze: "Bronze",
  gold: "Gold",
};

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Listen to AI music for free",
    features: [
      { text: "Listen to released music", included: true },
      { text: "Follow artists", included: true },
      { text: "Playlists", included: false },
      { text: "Pre-release access", included: false },
      { text: "Artist services", included: false },
    ],
    popular: false,
    cta: "",
    color: "text-muted-foreground",
  },
  {
    id: "silver",
    name: "Silver",
    price: "$1.99",
    period: "/month",
    description: "Playlists and more music features",
    features: [
      { text: "Listen to released music", included: true },
      { text: "Follow artists", included: true },
      { text: "Create unlimited playlists", included: true },
      { text: "Standard audio quality", included: true },
      { text: "Pre-release access", included: false },
    ],
    popular: false,
    cta: "Get Silver",
    color: "text-gray-400",
  },
  {
    id: "bronze",
    name: "Bronze",
    price: "$3.99",
    period: "/month",
    description: "Full access — AI pre-releases, playlists, and videos",
    features: [
      { text: "Listen to released music", included: true },
      { text: "Pre-release music access", included: true },
      { text: "Create unlimited playlists", included: true },
      { text: "Watch music videos", included: true },
      { text: "High quality audio", included: true },
    ],
    popular: true,
    cta: "Get Bronze",
    color: "text-amber-600",
  },
  {
    id: "gold",
    name: "Gold",
    price: "$6.99",
    period: "/month",
    description: "Artist Pro — upload, promote, and distribute your music",
    features: [
      { text: "Everything in Bronze", included: true },
      { text: "Unlimited track uploads", included: true },
      { text: "Upload music videos (MP3/YouTube)", included: true },
      { text: "Marketing & promotions tools", included: true },
      { text: "Music distribution services", included: true },
      { text: "Advanced analytics dashboard", included: true },
      { text: "Lossless audio quality", included: true },
    ],
    popular: false,
    cta: "Get Gold",
    color: "text-yellow-500",
  },
];

const benefits = [
  {
    icon: Star,
    title: "2 Weeks Before Major Platforms",
    description: "Bronze and Gold members hear new AI music before Spotify, Amazon Music, Deezer, YouTube & Anghami",
  },
  {
    icon: Headphones,
    title: "Premium Sound",
    description: "Gold members enjoy lossless quality with crystal clear audio",
  },
  {
    icon: Zap,
    title: "Artist Services",
    description: "Gold members get uploads, distribution, marketing tools, and promotions",
  },
  {
    icon: Crown,
    title: "Follow & Playlist",
    description: "Follow your favorite artists and build playlists starting from Silver",
  },
];

function PayPalCheckoutDialog({
  open,
  onOpenChange,
  tier,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: string;
  onSuccess: (tier: string, orderId: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paypalInitialized = useRef(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const clickHandlerRef = useRef<((e: Event) => void) | null>(null);

  const amount = TIER_PRICES[tier] || "0";
  const tierName = TIER_NAMES[tier] || tier;

  const initPayPal = useCallback(async () => {
    if (!open || paypalInitialized.current) return;

    setLoading(true);
    setError(null);

    try {
      const setupRes = await fetch("/setup", { credentials: "include" });
      if (!setupRes.ok) throw new Error("Failed to initialize PayPal");
      const { clientToken, sandbox } = await setupRes.json();

      const loadScript = () =>
        new Promise<void>((resolve, reject) => {
          if ((window as any).paypal) {
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = sandbox
            ? "https://www.sandbox.paypal.com/web-sdk/v6/core"
            : "https://www.paypal.com/web-sdk/v6/core";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PayPal SDK"));
          document.body.appendChild(script);
        });

      await loadScript();

      const sdkInstance = await (window as any).paypal.createInstance({
        clientToken,
        components: ["paypal-payments"],
      });

      const paypalCheckout = sdkInstance.createPayPalOneTimePaymentSession({
        onApprove: async (data: any) => {
          try {
            const captureRes = await fetch(`/order/${data.orderId}/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });
            if (!captureRes.ok) throw new Error("Capture failed");
            const captureData = await captureRes.json();

            if (captureData.status === "COMPLETED") {
              onSuccess(tier, data.orderId);
            } else {
              setError("Payment was not completed. Please try again.");
            }
          } catch {
            setError("Failed to process payment. Please try again.");
          }
        },
        onCancel: () => {
          setError("Payment was cancelled.");
        },
        onError: (err: any) => {
          console.error("PayPal error:", err);
          setError("A payment error occurred. Please try again.");
        },
      });

      const container = buttonContainerRef.current;
      if (container) {
        container.innerHTML = "";
        const btn = document.createElement("paypal-button");
        btn.id = `paypal-btn-${tier}`;
        btn.setAttribute("data-testid", "button-paypal-checkout");
        container.appendChild(btn);

        const clickHandler = async () => {
          try {
            const orderRes = await fetch("/order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ tier }),
            });
            if (!orderRes.ok) throw new Error("Failed to create order");
            const orderData = await orderRes.json();

            await paypalCheckout.start(
              { paymentFlow: "auto" },
              Promise.resolve({ orderId: orderData.id })
            );
          } catch (e) {
            console.error("PayPal checkout error:", e);
            setError("Failed to start checkout. Please try again.");
          }
        };

        clickHandlerRef.current = clickHandler;
        btn.addEventListener("click", clickHandler);
      }

      paypalInitialized.current = true;
      setLoading(false);
    } catch (e: any) {
      console.error("PayPal init error:", e);
      setError(e.message || "Failed to initialize payment system");
      setLoading(false);
    }
  }, [open, tier, onSuccess]);

  useEffect(() => {
    if (open) {
      paypalInitialized.current = false;
      const timer = setTimeout(initPayPal, 300);
      return () => {
        clearTimeout(timer);
        const container = buttonContainerRef.current;
        if (container && clickHandlerRef.current) {
          const btn = container.querySelector("paypal-button");
          if (btn) btn.removeEventListener("click", clickHandlerRef.current);
          clickHandlerRef.current = null;
        }
      };
    }
  }, [open, initPayPal]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Upgrade to {tierName}
          </DialogTitle>
          <DialogDescription>
            Complete your payment of ${amount}/month via PayPal to activate your {tierName} membership.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">{tierName} Membership</p>
                <p className="text-sm text-muted-foreground">Monthly subscription</p>
              </div>
              <p className="text-2xl font-bold">${amount}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading PayPal...</span>
            </div>
          )}

          <div ref={buttonContainerRef} className={loading ? "hidden" : "flex justify-center"} />

          <p className="text-xs text-muted-foreground text-center">
            Secured by PayPal. You can cancel anytime from your account settings.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MembershipPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [checkoutTier, setCheckoutTier] = useState<string | null>(null);

  const { data: membership } = useQuery<{ tier: string; isActive: boolean; downloadsUsed?: number; previewsUsed?: number }>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  const upgradeMutation = useMutation({
    mutationFn: async ({ tier, paypalOrderId }: { tier: string; paypalOrderId: string }) => {
      return apiRequest("POST", "/api/user/membership/upgrade", { tier, paypalOrderId });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      setCheckoutTier(null);
      toast({
        title: "Membership activated!",
        description: `You are now a ${TIER_NAMES[variables.tier]} member. Enjoy your new benefits!`,
      });
    },
    onError: () => {
      toast({ title: "Activation failed", description: "Payment was received but activation failed. Please contact support.", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/membership/cancel");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "Membership cancelled", description: "You are now on the Free plan." });
    },
  });

  const handlePaymentSuccess = (tier: string, orderId: string) => {
    upgradeMutation.mutate({ tier, paypalOrderId: orderId });
  };

  const currentTier = membership?.tier || "free";

  const isCurrent = (planId: string) => planId === currentTier;

  return (
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
        <div className="relative px-6 py-12 text-center">
          <Badge variant="secondary" className="mb-4">
            <Crown className="h-3 w-3 mr-1 text-yellow-500" />
            AITIFY MUSIC RADIO Membership
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4" data-testid="text-membership-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From previews to unlimited downloads — pick the tier that matches your vibe.
            All plans include unlimited access to released music.
          </p>
          {isAuthenticated && currentTier !== "free" && (
            <div className="mt-4">
              <Badge variant="default" className="text-sm px-3 py-1" data-testid="badge-current-tier">
                Current Plan: {TIER_NAMES[currentTier] || currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden ${
                plan.popular ? "border-primary scale-105 z-10" : "border-border/50"
              }`}
              data-testid={`membership-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader className={plan.popular ? "pt-10" : ""}>
                <CardTitle className={`flex items-center gap-2 ${plan.color}`}>
                  {plan.name}
                  {plan.id === "gold" && <Crown className="h-4 w-4 text-yellow-500" />}
                  {plan.id === "bronze" && <Crown className="h-4 w-4 text-amber-600" />}
                  {plan.id === "silver" && <Crown className="h-4 w-4 text-gray-400" />}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 text-sm ${
                        !feature.included ? "text-muted-foreground" : ""
                      }`}
                    >
                      <Check
                        className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                          feature.included ? "text-primary" : "text-muted-foreground/40"
                        }`}
                      />
                      <span className={!feature.included ? "line-through" : ""}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {isCurrent(plan.id) ? (
                  <>
                    <Button className="w-full" variant="outline" disabled data-testid={`button-plan-${plan.id}`}>
                      Current Plan
                    </Button>
                    {plan.id !== "free" && (
                      <Button
                        className="w-full"
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate()}
                        disabled={cancelMutation.isPending}
                        data-testid="button-cancel-membership"
                      >
                        Cancel Plan
                      </Button>
                    )}
                  </>
                ) : plan.id === "free" ? (
                  <Button className="w-full" variant="outline" disabled data-testid={`button-plan-${plan.id}`}>
                    Free Plan
                  </Button>
                ) : isAuthenticated ? (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setCheckoutTier(plan.id)}
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"} asChild data-testid={`button-plan-${plan.id}`}>
                    <a href="/api/login">{plan.cta}</a>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 max-w-2xl mx-auto">
          <h3 className="font-semibold mb-2">Have questions?</h3>
          <p className="text-sm text-muted-foreground">
            All paid plans include a 7-day free trial. Cancel anytime.
            Artists keep more of their earnings through AITIFY MUSIC RADIO's fair revenue sharing model.
          </p>
        </div>
      </div>

      {checkoutTier && (
        <PayPalCheckoutDialog
          open={!!checkoutTier}
          onOpenChange={(open) => { if (!open) setCheckoutTier(null); }}
          tier={checkoutTier}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
