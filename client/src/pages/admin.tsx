import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, Users, Music, UserCheck, BarChart3, Trash2, Ban, CheckCircle, XCircle, Crown, DollarSign, Disc3, ListMusic, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, Artist, Membership, TrackWithArtist } from "@shared/schema";

interface Analytics {
  totalUsers: number;
  totalArtists: number;
  totalTracks: number;
  totalPlays: number;
  premiumMembers: number;
  artistProMembers: number;
  totalAlbums: number;
  totalVideos: number;
  totalPlaylists: number;
  estimatedRevenue: number;
  topTracks: { title: string; artistName: string; playCount: number }[];
  topArtists: { name: string; monthlyListeners: number; trackCount: number }[];
}

function StatCard({ title, value, icon: Icon, description }: { title: string; value: number | string; icon: any; description?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
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
        <StatCard title="Premium Members" value={analytics?.premiumMembers || 0} icon={Crown} description="$9.99/month" />
        <StatCard title="Artist Pro" value={analytics?.artistProMembers || 0} icon={Crown} description="$19.99/month" />
        <StatCard title="Est. Monthly Revenue" value={`$${(analytics?.estimatedRevenue || 0).toFixed(2)}`} icon={DollarSign} />
        <StatCard title="Total Playlists" value={analytics?.totalPlaylists || 0} icon={ListMusic} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
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
          <div key={user.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`user-row-${user.id}`}>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <Users className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
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
  
  const { data: artists, isLoading } = useQuery<Artist[]>({
    queryKey: ["/api/admin/artists"],
  });

  const { data: pendingArtists } = useQuery<Artist[]>({
    queryKey: ["/api/admin/artists/pending"],
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
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-yellow-500" />
            Pending Applications ({pendingArtists.length})
          </h3>
          <div className="space-y-2">
            {pendingArtists.map((artist) => (
              <div key={artist.id} className="flex items-center gap-4 p-4 border border-yellow-500/30 bg-yellow-500/5 rounded-lg" data-testid={`pending-artist-${artist.id}`}>
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {artist.profileImage ? (
                    <img src={artist.profileImage} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <Music className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{artist.name}</p>
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

      <h3 className="text-lg font-semibold mb-3">All Artists</h3>
      <div className="space-y-2">
        {artists?.map((artist) => (
          <div key={artist.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`artist-row-${artist.id}`}>
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {artist.profileImage ? (
                <img src={artist.profileImage} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <Music className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{artist.name}</span>
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
          <div key={track.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`track-row-${track.id}`}>
            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center overflow-hidden">
              {track.coverImage ? (
                <img src={track.coverImage} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <Music className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{track.title}</span>
                {track.isPrerelease && <Badge className="bg-yellow-500/20 text-yellow-600">Pre-release</Badge>}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {track.artist?.name} • {track.playCount?.toLocaleString()} plays
              </p>
            </div>
            <div className="flex items-center gap-2">
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
        <div key={membership.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`membership-row-${membership.id}`}>
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            {membership.user?.profileImageUrl ? (
              <img src={membership.user.profileImageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <Users className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {membership.user?.firstName} {membership.user?.lastName}
            </p>
            <p className="text-sm text-muted-foreground truncate">{membership.user?.email}</p>
          </div>
          <Badge variant={
            membership.tier === "artist" ? "default" :
            membership.tier === "premium" ? "secondary" : "outline"
          }>
            {membership.tier === "artist" ? "Artist Pro" : membership.tier}
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

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Portal</h1>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="artists" data-testid="tab-artists">
              <Music className="h-4 w-4 mr-2" />
              Artists
            </TabsTrigger>
            <TabsTrigger value="content" data-testid="tab-content">
              <Music className="h-4 w-4 mr-2" />
              Content
            </TabsTrigger>
            <TabsTrigger value="memberships" data-testid="tab-memberships">
              <Crown className="h-4 w-4 mr-2" />
              Memberships
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="memberships">
            <MembershipsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
