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
  entry_trader: "4.99",
  exchange_trader: "24.99",
  mint_factory_ceo: "99.00",
  mint_factory_ceo_monthly: "9.99",
};

const TIER_NAMES: Record<string, string> = {
  entry_trader: "Entry Trader",
  exchange_trader: "Exchange Trader",
  mint_factory_ceo: "Mint Factory CEO",
};

const plans = [
  {
    id: "free",
    name: "Front Page Investor",
    price: "FREE",
    period: "",
    description: "Paper trading on the landing page — Spotify account required",
    features: [
      { text: "Paper trading on 97.7 THE FLAME", included: true },
      { text: "Stream AI-generated assets", included: true },
      { text: "Landing page access only", included: true },
      { text: "Inside exchange access", included: false },
      { text: "Pre-release / High-Volatility assets", included: false },
      { text: "Minting rights", included: false },
    ],
    popular: false,
    cta: "",
    gradient: "from-zinc-700 to-zinc-800",
    iconColor: "text-zinc-500",
    borderColor: "border-zinc-700/30",
    glowColor: "",
  },
  {
    id: "entry_trader",
    name: "Entry Trader",
    price: "$4.99",
    period: "/month",
    description: "Restricted access — standard assets only",
    features: [
      { text: "Access the Sovereign Exchange", included: true },
      { text: "Acquire standard asset positions", included: true },
      { text: "Follow artists & create playlists", included: true },
      { text: "Standard audio quality", included: true },
      { text: "Pre-release assets", included: false },
      { text: "High-Volatility assets", included: false },
    ],
    popular: false,
    cta: "ENTER THE FLOOR",
    gradient: "from-emerald-800 to-emerald-900",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-500/20",
    glowColor: "",
  },
  {
    id: "exchange_trader",
    name: "Exchange Trader",
    price: "$24.99",
    period: "/month",
    description: "Full market access — all assets + early pre-release papers",
    features: [
      { text: "Full Sovereign Exchange access", included: true },
      { text: "Acquire ALL asset positions", included: true },
      { text: "Early Pre-release paper access", included: true },
      { text: "High-Volatility asset trading", included: true },
      { text: "High quality audio streaming", included: true },
      { text: "Priority settlement queue", included: true },
    ],
    popular: true,
    cta: "UNLOCK FULL ACCESS",
    gradient: "from-emerald-700 to-emerald-800",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-400/30",
    glowColor: "shadow-emerald-500/10",
  },
  {
    id: "mint_factory_ceo",
    name: "Mint Factory CEO",
    price: "$99",
    period: " to join",
    description: "Full access + minting rights + 16% daily trading credit",
    features: [
      { text: "Everything in Exchange Trader", included: true },
      { text: "$9.99/month to stay active", included: true },
      { text: "16% Daily Trading Credit on all positions", included: true },
      { text: "Minting rights — upload & mint AI-generated assets", included: true },
      { text: "AI Lyrics Generator — prompt-to-song engine", included: true },
      { text: "Professional audio mastering (radio-ready, -14 LUFS)", included: true },
      { text: "Distribution to Spotify, Amazon Music, Deezer, YouTube & Anghami", included: true },
      { text: "In-house AI-music marketing & promotions", included: true },
      { text: "Aitify Music Store — 25% sales retention", included: true },
      { text: "Tip Jar — direct PayPal tips from fans", included: true },
      { text: "Leaderboard rank tracking & tier badges", included: true },
      { text: "Advanced analytics dashboard", included: true },
      { text: "Artist profile & bio page", included: true },
      { text: "Lossless audio quality", included: true },
    ],
    popular: false,
    cta: "BECOME CEO",
    gradient: "from-emerald-600 to-emerald-700",
    iconColor: "text-emerald-300",
    borderColor: "border-emerald-300/30",
    glowColor: "shadow-emerald-400/10",
  },
];

const benefits = [
  {
    icon: Star,
    title: "Early Pre-release Papers",
    description: "Exchange Traders and Mint Factory CEOs get early access to AI-generated assets before public listing",
  },
  {
    icon: Headphones,
    title: "Lossless Audio",
    description: "Mint Factory CEOs stream in lossless quality with crystal clear AI-generated audio",
  },
  {
    icon: Zap,
    title: "16% Daily Trading Credit",
    description: "Mint Factory CEOs earn 16% originator credit on every position minted",
  },
  {
    icon: Crown,
    title: "Full Market Access",
    description: "Exchange Traders unlock all assets including High-Volatility and Pre-release positions",
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
            {tier === "mint_factory_ceo"
              ? `Complete your one-time payment of $${amount} via PayPal to join as a Mint Factory CEO. After joining, it's $9.99/month to stay active.`
              : `Complete your payment of $${amount}/month via PayPal to activate your ${tierName} access.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border/30 p-4 bg-card/60">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">{tierName}</p>
                <p className="text-sm text-muted-foreground">
                  {tier === "mint_factory_ceo" ? "One-time join fee + $9.99/month" : "Monthly subscription"}
                </p>
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
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  const { data: membership } = useQuery<{ tier: string; isActive: boolean; downloadsUsed?: number; previewsUsed?: number }>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  const { data: subscriptionStatus } = useQuery<{ hasSubscription: boolean; status?: string; nextBillingTime?: string }>({
    queryKey: ["/api/user/membership/subscription-status"],
    enabled: isAuthenticated && membership?.tier === "mint_factory_ceo",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("subscription") === "success") {
      window.history.replaceState({}, "", "/membership");
      apiRequest("POST", "/api/user/membership/gold-subscription/activate", {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user/membership/subscription-status"] });
        toast({ title: "Subscription activated!", description: "Your $9.99/month Mint Factory CEO subscription is set up. First charge in 30 days." });
      }).catch(() => {
        toast({ title: "Subscription pending", description: "Your subscription may take a moment to activate. Check back shortly." });
      });
    } else if (params.get("subscription") === "cancelled") {
      window.history.replaceState({}, "", "/membership");
      toast({ title: "Subscription not completed", description: "You can set up your monthly subscription anytime from this page.", variant: "destructive" });
    }
  }, []);

  const upgradeMutation = useMutation({
    mutationFn: async ({ tier, paypalOrderId }: { tier: string; paypalOrderId: string }) => {
      return apiRequest("POST", "/api/user/membership/upgrade", { tier, paypalOrderId });
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      setCheckoutTier(null);

      if (variables.tier === "mint_factory_ceo") {
        toast({
          title: "Mint Factory CEO joining fee paid!",
          description: "Setting up your $9.99/month subscription...",
        });
        setSubscriptionLoading(true);
        try {
          const subRes = await apiRequest("POST", "/api/user/membership/gold-subscription");
          const subData = subRes as any;
          if (subData.approvalUrl) {
            window.location.href = subData.approvalUrl;
          }
        } catch (e) {
          setSubscriptionLoading(false);
          toast({
            title: "Subscription setup failed",
            description: "Your $99 joining fee was paid. You can set up the monthly subscription later from this page.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Membership activated!",
          description: `You are now a ${TIER_NAMES[variables.tier]} member. Enjoy your new benefits!`,
        });
      }
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
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership/subscription-status"] });
      toast({ title: "Membership cancelled", description: "Your subscription has been cancelled. You are now on the Free plan." });
    },
  });

  const setupSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/membership/gold-subscription");
    },
    onSuccess: (data: any) => {
      if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      }
    },
    onError: () => {
      toast({ title: "Subscription setup failed", description: "Please try again later.", variant: "destructive" });
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
        <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/10 via-primary/5 to-transparent" />
        <div className="relative px-6 py-12 text-center">
          <Badge variant="secondary" className="mb-4 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Crown className="h-3 w-3 mr-1" />
            AITIFY MUSIC RADIO Membership
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-4" data-testid="text-membership-title">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg font-medium">
            From previews to unlimited downloads — pick the tier that matches your vibe.
            All plans include unlimited access to released music.
          </p>
          {isAuthenticated && currentTier !== "free" && (
            <div className="mt-4">
              <Badge className="text-sm px-3 py-1 bg-gradient-to-r from-primary to-emerald-500 border-0" data-testid="badge-current-tier">
                Current Plan: {TIER_NAMES[currentTier] || currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center p-5 rounded-xl bg-card/40 border border-border/20 hover:border-primary/20 transition-colors">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${
                plan.popular
                  ? `border-primary/50 shadow-xl ${plan.glowColor} scale-[1.02]`
                  : `${plan.borderColor} bg-card/60 hover:bg-card/90 hover:border-primary/20`
              }`}
              data-testid={`membership-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className={`absolute top-0 left-0 right-0 bg-gradient-to-r ${plan.gradient} text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider`}>
                  Most Popular
                </div>
              )}
              <CardHeader className={plan.popular ? "pt-10" : ""}>
                <CardTitle className={`flex items-center gap-2 ${plan.iconColor} font-extrabold tracking-tight`}>
                  {plan.name}
                  {plan.id === "mint_factory_ceo" && <Crown className="h-5 w-5 text-emerald-300" />}
                  {plan.id === "exchange_trader" && <Zap className="h-5 w-5 text-emerald-400" />}
                  {plan.id === "entry_trader" && <ShieldCheck className="h-5 w-5 text-emerald-500" />}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-4xl font-black tracking-tight text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 text-sm ${
                        !feature.included ? "text-muted-foreground/50" : ""
                      }`}
                    >
                      <Check
                        className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                          feature.included ? "text-primary" : "text-muted-foreground/30"
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
                    {plan.id === "mint_factory_ceo" && subscriptionStatus && !subscriptionStatus.hasSubscription && (
                      <Button
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500/90 hover:to-emerald-600/90 text-black border-0 font-bold"
                        onClick={() => setupSubscriptionMutation.mutate()}
                        disabled={setupSubscriptionMutation.isPending || subscriptionLoading}
                        data-testid="button-setup-subscription"
                      >
                        {setupSubscriptionMutation.isPending || subscriptionLoading ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Setting up...</>
                        ) : "Setup $9.99/mo Subscription"}
                      </Button>
                    )}
                    {plan.id === "mint_factory_ceo" && subscriptionStatus?.hasSubscription && (
                      <div className="w-full text-center">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${subscriptionStatus.status === "ACTIVE" || subscriptionStatus.status === "APPROVED" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}`}
                          data-testid="badge-subscription-status"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Subscription: {subscriptionStatus.status === "ACTIVE" || subscriptionStatus.status === "APPROVED" ? "Active" : subscriptionStatus.status}
                        </Badge>
                        {subscriptionStatus.nextBillingTime && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Next billing: {new Date(subscriptionStatus.nextBillingTime).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
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
                ) : (
                  <Button
                    className={`w-full ${plan.popular ? "bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 border-0 shadow-lg shadow-primary/20" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setCheckoutTier(plan.id)}
                    disabled={subscriptionLoading}
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {subscriptionLoading && plan.id === "mint_factory_ceo" ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : plan.cta}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 max-w-2xl mx-auto p-6 rounded-xl bg-card/30 border border-border/20">
          <h3 className="font-semibold mb-2">Have questions?</h3>
          <p className="text-sm text-muted-foreground">
            All tiers include a 7-day free trial. Cancel anytime.
            100% AI-powered platform — all assets are certified AI-generated.
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
