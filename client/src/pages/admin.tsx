import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { Shield, Users, Music, UserCheck, BarChart3, Trash2, Ban, CheckCircle, XCircle, Crown, DollarSign, Disc3, ListMusic, TrendingUp, Search, ExternalLink, Clock, Loader2, Hash, Radio, Download, Send, MessageSquare, Plus, FileText, Headphones, Wand2, Eye, Flame, Target, Pencil, RefreshCw, Link2, ShieldCheck, Trophy, Zap, Copy, Sparkles, Wifi, UserPlus, Lock, Unlock, ChevronUp, ChevronDown, Activity } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest, downloadFile } from "@/lib/queryClient";
import type { User, Artist, Membership, TrackWithArtist } from "@shared/schema";

interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalTracks: number;
  totalPlays: number;
  premiumMembers: number;
  goldMembers: number;
  totalAlbums: number;
  totalVideos: number;
  totalPlaylists: number;
  estimatedRevenue: number;
  topTracks: { title: string; artistName: string; playCount: number }[];
  topArtists: { name: string; monthlyListeners: number; trackCount: number }[];
}

function StatCard({ title, value, icon: Icon, description }: { title: string; value: number | string; icon: any; description?: string }) {
  return (
    <Card className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tight" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function AnalyticsDashboard() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={analytics?.totalUsers || 0} icon={Users} />
        <StatCard title="Total Artists" value={analytics?.totalArtists || 0} icon={UserCheck} />
        <StatCard title="Total Tracks" value={analytics?.totalTracks || 0} icon={Music} />
        <StatCard title="Total Plays" value={analytics?.totalPlays?.toLocaleString() || "0"} icon={TrendingUp} />
        <StatCard title="Paid Members" value={analytics?.premiumMembers || 0} icon={Crown} description="Silver/Bronze/Gold" />
        <StatCard title="Gold (Artist Pro)" value={analytics?.goldMembers || 0} icon={Crown} description="$49.99 join + $9.99/mo" />
        <StatCard title="Est. Monthly Revenue" value={`$${(analytics?.estimatedRevenue || 0).toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Total Playlists" value={analytics?.totalPlaylists || 0} icon={ListMusic} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/60 border-border/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-emerald-500 to-primary" />
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              Top Tracks
            </CardTitle>
            <CardDescription>Most played tracks on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.topTracks && analytics.topTracks.length > 0 ? (
              <div className="space-y-3">
                {analytics.topTracks.map((track, index) => {
                  const maxPlays = analytics.topTracks[0]?.playCount || 1;
                  const percentage = (track.playCount / maxPlays) * 100;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5">{index + 1}.</span>
                          <span className="font-medium truncate">{track.title}</span>
                          <span className="text-muted-foreground text-xs truncate">by {track.artistName}</span>
                        </div>
                        <span className="text-muted-foreground ml-2 whitespace-nowrap">{track.playCount.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No track data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500/50 to-primary/50" />
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-400" />
              </div>
              Top Artists
            </CardTitle>
            <CardDescription>Most popular artists by monthly listeners</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.topArtists && analytics.topArtists.length > 0 ? (
              <div className="space-y-3">
                {analytics.topArtists.map((artist, index) => {
                  const maxListeners = analytics.topArtists[0]?.monthlyListeners || 1;
                  const percentage = (artist.monthlyListeners / maxListeners) * 100;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground w-5">{index + 1}.</span>
                          <span className="font-medium truncate">{artist.name}</span>
                          <span className="text-muted-foreground text-xs">{artist.trackCount} tracks</span>
                        </div>
                        <span className="text-muted-foreground ml-2 whitespace-nowrap">{artist.monthlyListeners.toLocaleString()} listeners</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No artist data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}/suspend`, { suspend });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const adminMutation = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}/admin`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setDeleteConfirm(null);
      toast({ title: "User deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete user", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {users?.map((user) => (
          <div key={user.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`user-row-${user.id}`}>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <Users className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate">
                  {user.firstName} {user.lastName}
                </span>
                {user.isAdmin && <Badge variant="secondary">Admin</Badge>}
                {user.isSuspended && <Badge variant="destructive">Suspended</Badge>}
              </div>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => suspendMutation.mutate({ id: user.id, suspend: !user.isSuspended })}
                disabled={suspendMutation.isPending}
                data-testid={`button-suspend-${user.id}`}
              >
                <Ban className="h-4 w-4 mr-1" />
                {user.isSuspended ? "Unsuspend" : "Suspend"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adminMutation.mutate({ id: user.id, isAdmin: !user.isAdmin })}
                disabled={adminMutation.isPending}
                data-testid={`button-admin-${user.id}`}
              >
                <Shield className="h-4 w-4 mr-1" />
                {user.isAdmin ? "Remove Admin" : "Make Admin"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirm(user)}
                data-testid={`button-delete-${user.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {users?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.firstName} {deleteConfirm?.lastName}? This action cannot be undone and will remove all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ArtistsTab() {
  const { toast } = useToast();
  const [rejectDialog, setRejectDialog] = useState<Artist | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Artist | null>(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBio, setCreateBio] = useState("");
  const [spotifyUrlDialog, setSpotifyUrlDialog] = useState<Artist | null>(null);
  const [spotifyUrlInput, setSpotifyUrlInput] = useState("");
  
  const { data: artists, isLoading } = useQuery<Artist[]>({
    queryKey: ["/api/admin/artists"],
  });

  const { data: pendingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/admin/artists/pending"],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const createArtistMutation = useMutation({
    mutationFn: async (data: { userId: string; name: string; bio: string }) => {
      return apiRequest("POST", "/api/admin/artists/create", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists/pending"] });
      setCreateDialog(false);
      setCreateUserId("");
      setCreateName("");
      setCreateBio("");
      toast({ title: "Artist profile created successfully" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || "Failed to create artist profile", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/admin/artists/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists/pending"] });
      toast({ title: "Artist approved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to approve artist", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("PATCH", `/api/admin/artists/${id}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists/pending"] });
      setRejectDialog(null);
      setRejectReason("");
      toast({ title: "Artist rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject artist", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/artists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setDeleteConfirm(null);
      toast({ title: "Artist deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete artist", variant: "destructive" });
    },
  });

  const spotifyUrlMutation = useMutation({
    mutationFn: async ({ id, url }: { id: string; url: string }) => {
      return apiRequest("PATCH", `/api/admin/artists/${id}/spotify-url`, { spotifyProfileUrl: url });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      setSpotifyUrlDialog(null);
      setSpotifyUrlInput("");
      toast({ title: "Spotify URL updated" });
    },
    onError: () => {
      toast({ title: "Failed to update Spotify URL", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {pendingArtists && pendingArtists.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-black mb-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-yellow-500" />
            </div>
            Pending Applications ({pendingArtists.length})
          </h3>
          <div className="space-y-2">
            {pendingArtists.map((artist) => (
              <div key={artist.id} className="flex items-center gap-4 p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg hover:border-yellow-500/50 transition-colors" data-testid={`pending-artist-${artist.id}`}>
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 flex items-center justify-center overflow-hidden">
                  {artist.profileImage ? (
                    <img src={artist.profileImage} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <Music className="h-6 w-6 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{artist.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{artist.bio || "No bio provided"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-600 hover:bg-green-600/10"
                    onClick={() => approveMutation.mutate(artist.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`button-approve-${artist.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-600 hover:bg-red-600/10"
                    onClick={() => setRejectDialog(artist)}
                    data-testid={`button-reject-${artist.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-black">All Artists</h3>
        <Button
          size="sm"
          className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20 text-white"
          onClick={() => setCreateDialog(true)}
          data-testid="button-create-artist"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Mentor
        </Button>
      </div>
      <div className="space-y-2">
        {artists?.map((artist) => (
          <div key={artist.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`artist-row-${artist.id}`}>
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center overflow-hidden">
              {artist.profileImage ? (
                <img src={artist.profileImage} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <Music className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate">{artist.name}</span>
                {artist.verified && <Badge className="bg-primary/20 text-primary">Verified</Badge>}
                <Badge variant={
                  artist.approvalStatus === "approved" ? "secondary" :
                  artist.approvalStatus === "rejected" ? "destructive" : "outline"
                }>
                  {artist.approvalStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {artist.monthlyListeners?.toLocaleString()} monthly listeners
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-[#1DB954] border-[#1DB954]/30 hover:bg-[#1DB954]/10"
                onClick={() => { setSpotifyUrlDialog(artist); setSpotifyUrlInput(artist.spotifyProfileUrl || ""); }}
                data-testid={`button-spotify-url-${artist.id}`}
              >
                <SiSpotify className="h-3.5 w-3.5" />
                {artist.spotifyProfileUrl ? "Edit" : "Set"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirm(artist)}
                data-testid={`button-delete-artist-${artist.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {artists?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No artists found</p>
          </div>
        )}
      </div>

      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Artist Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {rejectDialog?.name}'s application.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectDialog && rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}
              disabled={rejectMutation.isPending}
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.name}? This will remove all their tracks, albums, and videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!spotifyUrlDialog} onOpenChange={() => setSpotifyUrlDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Spotify Profile URL</DialogTitle>
            <DialogDescription>
              Set the Spotify profile URL for {spotifyUrlDialog?.name}. This enables the "Follow on Spotify" button on their artist page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Spotify Profile URL</Label>
            <Input
              placeholder="https://open.spotify.com/artist/..."
              value={spotifyUrlInput}
              onChange={(e) => setSpotifyUrlInput(e.target.value)}
              data-testid="input-spotify-profile-url"
            />
            <p className="text-xs text-muted-foreground">Paste the full Spotify artist page URL</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSpotifyUrlDialog(null)}>Cancel</Button>
            <Button
              className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-white border-0"
              onClick={() => spotifyUrlDialog && spotifyUrlMutation.mutate({ id: spotifyUrlDialog.id, url: spotifyUrlInput })}
              disabled={spotifyUrlMutation.isPending}
              data-testid="button-save-spotify-url"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialog} onOpenChange={() => setCreateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Mentor Profile</DialogTitle>
            <DialogDescription>
              Create a mentor profile for any user without requiring a Gold membership.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Select User</label>
              <Select value={createUserId} onValueChange={(val) => {
                setCreateUserId(val);
                const user = allUsers?.find(u => u.id === val);
                if (user && !createName) {
                  setCreateName(`${user.firstName || ""} ${user.lastName || ""}`.trim());
                }
              }}>
                <SelectTrigger data-testid="select-create-artist-user">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers?.filter(u => !artists?.some(a => a.userId === u.id)).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} ({user.email || user.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Artist Name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Artist or stage name"
                data-testid="input-create-artist-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Bio (optional)</label>
              <Textarea
                value={createBio}
                onChange={(e) => setCreateBio(e.target.value)}
                placeholder="Short bio..."
                data-testid="input-create-artist-bio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createArtistMutation.mutate({ userId: createUserId, name: createName, bio: createBio })}
              disabled={!createUserId || !createName || createArtistMutation.isPending}
              data-testid="button-submit-create-artist"
            >
              {createArtistMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Mentor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContentTab() {
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<TrackWithArtist | null>(null);
  
  const { data: tracks, isLoading } = useQuery<TrackWithArtist[]>({
    queryKey: ["/api/admin/tracks"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/tracks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setDeleteConfirm(null);
      toast({ title: "Track deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete track", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tracks?.map((track) => (
          <div key={track.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`track-row-${track.id}`}>
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center overflow-hidden">
              {track.coverImage ? (
                <img src={track.coverImage} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <Music className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate">{track.title}</span>
                {track.isPrerelease && <Badge className="bg-yellow-500/20 text-yellow-600">Pre-release</Badge>}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {track.artist?.name} • {track.playCount?.toLocaleString()} plays
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/tracks/${track.id}/download`, { credentials: "include" });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ message: "Download failed" }));
                      toast({ title: "Download unavailable", description: err.message, variant: "destructive" });
                      return;
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${track.title}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: "Download started" });
                  } catch {
                    toast({ title: "Download failed", variant: "destructive" });
                  }
                }}
                data-testid={`button-download-track-${track.id}`}
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteConfirm(track)}
                data-testid={`button-delete-track-${track.id}`}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        ))}
        {tracks?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tracks found</p>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Track</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteConfirm?.title}" by {deleteConfirm?.artist?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MembershipsTab() {
  const { data: memberships, isLoading } = useQuery<(Membership & { user?: User })[]>({
    queryKey: ["/api/admin/memberships"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {memberships?.map((membership) => (
        <div key={membership.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`membership-row-${membership.id}`}>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
            {membership.user?.profileImageUrl ? (
              <img src={membership.user.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <Users className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">
              {membership.user?.firstName} {membership.user?.lastName}
            </p>
            <p className="text-sm text-muted-foreground truncate">{membership.user?.email}</p>
          </div>
          <Badge variant={
            membership.tier === "mint_factory_ceo" ? "default" :
            membership.tier === "exchange_trader" ? "secondary" :
            membership.tier === "entry_trader" ? "secondary" : "outline"
          }>
            {membership.tier === "mint_factory_ceo" ? "Mint Factory CEO" :
             membership.tier === "exchange_trader" ? "Exchange Trader" :
             membership.tier === "entry_trader" ? "Entry Trader" : membership.tier}
          </Badge>
          <Badge variant={membership.isActive ? "default" : "destructive"}>
            {membership.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      ))}
      {memberships?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No memberships found</p>
        </div>
      )}
    </div>
  );
}

interface SpotifyTrackDetail {
  id: string;
  name: string;
  streamCount: number | null;
  duration: number;
  contentRating: string;
  trackNumber: number;
  releaseDate: string | null;
  coverArt: string | null;
  album: {
    id: string;
    name: string;
    type: string;
    releaseDate: string;
    cover?: { url: string }[];
  } | null;
  artists: { id: string; name: string }[];
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatStreamCount(count: number) {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(2)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function AdminLyricsTab() {
  const { toast } = useToast();
  const [viewReq, setViewReq] = useState<any>(null);
  const [notesDialogReq, setNotesDialogReq] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading, error: lyricsError } = useQuery<any[]>({
    queryKey: ["/api/admin/lyrics-requests"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      return apiRequest("PATCH", `/api/admin/lyrics-requests/${id}`, { status, adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/lyrics-requests"] });
      setNotesDialogReq(null);
      setAdminNotes("");
      toast({ title: "Lyrics request updated" });
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
      case "in_production": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">In Production</Badge>;
      case "completed": return <Badge variant="secondary" className="bg-green-500/20 text-green-600">Completed</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pendingCount = requests?.filter(r => r.status === "pending").length || 0;

  return (
    <>
      {pendingCount > 0 && (
        <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-yellow-500" />
            <p className="font-medium text-yellow-600">{pendingCount} pending lyrics submission{pendingCount > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {requests?.map((req) => (
          <div key={req.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`lyrics-request-${req.id}`}>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500/15 to-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">{req.title}</span>
                {statusBadge(req.status)}
              </div>
              {req.genre && <p className="text-sm text-muted-foreground">Genre: {req.genre}</p>}
              <p className="text-sm text-muted-foreground">Artist: {req.artistId}</p>
              {req.notes && <p className="text-sm text-muted-foreground truncate">Notes: {req.notes}</p>}
              {req.adminNotes && <p className="text-sm text-blue-400">Admin: {req.adminNotes}</p>}
              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewReq(req)}
                data-testid={`button-view-lyrics-${req.id}`}
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
              {req.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setNotesDialogReq(req); setAdminNotes(""); }}
                    data-testid={`button-notes-lyrics-${req.id}`}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Notes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-blue-600 text-white"
                    onClick={() => updateMutation.mutate({ id: req.id, status: "in_production" })}
                    data-testid={`button-produce-lyrics-${req.id}`}
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Start Production
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: req.id, status: "rejected" })}
                    data-testid={`button-reject-lyrics-${req.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
              {req.status === "in_production" && (
                <Button
                  size="sm"
                  className="bg-green-600 text-white"
                  onClick={() => updateMutation.mutate({ id: req.id, status: "completed" })}
                  data-testid={`button-complete-lyrics-${req.id}`}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
              )}
            </div>
          </div>
        ))}
        {lyricsError && (
          <div className="text-center py-8 text-destructive">
            <p className="font-medium">Failed to load lyrics requests</p>
            <p className="text-sm mt-1">{(lyricsError as Error).message}</p>
          </div>
        )}
        {!lyricsError && (!requests || requests.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No lyrics submissions</p>
          </div>
        )}
      </div>

      <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewReq?.title}</DialogTitle>
            <DialogDescription>
              {viewReq?.genre && `Genre: ${viewReq.genre} • `}
              Submitted {viewReq?.createdAt && new Date(viewReq.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Lyrics</h4>
              <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap font-mono text-sm max-h-[400px] overflow-y-auto">
                {viewReq?.lyrics}
              </div>
            </div>
            {viewReq?.notes && (
              <div>
                <h4 className="text-sm font-medium mb-1">Artist Notes</h4>
                <p className="text-sm text-muted-foreground">{viewReq.notes}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!notesDialogReq} onOpenChange={() => setNotesDialogReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Notes</DialogTitle>
            <DialogDescription>Add notes for &quot;{notesDialogReq?.title}&quot; before updating status.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Notes for the artist..."
            data-testid="input-admin-lyrics-notes"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesDialogReq(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 text-white"
              onClick={() => notesDialogReq && updateMutation.mutate({ id: notesDialogReq.id, status: "in_production", adminNotes })}
            >
              Start Production
            </Button>
            <Button
              variant="destructive"
              onClick={() => notesDialogReq && updateMutation.mutate({ id: notesDialogReq.id, status: "rejected", adminNotes })}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdminMasteringTab() {
  const { toast } = useToast();
  const [notesDialogReq, setNotesDialogReq] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/mastering-requests"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      return apiRequest("PATCH", `/api/admin/mastering-requests/${id}`, { status, adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mastering-requests"] });
      setNotesDialogReq(null);
      setAdminNotes("");
      toast({ title: "Mastering request updated" });
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (requestId: string) => {
      setProcessingId(requestId);
      return apiRequest("POST", `/api/admin/master-request/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mastering-requests"] });
      setProcessingId(null);
      toast({ title: "Mastering complete!", description: "Track has been mastered and is ready for download." });
    },
    onError: (error: Error) => {
      setProcessingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mastering-requests"] });
      toast({ title: "Mastering failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
      case "in_progress": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">In Progress</Badge>;
      case "completed": return <Badge variant="secondary" className="bg-green-500/20 text-green-600">Completed</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pendingCount = requests?.filter(r => r.status === "pending").length || 0;

  return (
    <>
      {pendingCount > 0 && (
        <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Headphones className="h-5 w-5 text-yellow-500" />
            <p className="font-medium text-yellow-600">{pendingCount} pending mastering request{pendingCount > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {requests?.map((req) => (
          <div key={req.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`mastering-request-${req.id}`}>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">Track: {req.trackId}</span>
                {statusBadge(req.status)}
              </div>
              <p className="text-sm text-muted-foreground">Artist: {req.artistId}</p>
              {req.notes && <p className="text-sm text-muted-foreground truncate">{req.notes}</p>}
              {req.adminNotes && <p className="text-sm text-blue-400">Admin: {req.adminNotes}</p>}
              {req.masteredUrl && (
                <button
                  onClick={() => downloadFile(`${req.masteredUrl}?download=true`, `mastered-${req.trackId}.wav`)}
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                  data-testid={`link-mastered-download-${req.id}`}
                >
                  <Download className="h-3 w-3" />
                  Download Mastered File
                </button>
              )}
              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {req.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setNotesDialogReq(req); setAdminNotes(""); }}
                    data-testid={`button-notes-mastering-${req.id}`}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Notes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground"
                    onClick={() => processMutation.mutate(req.id)}
                    disabled={processingId === req.id}
                    data-testid={`button-process-mastering-${req.id}`}
                  >
                    {processingId === req.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-1" />
                        Master Track
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: req.id, status: "rejected" })}
                    data-testid={`button-reject-mastering-${req.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
              {req.status === "in_progress" && (
                <>
                  {processingId === req.id ? (
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: req.id, status: "pending" })}
                      data-testid={`button-reset-mastering-${req.id}`}
                    >
                      Reset to Pending
                    </Button>
                  )}
                </>
              )}
              {req.status === "rejected" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: req.id, status: "pending" })}
                  data-testid={`button-retry-mastering-${req.id}`}
                >
                  Reset to Pending
                </Button>
              )}
              {req.status === "completed" && req.masteredUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(`${req.masteredUrl}?download=true`, `mastered-${req.trackId}.wav`)}
                  data-testid={`button-download-mastered-${req.id}`}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              )}
            </div>
          </div>
        ))}
        {(!requests || requests.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No mastering requests</p>
          </div>
        )}
      </div>

      <Dialog open={!!notesDialogReq} onOpenChange={() => setNotesDialogReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Notes</DialogTitle>
            <DialogDescription>Add notes for this mastering request before updating status.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Notes for the artist..."
            data-testid="input-admin-mastering-notes"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesDialogReq(null)}>Cancel</Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={() => {
                if (notesDialogReq) {
                  updateMutation.mutate({ id: notesDialogReq.id, status: "in_progress", adminNotes });
                }
              }}
            >
              Save Notes
            </Button>
            <Button
              variant="destructive"
              onClick={() => notesDialogReq && updateMutation.mutate({ id: notesDialogReq.id, status: "rejected", adminNotes })}
            >
              Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DistributionTab() {
  const { toast } = useToast();
  const [notesDialogReq, setNotesDialogReq] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/distribution-requests"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes?: string }) => {
      return apiRequest("PATCH", `/api/admin/distribution-requests/${id}`, { status, adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/distribution-requests"] });
      setNotesDialogReq(null);
      setAdminNotes("");
      toast({ title: "Distribution request updated" });
    },
    onError: () => {
      toast({ title: "Failed to update request", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-green-500/20 text-green-600">Approved</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-12 w-12 rounded" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const pendingCount = requests?.filter(r => r.status === "pending").length || 0;

  return (
    <>
      {pendingCount > 0 && (
        <Card className="mb-4 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Send className="h-5 w-5 text-yellow-500" />
            <p className="font-medium text-yellow-600">{pendingCount} pending distribution request{pendingCount > 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {requests?.map((req) => (
          <div key={req.id} className="flex items-center gap-4 p-4 rounded-lg bg-card/60 border border-border/30 hover:border-primary/20 transition-colors" data-testid={`distribution-request-${req.id}`}>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold">Artist: {req.userId}</span>
                {statusBadge(req.status)}
              </div>
              {req.trackId && <p className="text-sm text-muted-foreground">Track ID: {req.trackId}</p>}
              {req.message && <p className="text-sm text-muted-foreground">{req.message}</p>}
              {req.adminNotes && <p className="text-sm text-blue-400">Notes: {req.adminNotes}</p>}
              <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              {req.status === "pending" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setNotesDialogReq(req); setAdminNotes(""); }}
                    data-testid={`button-notes-${req.id}`}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Notes
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 text-white"
                    onClick={() => updateMutation.mutate({ id: req.id, status: "approved" })}
                    data-testid={`button-approve-distribution-${req.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => updateMutation.mutate({ id: req.id, status: "rejected" })}
                    data-testid={`button-reject-distribution-${req.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {(!requests || requests.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No distribution requests</p>
          </div>
        )}
      </div>

      <Dialog open={!!notesDialogReq} onOpenChange={() => setNotesDialogReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Notes</DialogTitle>
            <DialogDescription>Add notes to this distribution request before approving or rejecting.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Notes for the artist..."
            data-testid="input-admin-notes"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesDialogReq(null)}>Cancel</Button>
            <Button
              className="bg-green-600 text-white"
              onClick={() => notesDialogReq && updateMutation.mutate({ id: notesDialogReq.id, status: "approved", adminNotes })}
            >
              Approve with Notes
            </Button>
            <Button
              variant="destructive"
              onClick={() => notesDialogReq && updateMutation.mutate({ id: notesDialogReq.id, status: "rejected", adminNotes })}
            >
              Reject with Notes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RadioPlaylistTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: allTracks, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/tracks"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: radioTracks } = useQuery<any[]>({
    queryKey: ["/api/admin/radio-playlist"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ trackId, isFeatured }: { trackId: string; isFeatured: boolean }) => {
      return apiRequest("PATCH", `/api/admin/tracks/${trackId}/featured`, { isFeatured });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio-playlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const filteredTracks = allTracks?.filter((t: any) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artist?.name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const radioCount = radioTracks?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/15 to-red-500/10 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            97.7 THE FLAME - Radio Playlist
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Select which tracks play on the radio. Toggle tracks on/off — no limit on how many you can add.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm" data-testid="badge-radio-count">
          {radioCount} track{radioCount !== 1 ? "s" : ""} on air
        </Badge>
      </div>

      {radioCount > 0 && (
        <Card className="bg-card/60 border-border/30 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Currently On Air ({radioCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {radioTracks?.map((track: any, index: number) => (
              <div
                key={track.id}
                className="flex items-center gap-3 p-2 rounded-md bg-primary/5 hover:bg-primary/10"
                data-testid={`radio-track-${track.id}`}
              >
                <span className="text-sm text-muted-foreground w-6 text-center">{index + 1}</span>
                <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                  {track.coverImage ? (
                    <img src={track.coverImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                      <Music className="h-3 w-3 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist?.name}</p>
                </div>
                <span className="text-xs text-muted-foreground">{track.playCount?.toLocaleString() || 0} plays</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => toggleMutation.mutate({ trackId: track.id, isFeatured: false })}
                  disabled={toggleMutation.isPending}
                  data-testid={`button-remove-radio-${track.id}`}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Tracks</CardTitle>
          <CardDescription>Toggle tracks to add or remove them from the radio playlist</CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tracks or artists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-radio-tracks"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : filteredTracks.length > 0 ? (
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredTracks.map((track: any) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer ${
                    track.isFeatured ? "bg-primary/5 border border-primary/20" : ""
                  }`}
                  onClick={() => toggleMutation.mutate({ trackId: track.id, isFeatured: !track.isFeatured })}
                  data-testid={`track-toggle-${track.id}`}
                >
                  <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${
                    track.isFeatured ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}>
                    {track.isFeatured && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                    {track.coverImage ? (
                      <img src={track.coverImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                        <Music className="h-3 w-3 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist?.name}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{track.genre || "—"}</span>
                  <span className="text-xs text-muted-foreground">{track.playCount?.toLocaleString() || 0} plays</span>
                  {track.isFeatured && (
                    <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-xs">
                      <Flame className="h-3 w-3 mr-0.5" />
                      On Air
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tracks found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GlobalRotationTab() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    ticker: "",
    title: "",
    type: "playlist",
    spotifyUri: "",
    spotifyUrl: "",
    audioUrl: "",
    coverImage: "",
    artistName: "",
    assetClass: "global",
  });

  const { data: items, isLoading } = useQuery<any[]>({
    queryKey: ["/api/global-rotation"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/admin/global-rotation", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-rotation"] });
      toast({ title: "Asset added to rotation" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/global-rotation/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-rotation"] });
      toast({ title: "Rotation item updated" });
      resetForm();
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/global-rotation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-rotation"] });
      toast({ title: "Removed from rotation" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => apiRequest("POST", "/api/admin/global-rotation/reorder", { orderedIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/global-rotation"] });
    },
    onError: () => toast({ title: "Failed to reorder", variant: "destructive" }),
  });

  const moveItem = (index: number, direction: "up" | "down") => {
    if (!items) return;
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    const orderedIds = newItems.map((item: any) => item.id);
    reorderMutation.mutate(orderedIds);
  };

  const resetForm = () => {
    setForm({ ticker: "", title: "", type: "playlist", spotifyUri: "", spotifyUrl: "", audioUrl: "", coverImage: "", artistName: "", assetClass: "global" });
    setShowAdd(false);
    setEditingId(null);
  };

  const startEdit = (item: any) => {
    setForm({
      ticker: item.ticker || "",
      title: item.title || "",
      type: item.type || "playlist",
      spotifyUri: item.spotifyUri || "",
      spotifyUrl: item.spotifyUrl || "",
      audioUrl: item.audioUrl || "",
      coverImage: item.coverImage || "",
      artistName: item.artistName || "",
      assetClass: item.assetClass || "global",
    });
    setEditingId(item.id);
    setShowAdd(true);
  };

  const handleSubmit = () => {
    if (!form.ticker || !form.title) {
      toast({ title: "Ticker and Title are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const count = items?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-lime-500/15 flex items-center justify-center">
              <Disc3 className="h-4 w-4 text-lime-400" />
            </div>
            GLOBAL RADIO — Rotation Manager
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Self-load assets into the Global Radio DJ Console rotation. Add Spotify URIs, audio URLs, or cover art.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm bg-lime-500/10 text-lime-400" data-testid="badge-rotation-count">
            {count} asset{count !== 1 ? "s" : ""} in rotation
          </Badge>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="bg-lime-600 hover:bg-lime-700 text-black font-bold" data-testid="button-add-rotation">
            <Plus className="h-4 w-4 mr-1" />
            ADD ASSET
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card className="border-lime-500/30 bg-card/80">
          <div className="h-1 bg-gradient-to-r from-lime-500 via-emerald-500 to-lime-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black text-lime-400">
              {editingId ? "EDIT ROTATION ASSET" : "ADD NEW ROTATION ASSET"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold">TICKER *</Label>
                <Input
                  placeholder="e.g. AITF-01"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                  data-testid="input-rotation-ticker"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">TITLE *</Label>
                <Input
                  placeholder="e.g. THE LOVE"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-rotation-title"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold">ARTIST NAME</Label>
                <Input
                  placeholder="e.g. AI FLAME"
                  value={form.artistName}
                  onChange={(e) => setForm({ ...form, artistName: e.target.value })}
                  data-testid="input-rotation-artist"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">ASSET CLASS</Label>
                <Select value={form.assetClass} onValueChange={(v) => setForm({ ...form, assetClass: v })}>
                  <SelectTrigger data-testid="select-rotation-class">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="inspirational">Inspirational</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">SPOTIFY URI</Label>
              <Input
                placeholder="spotify:playlist:xxxxx or spotify:album:xxxxx"
                value={form.spotifyUri}
                onChange={(e) => setForm({ ...form, spotifyUri: e.target.value })}
                data-testid="input-rotation-spotify-uri"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Paste a Spotify URI to stream via Spotify Web Playback SDK</p>
            </div>
            <div>
              <Label className="text-xs font-bold">AUDIO URL (Direct)</Label>
              <Input
                placeholder="https://... .mp3 or cloud storage URL"
                value={form.audioUrl}
                onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
                data-testid="input-rotation-audio-url"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Direct audio file URL — plays without Spotify</p>
            </div>
            <div>
              <Label className="text-xs font-bold">COVER IMAGE URL</Label>
              <Input
                placeholder="https://... album art or cover image"
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                data-testid="input-rotation-cover"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={resetForm} data-testid="button-rotation-cancel">CANCEL</Button>
              <Button
                onClick={handleSubmit}
                disabled={addMutation.isPending || updateMutation.isPending}
                className="bg-lime-600 hover:bg-lime-700 text-black font-bold"
                data-testid="button-rotation-save"
              >
                {addMutation.isPending || updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                {editingId ? "UPDATE" : "ADD TO ROTATION"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : count > 0 ? (
        <Card className="bg-card/60 border-lime-500/20 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-lime-500 via-emerald-500 to-lime-500" />
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2 text-lime-400">
              <Disc3 className="h-4 w-4" />
              Current Rotation ({count})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {items?.map((item: any, index: number) => {
              const isFirst = index === 0;
              const isLast = index === (items?.length || 0) - 1;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-md bg-lime-500/5 hover:bg-lime-500/10 border border-lime-500/10 transition-colors"
                  data-testid={`rotation-item-${item.id}`}
                >
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <button
                      className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${isFirst ? "text-zinc-700 cursor-default" : "text-lime-400/60 hover:text-lime-400 hover:bg-lime-500/20"}`}
                      onClick={() => !isFirst && moveItem(index, "up")}
                      disabled={isFirst || reorderMutation.isPending}
                      data-testid={`button-rotation-up-${item.id}`}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-lime-400/60 font-mono font-bold leading-none w-5 text-center">{index + 1}</span>
                    <button
                      className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${isLast ? "text-zinc-700 cursor-default" : "text-lime-400/60 hover:text-lime-400 hover:bg-lime-500/20"}`}
                      onClick={() => !isLast && moveItem(index, "down")}
                      disabled={isLast || reorderMutation.isPending}
                      data-testid={`button-rotation-down-${item.id}`}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-black border border-lime-500/20">
                    {item.coverImage ? (
                      <img src={item.coverImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc3 className="h-4 w-4 text-lime-400/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{item.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-lime-400 font-mono font-bold">{item.ticker}</span>
                      {item.artistName && <span className="text-[10px] text-muted-foreground">— {item.artistName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.spotifyUri && (
                      <Badge variant="secondary" className="text-[9px] bg-green-500/10 text-green-400">
                        <SiSpotify className="h-2.5 w-2.5 mr-0.5" /> SPOTIFY
                      </Badge>
                    )}
                    {item.audioUrl && (
                      <Badge variant="secondary" className="text-[9px] bg-blue-500/10 text-blue-400">
                        AUDIO
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px]">{item.assetClass?.toUpperCase()}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(item)}
                    data-testid={`button-edit-rotation-${item.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-rotation-${item.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-lime-500/20">
          <CardContent className="py-12 text-center">
            <Disc3 className="h-12 w-12 mx-auto mb-3 text-lime-400/30" />
            <p className="text-lime-400/60 font-bold text-sm">NO ASSETS IN ROTATION</p>
            <p className="text-xs text-muted-foreground mt-1">Click "ADD ASSET" to load tracks into the Global Radio DJ Console</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RadioShowsTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingShow, setEditingShow] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", slot: "morning", spotifyPlaylistUrl: "", description: "", sortOrder: 0 });

  const { data: shows, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/radio-shows"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/admin/radio-shows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio-shows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/radio-shows"] });
      setShowDialog(false);
      resetForm();
      toast({ title: "Radio show created" });
    },
    onError: () => toast({ title: "Failed to create show", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => apiRequest("PATCH", `/api/admin/radio-shows/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio-shows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/radio-shows"] });
      setShowDialog(false);
      setEditingShow(null);
      resetForm();
      toast({ title: "Radio show updated" });
    },
    onError: () => toast({ title: "Failed to update show", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/radio-shows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio-shows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/radio-shows"] });
      toast({ title: "Radio show deleted" });
    },
    onError: () => toast({ title: "Failed to delete show", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/radio-shows/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/radio-shows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/radio-shows"] });
    },
  });

  const resetForm = () => setFormData({ name: "", slot: "morning", spotifyPlaylistUrl: "", description: "", sortOrder: 0 });

  const openEdit = (show: any) => {
    setEditingShow(show);
    setFormData({
      name: show.name,
      slot: show.slot,
      spotifyPlaylistUrl: show.spotifyPlaylistUrl,
      description: show.description || "",
      sortOrder: show.sortOrder || 0,
    });
    setShowDialog(true);
  };

  const openCreate = () => {
    setEditingShow(null);
    resetForm();
    setShowDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.slot || !formData.spotifyPlaylistUrl) return;
    if (editingShow) {
      updateMutation.mutate({ id: editingShow.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const slotLabels: Record<string, string> = {
    morning: "Morning Show (6 AM - 10 AM)",
    midday: "Mid-Day Vibes (10 AM - 2 PM)",
    afternoon: "Afternoon Drive (2 PM - 6 PM)",
    evening: "Evening Sessions (6 PM - 10 PM)",
    bedtime: "Bedtime Music (10 PM - 6 AM)",
  };

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1DB954]/15 to-[#1DB954]/5 flex items-center justify-center">
              <Radio className="h-4 w-4 text-[#1DB954]" />
            </div>
            Radio Shows
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Pre-load Spotify playlist URLs for each time slot</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" data-testid="button-add-radio-show">
          <Plus className="h-4 w-4" />
          Add Show
        </Button>
      </div>

      {shows && shows.length > 0 ? (
        <div className="space-y-3">
          {shows.map((show: any) => (
            <Card key={show.id} className={`bg-card/60 border-border/30 hover:border-[#1DB954]/20 transition-colors ${!show.isActive ? "opacity-50" : ""}`} data-testid={`admin-radio-show-${show.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1DB954]/15 to-[#1DB954]/5 flex items-center justify-center">
                    <Radio className="h-5 w-5 text-[#1DB954]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold">{show.name}</p>
                      <Badge variant="outline" className="text-xs">{slotLabels[show.slot]?.split(" (")[0] || show.slot}</Badge>
                      {!show.isActive && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">{show.spotifyPlaylistUrl}</p>
                    {show.description && <p className="text-xs text-muted-foreground mt-1">{show.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleMutation.mutate({ id: show.id, isActive: !show.isActive })}
                      data-testid={`button-toggle-show-${show.id}`}
                    >
                      {show.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(show)} data-testid={`button-edit-show-${show.id}`}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(show.id)}
                      data-testid={`button-delete-show-${show.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="font-medium mb-1">No Radio Shows</p>
            <p className="text-sm text-muted-foreground mb-4">Add Spotify playlist URLs for Morning, Mid-Day, Afternoon, Evening, and Bedtime shows</p>
            <Button onClick={openCreate} className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2">
              <Plus className="h-4 w-4" />
              Add First Show
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditingShow(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShow ? "Edit Radio Show" : "Add Radio Show"}</DialogTitle>
            <DialogDescription>
              {editingShow ? "Update the playlist URL or details" : "Pre-load a Spotify playlist for a time slot"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Show Name</Label>
              <Input
                placeholder="e.g., Morning Jazz, Evening R&B..."
                value={formData.name}
                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                data-testid="input-show-name"
              />
            </div>

            <div>
              <Label>Time Slot</Label>
              <Select value={formData.slot} onValueChange={(v) => setFormData(p => ({ ...p, slot: v }))}>
                <SelectTrigger data-testid="select-show-slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(slotLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Spotify Playlist URL</Label>
              <Input
                placeholder="https://open.spotify.com/playlist/..."
                value={formData.spotifyPlaylistUrl}
                onChange={(e) => setFormData(p => ({ ...p, spotifyPlaylistUrl: e.target.value }))}
                data-testid="input-show-url"
              />
              <p className="text-xs text-muted-foreground mt-1">Paste a Spotify playlist, album, or track URL</p>
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Describe this show..."
                value={formData.description}
                onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                rows={2}
                data-testid="input-show-description"
              />
            </div>

            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                data-testid="input-show-sort"
              />
              <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditingShow(null); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.spotifyPlaylistUrl || createMutation.isPending || updateMutation.isPending}
              className="bg-[#1DB954] hover:bg-[#1DB954]/90"
              data-testid="button-save-show"
            >
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingShow ? "Update Show" : "Add Show"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JamControlTab() {
  const { toast } = useToast();
  const SETTLEMENT_RATE = 0.00025;

  const [seats, setSeats] = useState([
    { slot: 1, label: "THE KING", userId: "", userName: "G. Smooth", role: "Leader", locked: true },
    { slot: 2, label: "THE QUEEN", userId: "", userName: "Jmarie", role: "Co-Leader", locked: true },
    { slot: 3, label: "LEASE SEAT", userId: "", userName: "", role: "Vacant", locked: false },
    { slot: 4, label: "LEASE SEAT", userId: "", userName: "", role: "Vacant", locked: false },
    { slot: 5, label: "LEASE SEAT", userId: "", userName: "", role: "Vacant", locked: false },
    { slot: 6, label: "LEASE SEAT", userId: "", userName: "", role: "Vacant", locked: false },
  ]);

  const { data: jamSessions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/jam-sessions"],
  });

  const { data: engagement } = useQuery<any>({
    queryKey: ["/api/jam-sessions/engagement/overview"],
  });

  const toggleSession = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/jam-sessions/${id}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      toast({ title: "Session toggled" });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jam-sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jam-sessions"] });
      toast({ title: "Session removed" });
    },
  });

  const updateSeatName = (slot: number, name: string) => {
    setSeats(prev => prev.map(s => s.slot === slot ? { ...s, userName: name, role: name ? "Leased" : "Vacant" } : s));
  };

  const totalStreams = engagement?.totalStreams || 0;
  const totalSessions = engagement?.totalSessions || 0;
  const estimatedSettlement = totalStreams * SETTLEMENT_RATE;
  const occupiedSeats = seats.filter(s => s.userName).length;

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <Wifi className="h-5 w-5 text-[#1DB954]" />
                JAM CONTROL CENTER
              </CardTitle>
              <CardDescription>Spotify Jam Session Leader Seats & Settlement Tracking</CardDescription>
            </div>
            <Badge className="bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40 font-mono">
              RATE: ${SETTLEMENT_RATE}/stream
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/40 rounded-lg p-3 border border-zinc-800 text-center">
              <p className="text-2xl font-black text-white">{occupiedSeats}/6</p>
              <p className="text-xs text-zinc-500 font-mono">SEATS FILLED</p>
            </div>
            <div className="bg-black/40 rounded-lg p-3 border border-zinc-800 text-center">
              <p className="text-2xl font-black text-[#1DB954]">{totalSessions}</p>
              <p className="text-xs text-zinc-500 font-mono">TOTAL SESSIONS</p>
            </div>
            <div className="bg-black/40 rounded-lg p-3 border border-zinc-800 text-center">
              <p className="text-2xl font-black text-white">{totalStreams.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 font-mono">TOTAL STREAMS</p>
            </div>
            <div className="bg-black/40 rounded-lg p-3 border border-[#1DB954]/30 text-center">
              <p className="text-2xl font-black text-[#1DB954]">${estimatedSettlement.toFixed(4)}</p>
              <p className="text-xs text-zinc-500 font-mono">EST. SETTLEMENT</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              LEADER SEAT CONFIGURATION
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {seats.map((seat) => (
                <div
                  key={seat.slot}
                  className={`rounded-lg p-4 border ${
                    seat.locked
                      ? seat.slot === 1
                        ? "bg-yellow-500/5 border-yellow-500/30"
                        : "bg-purple-500/5 border-purple-500/30"
                      : seat.userName
                        ? "bg-[#1DB954]/5 border-[#1DB954]/30"
                        : "bg-black/40 border-zinc-800 border-dashed"
                  }`}
                  data-testid={`jam-seat-${seat.slot}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-600">SLOT {seat.slot}</span>
                      <Badge className={`text-[10px] ${
                        seat.locked ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
                        seat.userName ? "bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/40" :
                        "bg-zinc-800 text-zinc-500 border-zinc-700"
                      }`}>
                        {seat.role}
                      </Badge>
                    </div>
                    {seat.locked ? (
                      <Lock className="h-3.5 w-3.5 text-yellow-500" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 text-zinc-600" />
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600 mb-1">{seat.label}</p>
                  {seat.locked ? (
                    <p className="text-sm font-bold text-white">{seat.userName}</p>
                  ) : (
                    <Input
                      value={seat.userName}
                      onChange={(e) => updateSeatName(seat.slot, e.target.value)}
                      placeholder="Assign listener..."
                      className="h-7 text-xs bg-black/60 border-zinc-700"
                      data-testid={`input-seat-name-${seat.slot}`}
                    />
                  )}
                  {seat.userName && !seat.locked && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-zinc-500 font-mono">POTENTIAL INCOME</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] text-red-400 hover:text-red-300"
                        onClick={() => updateSeatName(seat.slot, "")}
                        data-testid={`button-remove-seat-${seat.slot}`}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <SiSpotify className="h-4 w-4 text-[#1DB954]" />
              ACTIVE JAM SESSIONS
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !jamSessions?.length ? (
              <div className="bg-black/40 rounded-lg p-6 border border-zinc-800 text-center">
                <Wifi className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No Jam Sessions configured</p>
                <p className="text-xs text-zinc-600 mt-1">Create sessions from the Spotify tab to start streaming</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jamSessions.map((session: any) => (
                  <div key={session.id} className="bg-black/40 rounded-lg p-3 border border-zinc-800 flex items-center justify-between" data-testid={`jam-session-${session.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${session.isActive ? "bg-[#1DB954] animate-pulse" : "bg-zinc-600"}`} />
                      <div>
                        <p className="text-sm font-bold text-white">{session.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{session.spotifyName || session.spotifyUri}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${session.isActive ? "bg-[#1DB954]/20 text-[#1DB954]" : "bg-zinc-800 text-zinc-500"}`}>
                        {session.isActive ? "LIVE" : "PAUSED"}
                      </Badge>
                      <span className="text-[10px] text-zinc-600 font-mono">{session.scheduledTime}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => toggleSession.mutate(session.id)}
                        data-testid={`button-toggle-jam-${session.id}`}
                      >
                        {session.isActive ? <Ban className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-red-400 hover:text-red-300"
                        onClick={() => deleteSession.mutate(session.id)}
                        data-testid={`button-delete-jam-${session.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-black/60 rounded-lg p-4 border border-emerald-500/20">
            <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              SETTLEMENT LEDGER
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
              <div className="bg-black/40 rounded p-3 border border-zinc-800">
                <span className="text-zinc-600">RATE PER STREAM</span>
                <p className="text-lg font-black text-white mt-1">${SETTLEMENT_RATE}</p>
              </div>
              <div className="bg-black/40 rounded p-3 border border-zinc-800">
                <span className="text-zinc-600">RATE PER SESSION</span>
                <p className="text-lg font-black text-white mt-1">${(SETTLEMENT_RATE * 10).toFixed(4)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">~10 streams/session avg</p>
              </div>
              <div className="bg-black/40 rounded p-3 border border-[#1DB954]/30">
                <span className="text-zinc-600">PROJECTED MONTHLY</span>
                <p className="text-lg font-black text-[#1DB954] mt-1">${(totalStreams * SETTLEMENT_RATE * 30).toFixed(2)}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Based on current daily avg</p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

function NativeOrderTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: nativeTracks, isLoading } = useQuery<any[]>({ queryKey: ["/api/tracks/featured"] });
  const [localOrder, setLocalOrder] = useState<any[]>([]);

  useEffect(() => {
    if (nativeTracks) setLocalOrder([...nativeTracks]);
  }, [nativeTracks]);

  const moveTrack = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= localOrder.length) return;
    const updated = [...localOrder];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setLocalOrder(updated);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/native-tracks/reorder", {
        orderedIds: localOrder.map(t => t.id),
      }),
    onSuccess: () => {
      toast({ title: "DJ ORDER SAVED", description: "Native radio will now play in your order" });
      qc.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
    },
    onError: (err: Error) => toast({ title: "FAILED", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-center py-10 text-zinc-500">Loading tracks...</div>;

  return (
    <div className="space-y-4" data-testid="native-order-tab">
      <div className="bg-zinc-900/50 border border-orange-500/30 p-4">
        <h3 className="text-orange-400 font-black text-lg mb-1">97.7 THE FLAME — DJ ORDER</h3>
        <p className="text-zinc-500 text-xs mb-4">First track plays first. Use arrows to reorder. Save when done.</p>
        <div className="space-y-1">
          {localOrder.map((track, idx) => (
            <div key={track.id} className="flex items-center gap-2 bg-black border border-zinc-800 px-3 py-2" data-testid={`dj-track-${track.id}`}>
              <span className="text-orange-400 font-black text-sm w-8 text-center">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{track.title}</p>
                <p className="text-zinc-500 text-[10px] truncate">{track.artist?.name} — ${parseFloat(track.unitPrice || "1").toFixed(2)}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => moveTrack(idx, idx - 1)}
                  disabled={idx === 0}
                  className="text-zinc-500 hover:text-orange-400 disabled:opacity-20 p-1"
                  data-testid={`btn-move-up-${track.id}`}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => moveTrack(idx, idx + 1)}
                  disabled={idx === localOrder.length - 1}
                  className="text-zinc-500 hover:text-orange-400 disabled:opacity-20 p-1"
                  data-testid={`btn-move-down-${track.id}`}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="mt-4 w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-2.5 text-sm transition-colors disabled:opacity-50"
          data-testid="btn-save-dj-order"
        >
          {saveMutation.isPending ? "SAVING..." : "SAVE DJ ORDER"}
        </button>
      </div>
    </div>
  );
}

function KineticGovernorTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: kineticState, isLoading } = useQuery<{
    floorROI: number;
    houseMBBP: number;
    pulse: string;
    bias: string;
    validEntries: number[];
    settlementFund: number;
    grossIntake: number;
    timestamp: number;
  }>({
    queryKey: ["/api/kinetic/state"],
    refetchInterval: 5000,
  });

  const biasMutation = useMutation({
    mutationFn: (bias: string) => apiRequest("POST", "/api/kinetic/bias", { bias }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/kinetic/state"] });
      toast({ title: "KINETIC BIAS UPDATED" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;

  const isHigh = kineticState?.pulse === "HIGH";
  const currentBias = kineticState?.bias || "NATURAL";

  return (
    <div className="space-y-6">
      <Card className="border-emerald-500/20 bg-black/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            <Zap className="h-5 w-5" />
            KINETIC GOVERNOR
          </CardTitle>
          <CardDescription>Live pulse oscillator controlling floor ROI distribution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-emerald-500/20 p-4 text-center">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">FLOOR ROI</p>
              <p className={`text-2xl font-black ${isHigh ? "floor-high-pulse" : "text-amber-400"}`}>
                {kineticState ? (kineticState.floorROI * 100).toFixed(0) : "—"}%
              </p>
            </div>
            <div className="bg-zinc-900 border border-emerald-500/20 p-4 text-center">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">HOUSE MBBP</p>
              <p className="text-2xl font-black text-red-400">
                {kineticState ? (kineticState.houseMBBP * 100).toFixed(0) : "—"}%
              </p>
            </div>
            <div className="bg-zinc-900 border border-emerald-500/20 p-4 text-center">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">PULSE</p>
              <p className={`text-2xl font-black ${isHigh ? "text-emerald-400" : "text-zinc-400"}`}>
                {kineticState?.pulse || "—"}
              </p>
            </div>
            <div className="bg-zinc-900 border border-emerald-500/20 p-4 text-center">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">BIAS</p>
              <p className={`text-2xl font-black ${currentBias === "FLOOR_HEAVY" ? "text-emerald-400" : "text-zinc-400"}`}>
                {currentBias}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">SETTLEMENT FUND</p>
              <p className="text-xl font-black text-lime-400">${kineticState?.settlementFund?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4">
              <p className="text-[10px] text-zinc-500 font-bold mb-1">GROSS INTAKE</p>
              <p className="text-xl font-black text-white">${kineticState?.grossIntake?.toFixed(2) || "0.00"}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 font-bold mb-2">VALID ENTRY AMOUNTS</p>
            <div className="flex flex-wrap gap-2">
              {(kineticState?.validEntries || [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]).map(v => (
                <span key={v} className="bg-zinc-900 border border-emerald-500/20 text-emerald-400 px-3 py-1 text-xs font-bold">${v}</span>
              ))}
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 font-bold mb-3">ADMIN BIAS CONTROL</p>
            <div className="flex gap-3">
              <Button
                onClick={() => biasMutation.mutate("FLOOR_HEAVY")}
                disabled={biasMutation.isPending || currentBias === "FLOOR_HEAVY"}
                className={`flex-1 font-bold ${currentBias === "FLOOR_HEAVY" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-emerald-600 hover:text-white"}`}
                data-testid="button-bias-floor-heavy"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                FLOOR HEAVY (90/10)
              </Button>
              <Button
                onClick={() => biasMutation.mutate("NATURAL")}
                disabled={biasMutation.isPending || currentBias === "NATURAL"}
                className={`flex-1 font-bold ${currentBias === "NATURAL" ? "bg-amber-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-amber-600 hover:text-white"}`}
                data-testid="button-bias-natural"
              >
                NATURAL (90/50)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CeoVaultTab() {
  const { toast } = useToast();
  const [themeInput, setThemeInput] = useState("");
  const [blueprint, setBlueprint] = useState<any>(null);

  const generateBlueprint = (theme: string) => {
    const t = theme.trim() || "Untitled Dynomite";
    const ticker = `$${t.toUpperCase().replace(/\s+/g, '').slice(0, 10)}`;
    const lyricsTemplate = `[Intro: 10s Instrumental Snap]\n[Chorus: Explosive Energy]\n(Enter your 70-word firecracker here...)\n[Verse: High-Velocity Bars]\n[Bridge: Tension]\n[Outro: Sudden Cut-off/Fade]`;
    const assetId = `ATFY-${Math.random().toString(36).toUpperCase().substring(2, 7)}`;
    setBlueprint({
      theme: t,
      ticker,
      assetId,
      structure: "Intro (10s) > Chorus (20s) > Verse (25s) > Bridge (15s) > Outro (20s)",
      wordConstraint: 70,
      durationTarget: "90 Seconds",
      sunoTags: "Slow Jam, 75bpm, Deep Bass, Silk Vocals, Sudden Ending, High Velocity",
      distroTags: `R&B, Soul, High-Velocity, 90-Seconds, ${t}`,
      lyricsTemplate,
      lyricPrompt: `Write exactly 70 words. R&B/Soul. Theme: ${t}. Structure: [Intro][Chorus][Verse][Bridge][Outro]. High energy.`,
      sunoPrompt: `[Vocal: JOE VOICE PRESET] [Style: G. SMOOTH SIGNATURE]\n[Intro: Atmospheric, 4x4 Snap, 10s] [Chorus: Exploding energy, Soulful R&B, 20s] [Verse: Rapid fire, 70 words total, 25s] [Bridge: High tension, 15s] [Outro: Sudden Cut-off, 20s]. Theme: "${t}".\nTags: Slow Jam, 75bpm, Deep Bass, Silk Vocals, Sudden Ending, High Velocity.\nVocal Chain: Deep Silk, Smooth R&B Baritone, G. Smooth Signature Reverb.\nMix: Heavy Low-End, 4x4 Snap Timing, High-Velocity Compression.\nEnforce 90s R&B Swing | Frequency: 432Hz. [End: Sudden Impact]`,
      ideogramPrompt: `Album cover, 1:1 aspect ratio, cinematic dynomite firecracker wrapped in gold foil, "AITIFY" embossed on gold, luxury R&B aesthetic, 8k render, emerald neon smoke, hyper-realistic lighting. Theme: "${t}".`,
      youtubeTitle: `${t.toUpperCase()} | 97.7 THE FLAME | AITIFY DYNOMITE`,
      youtubeDescription: `\u{1F48E} ASSET CLASS: $MUSE (Musical Equity)\n\u{1F525} SERIES: DYNOMITE (90-Second High-Velocity)\n\u{1F194} ASSET ID: ${assetId}\n\nOfficial "Sonsation" release from the AITIFY Sovereign Mint.\nThis track is optimized for high-velocity trading and global streaming settlement.\n\n[OFFICIAL CHANNELS]\n97.7 THE FLAME: https://suno.com/@aitify\nEXCHANGE: https://aitify-music-stream.replit.app\n\n#Aitify #977TheFlame #SovereignMint #DynomiteSeries #AitiPay`,
    });
    toast({ title: `Blueprint generated: ${ticker}` });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  return (
    <div className="p-6 border-2 border-yellow-500/30 bg-black/40 rounded-xl space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-yellow-400 font-mono" data-testid="text-vault-title">SOVEREIGN TRUST VAULT</h2>
        <Badge className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50" data-testid="badge-institutional">INSTITUTIONAL ACCESS</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-zinc-800 hover:border-yellow-500/40 transition-all" data-testid="card-ceo-blueprint">
          <CardContent className="p-4">
            <h3 className="text-white font-bold">12-Module CEO Blueprint</h3>
            <p className="text-xs text-zinc-400 mt-1">Master the Mint Factory & Global Index</p>
            <Button className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold" data-testid="button-start-course">START COURSE</Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 hover:border-yellow-500/40 transition-all" data-testid="card-trust-certificate">
          <CardContent className="p-4 text-center">
            <div className="h-20 w-full bg-yellow-500/10 rounded flex items-center justify-center mb-2">
              <Trophy className="h-10 w-10 text-yellow-500" />
            </div>
            <h3 className="text-white font-bold">$500.00 Trust Certificate</h3>
            <Button variant="outline" className="w-full mt-2 border-yellow-500/30 text-yellow-400" data-testid="button-download-certificate">DOWNLOAD STAMPED PROOF</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-2 border-orange-500/30 hover:border-orange-500/50 transition-all" data-testid="card-production-room">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-400" />
            <h3 className="text-lg font-bold text-orange-400 font-mono">DYNOMITE PRODUCTION ROOM</h3>
          </div>
          <p className="text-xs text-zinc-400">Generate a complete production blueprint — Suno prompt, Ideogram cover art prompt, and YouTube description — for your next 90-second Dynomite drop.</p>

          <div className="flex gap-2">
            <Input
              placeholder="Enter theme / mood / concept..."
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              className="bg-black/60 border-zinc-700 text-white"
              data-testid="input-dynomite-theme"
              onKeyDown={(e) => e.key === "Enter" && generateBlueprint(themeInput)}
            />
            <Button
              onClick={() => generateBlueprint(themeInput)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold shrink-0"
              data-testid="button-generate-blueprint"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              GENERATE
            </Button>
          </div>

          {blueprint && (
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/40 font-mono">{blueprint.ticker}</Badge>
                <Badge className="bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono text-[10px]">{blueprint.assetId}</Badge>
                <span className="text-xs text-zinc-500">{blueprint.durationTarget} | {blueprint.wordConstraint} words max</span>
              </div>

              <div className="bg-black/60 rounded p-2 border border-emerald-500/20 text-xs font-mono flex items-center gap-3 mb-1">
                <span className="text-emerald-400 font-bold">G. SMOOTH SIGNATURE</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-400">Deep Silk Baritone</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-400">432Hz</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-400">90s R&B Swing</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-black/40 rounded p-2 border border-zinc-800">
                  <span className="text-zinc-600">STRUCTURE:</span>
                  <p className="text-zinc-400 mt-1">{blueprint.structure}</p>
                </div>
                <div className="bg-black/40 rounded p-2 border border-zinc-800">
                  <span className="text-zinc-600">SUNO TAGS:</span>
                  <p className="text-orange-400 mt-1">{blueprint.sunoTags}</p>
                </div>
                <div className="bg-black/40 rounded p-2 border border-zinc-800">
                  <span className="text-zinc-600">DISTRO TAGS:</span>
                  <p className="text-blue-400 mt-1">{blueprint.distroTags}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-black/40 rounded p-3 border border-yellow-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-yellow-400 font-mono">LYRICS TEMPLATE</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => copyToClipboard(blueprint.lyricsTemplate, "Lyrics template")} data-testid="button-copy-template">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="text-xs text-yellow-300/80 leading-relaxed whitespace-pre-wrap font-mono">{blueprint.lyricsTemplate}</pre>
                </div>

                <div className="bg-black/40 rounded p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-yellow-400 font-mono">LYRIC PROMPT</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => copyToClipboard(blueprint.lyricPrompt, "Lyric prompt")} data-testid="button-copy-lyric">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{blueprint.lyricPrompt}</p>
                </div>

                <div className="bg-black/40 rounded p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400 font-mono">SUNO PRODUCTION PROMPT</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => copyToClipboard(blueprint.sunoPrompt, "Suno prompt")} data-testid="button-copy-suno">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{blueprint.sunoPrompt}</p>
                </div>

                <div className="bg-black/40 rounded p-3 border border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-400 font-mono">IDEOGRAM COVER ART</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => copyToClipboard(blueprint.ideogramPrompt, "Ideogram prompt")} data-testid="button-copy-ideogram">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{blueprint.ideogramPrompt}</p>
                </div>

                <div className="bg-black/40 rounded p-3 border border-red-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-red-400 font-mono">YOUTUBE METADATA</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-zinc-500 hover:text-white" onClick={() => copyToClipboard(blueprint.youtubeDescription, "YouTube metadata")} data-testid="button-copy-youtube">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{blueprint.youtubeDescription}</pre>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpotifyRoyaltyTab() {
  const { toast } = useToast();
  const [urlInput, setUrlInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "needs-work" | "qualified">("all");

  const { data: royaltyTracks, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/spotify-royalty-tracks"],
  });

  const addMutation = useMutation({
    mutationFn: (spotifyUrl: string) => apiRequest("POST", "/api/admin/spotify-royalty-tracks", { spotifyUrl }),
    onSuccess: async (res) => {
      const track = await res.json();
      toast({ title: `Added: ${track.title}`, description: `${track.streamCount?.toLocaleString() || 0} streams loaded` });
      setUrlInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/spotify-royalty-tracks"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refreshOneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/spotify-royalty-tracks/${id}/refresh`),
    onSuccess: async (res) => {
      const track = await res.json();
      toast({ title: `Refreshed: ${track.title}`, description: `${track.streamCount?.toLocaleString()} streams` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/spotify-royalty-tracks"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const refreshAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/spotify-royalty-tracks/refresh-all"),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Refreshed ${data.updated} of ${data.total} tracks`, description: data.stopped ? data.message : `${data.errors} errors` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/spotify-royalty-tracks"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/spotify-royalty-tracks/${id}`),
    onSuccess: () => {
      toast({ title: "Track removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/spotify-royalty-tracks"] });
    },
  });

  const handleBulkAdd = async () => {
    const urls = urlInput.split("\n").map(u => u.trim()).filter(u => u.includes("spotify.com/track/"));
    if (urls.length === 0) return toast({ title: "No valid Spotify URLs found", variant: "destructive" });
    setAdding(true);
    let added = 0;
    let skipped = 0;
    for (const url of urls) {
      try {
        await apiRequest("POST", "/api/admin/spotify-royalty-tracks", { spotifyUrl: url });
        added++;
      } catch (e: any) {
        if (e.message?.includes("already")) skipped++;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    toast({ title: `Loaded ${added} tracks`, description: skipped > 0 ? `${skipped} already tracked` : undefined });
    setUrlInput("");
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/spotify-royalty-tracks"] });
  };

  const filtered = (royaltyTracks || []).filter((t: any) => {
    if (filterMode === "needs-work") return !t.isQualified;
    if (filterMode === "qualified") return t.isQualified;
    return true;
  });

  const totalTracks = royaltyTracks?.length || 0;
  const qualifiedCount = royaltyTracks?.filter((t: any) => t.isQualified).length || 0;
  const needsWorkCount = totalTracks - qualifiedCount;
  const totalStreams = royaltyTracks?.reduce((sum: number, t: any) => sum + (t.streamCount || 0), 0) || 0;
  const avgStreams = totalTracks > 0 ? Math.round(totalStreams / totalTracks) : 0;

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-royalty-title">Spotify Royalty Tracker</h3>
        <p className="text-sm text-muted-foreground">Track your songs on Spotify — paste URLs to load stream counts and monitor qualification toward 1,000 streams</p>
      </div>

      <Card className="bg-card/60 border-border/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Textarea
                placeholder={"Paste Spotify track URLs (one per line)\nhttps://open.spotify.com/track/...\nhttps://open.spotify.com/track/..."}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                rows={4}
                className="font-mono text-sm"
                data-testid="input-spotify-urls"
              />
              <p className="text-xs text-muted-foreground mt-1">Paste one or multiple Spotify track URLs — stream data will be loaded automatically</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleBulkAdd}
                disabled={adding || !urlInput.trim()}
                data-testid="button-load-tracks"
              >
                {adding ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                Load Tracks
              </Button>
              {totalTracks > 0 && (
                <Button
                  variant="outline"
                  onClick={() => refreshAllMutation.mutate()}
                  disabled={refreshAllMutation.isPending}
                  data-testid="button-refresh-all-royalty"
                >
                  {refreshAllMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Refresh All
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black" data-testid="text-royalty-total">{totalTracks}</p>
            <p className="text-xs text-muted-foreground">Tracks on Spotify</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black text-green-500" data-testid="text-royalty-qualified">{qualifiedCount}</p>
            <p className="text-xs text-muted-foreground">Earning Royalties</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black text-yellow-500" data-testid="text-royalty-needs-work">{needsWorkCount}</p>
            <p className="text-xs text-muted-foreground">Need 1K Streams</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black" data-testid="text-royalty-total-streams">{totalStreams.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Streams</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black" data-testid="text-royalty-avg">{avgStreams.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Avg per Track</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant={filterMode === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("all")} data-testid="button-royalty-filter-all">
          All ({totalTracks})
        </Button>
        <Button variant={filterMode === "needs-work" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("needs-work")} data-testid="button-royalty-filter-needs-work">
          <Target className="h-3 w-3 mr-1" /> Needs 1K ({needsWorkCount})
        </Button>
        <Button variant={filterMode === "qualified" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("qualified")} data-testid="button-royalty-filter-qualified">
          <CheckCircle className="h-3 w-3 mr-1" /> Qualified ({qualifiedCount})
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((t: any) => {
          const progress = Math.min((t.streamCount / 1000) * 100, 100);
          const streamsNeeded = Math.max(0, 1000 - t.streamCount);

          return (
            <Card key={t.id} className={`bg-card/60 border-border/30 ${t.isQualified ? 'border-l-4 border-l-green-500' : streamsNeeded <= 200 ? 'border-l-4 border-l-yellow-500' : ''}`} data-testid={`card-royalty-${t.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {t.coverArt && (
                    <img src={t.coverArt} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                  )}
                  {!t.coverArt && (
                    <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate" data-testid={`text-royalty-track-${t.id}`}>{t.title}</h4>
                      {t.isQualified ? (
                        <Badge variant="default" className="bg-green-600 text-white shrink-0">
                          <CheckCircle className="h-3 w-3 mr-1" /> Earning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 shrink-0">
                          {streamsNeeded.toLocaleString()} to go
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{t.artistName}{t.albumName ? ` • ${t.albumName}` : ""}{t.releaseDate ? ` • ${t.releaseDate}` : ""}</p>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${t.isQualified ? 'bg-green-500' : progress >= 80 ? 'bg-yellow-500' : progress >= 50 ? 'bg-blue-500' : 'bg-primary'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono font-bold shrink-0" data-testid={`text-royalty-streams-${t.id}`}>
                        {t.streamCount.toLocaleString()} / 1,000
                      </span>
                    </div>

                    {t.lastFetchedAt && (
                      <p className="text-xs text-muted-foreground mt-1">Last updated: {new Date(t.lastFetchedAt).toLocaleString()}</p>
                    )}
                    {t.notes && <p className="text-xs text-blue-400 mt-1">{t.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refreshOneMutation.mutate(t.id)}
                      disabled={refreshOneMutation.isPending}
                      title="Refresh stream count"
                      data-testid={`button-refresh-royalty-${t.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshOneMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <a
                      href={t.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[#1DB954] hover:bg-muted"
                      title="Open on Spotify"
                      data-testid={`link-spotify-royalty-${t.id}`}
                    >
                      <SiSpotify className="h-4 w-4" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="text-destructive hover:text-destructive"
                      title="Remove from tracker"
                      data-testid={`button-delete-royalty-${t.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <SiSpotify className="h-12 w-12 mx-auto mb-4 opacity-50 text-[#1DB954]" />
            <p>{totalTracks === 0 ? "Paste Spotify track URLs above to start tracking your royalty qualification" : "No tracks match this filter"}</p>
          </div>
        )}
      </div>

      {royaltyTracks && royaltyTracks.length > 0 && needsWorkCount > 0 && (
        <Card className="bg-gradient-to-r from-[#1DB954]/10 to-green-600/10 border-[#1DB954]/30">
          <CardContent className="py-4">
            <h4 className="font-semibold text-[#1DB954] mb-2">Priority Boost Targets</h4>
            <p className="text-sm text-muted-foreground mb-3">These songs are closest to qualifying — use Jam Sessions to push them over 1,000:</p>
            <div className="space-y-2">
              {royaltyTracks
                .filter((t: any) => !t.isQualified)
                .sort((a: any, b: any) => b.streamCount - a.streamCount)
                .slice(0, 10)
                .map((t: any, i: number) => (
                  <div key={t.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-right font-mono text-muted-foreground">{i + 1}.</span>
                    {t.coverArt && <img src={t.coverArt} alt="" className="w-8 h-8 rounded object-cover" />}
                    <span className="truncate flex-1">{t.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${t.streamCount >= 800 ? 'bg-yellow-500' : 'bg-primary'}`} style={{ width: `${Math.min((t.streamCount / 1000) * 100, 100)}%` }} />
                      </div>
                      <span className="font-mono text-yellow-500 w-20 text-right">
                        {(1000 - t.streamCount).toLocaleString()} left
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StreamQualifierTab() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStreams, setEditStreams] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "needs-work" | "qualified">("all");

  const { data: qualifiers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/stream-qualifiers"],
  });

  const bulkAddMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/stream-qualifiers/bulk"),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Added ${data.added} tracks to tracker` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stream-qualifiers"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/admin/stream-qualifiers/${id}`, data),
    onSuccess: () => {
      toast({ title: "Stream count updated" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stream-qualifiers"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/stream-qualifiers/${id}`),
    onSuccess: () => {
      toast({ title: "Track removed from tracker" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stream-qualifiers"] });
    },
  });

  const filtered = (qualifiers || []).filter((q: any) => {
    if (filterMode === "needs-work") return !q.isQualified;
    if (filterMode === "qualified") return q.isQualified;
    return true;
  });

  const totalTracks = qualifiers?.length || 0;
  const qualifiedCount = qualifiers?.filter((q: any) => q.isQualified).length || 0;
  const needsWorkCount = totalTracks - qualifiedCount;
  const totalStreams = qualifiers?.reduce((sum: number, q: any) => sum + (q.spotifyStreamCount || 0), 0) || 0;

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-qualifier-title">Spotify 1K Stream Qualifier</h3>
          <p className="text-sm text-muted-foreground">Track which songs need 1,000 streams to qualify for royalties</p>
        </div>
        <Button
          onClick={() => bulkAddMutation.mutate()}
          disabled={bulkAddMutation.isPending}
          data-testid="button-bulk-add-qualifiers"
        >
          {bulkAddMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add All Tracks
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black" data-testid="text-total-tracked">{totalTracks}</p>
            <p className="text-xs text-muted-foreground">Total Tracked</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black text-green-500" data-testid="text-qualified-count">{qualifiedCount}</p>
            <p className="text-xs text-muted-foreground">Qualified (1K+)</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black text-yellow-500" data-testid="text-needs-work-count">{needsWorkCount}</p>
            <p className="text-xs text-muted-foreground">Needs Work</p>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-2xl font-black" data-testid="text-total-streams">{totalStreams.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Streams</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button variant={filterMode === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("all")} data-testid="button-filter-all">
          All ({totalTracks})
        </Button>
        <Button variant={filterMode === "needs-work" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("needs-work")} data-testid="button-filter-needs-work">
          <Target className="h-3 w-3 mr-1" /> Needs Work ({needsWorkCount})
        </Button>
        <Button variant={filterMode === "qualified" ? "default" : "outline"} size="sm" onClick={() => setFilterMode("qualified")} data-testid="button-filter-qualified">
          <CheckCircle className="h-3 w-3 mr-1" /> Qualified ({qualifiedCount})
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((q: any) => {
          const progress = Math.min((q.spotifyStreamCount / 1000) * 100, 100);
          const isEditing = editingId === q.id;
          const streamsNeeded = Math.max(0, 1000 - q.spotifyStreamCount);

          return (
            <Card key={q.id} className={`bg-card/60 border-border/30 ${q.isQualified ? 'border-l-4 border-l-green-500' : streamsNeeded <= 200 ? 'border-l-4 border-l-yellow-500' : ''}`} data-testid={`card-qualifier-${q.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {q.coverImage && (
                    <img src={q.coverImage} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate" data-testid={`text-qualifier-track-${q.id}`}>{q.trackTitle || "Unknown Track"}</h4>
                      {q.isQualified ? (
                        <Badge variant="default" className="bg-green-600 text-white shrink-0" data-testid={`badge-qualified-${q.id}`}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Qualified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 shrink-0" data-testid={`badge-needs-work-${q.id}`}>
                          <Target className="h-3 w-3 mr-1" /> {streamsNeeded} to go
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{q.artistName || "Unknown Artist"} • {q.trackGenre || "No genre"}</p>

                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${q.isQualified ? 'bg-green-500' : progress >= 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                          style={{ width: `${progress}%` }}
                          data-testid={`progress-bar-${q.id}`}
                        />
                      </div>
                      <span className="text-sm font-mono font-bold shrink-0" data-testid={`text-stream-count-${q.id}`}>
                        {q.spotifyStreamCount.toLocaleString()} / 1,000
                      </span>
                    </div>

                    {q.notes && <p className="text-xs text-muted-foreground mt-1">{q.notes}</p>}

                    {isEditing && (
                      <div className="mt-3 flex flex-col gap-2 p-3 bg-muted/50 rounded-lg">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Stream count"
                            value={editStreams}
                            onChange={(e) => setEditStreams(e.target.value)}
                            className="w-32"
                            data-testid={`input-edit-streams-${q.id}`}
                          />
                          <Input
                            placeholder="Notes (optional)"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="flex-1"
                            data-testid={`input-edit-notes-${q.id}`}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateMutation.mutate({
                              id: q.id,
                              spotifyStreamCount: parseInt(editStreams) || 0,
                              notes: editNotes || undefined,
                            })}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-streams-${q.id}`}
                          >
                            {updateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${q.id}`}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingId(q.id);
                          setEditStreams(String(q.spotifyStreamCount));
                          setEditNotes(q.notes || "");
                        }}
                        data-testid={`button-edit-qualifier-${q.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(q.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-qualifier-${q.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{totalTracks === 0 ? 'Click "Add All Tracks" to start tracking your songs' : "No tracks match this filter"}</p>
          </div>
        )}
      </div>

      {qualifiers && qualifiers.length > 0 && !qualifiers.every((q: any) => q.isQualified) && (
        <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
          <CardContent className="py-4">
            <h4 className="font-semibold text-yellow-500 mb-2">Focus Tracks</h4>
            <p className="text-sm text-muted-foreground mb-3">These tracks are closest to qualifying — concentrate promotion efforts here:</p>
            <div className="space-y-1">
              {qualifiers
                .filter((q: any) => !q.isQualified)
                .sort((a: any, b: any) => b.spotifyStreamCount - a.spotifyStreamCount)
                .slice(0, 5)
                .map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{q.trackTitle}</span>
                    <span className="font-mono text-yellow-500 shrink-0 ml-2">
                      {q.spotifyStreamCount} / 1,000 ({Math.round((q.spotifyStreamCount / 1000) * 100)}%)
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SpotifyLookupTab() {
  const { toast } = useToast();
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackIdInput, setTrackIdInput] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const extractTrackId = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];
    const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (uriMatch) return uriMatch[1];
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;
    return trimmed;
  };

  const lookupTrack = async (rawInput: string) => {
    const trackId = extractTrackId(rawInput);
    if (!trackId) return;
    setLoading(true);
    setSelectedTrack(null);
    try {
      const res = await fetch(`/api/admin/spotify/track/${encodeURIComponent(trackId)}`, { credentials: "include" });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Lookup failed (${res.status})`);
      }
      const data = await res.json();
      setSelectedTrack(data);
    } catch (err: any) {
      toast({ title: "Lookup failed", description: err?.message || "Could not reach Spotify API", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card/60 border-border/30 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#1DB954] to-[#1DB954]/50" />
        <CardHeader>
          <CardTitle className="font-black flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#1DB954]/15 to-[#1DB954]/5 flex items-center justify-center">
              <SiSpotify className="h-4 w-4 text-[#1DB954]" />
            </div>
            Spotify Stream Counter
          </CardTitle>
          <CardDescription>
            Enter a Spotify Track ID or URL to get stream counts, metadata, and track details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Spotify Track ID or URL</Label>
            <div className="flex gap-2 mt-1.5">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Track ID, URL, or URI (e.g., 2x8evxqUlF0eRabbW2JBJd)"
                  value={trackIdInput}
                  onChange={(e) => setTrackIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookupTrack(trackIdInput)}
                  className="pl-10"
                  data-testid="input-spotify-track-id"
                />
              </div>
              <Button onClick={() => lookupTrack(trackIdInput)} disabled={loading || !trackIdInput.trim()} data-testid="button-spotify-track-lookup">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Lookup</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Accepts: Track ID (2x8evxqUlF0eRabbW2JBJd), URL (https://open.spotify.com/track/...), or URI (spotify:track:...)
            </p>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#1DB954]" />
          <span className="ml-3 text-muted-foreground">Fetching track data...</span>
        </div>
      )}

      {selectedTrack && (
        <Card className="border-[#1DB954]/30 bg-[#1DB954]/5 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#1DB954] via-[#1DB954]/60 to-[#1DB954]" />
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <SiSpotify className="h-5 w-5 text-[#1DB954]" />
              Track Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                {selectedTrack.coverArt && (
                  <img src={selectedTrack.coverArt} alt={selectedTrack.name} className="w-32 h-32 rounded-lg object-cover" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Track Name</p>
                  <p className="text-xl font-bold" data-testid="text-spotify-track-name">{selectedTrack.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Artist(s)</p>
                  <p className="font-medium text-lg" data-testid="text-spotify-track-artists">
                    {selectedTrack.artists?.map((a) => a.name).join(", ") || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Spotify Track ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono" data-testid="text-spotify-track-id">{selectedTrack.id}</code>
                  </div>
                </div>
                <div>
                  <a
                    href={`https://open.spotify.com/track/${selectedTrack.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#1DB954] hover:underline font-medium"
                    data-testid="link-spotify-track-url"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open on Spotify
                  </a>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-lg bg-background/50 p-4 border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Streams</p>
                  <p className="text-3xl font-bold text-[#1DB954]" data-testid="text-spotify-stream-count">
                    {selectedTrack.streamCount != null && selectedTrack.streamCount >= 0
                      ? selectedTrack.streamCount.toLocaleString()
                      : "Not Available"}
                  </p>
                  {selectedTrack.streamCount != null && selectedTrack.streamCount > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">{formatStreamCount(selectedTrack.streamCount)} streams</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                  <p className="font-medium flex items-center gap-1" data-testid="text-spotify-duration">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {formatDuration(selectedTrack.duration)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Content Rating</p>
                  <Badge variant={selectedTrack.contentRating === "explicit" ? "destructive" : "secondary"} data-testid="badge-spotify-content-rating">
                    {selectedTrack.contentRating === "explicit" ? "Explicit" : "Clean"}
                  </Badge>
                </div>
                {selectedTrack.album && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Album</p>
                    <p className="font-medium" data-testid="text-spotify-album">{selectedTrack.album.name}</p>
                    {selectedTrack.album.releaseDate && (
                      <p className="text-xs text-muted-foreground">Released: {selectedTrack.album.releaseDate}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedTrack && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <SiSpotify className="h-12 w-12 mx-auto mb-4 text-[#1DB954]/30" />
          <p className="text-lg font-medium mb-1">Spotify Stream Counter</p>
          <p className="text-sm">Paste a Spotify Track ID, URL, or URI above to get stream counts and track details</p>
        </div>
      )}
    </div>
  );
}

function CreateArtistHeaderButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBio, setCreateBio] = useState("");

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const createArtistMutation = useMutation({
    mutationFn: async (data: { userId: string; name: string; bio: string }) => {
      return apiRequest("POST", "/api/admin/artists/create", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/artists/pending"] });
      setOpen(false);
      setCreateUserId("");
      setCreateName("");
      setCreateBio("");
      toast({ title: "Artist created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create artist", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        size="sm"
        className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20 text-white gap-1.5"
        onClick={() => setOpen(true)}
        data-testid="button-create-artist-header"
      >
        <Plus className="h-3.5 w-3.5" />
        Create Mentor
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Mentor Profile</DialogTitle>
            <DialogDescription>Create a mentor profile for a user (bypasses membership requirement)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Select User</Label>
              <Select value={createUserId} onValueChange={setCreateUserId}>
                <SelectTrigger data-testid="select-create-artist-user">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers?.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.username || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Artist Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Artist name"
                data-testid="input-create-artist-name"
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Input
                value={createBio}
                onChange={(e) => setCreateBio(e.target.value)}
                placeholder="Short bio (optional)"
                data-testid="input-create-artist-bio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createArtistMutation.mutate({ userId: createUserId, name: createName, bio: createBio })}
              disabled={!createUserId || !createName || createArtistMutation.isPending}
              data-testid="button-confirm-create-artist"
            >
              {createArtistMutation.isPending ? "Creating..." : "Create Mentor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PortalControlPanel() {
  const { data: portals, isLoading, refetch } = useQuery<{
    id: string;
    name: string;
    tbi: string;
    mbb: string;
    early: string;
    pool: number;
    sortOrder: number;
    isActive: boolean;
  }[]>({
    queryKey: ["/api/admin/portals"],
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ tbi: "", mbb: "", early: "", pool: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bulkMbb, setBulkMbb] = useState("");
  const [bulkEarly, setBulkEarly] = useState("");

  const startEdit = (p: NonNullable<typeof portals>[0]) => {
    setEditing(p.id);
    setForm({
      tbi: p.tbi,
      mbb: p.mbb,
      early: p.early,
      pool: p.pool.toString(),
      isActive: p.isActive,
    });
    setMsg(null);
  };

  const savePortal = async () => {
    if (!editing) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/portals/${editing}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tbi: parseFloat(form.tbi),
          mbb: parseFloat(form.mbb),
          early: parseFloat(form.early),
          pool: parseInt(form.pool),
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMsg(err.message || "Save failed");
      } else {
        setMsg("Saved. Market updated.");
        setEditing(null);
        refetch();
      }
    } catch {
      setMsg("Network error");
    } finally {
      setSaving(false);
    }
  };

  const updateAllPortals = async () => {
    if (!portals?.length) return;
    setBulkSaving(true);
    setMsg(null);
    try {
      const updates = portals.map((p) => ({
        id: p.id,
        ...(bulkMbb ? { mbb: parseFloat(bulkMbb) } : {}),
        ...(bulkEarly ? { early: parseFloat(bulkEarly) } : {}),
      }));
      const res = await fetch("/api/admin/portals/bulk-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portals: updates }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMsg(err.message || "Bulk update failed");
      } else {
        const data = await res.json();
        setMsg(`ALL ${data.updated} TERMINALS UPDATED. Market live.`);
        setBulkMbb("");
        setBulkEarly("");
        refetch();
      }
    } catch {
      setMsg("Network error");
    } finally {
      setBulkSaving(false);
    }
  };

  if (isLoading) return <div className="text-lime-500 animate-pulse font-mono p-6">LOADING PORTAL CONFIG...</div>;

  return (
    <div className="bg-black border border-zinc-800 p-6 font-mono" data-testid="portal-control-panel">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <h2 className="text-xl text-lime-400 font-bold tracking-tighter uppercase underline">
          Trade Portal Control
        </h2>
        <div className="text-[10px] text-zinc-500">ADMIN ONLY — CHANGES APPLY IMMEDIATELY</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-500 uppercase border-b border-zinc-800">
              <th className="text-left p-2">Portal</th>
              <th className="text-right p-2">TBI ($)</th>
              <th className="text-right p-2">MBB (x)</th>
              <th className="text-right p-2">BB Price ($)</th>
              <th className="text-right p-2">Early (x)</th>
              <th className="text-right p-2">Early Price ($)</th>
              <th className="text-right p-2">House Spread ($)</th>
              <th className="text-right p-2">Pool ($)</th>
              <th className="text-center p-2">Active</th>
              <th className="text-center p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {portals?.map((p) => {
              const tbi = parseFloat(p.tbi);
              const mbb = parseFloat(p.mbb);
              const early = parseFloat(p.early);
              const bbPrice = (tbi * mbb).toFixed(2);
              const earlyPrice = (tbi * early).toFixed(2);
              const houseSpread = ((tbi * mbb) - (tbi * early)).toFixed(2);
              const isEditing = editing === p.id;

              return (
                <tr key={p.id} className={`border-b border-zinc-900 ${isEditing ? "bg-zinc-950" : "hover:bg-zinc-950/50"}`} data-testid={`portal-row-${p.name}`}>
                  <td className="p-2 text-white font-bold">{p.name.replace(/_/g, " ")}</td>

                  {isEditing ? (
                    <>
                      <td className="p-2"><input type="number" step="0.01" className="bg-black border border-lime-700 text-lime-400 p-1 w-20 text-right" value={form.tbi} onChange={e => setForm({...form, tbi: e.target.value})} data-testid="input-edit-tbi" /></td>
                      <td className="p-2"><input type="number" step="0.01" className="bg-black border border-lime-700 text-lime-400 p-1 w-16 text-right" value={form.mbb} onChange={e => setForm({...form, mbb: e.target.value})} data-testid="input-edit-mbb" /></td>
                      <td className="p-2 text-zinc-400 text-right">${(parseFloat(form.tbi || "0") * parseFloat(form.mbb || "0")).toFixed(2)}</td>
                      <td className="p-2"><input type="number" step="0.01" className="bg-black border border-yellow-700 text-yellow-400 p-1 w-16 text-right" value={form.early} onChange={e => setForm({...form, early: e.target.value})} data-testid="input-edit-early" /></td>
                      <td className="p-2 text-yellow-500 text-right">${(parseFloat(form.tbi || "0") * parseFloat(form.early || "0")).toFixed(2)}</td>
                      <td className="p-2 text-lime-400 text-right font-bold">${((parseFloat(form.tbi || "0") * parseFloat(form.mbb || "0")) - (parseFloat(form.tbi || "0") * parseFloat(form.early || "0"))).toFixed(2)}</td>
                      <td className="p-2"><input type="number" step="100" className="bg-black border border-zinc-700 text-white p-1 w-20 text-right" value={form.pool} onChange={e => setForm({...form, pool: e.target.value})} data-testid="input-edit-pool" /></td>
                      <td className="p-2 text-center">
                        <button onClick={() => setForm({...form, isActive: !form.isActive})} className={`text-[10px] px-2 py-0.5 border ${form.isActive ? "border-lime-500 text-lime-400" : "border-red-500 text-red-400"}`} data-testid="button-toggle-active">
                          {form.isActive ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="p-2 text-center space-x-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); savePortal(); }}
                          disabled={saving}
                          className="relative z-10 cursor-pointer text-[10px] px-3 py-1 bg-lime-600 text-black font-bold hover:bg-lime-400 disabled:opacity-50 active:scale-95 transition-all"
                          data-testid="button-save-portal"
                        >
                          {saving ? "..." : "SAVE"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEditing(null); }}
                          className="relative z-10 cursor-pointer text-[10px] px-3 py-1 border border-red-700 text-red-400 hover:bg-red-700 hover:text-white active:scale-95 transition-all"
                          data-testid="button-cancel-edit"
                        >
                          X
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2 text-white text-right">${tbi.toFixed(2)}</td>
                      <td className="p-2 text-zinc-300 text-right">{mbb.toFixed(2)}x</td>
                      <td className="p-2 text-zinc-400 text-right">${bbPrice}</td>
                      <td className="p-2 text-yellow-500 text-right">{early.toFixed(2)}x</td>
                      <td className="p-2 text-yellow-500 text-right">${earlyPrice}</td>
                      <td className="p-2 text-lime-400 text-right font-bold">${houseSpread}</td>
                      <td className="p-2 text-white text-right">${p.pool.toLocaleString()}</td>
                      <td className="p-2 text-center">
                        <span className={`text-[10px] ${p.isActive ? "text-lime-400" : "text-red-400"}`}>{p.isActive ? "ON" : "OFF"}</span>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                          className="relative z-10 cursor-pointer text-[10px] px-3 py-1 border border-lime-700 text-lime-400 bg-lime-900/30 hover:bg-lime-700 hover:text-black font-bold active:scale-95 transition-all"
                          data-testid={`button-edit-${p.name}`}
                        >
                          EDIT
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {msg && <p className={`mt-3 text-[10px] ${msg.includes("UPDATED") || msg.includes("Saved") ? "text-lime-500" : "text-red-500"}`}>{msg}</p>}

      <div className="mt-6 p-4 border border-lime-700/30 bg-lime-950/10">
        <p className="text-lime-400 text-xs font-mono font-bold mb-3 uppercase">UPDATE ALL TERMINALS AT ONCE</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">NEW MBB (x) FOR ALL</label>
            <input type="number" step="0.01" value={bulkMbb} onChange={e => setBulkMbb(e.target.value)}
              placeholder="e.g. 3.50"
              className="bg-black border border-lime-700 text-lime-400 p-2 w-24 text-right text-xs font-mono"
              data-testid="input-bulk-mbb" />
          </div>
          <div>
            <label className="text-zinc-500 text-[9px] font-mono font-bold block mb-1">NEW EARLY (x) FOR ALL</label>
            <input type="number" step="0.01" value={bulkEarly} onChange={e => setBulkEarly(e.target.value)}
              placeholder="e.g. 2.00"
              className="bg-black border border-yellow-700 text-yellow-400 p-2 w-24 text-right text-xs font-mono"
              data-testid="input-bulk-early" />
          </div>
          <button type="button" onClick={updateAllPortals}
            disabled={bulkSaving || (!bulkMbb && !bulkEarly)}
            className="relative z-10 cursor-pointer bg-lime-600 hover:bg-lime-500 text-black font-mono font-black py-2 px-6 text-xs disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
            data-testid="button-update-all-terminals">
            {bulkSaving ? "UPDATING..." : "UPDATE ALL TERMINALS"}
          </button>
        </div>
        <p className="text-zinc-600 text-[9px] font-mono mt-2">Set a value in either field and hit UPDATE — applies to all 6 portals instantly.</p>
      </div>

      <div className="mt-4 text-[10px] text-zinc-600 italic">
        *TBI = Trade Buy-In threshold. MBB = Max Buy-Back multiplier. Early = Early Exit multiplier. Pool = Pool ceiling in USD.
      </div>
    </div>
  );
}

function GlobalLedger() {
  const { data: exits, isLoading } = useQuery<{
    id: string;
    trackingNumber: string;
    unitPrice: string;
    finalPayout: string;
    houseTake: string;
    portalName: string;
    createdAt: string;
  }[]>({
    queryKey: ["/api/admin/early-exit-ledger"],
    refetchInterval: 30000,
  });

  return (
    <div className="mt-6 border border-zinc-800 bg-black p-4 font-mono text-[11px]" data-testid="global-ledger">
      <h3 className="text-zinc-400 text-xs font-bold uppercase mb-3 tracking-wider">Early Exit Ledger</h3>
      <div className="grid grid-cols-5 text-zinc-500 uppercase border-b border-zinc-800 pb-2 mb-2">
        <span>Asset ID</span>
        <span>Buy-In (TBI)</span>
        <span>User Payout</span>
        <span className="text-lime-500">House Take</span>
        <span>Portal</span>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-zinc-600 py-4 text-center">Loading ledger...</div>
        ) : !exits?.length ? (
          <div className="text-zinc-600 py-4 text-center">No early exits recorded</div>
        ) : (
          exits.map((log) => (
            <div key={log.id} className="grid grid-cols-5 border-b border-zinc-900 py-1 hover:bg-zinc-950" data-testid={`ledger-row-${log.id}`}>
              <span className="text-zinc-400 truncate">{log.trackingNumber}</span>
              <span className="text-white">${log.unitPrice}</span>
              <span className="text-yellow-600">${log.finalPayout || "—"}</span>
              <span className="text-lime-400 font-bold">${log.houseTake || "—"}</span>
              <span className="text-zinc-500">{log.portalName || "—"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WithdrawalTool() {
  const [amt, setAmt] = useState("");
  const [destination, setDestination] = useState("$AITITRADEBROKERAGE");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; remaining?: number; error?: string } | null>(null);

  const executeWithdraw = async () => {
    const amount = parseFloat(amt);
    if (!amount || amount <= 0) return;
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/treasury-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, destination, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.message || "Withdrawal failed" });
      } else {
        setResult({ success: true, remaining: data.remaining });
        setAmt("");
        setNote("");
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 p-4 border border-red-900/50 bg-zinc-950 font-mono" data-testid="withdrawal-tool">
      <h3 className="text-red-500 text-xs font-bold uppercase mb-4 tracking-wider">Treasury Sweep Tool</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input
          type="number"
          placeholder="Amount"
          className="bg-black border border-zinc-800 text-white p-2 text-sm"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          data-testid="input-withdraw-amount"
          min="0.01"
          step="0.01"
        />
        <input
          type="text"
          placeholder="Destination"
          className="bg-black border border-zinc-800 text-white p-2 text-sm"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          data-testid="input-withdraw-destination"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          className="bg-black border border-zinc-800 text-zinc-400 p-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="input-withdraw-note"
        />
      </div>
      <button
        className="w-full bg-red-700 text-white py-2 font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        onClick={executeWithdraw}
        disabled={pending || !amt || parseFloat(amt) <= 0}
        data-testid="button-execute-withdrawal"
      >
        {pending ? "PROCESSING..." : "EXECUTE TRANSFER"}
      </button>
      {result?.success && (
        <p className="text-lime-500 text-[10px] mt-2">Transfer complete. Remaining: ${result.remaining?.toFixed(2)}</p>
      )}
      {result?.error && (
        <p className="text-red-500 text-[10px] mt-2">{result.error}</p>
      )}
      <p className="text-[9px] text-zinc-600 mt-2 italic">
        *This action will be logged in the Global Ledger for audit purposes.
      </p>
    </div>
  );
}

function SettlementGovernorTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading } = useQuery<{
    grossIntake: number;
    ksReached: number;
    totalOwed54: number;
    totalPaidOut: number;
    fundAvailable: number;
    payoutPerK: number;
    totalTraders: number;
    queuedCount: number;
    holdingCount: number;
    settledCount: number;
    currentCycle: number;
    cycleThreshold: number;
    nextKAt: number;
    ceo46Total: number;
    recentSettlements: any[];
    topQueue: any[];
  }>({
    queryKey: ["/api/settlement/status"],
    refetchInterval: 10000,
  });

  const runCycleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/settlement/run-cycle");
      if (!res.ok) throw new Error("Failed to run cycle");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Settlement Cycle Complete", description: `Cycle #${data.cycleNumber} — ${data.settled?.length || 0} settled, ${data.holding?.length || 0} holding` });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement/status"] });
    },
    onError: () => toast({ title: "Cycle Failed", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await apiRequest("POST", "/api/settlement/accept", { queueId });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Settlement Accepted", description: `$${data.payout?.toFixed(2)} paid at ${data.multiplier?.toFixed(2)}x` });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement/status"] });
    },
    onError: (err: any) => toast({ title: "Accept Failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-8 text-center text-zinc-500 font-mono">Loading Settlement Governor...</div>;
  if (!dashboard) return <div className="p-8 text-center text-zinc-500 font-mono">No settlement data</div>;

  const distToClose = Math.max(0, dashboard.nextKAt - dashboard.grossIntake);
  const cyclePct = Math.min(100, ((dashboard.grossIntake % 1000) / 1000) * 100);

  return (
    <div className="space-y-3 sm:space-y-4 font-mono">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-black text-emerald-400">SETTLEMENT GOVERNOR</h2>
          <p className="text-[8px] sm:text-[10px] text-zinc-500">KINETIC MANDATE — $1K = LIVE SPLIT PAYOUT</p>
        </div>
        <Button
          onClick={() => runCycleMutation.mutate()}
          disabled={runCycleMutation.isPending || dashboard.fundAvailable <= 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] sm:text-sm h-7 sm:h-9 px-2 sm:px-4"
          data-testid="button-run-settlement-cycle"
        >
          {runCycleMutation.isPending ? "RUNNING..." : "RUN CYCLE"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
        <div className="bg-zinc-900 border border-emerald-500/20 p-1.5 sm:p-3">
          <p className="text-[7px] sm:text-[9px] text-zinc-500 tracking-wider">GROSS</p>
          <p className="text-sm sm:text-lg text-emerald-400 font-black">${dashboard.grossIntake.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-500/20 p-1.5 sm:p-3">
          <p className="text-[7px] sm:text-[9px] text-zinc-500 tracking-wider">54% POOL</p>
          <p className="text-sm sm:text-lg text-lime-400 font-black">${dashboard.totalOwed54.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-500/20 p-1.5 sm:p-3">
          <p className="text-[7px] sm:text-[9px] text-zinc-500 tracking-wider">46% CEO</p>
          <p className="text-sm sm:text-lg text-amber-400 font-black">${dashboard.ceo46Total.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-500/20 p-1.5 sm:p-3">
          <p className="text-[7px] sm:text-[9px] text-zinc-500 tracking-wider">AVAILABLE</p>
          <p className={`text-sm sm:text-lg font-black ${dashboard.fundAvailable > 0 ? "text-emerald-400" : "text-zinc-500"}`}>${dashboard.fundAvailable.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <span className="text-[8px] sm:text-[10px] text-zinc-400 font-bold">TO NEXT PAYOUT</span>
          <span className={`text-xs sm:text-sm font-black ${distToClose <= 100 ? "text-red-400 animate-pulse" : distToClose <= 200 ? "text-amber-400" : "text-lime-400"}`}>
            ${distToClose.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </span>
        </div>
        <div className="w-full bg-zinc-800 h-3 sm:h-4 overflow-hidden border border-zinc-700">
          <div
            className={`h-full transition-all duration-500 ${distToClose <= 100 ? "bg-red-500 animate-pulse" : distToClose <= 200 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${cyclePct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5 sm:mt-1 text-[7px] sm:text-[9px] text-zinc-500 flex-wrap gap-x-2">
          <span>{dashboard.ksReached}K DONE</span>
          <span>NEXT @ ${dashboard.nextKAt.toLocaleString()}</span>
          <span>PAID: ${dashboard.totalPaidOut.toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        <div className="bg-zinc-900 border border-zinc-800 p-1.5 sm:p-2 text-center">
          <p className="text-[7px] sm:text-[9px] text-zinc-500">TRADERS</p>
          <p className="text-sm sm:text-lg text-white font-black">{dashboard.totalTraders}</p>
        </div>
        <div className="bg-zinc-900 border border-emerald-500/20 p-1.5 sm:p-2 text-center">
          <p className="text-[7px] sm:text-[9px] text-zinc-500">QUEUED</p>
          <p className="text-sm sm:text-lg text-emerald-400 font-black">{dashboard.queuedCount}</p>
        </div>
        <div className="bg-zinc-900 border border-amber-500/20 p-1.5 sm:p-2 text-center">
          <p className="text-[7px] sm:text-[9px] text-zinc-500">HOLD</p>
          <p className="text-sm sm:text-lg text-amber-400 font-black">{dashboard.holdingCount}</p>
        </div>
        <div className="bg-zinc-900 border border-lime-500/20 p-1.5 sm:p-2 text-center">
          <p className="text-[7px] sm:text-[9px] text-zinc-500">SETTLED</p>
          <p className="text-sm sm:text-lg text-lime-400 font-black">{dashboard.settledCount}</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800">
        <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-[8px] sm:text-[10px] text-emerald-400 font-extrabold tracking-wider">FIFO QUEUE</span>
          <span className="text-[8px] sm:text-[9px] text-zinc-500">{dashboard.topQueue?.length || 0} IN LINE</span>
        </div>
        {dashboard.topQueue && dashboard.topQueue.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {dashboard.topQueue.map((entry: any, idx: number) => {
              const pctGain = entry.buyIn > 0 ? (((entry.currentOffer - entry.buyIn) / entry.buyIn) * 100).toFixed(0) : "0";
              return (
                <div key={entry.queueId} className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-zinc-800/50 transition-colors" data-testid={`settlement-row-${entry.queueId}`}>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`text-xs sm:text-sm font-black flex-shrink-0 ${idx === 0 ? "text-emerald-400" : idx < 3 ? "text-lime-400" : "text-zinc-400"}`}>#{entry.queuePosition}</span>
                      <span className="text-[8px] sm:text-[10px] text-white font-bold truncate">{entry.userId.slice(0, 8)}..</span>
                      <span className={`text-[7px] sm:text-[8px] px-0.5 sm:px-1 py-0.5 border font-bold flex-shrink-0 ${
                        entry.status === "OFFERED" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                        entry.status === "HOLDING" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                        entry.status === "SETTLED" ? "text-lime-400 border-lime-500/30 bg-lime-500/10" :
                        "text-zinc-400 border-zinc-600 bg-zinc-800"
                      }`}>{entry.status}</span>
                    </div>
                    {entry.status !== "SETTLED" && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[7px] sm:text-[9px] font-bold h-6 sm:h-7 px-1.5 sm:px-2 flex-shrink-0"
                        onClick={() => acceptMutation.mutate(entry.queueId)}
                        disabled={acceptMutation.isPending}
                        data-testid={`button-settle-${entry.queueId}`}
                      >
                        ${entry.currentOffer.toFixed(0)}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
                    <span className="text-[7px] sm:text-[9px] text-zinc-500">IN:<span className="text-white font-bold">${entry.buyIn.toFixed(0)}</span></span>
                    <span className="text-[7px] sm:text-[9px] text-zinc-500">OFFER:<span className="text-emerald-400 font-bold">${entry.currentOffer.toFixed(0)} ({pctGain}%)</span></span>
                    <span className="text-[7px] sm:text-[9px] text-zinc-500">{entry.cyclesHeld}x held</span>
                    <span className="text-[7px] sm:text-[8px] text-zinc-600 hidden sm:inline">{entry.portalName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center text-zinc-500 text-xs sm:text-sm">
            <p>No traders in queue</p>
            <p className="text-[8px] sm:text-[10px] text-zinc-600 mt-1">Enqueued on position acquisition</p>
          </div>
        )}
      </div>

      {dashboard.recentSettlements && dashboard.recentSettlements.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800">
          <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-b border-zinc-800">
            <span className="text-[8px] sm:text-[10px] text-lime-400 font-extrabold tracking-wider">RECENT</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {dashboard.recentSettlements.map((s: any) => (
              <div key={s.queueId} className="px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2">
                <span className="text-[7px] sm:text-[9px] text-zinc-400 truncate">{s.userId.slice(0, 8)}..</span>
                <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                  <span className="text-[7px] sm:text-[9px] text-zinc-500">${s.buyIn.toFixed(0)}</span>
                  <span className="text-[7px] sm:text-[9px] text-lime-400 font-bold">${s.currentOffer.toFixed(0)}</span>
                  <span className="text-[7px] sm:text-[9px] text-emerald-400 font-bold">{s.currentMultiplier.toFixed(2)}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TreasuryDashboard() {
  const { data: stats, isLoading } = useQuery<{
    totalRevenue: number;
    activeVolume: number;
    earlyPayouts: number;
    settledCount: number;
    holdingCount: number;
  }>({
    queryKey: ["/api/admin/treasury-stats"],
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="text-lime-500 animate-pulse font-mono p-6">LOADING TREASURY DATA...</div>;

  return (
    <div className="bg-black border border-zinc-800 p-6 font-mono" data-testid="treasury-dashboard">
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4">
        <h2 className="text-xl text-lime-400 font-bold tracking-tighter uppercase underline">
          Sovereign House Treasury
        </h2>
        <div className="text-[10px] text-zinc-500 text-right">
          STATUS: SYSTEM ACTIVE<br />
          PORTALS: 700 / 1K / 2K / 3K / 5K
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-950 p-4 border-l-2 border-lime-500">
          <p className="text-zinc-500 text-xs uppercase mb-1">Total House Take</p>
          <p className="text-3xl text-white font-bold" data-testid="treasury-total-revenue">
            ${stats?.totalRevenue?.toLocaleString() || "0.00"}
          </p>
          <p className="text-[10px] text-lime-600 mt-2">↑ 150% Spread Retention Active</p>
        </div>

        <div className="bg-zinc-950 p-4 border-l-2 border-zinc-700">
          <p className="text-zinc-500 text-xs uppercase mb-1">Active Floor Volume</p>
          <p className="text-3xl text-zinc-300 font-bold" data-testid="treasury-active-volume">
            ${stats?.activeVolume?.toLocaleString() || "0.00"}
          </p>
          <p className="text-[10px] text-zinc-600 mt-2">Sum of all open TBIs</p>
        </div>

        <div className="bg-zinc-950 p-4 border-l-2 border-yellow-600">
          <p className="text-zinc-500 text-xs uppercase mb-1">Early Payouts Issued</p>
          <p className="text-3xl text-yellow-500 font-bold" data-testid="treasury-early-payouts">
            ${stats?.earlyPayouts?.toLocaleString() || "0.00"}
          </p>
          <p className="text-[10px] text-zinc-600 mt-2">Users paid first at lower offers</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-6">
        <div className="bg-zinc-950 p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs uppercase mb-1">Early Exits</p>
          <p className="text-2xl text-lime-400 font-bold" data-testid="treasury-settled-count">{stats?.settledCount || 0}</p>
          <p className="text-[10px] text-zinc-600 mt-1">Positions closed at early rate</p>
        </div>
        <div className="bg-zinc-950 p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs uppercase mb-1">Active Positions</p>
          <p className="text-2xl text-white font-bold" data-testid="treasury-holding-count">{stats?.holdingCount || 0}</p>
          <p className="text-[10px] text-zinc-600 mt-1">Holding for MBB settlement</p>
        </div>
      </div>

      <GlobalLedger />
      <WithdrawalTool />

      <div className="mt-8 text-[10px] text-zinc-700 italic">
        *No-loss architecture enabled. All settlements are final and calculated across the trading floor.
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: adminCheck, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  if (checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You don't have permission to access the Admin Portal.</p>
        </div>
      </div>
    );
  }

  function StreamEngagementTab() {
    const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/global-stream/stats"] });
    const { data: logs, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/global-stream/logs"] });

    const formatMs = (ms: number) => {
      const totalSec = Math.floor(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Global Stream Engagement</h3>
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.totalPlays}</p>
              <p className="text-xs text-muted-foreground">PLAYS</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.totalHeartbeats}</p>
              <p className="text-xs text-muted-foreground">HEARTBEATS</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{stats.totalSkips}</p>
              <p className="text-xs text-muted-foreground">SKIPS</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{formatMs(Number(stats.totalStreamTimeMs))}</p>
              <p className="text-xs text-muted-foreground">TOTAL STREAM TIME</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-lime-400">{stats.uniqueListeners}</p>
              <p className="text-xs text-muted-foreground">UNIQUE LISTENERS</p>
            </CardContent></Card>
          </div>
        )}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-bold">TIME</th>
                <th className="text-left p-2 font-bold">ACTION</th>
                <th className="text-left p-2 font-bold">TRACK</th>
                <th className="text-left p-2 font-bold">ARTIST</th>
                <th className="text-left p-2 font-bold">TICKER</th>
                <th className="text-left p-2 font-bold">DURATION</th>
                <th className="text-left p-2 font-bold">USER</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
              ) : logs && logs.length > 0 ? logs.map((log: any, i: number) => (
                <tr key={log.id || i} className="border-t border-muted/30 hover:bg-muted/20" data-testid={`stream-log-${i}`}>
                  <td className="p-2 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="p-2">
                    <Badge variant={log.action === "PLAY_START" ? "default" : log.action === "SKIP" ? "destructive" : "secondary"} className="text-[9px]">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="p-2 font-medium truncate max-w-[120px]">{log.trackName}</td>
                  <td className="p-2 text-muted-foreground truncate max-w-[100px]">{log.artistName || "—"}</td>
                  <td className="p-2 text-emerald-400 font-mono">{log.ticker || "—"}</td>
                  <td className="p-2">{log.streamDurationMs ? formatMs(log.streamDurationMs) : "—"}</td>
                  <td className="p-2 text-muted-foreground truncate max-w-[120px]">{log.userEmail || log.userId}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No stream logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function PlaybackSchedulerTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: "", hour: "8", minute: "0", spotifyUri: "", playlistTitle: "", daysOfWeek: "0,1,2,3,4,5,6" });

    const { data: schedules, isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/playback-schedules"] });
    const { data: rotationItems } = useQuery<any[]>({ queryKey: ["/api/global-rotation"] });

    const addMutation = useMutation({
      mutationFn: async (data: any) => apiRequest("POST", "/api/admin/playback-schedules", data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/playback-schedules"] });
        toast({ title: "Schedule added" });
        setShowAdd(false);
        setForm({ name: "", hour: "8", minute: "0", spotifyUri: "", playlistTitle: "", daysOfWeek: "0,1,2,3,4,5,6" });
      },
    });

    const toggleMutation = useMutation({
      mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
        apiRequest("PATCH", `/api/admin/playback-schedules/${id}`, { isActive }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/playback-schedules"] }),
    });

    const deleteMutation = useMutation({
      mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/playback-schedules/${id}`),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/playback-schedules"] });
        toast({ title: "Schedule removed" });
      },
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const toggleDay = (day: number) => {
      const current = form.daysOfWeek.split(",").map(Number);
      const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort();
      setForm({ ...form, daysOfWeek: next.join(",") });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Spotify Playback Timer</h3>
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" data-testid="button-add-schedule">
            <Plus className="h-4 w-4 mr-1" /> Add Schedule
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Set daily times to auto-start Spotify playback on the Global Trade Portal. Like IFTTT — every day at your set time, the portal fires up your playlist.</p>

        {showAdd && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block">NAME</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Morning Market Open" data-testid="input-schedule-name" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block">PLAYLIST TITLE</label>
                  <Input value={form.playlistTitle} onChange={(e) => setForm({ ...form, playlistTitle: e.target.value })} placeholder="Optional display name" data-testid="input-schedule-title" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold mb-1 block">HOUR (0-23)</label>
                  <Input type="number" min={0} max={23} value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })} data-testid="input-schedule-hour" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block">MINUTE (0-59)</label>
                  <Input type="number" min={0} max={59} value={form.minute} onChange={(e) => setForm({ ...form, minute: e.target.value })} data-testid="input-schedule-minute" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block">SPOTIFY URI</label>
                  <Input value={form.spotifyUri} onChange={(e) => setForm({ ...form, spotifyUri: e.target.value })} placeholder="spotify:playlist:..." data-testid="input-schedule-uri" />
                </div>
              </div>
              {rotationItems && rotationItems.length > 0 && (
                <div>
                  <label className="text-xs font-bold mb-1 block">OR SELECT FROM ROTATION</label>
                  <div className="flex flex-wrap gap-1">
                    {rotationItems.map((item: any) => (
                      <Button
                        key={item.id}
                        variant={form.spotifyUri === item.spotifyUri ? "default" : "outline"}
                        size="sm"
                        className="text-[10px] h-7"
                        onClick={() => setForm({ ...form, spotifyUri: item.spotifyUri || "", playlistTitle: item.title, name: form.name || item.title })}
                        data-testid={`select-rotation-${item.id}`}
                      >
                        {item.ticker}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold mb-1 block">DAYS</label>
                <div className="flex gap-1">
                  {dayNames.map((d, i) => (
                    <Button
                      key={i}
                      variant={form.daysOfWeek.split(",").map(Number).includes(i) ? "default" : "outline"}
                      size="sm"
                      className="text-[10px] h-7 px-2"
                      onClick={() => toggleDay(i)}
                      data-testid={`day-toggle-${i}`}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => addMutation.mutate({ name: form.name, hour: Number(form.hour), minute: Number(form.minute), spotifyUri: form.spotifyUri, playlistTitle: form.playlistTitle, daysOfWeek: form.daysOfWeek })}
                disabled={!form.name || !form.spotifyUri || addMutation.isPending}
                className="w-full"
                data-testid="button-save-schedule"
              >
                {addMutation.isPending ? "Saving..." : "SAVE SCHEDULE"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading schedules...</p>
          ) : schedules && schedules.length > 0 ? schedules.map((sched: any) => (
            <Card key={sched.id} className={`${sched.isActive ? "border-emerald-500/30" : "border-muted opacity-60"}`} data-testid={`schedule-card-${sched.id}`}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{sched.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Every {sched.daysOfWeek.split(",").map((d: string) => dayNames[Number(d)]).join(", ")} at {String(sched.hour).padStart(2, "0")}:{String(sched.minute).padStart(2, "0")}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-mono mt-1">{sched.spotifyUri}</p>
                  {sched.lastTriggered && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">Last triggered: {new Date(sched.lastTriggered).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ id: sched.id, isActive: !sched.isActive })}
                    data-testid={`toggle-schedule-${sched.id}`}
                  >
                    {sched.isActive ? "ACTIVE" : "OFF"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate(sched.id)}
                    data-testid={`delete-schedule-${sched.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <p className="text-muted-foreground text-sm text-center py-8">No schedules set. Add one to auto-start Spotify at a set time every day.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/3 to-transparent" />
        <div className="relative px-6 py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight" data-testid="text-admin-title">Admin Portal</h1>
                <p className="text-muted-foreground font-medium">Manage your platform</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <CreateArtistHeaderButton />
              <a href="https://suno.com/create/" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="link-suno">
                  <Music className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Suno</span> Production
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
              <a href="https://jumpstr.io" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="link-jumpstr">
                  <Disc3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Jumpstr</span> Distribution
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6">
        <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="overflow-x-auto -mx-6 px-6 pb-2">
            <TabsList className="inline-flex w-auto min-w-full gap-1 bg-card/60 border border-border/30">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="whitespace-nowrap">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users" className="whitespace-nowrap">
                <Users className="h-4 w-4 mr-1.5" />
                Users
              </TabsTrigger>
              <TabsTrigger value="artists" data-testid="tab-artists" className="whitespace-nowrap">
                <Music className="h-4 w-4 mr-1.5" />
                Artists
              </TabsTrigger>
              <TabsTrigger value="content" data-testid="tab-content" className="whitespace-nowrap">
                <Music className="h-4 w-4 mr-1.5" />
                Content
              </TabsTrigger>
              <TabsTrigger value="lyrics" data-testid="tab-lyrics" className="whitespace-nowrap">
                <FileText className="h-4 w-4 mr-1.5" />
                Lyrics
              </TabsTrigger>
              <TabsTrigger value="mastering" data-testid="tab-mastering" className="whitespace-nowrap">
                <Headphones className="h-4 w-4 mr-1.5" />
                Mastering
              </TabsTrigger>
              <TabsTrigger value="distribution" data-testid="tab-distribution" className="whitespace-nowrap">
                <Send className="h-4 w-4 mr-1.5" />
                Distribution
              </TabsTrigger>
              <TabsTrigger value="radio-playlist" data-testid="tab-radio-playlist" className="whitespace-nowrap">
                <Flame className="h-4 w-4 mr-1.5 text-orange-500" />
                97.7 FM
              </TabsTrigger>
              <TabsTrigger value="global-rotation" data-testid="tab-global-rotation" className="whitespace-nowrap data-[state=active]:bg-lime-500/10 data-[state=active]:text-lime-400">
                <Disc3 className="h-4 w-4 mr-1.5 text-lime-400" />
                Global Radio
              </TabsTrigger>
              <TabsTrigger value="radio-shows" data-testid="tab-radio-shows" className="whitespace-nowrap">
                <Radio className="h-4 w-4 mr-1.5" />
                Radio
              </TabsTrigger>
              <TabsTrigger value="memberships" data-testid="tab-memberships" className="whitespace-nowrap">
                <Crown className="h-4 w-4 mr-1.5" />
                Members
              </TabsTrigger>
              <TabsTrigger value="spotify" data-testid="tab-spotify" className="whitespace-nowrap">
                <SiSpotify className="h-4 w-4 mr-1.5 text-[#1DB954]" />
                Streams
              </TabsTrigger>
              <TabsTrigger value="qualifier" data-testid="tab-qualifier" className="whitespace-nowrap">
                <Target className="h-4 w-4 mr-1.5 text-yellow-500" />
                1K Qualifier
              </TabsTrigger>
              <TabsTrigger value="royalty" data-testid="tab-royalty" className="whitespace-nowrap">
                <DollarSign className="h-4 w-4 mr-1.5 text-[#1DB954]" />
                Royalty Tracker
              </TabsTrigger>
              <TabsTrigger value="jam-control" data-testid="tab-jam-control" className="whitespace-nowrap data-[state=active]:bg-[#1DB954]/10 data-[state=active]:text-[#1DB954]">
                <Wifi className="h-4 w-4 mr-1.5" />
                Global Trades
              </TabsTrigger>
              <TabsTrigger value="portals" data-testid="tab-portals" className="whitespace-nowrap data-[state=active]:bg-lime-500/10 data-[state=active]:text-lime-400">
                <Target className="h-4 w-4 mr-1.5 text-lime-400" />
                Portals
              </TabsTrigger>
              <TabsTrigger value="settlement" data-testid="tab-settlement" className="whitespace-nowrap data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                Settlement Governor
              </TabsTrigger>
              <TabsTrigger value="treasury" data-testid="tab-treasury" className="whitespace-nowrap data-[state=active]:bg-lime-500/10 data-[state=active]:text-lime-400">
                <DollarSign className="h-4 w-4 mr-1.5 text-lime-400" />
                Treasury
              </TabsTrigger>
              <TabsTrigger value="vault" data-testid="tab-vault" className="whitespace-nowrap data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-400">
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                CEO Vault
              </TabsTrigger>
              <TabsTrigger value="kinetic" data-testid="tab-kinetic" className="whitespace-nowrap data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                <Zap className="h-4 w-4 mr-1.5 text-emerald-400" />
                Kinetic Governor
              </TabsTrigger>
              <TabsTrigger value="native-order" data-testid="tab-native-order" className="whitespace-nowrap data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
                <Radio className="h-4 w-4 mr-1.5 text-orange-400" />
                DJ Order
              </TabsTrigger>
              <TabsTrigger value="stream-engagement" data-testid="tab-stream-engagement" className="whitespace-nowrap data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">
                <Activity className="h-4 w-4 mr-1.5 text-emerald-400" />
                Stream Engagement
              </TabsTrigger>
              <TabsTrigger value="playback-scheduler" data-testid="tab-playback-scheduler" className="whitespace-nowrap data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400">
                <Clock className="h-4 w-4 mr-1.5 text-blue-400" />
                Playback Timer
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="artists">
            <ArtistsTab />
          </TabsContent>

          <TabsContent value="content">
            <ContentTab />
          </TabsContent>

          <TabsContent value="lyrics">
            <AdminLyricsTab />
          </TabsContent>

          <TabsContent value="mastering">
            <AdminMasteringTab />
          </TabsContent>

          <TabsContent value="distribution">
            <DistributionTab />
          </TabsContent>

          <TabsContent value="radio-playlist">
            <RadioPlaylistTab />
          </TabsContent>

          <TabsContent value="global-rotation">
            <GlobalRotationTab />
          </TabsContent>

          <TabsContent value="radio-shows">
            <RadioShowsTab />
          </TabsContent>

          <TabsContent value="memberships">
            <MembershipsTab />
          </TabsContent>

          <TabsContent value="spotify">
            <SpotifyLookupTab />
          </TabsContent>

          <TabsContent value="qualifier">
            <StreamQualifierTab />
          </TabsContent>

          <TabsContent value="royalty">
            <SpotifyRoyaltyTab />
          </TabsContent>

          <TabsContent value="jam-control">
            <JamControlTab />
          </TabsContent>

          <TabsContent value="portals">
            <PortalControlPanel />
          </TabsContent>

          <TabsContent value="settlement">
            <SettlementGovernorTab />
          </TabsContent>

          <TabsContent value="treasury">
            <TreasuryDashboard />
          </TabsContent>

          <TabsContent value="vault">
            <CeoVaultTab />
          </TabsContent>

          <TabsContent value="kinetic">
            <KineticGovernorTab />
          </TabsContent>

          <TabsContent value="native-order">
            <NativeOrderTab />
          </TabsContent>

          <TabsContent value="stream-engagement">
            <StreamEngagementTab />
          </TabsContent>

          <TabsContent value="playback-scheduler">
            <PlaybackSchedulerTab />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
}
