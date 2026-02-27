import { Crown, Check, Star, Zap, Headphones, Download, Music, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Great for casual listening",
    features: [
      { text: "Stream all previously released music", included: true },
      { text: "Create up to 10 playlists", included: true },
      { text: "Standard audio quality", included: true },
      { text: "Pre-release previews", included: false },
      { text: "MP3 downloads", included: false },
    ],
    popular: false,
    cta: "Current Plan",
    color: "text-muted-foreground",
  },
  {
    id: "silver",
    name: "Silver",
    price: "$1.99",
    period: "/month",
    description: "Preview new music before release",
    features: [
      { text: "Unlimited previously released music", included: true },
      { text: "5 pre-release previews per month", included: true },
      { text: "Standard audio quality", included: true },
      { text: "Create unlimited playlists", included: true },
      { text: "MP3 downloads", included: false },
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
    description: "Download and preview your favorites",
    features: [
      { text: "Unlimited previously released music", included: true },
      { text: "20 pre-release previews per month", included: true },
      { text: "10 MP3 downloads per month", included: true },
      { text: "Create unlimited playlists", included: true },
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
    description: "Unlimited everything — the full experience",
    features: [
      { text: "Unlimited previously released music", included: true },
      { text: "Unlimited pre-release previews", included: true },
      { text: "Unlimited MP3 downloads", included: true },
      { text: "Lossless audio quality", included: true },
      { text: "Create unlimited playlists", included: true },
      { text: "No advertisements", included: true },
    ],
    popular: false,
    cta: "Get Gold",
    color: "text-yellow-500",
  },
  {
    id: "artist",
    name: "Artist Pro",
    price: "$19.99",
    period: "/month",
    description: "Upload music, build your fanbase, and earn",
    features: [
      { text: "Everything in Gold", included: true },
      { text: "Unlimited track uploads", included: true },
      { text: "Upload music videos", included: true },
      { text: "Advanced analytics dashboard", included: true },
      { text: "Fan engagement tools", included: true },
      { text: "Priority artist support", included: true },
    ],
    popular: false,
    cta: "Go Artist Pro",
    color: "text-primary",
  },
];

const benefits = [
  {
    icon: Star,
    title: "Early Access Previews",
    description: "Preview pre-release tracks before they drop for everyone else",
  },
  {
    icon: Headphones,
    title: "Premium Sound",
    description: "Gold members enjoy lossless quality with crystal clear audio",
  },
  {
    icon: Download,
    title: "MP3 Downloads",
    description: "Download tracks and listen offline — Bronze gets 10/mo, Gold gets unlimited",
  },
  {
    icon: Zap,
    title: "Unlimited Released Music",
    description: "All tiers get unlimited access to previously released tracks",
  },
];

export default function MembershipPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: membership } = useQuery<{ tier: string; isActive: boolean; downloadsUsed?: number; previewsUsed?: number }>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  const upgradeMutation = useMutation({
    mutationFn: async (tier: string) => {
      return apiRequest("POST", "/api/user/membership/upgrade", { tier });
    },
    onSuccess: (_data, tier) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      toast({ title: "Membership upgraded!", description: `You are now a ${tier.charAt(0).toUpperCase() + tier.slice(1)} member.` });
    },
    onError: () => {
      toast({ title: "Upgrade failed", description: "Please try again.", variant: "destructive" });
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

  const currentTier = membership?.tier || "free";

  const tierRank: Record<string, number> = { free: 0, silver: 1, bronze: 2, gold: 3, artist: 4 };
  const isCurrentOrLower = (planId: string) => tierRank[planId] <= tierRank[currentTier];

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
                Current Plan: {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
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
                {currentTier === plan.id ? (
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
                ) : isCurrentOrLower(plan.id) ? (
                  <Button className="w-full" variant="outline" disabled data-testid={`button-plan-${plan.id}`}>
                    {plan.id === "free" ? "Free Plan" : "Current or Lower"}
                  </Button>
                ) : isAuthenticated ? (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => upgradeMutation.mutate(plan.id)}
                    disabled={upgradeMutation.isPending}
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {upgradeMutation.isPending ? "Upgrading..." : plan.cta}
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
    </div>
  );
}
