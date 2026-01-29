import { Crown, Check, Star, Zap, Headphones, Download, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Great for casual listening",
    features: [
      { text: "Stream all public releases", included: true },
      { text: "Create up to 10 playlists", included: true },
      { text: "Standard audio quality", included: true },
      { text: "2-week early access", included: false },
      { text: "Lossless audio", included: false },
      { text: "Offline downloads", included: false },
    ],
    popular: false,
    cta: "Current Plan",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$9.99",
    period: "/month",
    description: "Get music before everyone else",
    features: [
      { text: "Everything in Free", included: true },
      { text: "2-week early access to releases", included: true },
      { text: "Exclusive pre-release content", included: true },
      { text: "Lossless audio quality", included: true },
      { text: "Unlimited offline downloads", included: true },
      { text: "No advertisements", included: true },
    ],
    popular: true,
    cta: "Upgrade to Premium",
  },
  {
    id: "artist",
    name: "Artist Pro",
    price: "$19.99",
    period: "/month",
    description: "For music creators",
    features: [
      { text: "Everything in Premium", included: true },
      { text: "Upload unlimited tracks", included: true },
      { text: "Upload music videos", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Scheduled releases", included: true },
      { text: "Fan engagement tools", included: true },
    ],
    popular: false,
    cta: "Start Creating",
  },
];

const benefits = [
  {
    icon: Star,
    title: "Exclusive Early Access",
    description: "Listen to new releases 2 weeks before they hit other streaming platforms",
  },
  {
    icon: Headphones,
    title: "Premium Sound",
    description: "Experience music in lossless quality with crystal clear audio",
  },
  {
    icon: Download,
    title: "Offline Mode",
    description: "Download your favorites and listen anywhere, even without internet",
  },
  {
    icon: Zap,
    title: "Ad-Free Experience",
    description: "No interruptions, just pure music from start to finish",
  },
];

export default function MembershipPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-full pb-28">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent" />
        <div className="relative px-6 py-12 text-center">
          <Badge variant="secondary" className="mb-4">
            <Crown className="h-3 w-3 mr-1 text-yellow-500" />
            AITIFY Premium
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Get Music First with Premium
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Unlock exclusive early access to pre-release music, lossless audio quality, 
            and offline downloads. Support artists while enjoying the best listening experience.
          </p>
        </div>
      </div>

      {/* Benefits Grid */}
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

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
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
                <CardTitle className="flex items-center gap-2">
                  {plan.name}
                  {plan.id === "premium" && <Crown className="h-4 w-4 text-yellow-500" />}
                  {plan.id === "artist" && <Music className="h-4 w-4 text-primary" />}
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
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  disabled={plan.id === "free"}
                  asChild={plan.id !== "free"}
                >
                  {plan.id === "free" ? (
                    <span>Current Plan</span>
                  ) : isAuthenticated ? (
                    <a href="#">{plan.cta}</a>
                  ) : (
                    <a href="/api/login">{plan.cta}</a>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ or Additional Info */}
        <div className="text-center mt-12 max-w-2xl mx-auto">
          <h3 className="font-semibold mb-2">Have questions?</h3>
          <p className="text-sm text-muted-foreground">
            All Premium plans include a 7-day free trial. Cancel anytime.
            Artists keep more of their earnings through AITIFY's fair revenue sharing model.
          </p>
        </div>
      </div>
    </div>
  );
}
