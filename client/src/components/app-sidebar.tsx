import { Home, Search, Library, Plus, Heart, Music2, Upload, Crown, User, Settings, LogOut, Shield, Radio } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
  { title: "Create Playlist", url: "/playlist/new", icon: Plus },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  
  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-4">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer" data-testid="link-logo">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Music2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">AITIFY</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Music</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
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

        <SidebarSeparator />

        {/* Your Music */}
        <SidebarGroup>
          <SidebarGroupLabel>Your Music</SidebarGroupLabel>
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

        <SidebarSeparator />

        {/* Premium / Membership */}
        <SidebarGroup>
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
                    <span>Music Radio</span>
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

      <SidebarFooter className="p-4">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {user.firstName?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-user-name">
                {user.firstName ? `${user.firstName} ${user.lastName || ""}` : user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">Free Plan</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button asChild className="w-full" data-testid="button-login-sidebar">
            <a href="/api/login">
              <User className="h-4 w-4 mr-2" />
              Sign In
            </a>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
