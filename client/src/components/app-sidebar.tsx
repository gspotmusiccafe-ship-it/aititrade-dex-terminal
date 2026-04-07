import { useState } from "react";
import { Home, Search, Library, Plus, Heart, Music2, Crown, User, Settings, LogOut, Shield, Radio, Trophy, KeyRound, Loader2, GraduationCap, Globe, ScrollText, BarChart3, Rocket, Upload, Lock, DollarSign, TrendingUp } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/a-bold-radio-station-logo-featuring-aiti_1n6BE9AnRHSDyOdG86KF_1775583562146.jpeg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated, spotifyConnected } = useAuth();
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const setPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("POST", "/api/auth/set-password", { password });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password set!", description: "You can now log in with your email and password on any device." });
      setShowSetPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to set password", variant: "destructive" });
    },
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: membership } = useQuery<{ tier: string; trustInvestor?: boolean } | null>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  const { data: artistProfile } = useQuery<{ id: string } | null>({
    queryKey: ["/api/user/artist-profile"],
    enabled: isAuthenticated,
  });

  const isTrustee = !!membership?.trustInvestor;
  const planLabel = isTrustee ? "Sovereign Trust" : "Trader";

  const roleLabel = adminCheck?.isAdmin
    ? "Admin"
    : artistProfile?.id
    ? "Asset Architect"
    : "Trader";

  return (
    <Sidebar className="border-r border-border/30">
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group" data-testid="link-logo">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-lg blur-md group-hover:bg-primary/30 transition-colors" />
              <img src={logoImage} alt="AITIFY Music Radio" className="w-10 h-10 rounded-lg object-cover relative" />
            </div>
            <div>
              <h1 className="font-black text-lg leading-tight tracking-tight bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">AITIFY</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Music Radio</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-emerald-400/60">Trading Floor</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"}>
                  <Link href="/" data-testid="nav-home">
                    <Home className="h-5 w-5" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/trader" || location.startsWith("/trader/")}>
                  <Link href="/trader" data-testid="nav-trader-portal">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    <span className="text-green-400 font-extrabold">Trader Portal</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/leaderboard"}>
                  <Link href="/leaderboard" data-testid="nav-leaderboard">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <span>Leaderboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/music-market"}>
                  <Link href="/music-market" data-testid="nav-music-market">
                    <TrendingUp className="h-5 w-5 text-lime-400" />
                    <span className="text-lime-400 font-extrabold">Music Market</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/investor-portals"}>
                  <Link href="/investor-portals" data-testid="nav-investor-portals">
                    <DollarSign className="h-5 w-5 text-emerald-400" />
                    <span className="text-emerald-400 font-extrabold">Investor Portals</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-30" />

        {(isTrustee || adminCheck?.isAdmin) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-amber-400/60 flex items-center gap-1">
              <Crown className="h-3 w-3" /> Sovereign Trust
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/radio"}>
                    <Link href="/radio" data-testid="nav-radio">
                      <Radio className="h-5 w-5 text-[#1DB954]" />
                      <span>Global Trades</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/trust-vault"}>
                    <Link href="/trust-vault" data-testid="nav-trust-vault">
                      <Globe className="h-5 w-5 text-amber-400" />
                      <span className="text-amber-400 font-extrabold">Trust Vault</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/dashboard"}>
                    <Link href="/dashboard" data-testid="nav-dashboard">
                      <GraduationCap className="h-5 w-5 text-lime-400" />
                      <span className="text-lime-400 font-bold">CEO Class</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard?cert=1" data-testid="nav-trust-certificate">
                      <ScrollText className="h-5 w-5 text-amber-400" />
                      <span className="text-amber-400 font-bold">Trust Certificate</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/search"}>
                    <Link href="/search" data-testid="nav-search">
                      <Search className="h-5 w-5" />
                      <span>Search</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/library"}>
                    <Link href="/library" data-testid="nav-library">
                      <Library className="h-5 w-5" />
                      <span>Library</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/liked"}>
                    <Link href="/liked" data-testid="nav-liked-songs">
                      <Heart className="h-5 w-5" />
                      <span>Liked Songs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isTrustee && !adminCheck?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-amber-400/60 flex items-center gap-1">
              <Crown className="h-3 w-3" /> Upgrade
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/membership"}>
                    <Link href="/membership" data-testid="nav-membership">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      <span>Get Sovereign Trust</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarSeparator className="opacity-30" />

        {adminCheck?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-red-400/60">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" data-testid="nav-admin">
                      <Shield className="h-5 w-5 text-red-500" />
                      <span>Admin Portal</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/artist-portal"}>
                    <Link href="/artist-portal" data-testid="nav-mint-factory">
                      <Upload className="h-5 w-5 text-lime-400" />
                      <span className="text-lime-400 font-extrabold">Mint Factory</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/production"}>
                    <Link href="/production" data-testid="nav-production">
                      <Rocket className="h-5 w-5 text-orange-500" />
                      <span className="text-orange-400 font-bold">Production Center</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 pb-4 space-y-2 flex-shrink-0">
        {isAuthenticated && user && !user.hasPassword && (
          <>
            {!showSetPassword ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-yellow-500/30 hover:bg-yellow-500/10 text-yellow-500"
                onClick={() => setShowSetPassword(true)}
                data-testid="button-show-set-password"
              >
                <KeyRound className="h-4 w-4" />
                Set Password for Mobile Login
              </Button>
            ) : (
              <div className="space-y-2 p-2 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground">Set a password to log in with email on any device</p>
                <Input
                  type="password"
                  placeholder="New password (6+ chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-new-password"
                />
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-8 text-xs"
                  data-testid="input-confirm-password"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    disabled={!newPassword || newPassword.length < 6 || newPassword !== confirmPassword || setPasswordMutation.isPending}
                    onClick={() => setPasswordMutation.mutate(newPassword)}
                    data-testid="button-set-password-submit"
                  >
                    {setPasswordMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set Password"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => { setShowSetPassword(false); setNewPassword(""); setConfirmPassword(""); }}
                    data-testid="button-cancel-set-password"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {isAuthenticated && user && !spotifyConnected && (
          <Button asChild variant="outline" size="sm" className="w-full gap-2 border-[#1DB954]/30 hover:bg-[#1DB954]/10 text-[#1DB954]" data-testid="button-connect-spotify">
            <a href="/api/login/spotify">
              <SiSpotify className="h-4 w-4" />
              Connect Spotify (Radio JAM)
            </a>
          </Button>
        )}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-gradient-to-r from-primary/5 to-transparent border border-border/30">
            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-bold">
                {user.firstName?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-user-name">
                {user.firstName ? `${user.firstName} ${user.lastName || ""}` : user.email}
              </p>
              <p className="text-xs truncate">
                <span className="text-muted-foreground">{roleLabel} · </span>
                {isTrustee ? (
                  <span className="text-amber-400 font-bold">{planLabel}</span>
                ) : (
                  <span className="text-emerald-400 font-bold">{planLabel}</span>
                )}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="flex-shrink-0 text-muted-foreground hover:text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span className="text-xs">Logout</span>
            </Button>
          </div>
        ) : null}
      </SidebarFooter>
      <div className="pb-44" />
    </Sidebar>
  );
}
