import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, Users, Music, UserCheck, BarChart3, Trash2, Ban, CheckCircle, XCircle, Crown, DollarSign, Disc3, ListMusic, TrendingUp, Search, ExternalLink, Clock, Loader2, Hash, Radio, Download, Send, MessageSquare, Plus, FileText, Headphones, Wand2, Eye, Flame } from "lucide-react";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
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
        <StatCard title="Paid Members" value={analytics?.premiumMembers || 0} icon={Crown} description="Silver/Bronze/Gold" />
        <StatCard title="Gold (Artist Pro)" value={analytics?.goldMembers || 0} icon={Crown} description="$49.99 join + $9.99/mo" />
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
  const [createDialog, setCreateDialog] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBio, setCreateBio] = useState("");
  
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

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">All Artists</h3>
        <Button
          size="sm"
          onClick={() => setCreateDialog(true)}
          data-testid="button-create-artist"
        >
          <Plus className="h-4 w-4 mr-1" />
          Create Artist
        </Button>
      </div>
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

      <Dialog open={createDialog} onOpenChange={() => setCreateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Artist Profile</DialogTitle>
            <DialogDescription>
              Create an artist profile for any user without requiring a Gold membership.
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
              Create Artist
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
            membership.tier === "gold" ? "default" :
            membership.tier === "bronze" ? "secondary" :
            membership.tier === "silver" ? "secondary" : "outline"
          }>
            {membership.tier === "gold" ? "Gold (Artist Pro)" :
             membership.tier === "bronze" ? "Bronze" :
             membership.tier === "silver" ? "Silver" : membership.tier}
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
          <div key={req.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`lyrics-request-${req.id}`}>
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{req.title}</span>
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
          <div key={req.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`mastering-request-${req.id}`}>
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Headphones className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">Track: {req.trackId}</span>
                {statusBadge(req.status)}
              </div>
              <p className="text-sm text-muted-foreground">Artist: {req.artistId}</p>
              {req.notes && <p className="text-sm text-muted-foreground truncate">{req.notes}</p>}
              {req.adminNotes && <p className="text-sm text-blue-400">Admin: {req.adminNotes}</p>}
              {req.masteredUrl && (
                <a
                  href={req.masteredUrl}
                  download
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  data-testid={`link-mastered-download-${req.id}`}
                >
                  <Download className="h-3 w-3" />
                  Download Mastered File
                </a>
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
                  asChild
                  data-testid={`button-download-mastered-${req.id}`}
                >
                  <a href={req.masteredUrl} download>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </a>
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
          <div key={req.id} className="flex items-center gap-4 p-4 border rounded-lg" data-testid={`distribution-request-${req.id}`}>
            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">Artist: {req.userId}</span>
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
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
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
          <h2 className="text-xl font-semibold">Radio Shows</h2>
          <p className="text-sm text-muted-foreground">Pre-load Spotify playlist URLs for each time slot</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" data-testid="button-add-radio-show">
          <Plus className="h-4 w-4" />
          Add Show
        </Button>
      </div>

      {shows && shows.length > 0 ? (
        <div className="space-y-3">
          {shows.map((show: any) => (
            <Card key={show.id} className={`${!show.isActive ? "opacity-50" : ""}`} data-testid={`admin-radio-show-${show.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-[#1DB954]/10 flex items-center justify-center">
                    <Radio className="h-5 w-5 text-[#1DB954]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{show.name}</p>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiSpotify className="h-5 w-5 text-[#1DB954]" />
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
        <Card className="border-[#1DB954]/30 bg-[#1DB954]/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-admin-title">Admin Portal</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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

        <Tabs defaultValue="dashboard" className="space-y-6">
          <div className="overflow-x-auto -mx-6 px-6 pb-2">
            <TabsList className="inline-flex w-auto min-w-full gap-1">
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

          <TabsContent value="radio-shows">
            <RadioShowsTab />
          </TabsContent>

          <TabsContent value="memberships">
            <MembershipsTab />
          </TabsContent>

          <TabsContent value="spotify">
            <SpotifyLookupTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
