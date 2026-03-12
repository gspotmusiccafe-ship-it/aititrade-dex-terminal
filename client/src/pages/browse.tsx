import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, Disc3, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlbumCard } from "@/components/album-card";
import { ArtistCard } from "@/components/artist-card";
import { Link } from "wouter";
import type { AlbumWithArtist, Artist } from "@shared/schema";

function CardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl bg-card/40 border border-border/20">
          <Skeleton className="aspect-square rounded-lg mb-4" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function BrowseAlbums() {
  const { data: albums, isLoading } = useQuery<AlbumWithArtist[]>({
    queryKey: ["/api/albums/new", { limit: 100 }],
    queryFn: () => fetch("/api/albums/new?limit=100").then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full border border-border/30 hover:border-primary/30" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
            <Disc3 className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-browse-title">All Albums</h1>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton count={12} />
      ) : albums && albums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Disc3 className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">No albums available yet</p>
        </div>
      )}
    </div>
  );
}

function BrowseArtists() {
  const { data: artists, isLoading } = useQuery<Artist[]>({
    queryKey: ["/api/artists/top", { limit: 100 }],
    queryFn: () => fetch("/api/artists/top?limit=100").then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full border border-border/30 hover:border-primary/30" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold" data-testid="text-browse-title">All Artists</h1>
        </div>
      </div>

      {isLoading ? (
        <CardSkeleton count={12} />
      ) : artists && artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Users className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">No artists available yet</p>
        </div>
      )}
    </div>
  );
}

export default function BrowsePage() {
  const [matchAlbums] = useRoute("/browse/albums");
  const [matchArtists] = useRoute("/browse/artists");

  return (
    <div className="p-6">
      {matchAlbums && <BrowseAlbums />}
      {matchArtists && <BrowseArtists />}
      {!matchAlbums && !matchArtists && <BrowseAlbums />}
    </div>
  );
}
