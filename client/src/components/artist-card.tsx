import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Artist } from "@shared/schema";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link href={`/artist/${artist.id}`}>
      <div
        className="group p-4 rounded-xl bg-card/60 hover:bg-card/90 cursor-pointer transition-all duration-300 border border-border/30 hover:border-primary/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
        data-testid={`artist-card-${artist.id}`}
      >
        <div className="relative aspect-square rounded-full overflow-hidden mb-4 shadow-lg ring-2 ring-border/30 group-hover:ring-primary/30 transition-all">
          {artist.profileImage ? (
            <img
              src={artist.profileImage}
              alt={artist.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-accent/20 to-emerald-500/10 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary/60">{artist.name[0]}</span>
            </div>
          )}
          
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-xl shadow-primary/30"
            data-testid={`button-play-artist-${artist.id}`}
          >
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </Button>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <h3 className="font-bold text-sm truncate">{artist.name}</h3>
            {artist.verified && (
              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Artist</p>
          {artist.monthlyListeners != null && artist.monthlyListeners > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {artist.monthlyListeners.toLocaleString()} monthly listeners
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
