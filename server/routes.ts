import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertArtistSchema, insertTrackSchema, insertPlaylistSchema, insertVideoSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // ============ Public Routes ============

  // Featured tracks
  app.get("/api/tracks/featured", async (req, res) => {
    try {
      const tracks = await storage.getFeaturedTracks(20);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching featured tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // Prerelease tracks - requires authentication and premium membership
  app.get("/api/tracks/prerelease", async (req: any, res) => {
    try {
      // Check if user is authenticated
      if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json([]); // Return empty for non-authenticated users
      }
      
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      
      // Only premium/artist tier members can access prerelease tracks
      if (!membership || (membership.tier !== "premium" && membership.tier !== "artist")) {
        return res.json([]); // Return empty for free tier users
      }
      
      const tracks = await storage.getPrereleaseTracks(10);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching prerelease tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // New album releases
  app.get("/api/albums/new", async (req, res) => {
    try {
      const albums = await storage.getNewReleases(10);
      res.json(albums);
    } catch (error) {
      console.error("Error fetching new releases:", error);
      res.status(500).json({ message: "Failed to fetch albums" });
    }
  });

  // Top artists
  app.get("/api/artists/top", async (req, res) => {
    try {
      const artists = await storage.getTopArtists(10);
      res.json(artists);
    } catch (error) {
      console.error("Error fetching top artists:", error);
      res.status(500).json({ message: "Failed to fetch artists" });
    }
  });

  // Get single artist
  app.get("/api/artists/:id", async (req, res) => {
    try {
      const artist = await storage.getArtist(req.params.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }
      res.json(artist);
    } catch (error) {
      console.error("Error fetching artist:", error);
      res.status(500).json({ message: "Failed to fetch artist" });
    }
  });

  // Get artist's tracks
  app.get("/api/artists/:id/tracks", async (req, res) => {
    try {
      const tracks = await storage.getArtistTracks(req.params.id);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching artist tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // Get artist's albums
  app.get("/api/artists/:id/albums", async (req, res) => {
    try {
      const albums = await storage.getArtistAlbums(req.params.id);
      res.json(albums);
    } catch (error) {
      console.error("Error fetching artist albums:", error);
      res.status(500).json({ message: "Failed to fetch albums" });
    }
  });

  // Get single album
  app.get("/api/albums/:id", async (req, res) => {
    try {
      const album = await storage.getAlbum(req.params.id);
      if (!album) {
        return res.status(404).json({ message: "Album not found" });
      }
      res.json(album);
    } catch (error) {
      console.error("Error fetching album:", error);
      res.status(500).json({ message: "Failed to fetch album" });
    }
  });

  // Search
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string || req.query["0"] as string || "";
      if (!query || query.length < 2) {
        return res.json({ tracks: [], albums: [], artists: [] });
      }

      const [tracks, albums, artists] = await Promise.all([
        storage.searchTracks(query),
        storage.searchAlbums(query),
        storage.searchArtists(query),
      ]);

      res.json({ tracks, albums, artists });
    } catch (error) {
      console.error("Error searching:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // ============ Authenticated Routes ============

  // Get current user's artist profile
  app.get("/api/user/artist-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      res.json(artist || null);
    } catch (error) {
      console.error("Error fetching artist profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Create artist profile
  app.post("/api/artists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has an artist profile
      const existing = await storage.getArtistByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "Artist profile already exists" });
      }

      const validated = insertArtistSchema.parse({ ...req.body, userId });
      const artist = await storage.createArtist(validated);
      res.status(201).json(artist);
    } catch (error) {
      console.error("Error creating artist:", error);
      res.status(500).json({ message: "Failed to create artist" });
    }
  });

  // Upload track (artists only)
  app.post("/api/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      
      if (!artist) {
        return res.status(403).json({ message: "You must be an artist to upload tracks" });
      }

      // Ensure the track is being uploaded to the user's own artist profile
      if (req.body.artistId !== artist.id) {
        return res.status(403).json({ message: "Cannot upload tracks for other artists" });
      }

      const validated = insertTrackSchema.parse(req.body);
      const track = await storage.createTrack(validated);
      res.status(201).json(track);
    } catch (error) {
      console.error("Error creating track:", error);
      res.status(500).json({ message: "Failed to create track" });
    }
  });

  // Get tracks for artist portal
  app.get("/api/artist/:id/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const tracks = await storage.getArtistTracks(req.params.id);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching artist tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // User's playlists
  app.get("/api/playlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const playlists = await storage.getUserPlaylists(userId);
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists" });
    }
  });

  // Create playlist
  app.post("/api/playlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertPlaylistSchema.parse({ ...req.body, userId });
      const playlist = await storage.createPlaylist(validated);
      res.status(201).json(playlist);
    } catch (error) {
      console.error("Error creating playlist:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  // Liked tracks
  app.get("/api/user/liked-tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tracks = await storage.getLikedTracks(userId);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching liked tracks:", error);
      res.status(500).json({ message: "Failed to fetch liked tracks" });
    }
  });

  app.get("/api/user/liked-tracks/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const count = await storage.getLikedTracksCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching liked tracks count:", error);
      res.status(500).json({ message: "Failed to fetch count" });
    }
  });

  app.post("/api/user/liked-tracks/:trackId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.likeTrack(userId, req.params.trackId);
      res.json({ liked: true });
    } catch (error) {
      console.error("Error liking track:", error);
      res.status(500).json({ message: "Failed to like track" });
    }
  });

  app.delete("/api/user/liked-tracks/:trackId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.unlikeTrack(userId, req.params.trackId);
      res.json({ liked: false });
    } catch (error) {
      console.error("Error unliking track:", error);
      res.status(500).json({ message: "Failed to unlike track" });
    }
  });

  // Followed artists
  app.get("/api/user/followed-artists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artists = await storage.getFollowedArtists(userId);
      res.json(artists);
    } catch (error) {
      console.error("Error fetching followed artists:", error);
      res.status(500).json({ message: "Failed to fetch followed artists" });
    }
  });

  app.post("/api/user/followed-artists/:artistId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.followArtist(userId, req.params.artistId);
      res.json({ followed: true });
    } catch (error) {
      console.error("Error following artist:", error);
      res.status(500).json({ message: "Failed to follow artist" });
    }
  });

  app.delete("/api/user/followed-artists/:artistId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.unfollowArtist(userId, req.params.artistId);
      res.json({ followed: false });
    } catch (error) {
      console.error("Error unfollowing artist:", error);
      res.status(500).json({ message: "Failed to unfollow artist" });
    }
  });

  // User membership
  app.get("/api/user/membership", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      res.json(membership || { tier: "free", isActive: true });
    } catch (error) {
      console.error("Error fetching membership:", error);
      res.status(500).json({ message: "Failed to fetch membership" });
    }
  });

  // Upgrade membership (simplified - would integrate with Stripe in production)
  app.post("/api/user/membership/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tier } = req.body;
      
      if (!["premium", "artist"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      
      // Check for existing membership
      const existing = await storage.getUserMembership(userId);
      if (existing) {
        // In production, this would update via Stripe webhook
        await storage.updateMembership(existing.id, { tier });
        res.json({ success: true, tier });
      } else {
        const membership = await storage.createMembership({
          userId,
          tier,
          isActive: true,
        });
        res.json({ success: true, tier: membership.tier });
      }
    } catch (error) {
      console.error("Error upgrading membership:", error);
      res.status(500).json({ message: "Failed to upgrade membership" });
    }
  });

  // Cancel membership
  app.post("/api/user/membership/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      
      if (membership) {
        await storage.updateMembership(membership.id, { isActive: false, tier: "free" });
      }
      
      res.json({ success: true, tier: "free" });
    } catch (error) {
      console.error("Error canceling membership:", error);
      res.status(500).json({ message: "Failed to cancel membership" });
    }
  });

  // Track play count
  app.post("/api/tracks/:id/play", async (req, res) => {
    try {
      await storage.incrementPlayCount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error incrementing play count:", error);
      res.status(500).json({ message: "Failed to update play count" });
    }
  });

  // ============ Video Routes ============

  // Get artist's videos
  app.get("/api/artists/:id/videos", async (req, res) => {
    try {
      const videos = await storage.getArtistVideos(req.params.id);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching artist videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  // Upload video (artists only)
  app.post("/api/videos", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      
      if (!artist) {
        return res.status(403).json({ message: "You must be an artist to upload videos" });
      }

      // Ensure the video is being uploaded to the user's own artist profile
      if (req.body.artistId !== artist.id) {
        return res.status(403).json({ message: "Cannot upload videos for other artists" });
      }

      const validated = insertVideoSchema.parse(req.body);
      const video = await storage.createVideo(validated);
      res.status(201).json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  return httpServer;
}
