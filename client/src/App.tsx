import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { PlayerProvider } from "@/lib/player-context";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MusicPlayer } from "@/components/music-player";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { MarketTicker } from "@/components/market-ticker";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import HomePage from "@/pages/home";
import SearchPage from "@/pages/search";
import LibraryPage from "@/pages/library";
import MembershipPage from "@/pages/membership";
import ArtistPortalPage from "@/pages/artist-portal";
import LikedSongsPage from "@/pages/liked-songs";
import ArtistPage from "@/pages/artist";
import AdminPage from "@/pages/admin";
import RadioPage from "@/pages/radio";
import BrowsePage from "@/pages/browse";
import PlaylistPage from "@/pages/playlist";
import LeaderboardPage from "@/pages/leaderboard";
import DashboardPage from "@/pages/dashboard";
import TrustVaultPage from "@/pages/trust-vault";
import { useEffect } from "react";

const PREMIUM_TIERS = ["entry_trader", "exchange_trader", "mint_factory_ceo", "mintor", "asset_trustee", "gold"];

interface MembershipData {
  tier: string;
  isActive: boolean;
  trustInvestor?: boolean;
}

function checkIsPremium(membership: MembershipData | null | undefined): boolean {
  if (!membership) return false;
  if (membership.isActive === false) return false;
  if (membership.trustInvestor) return true;
  return PREMIUM_TIERS.includes(membership.tier);
}

function UpgradeRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/membership");
  }, [setLocation]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4 text-center font-mono">
        <div className="w-16 h-16 bg-lime-500/20 flex items-center justify-center">
          <span className="text-lime-400 text-2xl font-extrabold">$</span>
        </div>
        <p className="text-lime-400 text-sm font-extrabold" data-testid="text-upgrade-redirect">PREMIUM TRADING ACCOUNT REQUIRED</p>
        <p className="text-zinc-400 text-xs">REDIRECTING TO MEMBERSHIP...</p>
      </div>
    </div>
  );
}

function PremiumGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { data: membership, isLoading: membershipLoading } = useQuery<MembershipData>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return <LandingPage />;

  if (membershipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-lime-500/20 animate-pulse" />
          <p className="text-lime-400 font-mono text-xs font-extrabold">VERIFYING ACCESS...</p>
        </div>
      </div>
    );
  }

  if ((user as any)?.isAdmin) return <>{children}</>;
  if (!checkIsPremium(membership)) return <UpgradeRedirect />;

  return <>{children}</>;
}

function useIsPremiumUser() {
  const { isAuthenticated, user } = useAuth();
  const { data: membership } = useQuery<MembershipData>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });
  return isAuthenticated && ((user as any)?.isAdmin || checkIsPremium(membership));
}

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const isPremium = useIsPremiumUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 animate-pulse" />
          <p className="text-emerald-500/50 font-mono text-xs">LOADING EXCHANGE...</p>
        </div>
      </div>
    );
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {isPremium && <AppSidebar />}
        <SidebarInset className="flex flex-col flex-1">
          <div className="sticky top-0 z-40">
            <MarketTicker />
            {isPremium && (
              <header className="flex items-center justify-between p-2 border-b border-emerald-500/10 bg-black">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
            )}
          </div>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/">{() => <PremiumGate><HomePage /></PremiumGate>}</Route>
              <Route path="/search">{() => <PremiumGate><SearchPage /></PremiumGate>}</Route>
              <Route path="/library">{() => <PremiumGate><LibraryPage /></PremiumGate>}</Route>
              <Route path="/membership" component={MembershipPage} />
              <Route path="/artist-portal">{() => <PremiumGate><ArtistPortalPage /></PremiumGate>}</Route>
              <Route path="/liked">{() => <PremiumGate><LikedSongsPage /></PremiumGate>}</Route>
              <Route path="/artist/:id">{() => <PremiumGate><ArtistPage /></PremiumGate>}</Route>
              <Route path="/admin">{() => <PremiumGate><AdminPage /></PremiumGate>}</Route>
              <Route path="/radio">{() => <PremiumGate><RadioPage /></PremiumGate>}</Route>
              <Route path="/leaderboard">{() => <PremiumGate><LeaderboardPage /></PremiumGate>}</Route>
              <Route path="/playlist/:id">{() => <PremiumGate><PlaylistPage /></PremiumGate>}</Route>
              <Route path="/browse/:section">{() => <PremiumGate><BrowsePage /></PremiumGate>}</Route>
              <Route path="/dashboard">{() => <PremiumGate><DashboardPage /></PremiumGate>}</Route>
              <Route path="/trust-vault">{() => <PremiumGate><TrustVaultPage /></PremiumGate>}</Route>
              <Route path="/login" component={LandingPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </SidebarInset>
      </div>
      <MusicPlayer />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <PlayerProvider>
            <AuthenticatedLayout />
            <Toaster />
          </PlayerProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
