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
  Play,
  Star,
  Heart,
  ImagePlus,
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
import { usePlayer } from "@/lib/player-context";
import type { Artist, Track, Album, TrackWithArtist } from "@shared/schema";

function UploadTrackDialog({ artistId }: { artistId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setFileName(file.name);
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.onloadedmetadata = () => {
        setAudioDuration(Math.round(audio.duration));
        URL.revokeObjectURL(audio.src);
      };
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const url = URL.createObjectURL(file);
      setCoverPreview(url);
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist", artistId, "tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
      setOpen(false);
      setTitle("");
      setGenre("");
      setAudioFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setFileName("");
      setAudioDuration(0);
      toast({ title: "Track uploaded!", description: "Your track is now available." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile) {
      toast({ title: "No audio file", description: "Please select an audio file to upload.", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("audioFile", audioFile);
    if (coverFile) {
      formData.append("coverImage", coverFile);
    }
    formData.append("title", title);
    formData.append("genre", genre);
    formData.append("duration", String(audioDuration || 180));
    formData.append("isPrerelease", String(isPrerelease));
    uploadMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-upload-track">
          <Upload className="h-4 w-4 mr-2" />
          Upload Track
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload New Track</DialogTitle>
          <DialogDescription>
            Add a new track to your catalog. You can set it as a pre-release for early access members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div className="space-y-2">
              <Label>Cover Art</Label>
              <div
                className="w-[120px] h-[120px] border-2 border-dashed border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/30"
                onClick={() => document.getElementById("coverImageInput")?.click()}
              >
                <input
                  id="coverImageInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleCoverChange}
                  className="hidden"
                  data-testid="input-cover-image"
                />
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                    <p className="text-[10px] text-muted-foreground">Add artwork</p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="audioFile">Audio File</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors h-[120px] flex flex-col items-center justify-center"
                onClick={() => document.getElementById("audioFileInput")?.click()}
              >
                <input
                  id="audioFileInput"
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.webm"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-audio-file"
                />
                {fileName ? (
                  <div className="space-y-1">
                    <Music className="h-6 w-6 mx-auto text-primary" />
                    <p className="text-xs font-medium truncate max-w-[180px]">{fileName}</p>
                    {audioDuration > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Click to select audio</p>
                    <p className="text-[10px] text-muted-foreground">MP3, WAV, FLAC (max 50MB)</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Pre-release</Label>
              <p className="text-xs text-muted-foreground">
                Only paid members can preview before release
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
            <Button type="submit" disabled={uploadMutation.isPending || !audioFile}>
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

function EditTrackDialog({ track, artistId }: { track: Track; artistId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(track.title);
  const [genre, setGenre] = useState(track.genre || "");
  const [isPrerelease, setIsPrerelease] = useState(track.isPrerelease || false);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/tracks/${track.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist", artistId, "tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
      setOpen(false);
      toast({ title: "Track updated!" });
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-track-${track.id}`}>
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Track</DialogTitle>
          <DialogDescription>Update track details</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate({ title, genre, isPrerelease }); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editTitle">Track Title</Label>
            <Input id="editTitle" value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="input-edit-track-title" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editGenre">Genre</Label>
            <Input id="editGenre" value={genre} onChange={(e) => setGenre(e.target.value)} data-testid="input-edit-track-genre" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Pre-release</Label>
              <p className="text-xs text-muted-foreground">Only Premium members can access for 2 weeks</p>
            </div>
            <Switch checked={isPrerelease} onCheckedChange={setIsPrerelease} data-testid="switch-edit-prerelease" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({ artist }: { artist: Artist }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(artist.name);
  const [bio, setBio] = useState(artist.bio || "");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(artist.profileImage || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(artist.coverImage || null);
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/artists/profile", {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Update failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/artist-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists/top"] });
      setOpen(false);
      toast({ title: "Profile updated!", description: "Your artist profile has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("bio", bio);
    if (profileFile) formData.append("profileImage", profileFile);
    if (coverFile) formData.append("coverImage", coverFile);
    updateMutation.mutate(formData);
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      setProfilePreview(URL.createObjectURL(file));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-edit-profile">
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Artist Profile</DialogTitle>
          <DialogDescription>
            Update your artist name, bio, and images.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Profile Image</Label>
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/30"
                onClick={() => document.getElementById("profileImageInput")?.click()}
              >
                <input
                  id="profileImageInput"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleProfileChange}
                  className="hidden"
                  data-testid="input-profile-image"
                />
                {profilePreview ? (
                  <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Click to upload your artist photo. Square images work best.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <div
              className="w-full h-32 rounded-lg overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/30"
              onClick={() => document.getElementById("coverImageInput")?.click()}
            >
              <input
                id="coverImageInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleCoverChange}
                className="hidden"
                data-testid="input-cover-image-profile"
              />
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">Add cover banner image</p>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editArtistName">Artist Name</Label>
            <Input
              id="editArtistName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="input-edit-artist-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editArtistBio">Bio</Label>
            <Textarea
              id="editArtistBio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell your fans about yourself..."
              data-testid="input-edit-artist-bio"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ArtistDashboard({ artist }: { artist: Artist }) {
  const { data: tracks, isLoading: loadingTracks } = useQuery<Track[]>({
    queryKey: ["/api/artist", artist.id, "tracks"],
  });
  const { toast } = useToast();
  const { playTrack } = usePlayer();

  const deleteMutation = useMutation({
    mutationFn: async (trackId: string) => {
      return apiRequest("DELETE", `/api/tracks/${trackId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artist", artist.id, "tracks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tracks/featured"] });
      toast({ title: "Track deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handlePlay = (track: Track) => {
    const trackWithArtist: TrackWithArtist = { ...track, artist };
    const allTracksWithArtist = (tracks || []).map(t => ({ ...t, artist }));
    playTrack(trackWithArtist, allTracksWithArtist);
  };

  const handleDelete = (trackId: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      deleteMutation.mutate(trackId);
    }
  };

  const totalPlays = tracks?.reduce((sum, t) => sum + (t.playCount || 0), 0) || 0;
  const topTrack = tracks?.length ? [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0))[0] : null;

  const stats = [
    { label: "Monthly Listeners", value: artist.monthlyListeners?.toLocaleString() || "0", icon: Users },
    { label: "Total Tracks", value: tracks?.length || 0, icon: Music },
    { label: "Pre-releases", value: tracks?.filter(t => t.isPrerelease).length || 0, icon: Star },
    { label: "Total Plays", value: totalPlays.toLocaleString(), icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {artist.coverImage && (
        <div className="w-full h-48 rounded-xl overflow-hidden -mb-4">
          <img src={artist.coverImage} alt={`${artist.name} cover`} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {artist.profileImage ? (
            <img src={artist.profileImage} alt={artist.name} className="w-full h-full object-cover" />
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
        <EditProfileDialog artist={artist} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <stat.icon className="h-4 w-4" />
                <span className="text-xs">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
                    <div
                      className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 cursor-pointer"
                      onClick={() => handlePlay(track)}
                      data-testid={`button-play-track-${track.id}`}
                    >
                      {track.coverImage ? (
                        <img src={track.coverImage} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                          <Music className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-5 w-5 text-white" />
                      </div>
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
                      <EditTrackDialog track={track} artistId={artist.id} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(track.id, track.title)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-track-${track.id}`}
                      >
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
          {loadingTracks ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : tracks && tracks.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs">Total Plays</span>
                    </div>
                    <p className="text-3xl font-bold" data-testid="stat-analytics-total-plays">{totalPlays.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs">Monthly Listeners</span>
                    </div>
                    <p className="text-3xl font-bold" data-testid="stat-analytics-listeners">{(artist.monthlyListeners || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Heart className="h-4 w-4" />
                      <span className="text-xs">Avg Plays Per Track</span>
                    </div>
                    <p className="text-3xl font-bold" data-testid="stat-analytics-avg-plays">
                      {tracks.length > 0 ? Math.round(totalPlays / tracks.length).toLocaleString() : "0"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {topTrack && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Top Performing Track
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Music className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-xl font-bold" data-testid="text-top-track-title">{topTrack.title}</p>
                        <p className="text-muted-foreground">{(topTrack.playCount || 0).toLocaleString()} plays • {topTrack.genre || "Unknown genre"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Track Performance</CardTitle>
                  <CardDescription>Play counts for each of your tracks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).map((track, index) => {
                      const maxPlays = Math.max(...tracks.map(t => t.playCount || 0), 1);
                      const percentage = ((track.playCount || 0) / maxPlays) * 100;
                      return (
                        <div key={track.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground w-6">{index + 1}.</span>
                              <span className="font-medium truncate">{track.title}</span>
                              {track.isPrerelease && (
                                <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">Pre-release</Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground">{(track.playCount || 0).toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No analytics yet</p>
              <p className="text-sm mt-1">Upload tracks and start getting plays to see your analytics</p>
            </div>
          )}
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
