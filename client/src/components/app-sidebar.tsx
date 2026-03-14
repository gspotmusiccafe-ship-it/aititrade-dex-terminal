import { Home, Search, Library, Plus, Heart, Music2, Upload, Crown, User, Settings, LogOut, Shield, Radio, Trophy } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/AITIFY_MUSIC_RADIO_LOGO_IMAGE_1773164873830.png";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

const mainNavItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Search", url: "/search", icon: Search },
  { title: "Library", url: "/library", icon: Library },
];

const yourMusicItems = [
  { title: "Liked Songs", url: "/liked", icon: Heart },
  { title: "Create Playlist", url: "/library", icon: Plus },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: membership } = useQuery<{ tier: string } | null>({
    queryKey: ["/api/user/membership"],
    enabled: isAuthenticated,
  });

  const { data: artistProfile } = useQuery<{ id: string } | null>({
    queryKey: ["/api/user/artist-profile"],
    enabled: isAuthenticated,
  });

  const planLabel = membership?.tier
    ? membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1) + " Plan"
    : "Free Plan";

  const roleLabel = adminCheck?.isAdmin
    ? "Admin"
    : artistProfile?.id
    ? "Artist"
    : "Fan";

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
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-30" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Your Music</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {yourMusicItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="opacity-30" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Explore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/membership"}>
                  <Link href="/membership" data-testid="nav-membership">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span>Get Premium</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/radio"}>
                  <Link href="/radio" data-testid="nav-radio">
                    <Radio className="h-5 w-5 text-[#1DB954]" />
                    <span>Radio</span>
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
                <SidebarMenuButton asChild isActive={location === "/artist-portal"}>
                  <Link href="/artist-portal" data-testid="nav-artist-portal">
                    <Upload className="h-5 w-5" />
                    <span>Artist Portal</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {adminCheck?.isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/admin"}>
                    <Link href="/admin" data-testid="nav-admin">
                      <Shield className="h-5 w-5 text-red-500" />
                      <span>Admin Portal</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 pb-28 md:pb-28">
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
              <p className="text-xs text-muted-foreground truncate">{roleLabel} · {planLabel}</p>
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
        ) : (
          <Button asChild className="w-full bg-[#1DB954] hover:bg-[#1DB954]/90 border-0 shadow-lg shadow-[#1DB954]/20 gap-1.5" data-testid="button-login-sidebar">
            <a href="/api/login">
              <SiSpotify className="h-4 w-4" />
              Sign In with Spotify
            </a>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
