import { useQuery } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import { Radio as RadioIcon, Sun, Sunrise, CloudSun, Sunset, Moon, Play, ExternalLink, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RadioShow } from "@shared/schema";

const SLOT_CONFIG: Record<string, { label: string; icon: any; gradient: string; time: string }> = {
  morning: { label: "Morning Show", icon: Sunrise, gradient: "from-amber-500/20 to-yellow-500/20", time: "6 AM - 10 AM" },
  midday: { label: "Mid-Day Vibes", icon: Sun, gradient: "from-orange-500/20 to-red-500/20", time: "10 AM - 2 PM" },
  afternoon: { label: "Afternoon Drive", icon: CloudSun, gradient: "from-sky-500/20 to-blue-500/20", time: "2 PM - 6 PM" },
  evening: { label: "Evening Sessions", icon: Sunset, gradient: "from-purple-500/20 to-pink-500/20", time: "6 PM - 10 PM" },
  bedtime: { label: "Bedtime Music", icon: Moon, gradient: "from-indigo-500/20 to-violet-500/20", time: "10 PM - 6 AM" },
};

function extractSpotifyEmbedUrl(url: string): string | null {
  try {
    let spotifyUrl = url.trim();
    if (spotifyUrl.startsWith("spotify:")) {
      const parts = spotifyUrl.split(":");
      if (parts.length >= 3) {
        spotifyUrl = `https://open.spotify.com/${parts[1]}/${parts[2]}`;
      }
    }
    const match = spotifyUrl.match(/open\.spotify\.com\/(playlist|album|track)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    }
    return null;
  } catch {
    return null;
  }
}

function ShowCard({ show }: { show: RadioShow }) {
  const config = SLOT_CONFIG[show.slot] || SLOT_CONFIG.morning;
  const Icon = config.icon;
  const embedUrl = extractSpotifyEmbedUrl(show.spotifyPlaylistUrl);

  return (
    <Card className="overflow-hidden border-border/50 hover:border-[#1DB954]/30 transition-colors" data-testid={`radio-show-${show.id}`}>
      <CardContent className="p-0">
        <div className={`p-4 bg-gradient-to-r ${config.gradient}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-background/80 flex items-center justify-center">
              <Icon className="h-5 w-5 text-[#1DB954]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate" data-testid={`text-show-name-${show.id}`}>{show.name}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{config.label}</Badge>
                <span className="text-xs text-muted-foreground">{config.time}</span>
              </div>
            </div>
            <a
              href={show.spotifyPlaylistUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm" className="gap-1.5 border-[#1DB954]/30 hover:bg-[#1DB954]/10" data-testid={`button-open-spotify-${show.id}`}>
                <SiSpotify className="h-4 w-4 text-[#1DB954]" />
                Open in Spotify
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          </div>
          {show.description && (
            <p className="text-sm text-muted-foreground mt-2 ml-[52px]">{show.description}</p>
          )}
        </div>

        {embedUrl && (
          <div className="p-4">
            <iframe
              src={embedUrl}
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
              data-testid={`embed-spotify-${show.id}`}
            />
          </div>
        )}

        {!embedUrl && (
          <div className="p-6 text-center">
            <a href={show.spotifyPlaylistUrl} target="_blank" rel="noopener noreferrer">
              <Button className="bg-[#1DB954] hover:bg-[#1DB954]/90 gap-2" data-testid={`button-listen-${show.id}`}>
                <Play className="h-4 w-4" />
                Listen on Spotify
              </Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RadioPage() {
  const { data: shows, isLoading } = useQuery<RadioShow[]>({
    queryKey: ["/api/radio-shows"],
  });

  if (isLoading) {
    return (
      <div className="min-h-full pb-28 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-28 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <RadioIcon className="h-8 w-8 text-[#1DB954]" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-radio-title">Spotify Jam Sessions</h1>
            <p className="text-muted-foreground">Pre-loaded playlists by show - Powered by Spotify</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 ml-11">
          <SiSpotify className="h-4 w-4 text-[#1DB954]" />
          <span className="text-sm text-muted-foreground">
            Click any show to stream directly on Spotify
          </span>
        </div>

        {shows && shows.length > 0 ? (
          <div className="space-y-6">
            {shows.map((show) => (
              <ShowCard key={show.id} show={show} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Music className="h-16 w-16 mx-auto mb-4 text-[#1DB954]/30" />
              <h2 className="text-xl font-bold mb-2">No Shows Scheduled</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Radio shows are being set up. Check back soon for Morning, Mid-Day, Afternoon, Evening, and Bedtime playlists.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
