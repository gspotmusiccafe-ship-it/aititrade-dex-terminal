import { Music2, Play, Crown, Clock, Headphones, Users, ArrowRight, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: Clock,
    title: "2 Weeks Early Access",
    description: "Members get exclusive access to pre-release music 2 weeks before it hits other platforms",
  },
  {
    icon: Headphones,
    title: "High-Quality Streaming",
    description: "Crystal clear audio with lossless quality streaming for the best listening experience",
  },
  {
    icon: Users,
    title: "Support Artists Directly",
    description: "Artists earn more per stream while you enjoy exclusive content and early releases",
  },
];

const membershipTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Stream public releases", "Create playlists", "Follow artists", "Basic audio quality"],
    highlight: false,
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "/month",
    features: [
      "Everything in Free",
      "2-week early access to releases",
      "Exclusive pre-release content",
      "Lossless audio quality",
      "Offline downloads",
      "No ads",
    ],
    highlight: true,
  },
  {
    name: "Artist Pro",
    price: "$19.99",
    period: "/month",
    features: [
      "Everything in Premium",
      "Upload unlimited tracks",
      "Upload music videos",
      "Analytics dashboard",
      "Scheduled releases",
      "Direct fan engagement",
    ],
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-xl">AITIFY</span>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#artists" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                For Artists
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" asChild data-testid="button-login">
                <a href="/api/login">Log in</a>
              </Button>
              <Button asChild data-testid="button-signup">
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1 text-yellow-500" />
                New: Early Access Memberships
              </Badge>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Get Music{" "}
                <span className="text-primary">First</span>
                <br />
                Before Anyone Else
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-xl">
                Stream exclusive pre-release music 2 weeks before it hits Spotify. 
                Support your favorite artists directly while enjoying early access to their latest releases.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild data-testid="button-hero-cta">
                  <a href="/api/login">
                    <Play className="h-5 w-5 mr-2" />
                    Start Listening Free
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="#pricing">
                    View Premium Plans
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 border-2 border-background"
                    />
                  ))}
                </div>
                <div className="text-sm">
                  <span className="font-semibold">10,000+</span>
                  <span className="text-muted-foreground"> music lovers already joined</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square max-w-lg mx-auto relative">
                {/* Decorative background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent rounded-3xl blur-3xl" />
                
                {/* Main visual - Vinyl record effect */}
                <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 overflow-hidden">
                  {/* Vinyl disc */}
                  <div className="absolute inset-8 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-800 animate-spin-slow">
                    <div className="absolute inset-0 rounded-full border-4 border-zinc-700/50" />
                    <div className="absolute inset-[40%] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-black/50" />
                    </div>
                    {/* Grooves */}
                    {[20, 30, 40, 50, 60, 70].map((percent) => (
                      <div
                        key={percent}
                        className="absolute rounded-full border border-zinc-600/20"
                        style={{
                          inset: `${percent / 2.5}%`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Early access badge */}
                  <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-medium shadow-lg">
                    2 Weeks Early
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Why Choose AITIFY?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We're building a new music experience that puts artists and listeners first
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/50 border-border/50 hover-elevate">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works for you. Upgrade anytime for early access.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {membershipTiers.map((tier, index) => (
              <Card
                key={index}
                className={`relative overflow-hidden ${
                  tier.highlight
                    ? "border-primary bg-primary/5 scale-105"
                    : "bg-card/50 border-border/50"
                }`}
                data-testid={`pricing-tier-${tier.name.toLowerCase()}`}
              >
                {tier.highlight && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <CardContent className={`p-6 ${tier.highlight ? "pt-10" : ""}`}>
                  <div className="mb-6">
                    <h3 className="font-semibold text-xl mb-2">{tier.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground text-sm">{tier.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={tier.highlight ? "default" : "outline"}
                    asChild
                  >
                    <a href="/api/login">
                      {tier.name === "Free" ? "Get Started" : "Start Free Trial"}
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Artists CTA Section */}
      <section id="artists" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="max-w-4xl mx-auto text-center">
          <Crown className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Are You an Artist?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload your music and videos, set pre-release dates, and let your fans hear your work 
            2 weeks before anyone else. Build anticipation and reward your most dedicated listeners.
          </p>
          <Button size="lg" asChild>
            <a href="/api/login">
              Join as Artist
              <ArrowRight className="h-4 w-4 ml-2" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Music2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">AITIFY MUSIC</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Get music first. Support artists directly.
            </p>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} AITIFY. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
