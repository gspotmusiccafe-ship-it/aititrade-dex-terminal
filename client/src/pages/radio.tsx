import { useState } from "react";
import { SiSpotify } from "react-icons/si";
import { Search, Clock, Loader2, Music2, ExternalLink, Hash, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface SpotifyTrackDetail {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; releaseDate?: string; cover?: { url: string }[] } | null;
  duration: number;
  contentRating: string;
  streamCount: number | null;
  trackNumber: number;
  releaseDate: string | null;
  coverArt: string | null;
}

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatStreamCount(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(2)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export default function RadioPage() {
  const { toast } = useToast();
  const [selectedTrack, setSelectedTrack] = useState<SpotifyTrackDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [trackIdInput, setTrackIdInput] = useState("");

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
      const res = await fetch(`/api/spotify/track/${encodeURIComponent(trackId)}`, { credentials: "include" });
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
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="h-20 w-20 rounded-full bg-[#1DB954] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#1DB954]/20">
            <SiSpotify className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-radio-title">Spotify Stream Counter</h1>
          <p className="text-muted-foreground">Look up verified stream counts for any track on Spotify</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#1DB954]" />
              Track Lookup
            </CardTitle>
            <CardDescription>
              Paste a Spotify Track ID, URL, or URI to get stream counts and track details
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
                <Button
                  onClick={() => lookupTrack(trackIdInput)}
                  disabled={loading || !trackIdInput.trim()}
                  className="bg-[#1DB954] hover:bg-[#1DB954]/90"
                  data-testid="button-spotify-track-lookup"
                >
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
                    <img src={selectedTrack.coverArt} alt={selectedTrack.name} className="w-40 h-40 rounded-lg object-cover shadow-lg" />
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
                  <div className="rounded-lg bg-background/50 p-5 border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Streams</p>
                    <p className="text-4xl font-bold text-[#1DB954]" data-testid="text-spotify-stream-count">
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
          <div className="text-center py-16 text-muted-foreground">
            <Music2 className="h-16 w-16 mx-auto mb-4 text-[#1DB954]/20" />
            <p className="text-lg font-medium mb-1">Ready to Look Up Streams</p>
            <p className="text-sm max-w-md mx-auto">
              Paste any Spotify track link or ID above to see verified stream counts, album info, and track details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
