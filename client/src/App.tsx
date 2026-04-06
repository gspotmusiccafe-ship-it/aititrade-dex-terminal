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
import { useAuth } from "@/hooks/use-auth";
import { MarketTicker } from "@/components/market-ticker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import ProductionPage from "@/pages/production";
import TraderPage from "@/pages/trader";
import InvestorPortalsPage from "@/pages/investor-portals";
import { useEffect } from "react";

interface TrustStatus {
  isMember: boolean;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <>{children}</>;
  if (!isAuthenticated) return <LandingPage />;
  return <>{children}</>;
}

function PremiumGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { data: trustStatus, isLoading: trustLoading } = useQuery<TrustStatus>({
    queryKey: ["/api/trust/status"],
    enabled: isAuthenticated,
  });

  if (isLoading || trustLoading) return <>{children}</>;
  if (!isAuthenticated) return <LandingPage />;
  if ((user as any)?.isAdmin) return <>{children}</>;
  if (trustStatus?.isMember) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black font-mono">
      <div className="text-center border border-amber-500/30 p-10 max-w-md">
        <h1 className="text-amber-400 font-black text-xl mb-4">PREMIUM ACCESS REQUIRED</h1>
        <p className="text-zinc-400 text-sm mb-2">This room requires a Sovereign Trust membership with Spotify Premium.</p>
        <p className="text-zinc-600 text-xs">$25 DOWN + $19.79/MO VIA CASH APP</p>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { isAuthenticated } = useAuth();
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {isAuthenticated && <AppSidebar />}
        <SidebarInset className="flex flex-col flex-1 bg-black">
          <div className="sticky top-0 z-40">
            <MarketTicker />
            {isAuthenticated && (
              <header className="flex items-center p-2 border-b border-emerald-500/10 bg-black">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </header>
            )}
          </div>
          <main className="flex-1 overflow-auto bg-black pb-40">
            <ErrorBoundary fallback={<CrashFallback />}>
              <Switch>
                <Route path="/">{() => <AuthGate><HomePage /></AuthGate>}</Route>
                <Route path="/search">{() => <AuthGate><SearchPage /></AuthGate>}</Route>
                <Route path="/library">{() => <AuthGate><LibraryPage /></AuthGate>}</Route>
                <Route path="/membership" component={MembershipPage} />
                <Route path="/artist-portal">{() => <AuthGate><ArtistPortalPage /></AuthGate>}</Route>
                <Route path="/liked">{() => <AuthGate><LikedSongsPage /></AuthGate>}</Route>
                <Route path="/artist/:id">{() => <AuthGate><ArtistPage /></AuthGate>}</Route>
                <Route path="/admin">{() => <AuthGate><AdminPage /></AuthGate>}</Route>
                <Route path="/radio">{() => <PremiumGate><RadioPage /></PremiumGate>}</Route>
                <Route path="/leaderboard">{() => <AuthGate><LeaderboardPage /></AuthGate>}</Route>
                <Route path="/playlist/:id">{() => <AuthGate><PlaylistPage /></AuthGate>}</Route>
                <Route path="/browse/:section">{() => <AuthGate><BrowsePage /></AuthGate>}</Route>
                <Route path="/dashboard">{() => <PremiumGate><DashboardPage /></PremiumGate>}</Route>
                <Route path="/trust-vault">{() => <PremiumGate><TrustVaultPage /></PremiumGate>}</Route>
                <Route path="/production">{() => <AuthGate><ProductionPage /></AuthGate>}</Route>
                <Route path="/trader/:userId">{() => <AuthGate><TraderPage /></AuthGate>}</Route>
                <Route path="/trader">{() => <AuthGate><TraderPage /></AuthGate>}</Route>
                <Route path="/investor-portals">{() => <AuthGate><InvestorPortalsPage /></AuthGate>}</Route>
                <Route path="/login" component={LandingPage} />
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </div>
      <MusicPlayer />
    </SidebarProvider>
  );
}

function CrashFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-mono">
      <div className="text-center border border-emerald-500/30 p-10 max-w-md">
        <h1 className="text-emerald-400 font-black text-2xl mb-4">AITITRADE EXCHANGE</h1>
        <p className="text-white mb-2">System is reloading...</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-emerald-600 text-white font-bold hover:bg-emerald-500">
          RELOAD EXCHANGE
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary fallback={<CrashFallback />}>
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
    </ErrorBoundary>
  );
}

export default App;
