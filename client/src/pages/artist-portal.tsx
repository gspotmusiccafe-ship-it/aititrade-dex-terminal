import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Music,
  Video,
  Plus,
  BarChart3,
  Calendar,
  Disc3,
  Users,
  TrendingUp,
  Edit,
  Trash2,
  Eye,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Artist, Track, Album } from "@shared/schema";

function UploadTrackDialog({ artistId }: { artistId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [duration, setDuration] = useState(180);
  const [isPrerelease, setIsPrerelease] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/tracks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist", artistId, "tracks"] });
      setOpen(false);
      setTitle("");
      setGenre("");
      toast({ title: "Track uploaded!", description: "Your track is now available." });
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate({
      artistId,
      title,
      genre,
      duration,
      isPrerelease,
      audioUrl: "/demo-audio.mp3",
      coverImage: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-upload-track">
          <Upload className="h-4 w-4 mr-2" />
          Upload Track
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload New Track</DialogTitle>
          <DialogDescription>
            Add a new track to your catalog. You can set it as a pre-release for early access members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Track Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter track title"
              required
              data-testid="input-track-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Pop, Rock, Hip-Hop..."
              data-testid="input-track-genre"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (seconds)</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              min={30}
              max={600}
              data-testid="input-track-duration"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Pre-release</Label>
              <p className="text-xs text-muted-foreground">
                Only Premium members can access for 2 weeks
              </p>
            </div>
            <Switch
              checked={isPrerelease}
              onCheckedChange={setIsPrerelease}
              data-testid="switch-prerelease"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading..." : "Upload Track"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArtistSetupCard() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const { toast } = useToast();

  const createArtistMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/artists", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/artist-profile"] });
      toast({ title: "Artist profile created!", description: "You can now start uploading music." });
    },
    onError: () => {
      toast({ title: "Failed to create profile", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createArtistMutation.mutate({ name, bio });
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Create Your Artist Profile
        </CardTitle>
        <CardDescription>
          Set up your artist profile to start uploading music and videos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="artistName">Artist / Band Name</Label>
            <Input
              id="artistName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your artist name"
              required
              data-testid="input-artist-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="artistBio">Bio</Label>
            <Textarea
              id="artistBio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your fans about yourself..."
              rows={4}
              data-testid="input-artist-bio"
            />
          </div>
          <Button type="submit" className="w-full" disabled={createArtistMutation.isPending}>
            {createArtistMutation.isPending ? "Creating..." : "Create Artist Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ArtistDashboard({ artist }: { artist: Artist }) {
  const { data: tracks, isLoading: loadingTracks } = useQuery<Track[]>({
    queryKey: ["/api/artist", artist.id, "tracks"],
  });

  const stats = [
    { label: "Monthly Listeners", value: artist.monthlyListeners?.toLocaleString() || "0", icon: Users },
    { label: "Total Tracks", value: tracks?.length || 0, icon: Music },
    { label: "Pre-releases", value: tracks?.filter(t => t.isPrerelease).length || 0, icon: Star },
    { label: "Total Plays", value: tracks?.reduce((sum, t) => sum + (t.playCount || 0), 0).toLocaleString() || "0", icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {/* Artist Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
          {artist.profileImage ? (
            <img src={artist.profileImage} alt={artist.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-4xl font-bold text-primary">{artist.name[0]}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold">{artist.name}</h2>
            {artist.verified && (
              <Badge variant="secondary" className="bg-primary/20 text-primary">
                Verified
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{artist.bio || "No bio yet"}</p>
        </div>
        <Button variant="outline" data-testid="button-edit-profile">
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="tracks">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="tracks">
              <Music className="h-4 w-4 mr-1" />
              Tracks
            </TabsTrigger>
            <TabsTrigger value="videos">
              <Video className="h-4 w-4 mr-1" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </TabsTrigger>
          </TabsList>
          <UploadTrackDialog artistId={artist.id} />
        </div>

        <TabsContent value="tracks">
          {loadingTracks ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : tracks && tracks.length > 0 ? (
            <div className="space-y-2">
              {tracks.map((track) => (
                <Card key={track.id} className="hover-elevate">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Disc3 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{track.title}</p>
                        {track.isPrerelease && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                            <Star className="h-2.5 w-2.5 mr-0.5" />
                            Pre-release
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {track.genre || "Unknown genre"} • {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(track.playCount || 0).toLocaleString()} plays
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No tracks yet</p>
              <p className="text-sm mt-1">Upload your first track to get started</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="videos">
          <div className="text-center py-12 text-muted-foreground">
            <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Video uploads coming soon</p>
            <p className="text-sm mt-1">You'll be able to upload music videos and exclusive content</p>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Analytics dashboard coming soon</p>
            <p className="text-sm mt-1">Track your plays, listeners, and engagement metrics</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ArtistPortalPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  const { data: artistProfile, isLoading: loadingProfile } = useQuery<Artist | null>({
    queryKey: ["/api/user/artist-profile"],
    enabled: isAuthenticated,
  });

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full pb-28 px-6 py-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Artist Portal</h2>
          <p className="text-muted-foreground mb-6">
            Sign in to upload your music, set pre-release dates, and manage your artist profile
          </p>
          <Button asChild data-testid="button-login-artist">
            <a href="/api/login">Sign In to Continue</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Artist Portal</h1>
      
      {artistProfile ? (
        <ArtistDashboard artist={artistProfile} />
      ) : (
        <ArtistSetupCard />
      )}
    </div>
  );
}
