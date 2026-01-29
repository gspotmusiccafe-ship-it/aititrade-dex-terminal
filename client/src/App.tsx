import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { PlayerProvider } from "@/lib/player-context";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MusicPlayer } from "@/components/music-player";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
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

function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/search" component={SearchPage} />
      <Route path="/library" component={LibraryPage} />
      <Route path="/membership" component={MembershipPage} />
      <Route path="/artist-portal" component={ArtistPortalPage} />
      <Route path="/liked" component={LikedSongsPage} />
      <Route path="/artist/:id" component={ArtistPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/search" component={SearchPage} />
              <Route path="/library" component={LibraryPage} />
              <Route path="/membership" component={MembershipPage} />
              <Route path="/artist-portal" component={ArtistPortalPage} />
              <Route path="/liked" component={LikedSongsPage} />
              <Route path="/artist/:id" component={ArtistPage} />
              <Route path="/admin" component={AdminPage} />
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
