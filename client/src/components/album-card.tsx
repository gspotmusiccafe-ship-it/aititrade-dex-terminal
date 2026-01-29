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
        className="group p-4 rounded-lg bg-card/50 hover-elevate cursor-pointer transition-colors"
        data-testid={`album-card-${album.id}`}
      >
        {/* Album Cover */}
        <div className="relative aspect-square rounded-md overflow-hidden mb-4 shadow-lg">
          {album.coverImage ? (
            <img
              src={album.coverImage}
              alt={album.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="text-4xl font-bold text-primary/50">{album.title[0]}</span>
            </div>
          )}
          
          {/* Play Button Overlay */}
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all shadow-xl"
            data-testid={`button-play-album-${album.id}`}
          >
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </Button>

          {/* Prerelease Badge */}
          {album.isPrerelease && (
            <Badge className="absolute top-2 left-2 bg-primary/90 text-primary-foreground">
              <Star className="h-3 w-3 mr-1" />
              Early Access
            </Badge>
          )}
        </div>

        {/* Album Info */}
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
