import { Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { AlbumWithArtist } from "@shared/schema";

interface AlbumCardProps {
  album: AlbumWithArtist;
}

export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Link href={`/album/${album.id}`}>
      <div
        className="group p-4 rounded-xl bg-card/60 hover:bg-card/90 cursor-pointer transition-all duration-300 border border-border/30 hover:border-primary/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
        data-testid={`album-card-${album.id}`}
      >
        <div className="relative aspect-square rounded-lg overflow-hidden mb-4 shadow-lg ring-1 ring-white/5">
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={album.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-primary/15 to-emerald-500/10 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary/50">{album.title[0]}</span>
            </div>
          )}
          
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-xl shadow-primary/30"
            data-testid={`button-play-album-${album.id}`}
          >
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </Button>

          {album.isPrerelease && (
            <Badge className="absolute top-2 left-2 bg-gradient-to-r from-primary/90 to-emerald-500/90 text-primary-foreground border-0 shadow-lg">
              <Star className="h-3 w-3 mr-1" />
              Early Access
            </Badge>
          )}
        </div>

        <h3 className="font-semibold text-sm truncate mb-1">{album.title}</h3>
        <p className="text-xs text-muted-foreground truncate">{album.artist?.name}</p>
        {album.releaseDate && (
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(album.releaseDate).getFullYear()}
          </p>
        )}
      </div>
    </Link>
  );
}
