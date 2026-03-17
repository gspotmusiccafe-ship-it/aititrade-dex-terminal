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
  Crown,
  Check,
  ArrowRight,
  Mic2,
  Sparkles,
  Send,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Headphones,
  Wand2,
  Download,
  DollarSign,
  ShoppingBag,
  ExternalLink,
  Palette,
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
import { apiRequest, queryClient, downloadFile } from "@/lib/queryClient";
import { usePlayer } from "@/lib/player-context";
import type { Artist, Track, Album, TrackWithArtist, Video as VideoType } from "@shared/schema";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function YouTubeEmbed({ videoUrl, title }: { videoUrl: string; title: string }) {
  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) return <div className="text-sm text-muted-foreground">Invalid video URL</div>;
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}`}
      title={title}
      className="w-full aspect-video rounded-lg"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      data-testid={`video-embed-${videoId}`}
    />
  );
}

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

function ArtistOnboarding() {
  const [step, setStep] = useState<"plan" | "profile">("plan");
  const [selectedPlan, setSelectedPlan] = useState<"mint_factory_ceo" | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: membership, isLoading: membershipLoading } = useQuery<{ tier: string; isActive: boolean }>({
    queryKey: ["/api/user/membership"],
  });

  const currentTier = membership?.tier || "free";
  const alreadyQualified = currentTier === "mint_factory_ceo" || currentTier === "artist";

  const upgradeMutation = useMutation({
    mutationFn: async (tier: string) => {
      return apiRequest("POST", "/api/user/membership/upgrade", { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/membership"] });
      setStep("profile");
    },
    onError: () => {
      toast({ title: "Subscription failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const createArtistMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/artists", {
        method: "POST",
        body: JSON.stringify({ name: formData.get("name"), bio: formData.get("bio") }),
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create profile");
      const artist = await res.json();

      const imgFile = profileFile;
      if (imgFile) {
        const imgForm = new FormData();
        imgForm.append("profileImage", imgFile);
        imgForm.append("name", formData.get("name") as string);
        await fetch("/api/artists/profile", {
          method: "PATCH",
          body: imgForm,
          credentials: "include",
        });
      }
      return artist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/artist-profile"] });
      toast({ title: "Welcome aboard!", description: "Your artist profile is live. Start uploading music!" });
    },
    onError: () => {
      toast({ title: "Failed to create profile", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("bio", bio);
    createArtistMutation.mutate(formData);
  };

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileFile(file);
      setProfilePreview(URL.createObjectURL(file));
    }
  };

  const artistPlans = [
    {
      id: "mint_factory_ceo" as const,
      name: "Mint Factory CEO",
      price: "$99",
      period: " to join",
      icon: Crown,
      color: "text-emerald-400",
      borderColor: "border-emerald-400/50",
      bgColor: "bg-emerald-500/10",
      popular: true,
      features: [
        "16% Daily Trading Credit on all positions",
        "Minting rights — upload & mint AI-generated assets",
        "AI Lyrics Generator — prompt-to-song engine",
        "Professional audio mastering (radio-ready, -14 LUFS)",
        "Distribution to Spotify, Amazon, Deezer, YouTube & Anghami",
        "In-house AI-music marketing & promotions",
        "Aitify Music Store — 25% sales retention",
        "Tip Jar — fans tip you directly via PayPal",
        "Leaderboard — track streams, rank up, earn tier badges",
        "Asset Architect profile & bio page",
        "Advanced analytics dashboard",
        "Lossless audio quality",
        "$9.99/month to stay active",
      ],
    },
  ];

  if (membershipLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
        <Skeleton className="h-8 w-64 mx-auto mb-2" />
        <Skeleton className="h-4 w-96 mx-auto mb-8" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (step === "plan" && !alreadyQualified) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mic2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2" data-testid="text-onboarding-title">
            Become an Asset Architect on AITIFY MUSIC RADIO
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Choose your plan to start minting assets, building your trader base, and earning from your creations.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {artistPlans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? `${plan.borderColor} ring-2 ring-primary/20`
                  : "border-border/50 hover:border-border"
              }`}
              onClick={() => setSelectedPlan(plan.id)}
              data-testid={`onboarding-plan-${plan.id}`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-xs font-medium">
                  Recommended
                </div>
              )}
              <CardContent className={`p-6 ${plan.popular ? "pt-10" : ""}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full ${plan.bgColor} flex items-center justify-center`}>
                    <plan.icon className={`h-5 w-5 ${plan.color}`} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${plan.color}`}>{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            disabled={!selectedPlan}
            onClick={() => window.location.href = "/membership"}
            className="min-w-[200px]"
            data-testid="button-subscribe-artist"
          >
            Subscribe & Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Cancel anytime. 7-day free trial included.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Set Up Your Asset Architect Profile
        </CardTitle>
        <CardDescription>
          Create your Asset Architect identity — this is how traders will find and follow you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/30 flex-shrink-0"
              onClick={() => document.getElementById("onboardingProfileImage")?.click()}
            >
              <input
                id="onboardingProfileImage"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleProfileImageChange}
                className="hidden"
                data-testid="input-onboarding-profile-image"
              />
              {profilePreview ? (
                <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Architect Photo</p>
              <p>Click to upload (optional)</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="artistName">Asset Architect / Brand Name</Label>
            <Input
              id="artistName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your architect name"
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
          <Button type="submit" className="w-full" disabled={createArtistMutation.isPending} data-testid="button-create-artist">
            {createArtistMutation.isPending ? "Creating..." : "Create Mentor Profile"}
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
      toast({ title: "Profile updated!", description: "Your Asset Architect profile has been saved." });
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
          <DialogTitle>Edit Asset Architect Profile</DialogTitle>
          <DialogDescription>
            Update your Asset Architect name, bio, and images.
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
                Click to upload your architect photo. Square images work best.
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
            <Label htmlFor="editArtistName">Asset Architect Name</Label>
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

function AddVideoDialog({ artistId }: { artistId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isPrerelease, setIsPrerelease] = useState(false);
  const { toast } = useToast();

  const videoId = extractYouTubeId(youtubeUrl);

  const addVideoMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/videos", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists", artistId, "videos"] });
      toast({ title: "Video added!", description: "Your music video is now live." });
      setOpen(false);
      setTitle("");
      setDescription("");
      setYoutubeUrl("");
      setIsPrerelease(false);
    },
    onError: () => {
      toast({ title: "Failed to add video", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoId) {
      toast({ title: "Invalid YouTube URL", description: "Please enter a valid YouTube video link.", variant: "destructive" });
      return;
    }
    addVideoMutation.mutate({
      artistId,
      title,
      description: description || null,
      videoUrl: youtubeUrl.trim(),
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0,
      isPrerelease,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-add-video">
          <Plus className="h-4 w-4 mr-1" />
          Add Video
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Add Music Video</DialogTitle>
          <DialogDescription>
            Paste a YouTube link to embed your music video
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoTitle">Video Title</Label>
            <Input
              id="videoTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BABY LETS RIDE (Official Video)"
              required
              data-testid="input-video-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtubeUrl">YouTube URL</Label>
            <Input
              id="youtubeUrl"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              data-testid="input-video-url"
            />
            {youtubeUrl && !videoId && (
              <p className="text-xs text-destructive">Enter a valid YouTube URL</p>
            )}
          </div>
          {videoId && (
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="Video thumbnail"
                className="w-full aspect-video object-cover"
                data-testid="img-video-preview"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="videoDescription">Description (optional)</Label>
            <Textarea
              id="videoDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="About this video..."
              rows={3}
              data-testid="input-video-description"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="videoPrerelease">Pre-release (Premium only)</Label>
            <Switch
              id="videoPrerelease"
              checked={isPrerelease}
              onCheckedChange={setIsPrerelease}
              data-testid="switch-video-prerelease"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addVideoMutation.isPending || !videoId} data-testid="button-submit-video">
              {addVideoMutation.isPending ? "Adding..." : "Add Video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteVideoButton({ videoId, artistId }: { videoId: string; artistId: string }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/videos/${videoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists", artistId, "videos"] });
      toast({ title: "Video deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete video", variant: "destructive" });
    },
  });

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
      data-testid={`button-delete-video-${videoId}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function ArtistDashboard({ artist }: { artist: Artist }) {
  const { data: tracks, isLoading: loadingTracks } = useQuery<Track[]>({
    queryKey: ["/api/artist", artist.id, "tracks"],
  });
  const { data: videos, isLoading: loadingVideos } = useQuery<VideoType[]>({
    queryKey: ["/api/artists", artist.id, "videos"],
  });
  const { data: followerData } = useQuery<{ count: number }>({
    queryKey: ["/api/artists", artist.id, "followers", "count"],
    queryFn: () => fetch(`/api/artists/${artist.id}/followers/count`).then(r => r.json()),
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

  const followerCount = followerData?.count || 0;

  const stats = [
    { label: "Followers", value: followerCount.toLocaleString(), icon: Heart },
    { label: "Total Tracks", value: tracks?.length || 0, icon: Music },
    { label: "Pre-releases", value: tracks?.filter(t => t.isPrerelease).length || 0, icon: Star },
    { label: "Total Plays", value: totalPlays.toLocaleString(), icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      <div className="relative rounded-2xl overflow-hidden">
        {artist.coverImage ? (
          <img src={artist.coverImage} alt={`${artist.name} cover`} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-primary/20 via-emerald-500/10 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center overflow-hidden flex-shrink-0 ring-4 ring-background shadow-2xl">
              {artist.profileImage ? (
                <img src={artist.profileImage} alt={artist.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-primary">{artist.name[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-black tracking-tight">{artist.name}</h2>
                {artist.verified && (
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/20">
                    Verified
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{artist.bio || "No bio yet"}</p>
            </div>
            <EditProfileDialog artist={artist} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
                  <stat.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-2xl font-black tracking-tight" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tracks">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <TabsList className="bg-card/60 border border-border/30">
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
            <TabsTrigger value="lyrics">
              <FileText className="h-4 w-4 mr-1" />
              Lyrics
            </TabsTrigger>
            <TabsTrigger value="mastering">
              <Headphones className="h-4 w-4 mr-1" />
              Mastering
            </TabsTrigger>
            <TabsTrigger value="distribution">
              <Send className="h-4 w-4 mr-1" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="tips">
              <DollarSign className="h-4 w-4 mr-1" />
              Tips
            </TabsTrigger>
            <TabsTrigger value="creative-suite" className="text-lime-400 data-[state=active]:text-lime-300 data-[state=active]:bg-lime-500/10">
              <Palette className="h-4 w-4 mr-1" />
              CEO Command
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5"
              onClick={() => window.open("https://payhip.com/auth/register/af6977122ef4124", "_blank", "noopener,noreferrer")}
              data-testid="button-my-store"
            >
              <ShoppingBag className="h-4 w-4 text-primary" />
              My Store
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </Button>
            <AddVideoDialog artistId={artist.id} />
            <UploadTrackDialog artistId={artist.id} />
          </div>
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
                <Card key={track.id} className="bg-card/60 border-border/30 hover:border-primary/20 transition-all duration-200 hover:bg-card/90">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div
                      className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group"
                      onClick={() => handlePlay(track)}
                      data-testid={`button-play-track-${track.id}`}
                    >
                      {track.coverImage ? (
                        <img src={track.coverImage} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
                          <Music className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{track.title}</p>
                        {track.isPrerelease && (
                          <Badge variant="secondary" className="bg-primary/20 text-primary text-xs border-primary/20">
                            <Star className="h-2.5 w-2.5 mr-0.5" />
                            Pre-release
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {track.genre || "Unknown genre"} • {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      {(track.playCount || 0).toLocaleString()} plays
                    </div>
                    <div className="flex items-center gap-2">
                      <EditTrackDialog track={track} artistId={artist.id} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
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
          {loadingVideos ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-lg" />
              ))}
            </div>
          ) : videos && videos.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {videos.map((video) => (
                <Card key={video.id} className="overflow-hidden bg-card/60 border-border/30 hover:border-primary/20 transition-colors" data-testid={`card-video-${video.id}`}>
                  <YouTubeEmbed videoUrl={video.videoUrl} title={video.title} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold truncate" data-testid={`text-video-title-${video.id}`}>{video.title}</h4>
                        {video.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{video.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {video.isPrerelease && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              Pre-release
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {video.viewCount || 0} views
                          </span>
                        </div>
                      </div>
                      <DeleteVideoButton videoId={video.id} artistId={artist.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No videos yet</p>
              <p className="text-sm mt-1">Add your first YouTube music video</p>
            </div>
          )}
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
                <Card className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider">Total Plays</span>
                    </div>
                    <p className="text-3xl font-black tracking-tight" data-testid="stat-analytics-total-plays">{totalPlays.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider">Monthly Listeners</span>
                    </div>
                    <p className="text-3xl font-black tracking-tight" data-testid="stat-analytics-listeners">{(artist.monthlyListeners || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500/15 to-pink-500/5 flex items-center justify-center">
                        <Heart className="h-4 w-4 text-pink-400" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider">Avg Plays Per Track</span>
                    </div>
                    <p className="text-3xl font-black tracking-tight" data-testid="stat-analytics-avg-plays">
                      {tracks.length > 0 ? Math.round(totalPlays / tracks.length).toLocaleString() : "0"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {topTrack && (
                <Card className="bg-card/60 border-border/30 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-primary via-emerald-500 to-primary" />
                  <CardHeader>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-500/15 to-yellow-500/5 flex items-center justify-center">
                        <Star className="h-4 w-4 text-yellow-400" />
                      </div>
                      Top Performing Track
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
                        <Music className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-xl font-black tracking-tight" data-testid="text-top-track-title">{topTrack.title}</p>
                        <p className="text-muted-foreground font-medium">{(topTrack.playCount || 0).toLocaleString()} plays • {topTrack.genre || "Unknown genre"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card/60 border-border/30 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary/50 to-emerald-500/50" />
                <CardHeader>
                  <CardTitle className="text-lg font-black">Track Performance</CardTitle>
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

        <TabsContent value="lyrics">
          <LyricsTab artistId={artist.id} />
        </TabsContent>

        <TabsContent value="mastering">
          <MasteringTab artistId={artist.id} tracks={tracks || []} />
        </TabsContent>

        <TabsContent value="distribution">
          <DistributionTab artistId={artist.id} tracks={tracks || []} />
        </TabsContent>

        <TabsContent value="tips">
          <TipsTab artistId={artist.id} />
        </TabsContent>

        <TabsContent value="creative-suite">
          <CreativeSuiteTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreativeSuiteTab() {
  const { toast } = useToast();

  const IDEOGRAM_PROMPT = "Create a bold, premium certificate design with a pitch black background. Use LIME GREEN (#84cc16) neon borders and circuit-board patterns. Include BOLD GOLD (#f59e0b) text reading 'CERTIFIED AI-GENERATED ASSET' with a metallic sheen. Add geometric neural network lines, a hexagonal trust seal, and futuristic typography. Style: Bloomberg Terminal meets luxury brand certificate. High contrast, no gradients on text.";

  const tools = [
    {
      id: "suno",
      name: "SUNO",
      subtitle: "AI AUDIO ENGINE",
      description: "Generate high-fidelity beats, instrumentals, and full AI tracks. Mint audio assets at production quality.",
      url: "https://suno.com",
      icon: "🎵",
      color: "lime",
    },
    {
      id: "jumpstr",
      name: "JUMPSTR",
      subtitle: "DISTRIBUTION & VELOCITY",
      description: "Distribute minted assets across platforms. Amplify social velocity and reach for maximum market penetration.",
      url: "https://jumpstr.io",
      icon: "🚀",
      color: "lime",
    },
    {
      id: "ideogram",
      name: "IDEOGRAM",
      subtitle: "COVER ART GENERATOR",
      description: "Generate bold gold and lime green cover art for Trust Certificates, asset thumbnails, and brand identity.",
      url: "https://ideogram.ai",
      icon: "🎨",
      color: "amber",
      hasPromptCopy: true,
    },
  ];

  const openPopup = (url: string, name: string) => {
    const w = 1200;
    const h = 800;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    window.open(url, name, `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no,scrollbars=yes,resizable=yes`);
  };

  const copyIdeogramPrompt = async () => {
    try {
      await navigator.clipboard.writeText(IDEOGRAM_PROMPT);
      toast({ title: "✦ PROMPT COPIED", description: "Gold/Lime Trust Certificate prompt ready. Paste into Ideogram." });
    } catch {
      toast({ title: "Copy failed", description: "Manually select and copy the prompt.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <h3 className="text-2xl font-extrabold flex items-center gap-3 text-lime-400 font-mono tracking-wide">
          <div className="h-10 w-10 rounded-lg bg-lime-500/15 flex items-center justify-center border border-lime-500/30">
            <Palette className="h-6 w-6 text-lime-400" />
          </div>
          CEO COMMAND CENTER
        </h3>
        <p className="text-sm text-zinc-500 mt-2 font-mono">
          QUICK-LAUNCH CREATIVE TOOLS — Each opens in a dedicated 1200×800 popup window for full-speed operation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {tools.map((tool) => (
          <Card
            key={tool.id}
            className={`bg-black border-2 ${tool.color === "amber" ? "border-amber-500/50 hover:border-amber-400/80" : "border-lime-500/50 hover:border-lime-400/80"} overflow-hidden transition-all duration-200 hover:shadow-lg ${tool.color === "amber" ? "hover:shadow-amber-500/10" : "hover:shadow-lime-500/10"} group`}
            data-testid={`creative-suite-${tool.id}`}
          >
            <CardContent className="p-0">
              <div className={`p-6 ${tool.color === "amber" ? "bg-amber-500/5" : "bg-lime-500/5"} border-b ${tool.color === "amber" ? "border-amber-500/20" : "border-lime-500/20"}`}>
                <div className="text-center mb-4">
                  <span className="text-5xl block mb-3">{tool.icon}</span>
                  <h4 className={`text-2xl font-extrabold font-mono tracking-wider ${tool.color === "amber" ? "text-amber-400" : "text-lime-400"}`}>
                    {tool.name}
                  </h4>
                  <p className={`text-xs font-bold font-mono mt-1 ${tool.color === "amber" ? "text-amber-500/70" : "text-lime-500/70"} tracking-widest`}>
                    {tool.subtitle}
                  </p>
                </div>
                <p className="text-zinc-400 text-xs font-mono text-center leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="p-4 space-y-3">
                <Button
                  onClick={() => openPopup(tool.url, tool.id)}
                  className={`w-full py-5 text-lg font-extrabold font-mono tracking-wide ${tool.color === "amber" ? "bg-amber-600 hover:bg-amber-700" : "bg-lime-600 hover:bg-lime-700"} text-white border-0 shadow-lg ${tool.color === "amber" ? "shadow-amber-500/20" : "shadow-lime-500/20"}`}
                  data-testid={`button-launch-${tool.id}`}
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  LAUNCH {tool.name}
                </Button>

                {tool.hasPromptCopy && (
                  <Button
                    onClick={copyIdeogramPrompt}
                    variant="outline"
                    className="w-full py-4 text-sm font-extrabold font-mono border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400/50"
                    data-testid="button-copy-ideogram-prompt"
                  >
                    📋 COPY TRUST CERTIFICATE PROMPT
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-black/50 border border-zinc-800 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-500/20">
              <span className="text-sm">📋</span>
            </div>
            <div>
              <p className="text-xs font-bold font-mono text-amber-400 mb-1">IDEOGRAM PROMPT — GOLD/LIME TRUST CERTIFICATE</p>
              <p className="text-[11px] font-mono text-zinc-500 leading-relaxed select-all">{IDEOGRAM_PROMPT}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LyricsTab({ artistId }: { artistId: string }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [style, setStyle] = useState("");
  const [generatedLyrics, setGeneratedLyrics] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/lyrics-requests"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/generate-lyrics", { prompt, genre, mood, style });
      return res.json();
    },
    onSuccess: (data: any) => {
      setGeneratedLyrics(data.lyrics);
      setIsGenerating(false);
      if (!songTitle.trim()) {
        const autoTitle = prompt.trim().split(/[.,!?\n]/)[0].slice(0, 60).trim();
        setSongTitle(autoTitle || "Untitled Track");
      }
      toast({ title: "✦ LYRICS GENERATED", description: "Review below — title auto-populated. Edit and mint when ready." });
    },
    onError: () => {
      setIsGenerating(false);
      toast({ title: "Failed to generate lyrics", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { title: string; lyrics: string; genre?: string; notes?: string }) => {
      return apiRequest("POST", "/api/lyrics-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lyrics-requests"] });
      setGeneratedLyrics("");
      setSongTitle("");
      setPrompt("");
      setGenre("");
      setMood("");
      setStyle("");
      toast({ title: "Lyrics submitted!", description: "Your lyrics have been sent to admin for beat production, mastering, and distribution." });
    },
    onError: () => {
      toast({ title: "Failed to submit lyrics", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lyrics-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lyrics-requests"] });
      toast({ title: "Lyrics request deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_production": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600"><Wand2 className="h-3 w-3 mr-1" />In Production</Badge>;
      case "completed": return <Badge variant="secondary" className="bg-green-500/20 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      <div>
        <h3 className="text-2xl font-extrabold flex items-center gap-3 text-lime-400">
          <div className="h-10 w-10 rounded-lg bg-lime-500/15 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-lime-400" />
          </div>
          ASSET MINT — AI SONG GENERATOR
        </h3>
        <p className="text-sm text-zinc-400 mt-2 font-mono">Describe your song idea below. AI generates complete lyrics. Edit, then mint your asset for distribution.</p>
      </div>

      <Card className="bg-card/60 border-lime-500/30 overflow-hidden w-full">
        <div className="h-1.5 bg-gradient-to-r from-lime-500 via-lime-400 to-emerald-500" />
        <CardContent className="p-6 space-y-5 w-full">
          <div className="w-full">
            <Label className="text-base font-extrabold text-lime-400">Describe your song *</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A love song about missing someone on a rainy night, with a catchy chorus about finding your way back..."
              className="mt-2 w-full font-mono border-lime-500/30 focus:border-lime-500"
              style={{ minHeight: "600px", fontSize: "1.5rem", lineHeight: "2rem" }}
              data-testid="input-lyrics-prompt"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div>
              <Label className="text-sm font-bold text-zinc-300">Genre</Label>
              <Input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. R&B, Hip-Hop..."
                className="mt-1.5 border-lime-500/20"
                style={{ fontSize: "1.5rem", padding: "0.75rem" }}
                data-testid="input-lyrics-genre"
              />
            </div>
            <div>
              <Label className="text-sm font-bold text-zinc-300">Mood</Label>
              <Input
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Melancholic, Upbeat..."
                className="mt-1.5 border-lime-500/20"
                style={{ fontSize: "1.5rem", padding: "0.75rem" }}
                data-testid="input-lyrics-mood"
              />
            </div>
            <div>
              <Label className="text-sm font-bold text-zinc-300">Style Reference</Label>
              <Input
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="e.g. Like Drake, Adele..."
                className="mt-1.5 border-lime-500/20"
                style={{ fontSize: "1.5rem", padding: "0.75rem" }}
                data-testid="input-lyrics-style"
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-6 text-2xl font-extrabold bg-lime-600 hover:bg-lime-700 text-white border-0 shadow-lg shadow-lime-500/20"
            data-testid="button-generate-lyrics"
          >
            {isGenerating ? <Loader2 className="h-7 w-7 mr-3 animate-spin" /> : <Wand2 className="h-7 w-7 mr-3" />}
            {isGenerating ? "GENERATING LYRICS..." : "GENERATE LYRICS"}
          </Button>
        </CardContent>
      </Card>

      {generatedLyrics && (
        <Card className="border-lime-500/40 w-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-extrabold flex items-center gap-2 text-lime-400">
              <Sparkles className="h-5 w-5 text-lime-400" />
              GENERATED LYRICS — READY TO MINT
            </CardTitle>
            <CardDescription className="text-zinc-400">Review and edit your lyrics, then mint your asset for beat production & distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 w-full">
            <div className="w-full">
              <Label className="text-base font-extrabold text-lime-400">Song Title *</Label>
              <Input
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                placeholder="Give your song a title..."
                className="mt-2 border-lime-500/30 font-bold"
                style={{ fontSize: "1.5rem", padding: "0.75rem" }}
                data-testid="input-lyrics-title"
              />
            </div>
            <div className="w-full">
              <Label className="text-base font-extrabold text-lime-400">Lyrics (editable)</Label>
              <Textarea
                value={generatedLyrics}
                onChange={(e) => setGeneratedLyrics(e.target.value)}
                className="mt-2 w-full font-mono border-lime-500/30 focus:border-lime-500"
                style={{ minHeight: "600px", fontSize: "1.5rem", lineHeight: "2rem" }}
                data-testid="input-lyrics-content"
              />
            </div>
            <div className="flex gap-3 w-full">
              <Button
                onClick={() => submitMutation.mutate({
                  title: songTitle,
                  lyrics: generatedLyrics,
                  genre: genre || undefined,
                  notes: `Prompt: ${prompt}${mood ? ` | Mood: ${mood}` : ""}${style ? ` | Style: ${style}` : ""}`,
                })}
                disabled={submitMutation.isPending || !songTitle.trim() || !generatedLyrics.trim()}
                className="flex-1 py-6 text-2xl font-extrabold bg-lime-600 hover:bg-lime-700 text-white border-0 shadow-lg shadow-lime-500/20"
                data-testid="button-submit-lyrics"
              >
                {submitMutation.isPending ? <Loader2 className="h-7 w-7 mr-3 animate-spin" /> : <Send className="h-7 w-7 mr-3" />}
                MINT ASSET
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="py-6 text-xl font-extrabold border-lime-500/30 text-lime-400 hover:bg-lime-500/10 px-8"
                data-testid="button-regenerate-lyrics"
              >
                <Wand2 className="h-6 w-6 mr-2" />
                REGENERATE
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Previous Submissions</h4>
          {requests.map((req: any) => (
            <Card key={req.id} className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{req.title}</p>
                  {req.genre && <p className="text-sm text-muted-foreground">Genre: {req.genre}</p>}
                  {req.adminNotes && <p className="text-sm text-blue-400 truncate">Admin: {req.adminNotes}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(req.status)}
                  {req.status !== "in_production" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this lyrics request?")) {
                          deleteMutation.mutate(req.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-lyrics-${req.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MasteringTab({ artistId, tracks }: { artistId: string; tracks: Track[] }) {
  const { toast } = useToast();
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/mastering-requests"],
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/mastering-requests", {
        artistId,
        trackId: selectedTrackId,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mastering-requests"] });
      setSelectedTrackId("");
      setNotes("");
      toast({ title: "Mastering request submitted!", description: "Our team will process your track and update the status." });
    },
    onError: () => {
      toast({ title: "Failed to submit", description: "Please try again", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/mastering-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mastering-requests"] });
      toast({ title: "Request deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_progress": return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600"><Headphones className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed": return <Badge variant="secondary" className="bg-green-500/20 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const selectedTrack = tracks.find(t => t.id === selectedTrackId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
            <Headphones className="h-4 w-4 text-primary" />
          </div>
          Request Mastering
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Submit your track for professional mastering. Our team will process it with EQ, compression, limiting, and loudness normalization to -14 LUFS.</p>
      </div>

      <Card className="bg-card/60 border-border/30 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-emerald-500" />
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Select Track to Master *</Label>
            <select
              className="w-full mt-1.5 px-3 py-2 bg-background border border-input rounded-md text-sm"
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              data-testid="select-mastering-track"
            >
              <option value="">Select a track</option>
              {tracks.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {selectedTrack && (
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <Disc3 className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium">{selectedTrack.title}</p>
                <p className="text-sm text-muted-foreground">{selectedTrack.genre || "Unknown genre"} · {Math.floor((selectedTrack.duration || 0) / 60)}:{String((selectedTrack.duration || 0) % 60).padStart(2, "0")}</p>
              </div>
            </div>
          )}

          <div>
            <Label>Notes (optional)</Label>
            <textarea
              className="w-full mt-1.5 px-3 py-2 bg-background border border-input rounded-md text-sm min-h-[80px]"
              placeholder="Any special instructions for mastering..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-mastering-notes"
            />
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !selectedTrackId || tracks.length === 0}
            data-testid="button-submit-mastering"
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Headphones className="h-4 w-4 mr-2" />}
            {submitMutation.isPending ? "Submitting..." : "Submit Mastering Request"}
          </Button>
        </CardContent>
      </Card>

      {!isLoading && requests && requests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Mastering History</h4>
          {requests.map((req: any) => {
            const track = tracks.find(t => t.id === req.trackId);
            return (
              <Card key={req.id} className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors" data-testid={`mastering-request-${req.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Headphones className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{track ? track.title : "Track"}</p>
                    {req.notes && <p className="text-sm text-muted-foreground truncate">{req.notes}</p>}
                    {req.adminNotes && <p className="text-sm text-muted-foreground truncate">Admin: {req.adminNotes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(req.status)}
                    {req.status === "completed" && req.masteredUrl && (
                      <button
                        onClick={() => downloadFile(`${req.masteredUrl}?download=true`, `mastered-${req.trackId}.wav`)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        data-testid={`button-download-mastered-${req.id}`}
                        title="Download mastered track"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    {req.status !== "in_production" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this mastering request?")) {
                            deleteMutation.mutate(req.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-mastering-${req.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DistributionTab({ artistId, tracks }: { artistId: string; tracks: Track[] }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [message, setMessage] = useState("");

  const { data: requests, isLoading } = useQuery<any[]>({
    queryKey: ["/api/distribution-requests"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { trackId?: string; message?: string }) => {
      return apiRequest("POST", "/api/distribution-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/distribution-requests"] });
      setShowDialog(false);
      setSelectedTrackId("");
      setMessage("");
      toast({ title: "Distribution request submitted", description: "Your request has been sent to the admin for review." });
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/distribution-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/distribution-requests"] });
      toast({ title: "Distribution request deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete request", variant: "destructive" });
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "approved": return <Badge variant="secondary" className="bg-green-500/20 text-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected": return <Badge variant="secondary" className="bg-red-500/20 text-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-primary" />
            </div>
            Music Distribution
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Request distribution of your tracks to streaming platforms</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20" data-testid="button-distribute-music">
          <Send className="h-4 w-4 mr-2" />
          Distribute My Music
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="space-y-2">
          {requests.map((req: any) => {
            const track = tracks.find(t => t.id === req.trackId);
            return (
              <Card key={req.id} className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Send className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">
                      {track ? track.title : req.trackId ? "Track" : "All Tracks"}
                    </p>
                    {req.message && <p className="text-sm text-muted-foreground truncate">{req.message}</p>}
                    {req.adminNotes && <p className="text-sm text-blue-400 truncate">Admin: {req.adminNotes}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(req.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this distribution request?")) {
                          deleteMutation.mutate(req.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-distribution-${req.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Send className="h-12 w-12 mx-auto mb-3 text-primary/30" />
            <p className="font-medium mb-1">No distribution requests yet</p>
            <p className="text-sm text-muted-foreground">Submit a request to distribute your music to streaming platforms</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Distribute My Music</DialogTitle>
            <DialogDescription>Submit a distribution request to the admin. Select a specific track or request distribution for all your music.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Track (optional)</Label>
              <select
                className="w-full mt-1.5 px-3 py-2 bg-background border border-input rounded-md text-sm"
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                data-testid="select-distribution-track"
              >
                <option value="">All tracks</option>
                {tracks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Message to Admin (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Any notes about your distribution request..."
                className="mt-1.5"
                data-testid="input-distribution-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ trackId: selectedTrackId || undefined, message: message || undefined })}
              disabled={createMutation.isPending}
              data-testid="button-submit-distribution"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="min-h-full pb-28 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <Upload className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-3">Mint Factory</h2>
          <p className="text-muted-foreground mb-6 font-medium">
            Sign in to mint assets, set pre-release dates, and manage your Asset Architect profile
          </p>
          <Button asChild className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20" data-testid="button-login-artist">
            <a href="/api/login">Sign In to Continue</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28">
      <div className="relative overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/3 to-transparent" />
        <div className="relative px-6 py-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
              <Mic2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Mint Factory</h1>
              <p className="text-muted-foreground font-medium">Manage your assets, analytics, and minting operations</p>
            </div>
          </div>
        </div>
      </div>
      <div className="px-6">
        {artistProfile ? (
          <ArtistDashboard artist={artistProfile} />
        ) : (
          <ArtistOnboarding />
        )}
      </div>
    </div>
  );
}

function TipsTab({ artistId }: { artistId: string }) {
  const { data: tipTotal, isLoading: loadingTotal } = useQuery<{ total: string; count: number }>({
    queryKey: ["/api/artists", artistId, "tips"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-border/30 hover:border-green-500/20 transition-colors overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/15 to-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Tips Received</p>
              {loadingTotal ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-black text-green-500" data-testid="text-total-tips">
                  ${parseFloat(tipTotal?.total || "0").toFixed(2)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/30 hover:border-primary/20 transition-colors overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary to-emerald-500" />
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/15 to-emerald-500/10 flex items-center justify-center">
              <Heart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Number of Tips</p>
              {loadingTotal ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-black" data-testid="text-tip-count">
                  {tipTotal?.count || 0}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="bg-card/60 border-border/30">
        <CardHeader>
          <CardTitle className="text-base font-bold">About Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Traders can send you tips directly from your Asset Architect page or while streaming your assets. 
            Tips are processed securely through PayPal. Your tip button appears on your Asset Architect profile 
            and in the music player when your tracks are playing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
