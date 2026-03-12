import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Music className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">
          This page doesn't exist — let's get you back to the music.
        </p>
        <Button asChild className="bg-gradient-to-r from-primary to-emerald-500 border-0 shadow-lg shadow-primary/20" data-testid="button-go-home">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
