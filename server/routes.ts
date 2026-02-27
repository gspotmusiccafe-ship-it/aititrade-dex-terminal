import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import express from "express";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { insertArtistSchema, insertTrackSchema, insertPlaylistSchema, insertVideoSchema, tracks, jamSessions, jamSessionEngagement, jamSessionListeners, insertJamSessionSchema } from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { getUncachableSpotifyClient } from "./spotify";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedAudio = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4", "audio/x-m4a", "audio/webm"];
    const allowedImage = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowedAudio.includes(file.mimetype) || allowedImage.includes(file.mimetype) ||
        file.originalname.match(/\.(mp3|wav|ogg|flac|aac|m4a|webm|jpg|jpeg|png|webp|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only audio and image files are allowed"));
    }
  },
});

const MEMBERSHIP_LIMITS: Record<string, { downloads: number; previews: number }> = {
  free: { downloads: 0, previews: 0 },
  silver: { downloads: 0, previews: 5 },
  bronze: { downloads: 10, previews: 20 },
  gold: { downloads: -1, previews: -1 },
  artist: { downloads: -1, previews: -1 },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/uploads/:filename", async (req: any, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      res.set("Content-Type", mimeTypes[ext] || "application/octet-stream");
      res.set("Content-Disposition", "inline");
      res.set("X-Content-Type-Options", "nosniff");
      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

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
      
      // Only active paid tier members can access prerelease tracks
      if (!membership || membership.tier === "free" || !membership.isActive) {
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

  // Create artist profile (requires Gold or Artist Pro membership)
  app.post("/api/artists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has an artist profile
      const existing = await storage.getArtistByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "Artist profile already exists" });
      }

      // Require Gold or Artist Pro membership
      const membership = await storage.getUserMembership(userId);
      if (!membership || !membership.isActive || !["gold", "artist"].includes(membership.tier)) {
        return res.status(403).json({ message: "Artist profile requires a Gold ($6.99/mo) or Artist Pro ($19.99/mo) subscription" });
      }

      const validated = insertArtistSchema.parse({ ...req.body, userId });
      const artist = await storage.createArtist(validated);
      res.status(201).json(artist);
    } catch (error) {
      console.error("Error creating artist:", error);
      res.status(500).json({ message: "Failed to create artist" });
    }
  });

  // Update artist profile (with optional image uploads)
  app.patch("/api/artists/profile", isAuthenticated, upload.fields([
    { name: "profileImage", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(404).json({ message: "Artist profile not found" });
      }

      const updates: any = {};
      if (req.body.name && req.body.name.trim()) updates.name = req.body.name.trim();
      if (req.body.bio !== undefined) updates.bio = req.body.bio.trim();

      const profileFile = req.files?.profileImage?.[0];
      const coverFile = req.files?.coverImage?.[0];

      if (profileFile) {
        if (artist.profileImage && artist.profileImage.startsWith("/uploads/")) {
          const oldFile = path.join(uploadsDir, path.basename(artist.profileImage));
          fs.unlink(oldFile, () => {});
        }
        updates.profileImage = `/uploads/${profileFile.filename}`;
      }
      if (coverFile) {
        if (artist.coverImage && artist.coverImage.startsWith("/uploads/")) {
          const oldFile = path.join(uploadsDir, path.basename(artist.coverImage));
          fs.unlink(oldFile, () => {});
        }
        updates.coverImage = `/uploads/${coverFile.filename}`;
      }

      if (Object.keys(updates).length === 0) {
        return res.json(artist);
      }

      const updated = await storage.updateArtist(artist.id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating artist profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Upload track (artists only)
  app.post("/api/tracks", isAuthenticated, upload.fields([
    { name: "audioFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      
      if (!artist) {
        return res.status(403).json({ message: "You must be an artist to upload tracks" });
      }

      const audioFile = req.files?.audioFile?.[0];
      const coverFile = req.files?.coverImage?.[0];

      if (!audioFile) {
        if (coverFile) fs.unlink(path.join(uploadsDir, coverFile.filename), () => {});
        return res.status(400).json({ message: "Audio file is required" });
      }

      const title = (req.body.title || "").trim();
      if (!title || title.length > 200) {
        fs.unlink(path.join(uploadsDir, audioFile.filename), () => {});
        if (coverFile) fs.unlink(path.join(uploadsDir, coverFile.filename), () => {});
        return res.status(400).json({ message: "Track title is required (max 200 characters)" });
      }

      const audioUrl = `/uploads/${audioFile.filename}`;
      const coverImage = coverFile ? `/uploads/${coverFile.filename}` : null;
      const duration = parseInt(req.body.duration);

      const trackData = {
        artistId: artist.id,
        title,
        genre: (req.body.genre || "").trim() || null,
        duration: isNaN(duration) || duration < 1 ? 180 : duration,
        isPrerelease: req.body.isPrerelease === "true",
        audioUrl,
        coverImage,
        albumId: null,
        releaseDate: null,
      };

      const validated = insertTrackSchema.parse(trackData);
      const track = await storage.createTrack(validated);
      res.status(201).json(track);
    } catch (error) {
      console.error("Error creating track:", error);
      if (req.files?.audioFile?.[0]) {
        fs.unlink(path.join(uploadsDir, req.files.audioFile[0].filename), () => {});
      }
      if (req.files?.coverImage?.[0]) {
        fs.unlink(path.join(uploadsDir, req.files.coverImage[0].filename), () => {});
      }
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

  // Update track (artist's own track)
  app.patch("/api/tracks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "You must be an artist" });
      }
      const track = await storage.getTrack(req.params.id);
      if (!track || track.artistId !== artist.id) {
        return res.status(403).json({ message: "Cannot edit this track" });
      }
      const updates: any = {};
      if (req.body.title !== undefined) {
        const trimmedTitle = String(req.body.title).trim();
        if (!trimmedTitle || trimmedTitle.length > 200) {
          return res.status(400).json({ message: "Track title is required (max 200 characters)" });
        }
        updates.title = trimmedTitle;
      }
      if (req.body.genre !== undefined) updates.genre = String(req.body.genre).trim() || null;
      if (req.body.isPrerelease !== undefined) updates.isPrerelease = Boolean(req.body.isPrerelease);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No updates provided" });
      }
      const [updated] = await db.update(tracks).set(updates).where(eq(tracks.id, req.params.id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating track:", error);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  // Delete track (artist's own track)
  app.delete("/api/tracks/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "You must be an artist" });
      }
      const track = await storage.getTrack(req.params.id);
      if (!track || track.artistId !== artist.id) {
        return res.status(403).json({ message: "Cannot delete this track" });
      }
      await storage.deleteTrack(req.params.id);
      if (track.audioUrl.startsWith("/uploads/")) {
        const filename = track.audioUrl.replace("/uploads/", "");
        fs.unlink(path.join(uploadsDir, filename), () => {});
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting track:", error);
      res.status(500).json({ message: "Failed to delete track" });
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

  app.get("/api/user/liked-tracks/:trackId/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const liked = await storage.isTrackLiked(userId, req.params.trackId);
      res.json({ liked });
    } catch (error) {
      res.json({ liked: false });
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
      
      if (!["silver", "bronze", "gold", "artist"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      
      const existing = await storage.getUserMembership(userId);
      if (existing) {
        await storage.updateMembership(existing.id, { tier, downloadsUsed: 0, previewsUsed: 0 });
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

  // Preview track (membership gated)
  app.post("/api/tracks/:id/preview", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      const tier = (membership?.isActive !== false ? membership?.tier : "free") || "free";
      const limits = MEMBERSHIP_LIMITS[tier] || MEMBERSHIP_LIMITS.free;

      if (limits.previews === 0) {
        return res.status(403).json({ message: "Previews require a Silver membership or higher" });
      }

      if (limits.previews > 0) {
        const used = membership?.previewsUsed || 0;
        if (used >= limits.previews) {
          return res.status(403).json({ message: `You've used all ${limits.previews} previews this month. Upgrade for more.` });
        }
        if (membership) {
          await storage.updateMembership(membership.id, { previewsUsed: used + 1 });
        }
      }

      res.json({ success: true, previewsUsed: (membership?.previewsUsed || 0) + 1, previewsLimit: limits.previews });
    } catch (error) {
      console.error("Error recording preview:", error);
      res.status(500).json({ message: "Failed to record preview" });
    }
  });

  // Download track (membership gated)
  app.get("/api/tracks/:id/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const track = await storage.getTrack(req.params.id);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }

      const membership = await storage.getUserMembership(userId);
      const tier = (membership?.isActive !== false ? membership?.tier : "free") || "free";
      const limits = MEMBERSHIP_LIMITS[tier] || MEMBERSHIP_LIMITS.free;

      if (limits.downloads === 0) {
        return res.status(403).json({ message: "Downloads require a Bronze membership or higher" });
      }

      if (limits.downloads > 0) {
        const used = membership?.downloadsUsed || 0;
        if (used >= limits.downloads) {
          return res.status(403).json({ message: `You've used all ${limits.downloads} downloads this month. Upgrade for more.` });
        }
        if (membership) {
          await storage.updateMembership(membership.id, { downloadsUsed: used + 1 });
        }
      }

      const audioUrl = track.audioUrl;
      if (!audioUrl || audioUrl === "/demo-audio.mp3" || audioUrl === "/uploads/demo-audio.wav") {
        return res.status(404).json({ message: "No downloadable audio file available" });
      }

      const filename = path.basename(audioUrl);
      const filePath = path.join(uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Audio file not found on server" });
      }

      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
        ".aac": "audio/aac",
        ".m4a": "audio/mp4",
        ".webm": "audio/webm",
      };

      const safeTitle = track.title.replace(/[^a-zA-Z0-9\s-_]/g, "").trim() || "track";
      res.set("Content-Type", mimeTypes[ext] || "application/octet-stream");
      res.set("Content-Disposition", `attachment; filename="${safeTitle}${ext}"`);
      res.sendFile(filePath);
    } catch (error) {
      console.error("Error downloading track:", error);
      res.status(500).json({ message: "Failed to download track" });
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

  // ============ Admin Routes ============

  // Admin middleware
  const isAdmin = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const isAdminUser = await storage.isUserAdmin(req.user.claims.sub);
    if (!isAdminUser) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Check if user is admin
  app.get("/api/admin/check", isAuthenticated, async (req: any, res) => {
    try {
      const isAdminUser = await storage.isUserAdmin(req.user.claims.sub);
      res.json({ isAdmin: isAdminUser });
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ message: "Failed to check admin status" });
    }
  });

  // Get analytics dashboard data
  app.get("/api/admin/analytics", isAdmin, async (req: any, res) => {
    try {
      const analytics = await storage.getAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Get all users
  app.get("/api/admin/users", isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Suspend/unsuspend user
  app.patch("/api/admin/users/:id/suspend", isAdmin, async (req: any, res) => {
    try {
      const { suspend } = req.body;
      const user = await storage.updateUser(req.params.id, { isSuspended: suspend });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Make/remove admin
  app.patch("/api/admin/users/:id/admin", isAdmin, async (req: any, res) => {
    try {
      const { isAdmin: makeAdmin } = req.body;
      const user = await storage.updateUser(req.params.id, { isAdmin: makeAdmin });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user
  app.delete("/api/admin/users/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get all artists
  app.get("/api/admin/artists", isAdmin, async (req: any, res) => {
    try {
      const artists = await storage.getAllArtists();
      res.json(artists);
    } catch (error) {
      console.error("Error fetching artists:", error);
      res.status(500).json({ message: "Failed to fetch artists" });
    }
  });

  // Get pending artist applications
  app.get("/api/admin/artists/pending", isAdmin, async (req: any, res) => {
    try {
      const pending = await storage.getPendingArtists();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending artists:", error);
      res.status(500).json({ message: "Failed to fetch pending artists" });
    }
  });

  // Approve artist
  app.patch("/api/admin/artists/:id/approve", isAdmin, async (req: any, res) => {
    try {
      const artist = await storage.approveArtist(req.params.id);
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }
      res.json(artist);
    } catch (error) {
      console.error("Error approving artist:", error);
      res.status(500).json({ message: "Failed to approve artist" });
    }
  });

  // Reject artist
  app.patch("/api/admin/artists/:id/reject", isAdmin, async (req: any, res) => {
    try {
      const { reason } = req.body;
      const artist = await storage.rejectArtist(req.params.id, reason || "Application rejected");
      if (!artist) {
        return res.status(404).json({ message: "Artist not found" });
      }
      res.json(artist);
    } catch (error) {
      console.error("Error rejecting artist:", error);
      res.status(500).json({ message: "Failed to reject artist" });
    }
  });

  // Delete artist
  app.delete("/api/admin/artists/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteArtist(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting artist:", error);
      res.status(500).json({ message: "Failed to delete artist" });
    }
  });

  // Delete track (content moderation)
  app.delete("/api/admin/tracks/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteTrack(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting track:", error);
      res.status(500).json({ message: "Failed to delete track" });
    }
  });

  // Delete video (content moderation)
  app.delete("/api/admin/videos/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // Get all memberships
  app.get("/api/admin/memberships", isAdmin, async (req: any, res) => {
    try {
      const memberships = await storage.getAllMemberships();
      res.json(memberships);
    } catch (error) {
      console.error("Error fetching memberships:", error);
      res.status(500).json({ message: "Failed to fetch memberships" });
    }
  });

  // Get all tracks for moderation
  app.get("/api/admin/tracks", isAdmin, async (req: any, res) => {
    try {
      const tracks = await storage.getFeaturedTracks(100);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // === Spotify Playback & Jam Sessions ===

  app.get("/api/spotify/me", isAuthenticated, async (req: any, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const profile = await spotify.currentUser.profile();
      res.json({
        connected: true,
        name: profile.display_name,
        email: profile.email,
        product: profile.product,
        isPremium: profile.product === "premium",
        image: profile.images?.[0]?.url,
      });
    } catch (error: any) {
      res.json({ connected: false, error: error.message });
    }
  });

  app.get("/api/spotify/player", isAuthenticated, async (req: any, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const state = await spotify.player.getPlaybackState();
      res.json(state || { is_playing: false });
    } catch (error) {
      res.json({ is_playing: false });
    }
  });

  app.get("/api/spotify/devices", isAuthenticated, async (req: any, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      const devices = await spotify.player.getAvailableDevices();
      res.json(devices);
    } catch (error) {
      res.json({ devices: [] });
    }
  });

  app.post("/api/spotify/play", isAuthenticated, async (req: any, res) => {
    try {
      const { uri, deviceId } = req.body;
      const spotify = await getUncachableSpotifyClient();
      const options: any = {};
      if (deviceId) options.device_id = deviceId;
      if (uri) {
        if (uri.includes(":track:")) {
          options.uris = [uri];
        } else {
          options.context_uri = uri;
        }
      }
      await spotify.player.startResumePlayback(deviceId || "", options.context_uri, options.uris);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Spotify play error:", error);
      res.status(400).json({ message: error.message || "Failed to start playback" });
    }
  });

  app.put("/api/spotify/pause", isAuthenticated, async (req: any, res) => {
    try {
      const spotify = await getUncachableSpotifyClient();
      await spotify.player.pausePlayback("");
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to pause" });
    }
  });

  app.get("/api/spotify/search", isAuthenticated, async (req: any, res) => {
    try {
      const { q, type } = req.query;
      if (!q) return res.status(400).json({ message: "Query required" });
      const spotify = await getUncachableSpotifyClient();
      const searchTypes = (type as string || "track,playlist,album").split(",") as any[];
      const results = await spotify.search(q as string, searchTypes, undefined, 10);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Search failed" });
    }
  });

  // Jam Session Engagement Overview (must be before :id routes)
  app.get("/api/jam-sessions/engagement/overview", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userSessions = await db.select().from(jamSessions).where(eq(jamSessions.userId, userId));
      const sessionIds = userSessions.map(s => s.id);
      if (!sessionIds.length) return res.json({ sessions: [], totalListeners: 0, totalEngagements: 0 });

      const overview = await Promise.all(sessionIds.map(async (sid) => {
        const listenerCount = await db.select({ total: sql<number>`COUNT(DISTINCT ${jamSessionListeners.userId})` })
          .from(jamSessionListeners).where(eq(jamSessionListeners.sessionId, sid));
        const engagementCount = await db.select({ total: count() })
          .from(jamSessionEngagement).where(eq(jamSessionEngagement.sessionId, sid));
        const session = userSessions.find(s => s.id === sid)!;
        return {
          ...session,
          uniqueListeners: Number(listenerCount[0]?.total || 0),
          totalEngagements: Number(engagementCount[0]?.total || 0),
        };
      }));

      const totalListeners = overview.reduce((sum, s) => sum + s.uniqueListeners, 0);
      const totalEngagements = overview.reduce((sum, s) => sum + s.totalEngagements, 0);

      res.json({ sessions: overview, totalListeners, totalEngagements });
    } catch (error) {
      console.error("Error fetching engagement overview:", error);
      res.status(500).json({ message: "Failed to fetch engagement overview" });
    }
  });

  // Jam Sessions CRUD
  app.get("/api/jam-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await db.select().from(jamSessions).where(eq(jamSessions.userId, userId)).orderBy(jamSessions.createdAt);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jam sessions" });
    }
  });

  app.post("/api/jam-sessions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, spotifyUri, spotifyName, spotifyType, scheduledTime, daysOfWeek } = req.body;
      if (!name || !spotifyUri || !scheduledTime) {
        return res.status(400).json({ message: "Name, Spotify URI, and scheduled time are required" });
      }
      const [session] = await db.insert(jamSessions).values({
        userId,
        name: name.trim(),
        spotifyUri,
        spotifyName: spotifyName || null,
        spotifyType: spotifyType || "track",
        scheduledTime,
        daysOfWeek: daysOfWeek || "0,1,2,3,4,5,6",
        isActive: true,
      }).returning();
      res.json(session);
    } catch (error) {
      console.error("Error creating jam session:", error);
      res.status(500).json({ message: "Failed to create jam session" });
    }
  });

  app.patch("/api/jam-sessions/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(and(eq(jamSessions.id, req.params.id), eq(jamSessions.userId, userId)));
      if (!session.length) return res.status(404).json({ message: "Session not found" });
      const [updated] = await db.update(jamSessions).set({ isActive: !session[0].isActive }).where(eq(jamSessions.id, req.params.id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle session" });
    }
  });

  app.delete("/api/jam-sessions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(and(eq(jamSessions.id, req.params.id), eq(jamSessions.userId, userId)));
      if (!session.length) return res.status(404).json({ message: "Session not found" });
      await db.delete(jamSessions).where(eq(jamSessions.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete session" });
    }
  });

  app.post("/api/jam-sessions/:id/play-now", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(and(eq(jamSessions.id, req.params.id), eq(jamSessions.userId, userId)));
      if (!session.length) return res.status(404).json({ message: "Session not found" });
      const spotify = await getUncachableSpotifyClient();
      const uri = session[0].spotifyUri;
      if (uri.includes(":track:")) {
        await spotify.player.startResumePlayback("", undefined, [uri]);
      } else {
        await spotify.player.startResumePlayback("", uri);
      }
      await db.update(jamSessions).set({ lastTriggered: new Date() }).where(eq(jamSessions.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Jam session play error:", error);
      res.status(400).json({ message: error.message || "Failed to start playback. Make sure Spotify is open on a device." });
    }
  });

  app.post("/api/jam-sessions/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(eq(jamSessions.id, req.params.id));
      if (!session.length) return res.status(404).json({ message: "Session not found" });

      const existing = await db.select().from(jamSessionListeners)
        .where(and(eq(jamSessionListeners.sessionId, req.params.id), eq(jamSessionListeners.userId, userId), sql`${jamSessionListeners.leftAt} IS NULL`));
      if (existing.length) return res.json(existing[0]);

      const user = await storage.getUser(userId);
      const [listener] = await db.insert(jamSessionListeners).values({
        sessionId: req.params.id,
        userId,
        userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : null,
        userEmail: user?.email || null,
      }).returning();
      res.json(listener);
    } catch (error) {
      console.error("Error joining session:", error);
      res.status(500).json({ message: "Failed to join session" });
    }
  });

  app.post("/api/jam-sessions/:id/leave", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await db.update(jamSessionListeners)
        .set({ leftAt: new Date() })
        .where(and(eq(jamSessionListeners.sessionId, req.params.id), eq(jamSessionListeners.userId, userId), sql`${jamSessionListeners.leftAt} IS NULL`));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to leave session" });
    }
  });

  app.post("/api/jam-sessions/:id/engagement", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { action, trackName, trackArtist, spotifyUri, metadata } = req.body;
      if (!action) return res.status(400).json({ message: "Action is required" });
      const validActions = ["play", "save", "share", "skip", "like", "add_to_playlist"];
      if (!validActions.includes(action)) return res.status(400).json({ message: "Invalid action type" });

      const [engagement] = await db.insert(jamSessionEngagement).values({
        sessionId: req.params.id,
        userId,
        action,
        trackName: trackName || null,
        trackArtist: trackArtist || null,
        spotifyUri: spotifyUri || null,
        metadata: metadata || null,
      }).returning();
      res.json(engagement);
    } catch (error) {
      console.error("Error recording engagement:", error);
      res.status(500).json({ message: "Failed to record engagement" });
    }
  });

  app.get("/api/jam-sessions/:id/engagement", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(and(eq(jamSessions.id, req.params.id), eq(jamSessions.userId, userId)));
      if (!session.length) return res.status(404).json({ message: "Session not found" });

      const engagements = await db.select().from(jamSessionEngagement)
        .where(eq(jamSessionEngagement.sessionId, req.params.id))
        .orderBy(desc(jamSessionEngagement.createdAt));

      const listeners = await db.select().from(jamSessionListeners)
        .where(eq(jamSessionListeners.sessionId, req.params.id))
        .orderBy(desc(jamSessionListeners.joinedAt));

      const actionCounts = await db.select({
        action: jamSessionEngagement.action,
        total: count(),
      }).from(jamSessionEngagement)
        .where(eq(jamSessionEngagement.sessionId, req.params.id))
        .groupBy(jamSessionEngagement.action);

      const uniqueListenerCount = await db.select({
        total: sql<number>`COUNT(DISTINCT ${jamSessionListeners.userId})`,
      }).from(jamSessionListeners)
        .where(eq(jamSessionListeners.sessionId, req.params.id));

      const topTracks = await db.select({
        trackName: jamSessionEngagement.trackName,
        trackArtist: jamSessionEngagement.trackArtist,
        spotifyUri: jamSessionEngagement.spotifyUri,
        total: count(),
      }).from(jamSessionEngagement)
        .where(and(eq(jamSessionEngagement.sessionId, req.params.id), eq(jamSessionEngagement.action, "play")))
        .groupBy(jamSessionEngagement.trackName, jamSessionEngagement.trackArtist, jamSessionEngagement.spotifyUri)
        .orderBy(desc(count()))
        .limit(10);

      res.json({
        session: session[0],
        engagements,
        listeners,
        stats: {
          actionCounts: actionCounts.reduce((acc: any, row: any) => { acc[row.action] = Number(row.total); return acc; }, {}),
          uniqueListeners: Number(uniqueListenerCount[0]?.total || 0),
          totalEngagements: engagements.length,
          topTracks,
        },
      });
    } catch (error) {
      console.error("Error fetching engagement:", error);
      res.status(500).json({ message: "Failed to fetch engagement data" });
    }
  });

  // Jam Session Scheduler - checks every minute
  setInterval(async () => {
    try {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, "0");
      const currentMinute = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHour}:${currentMinute}`;
      const currentDay = now.getDay().toString();

      const activeSessions = await db.select().from(jamSessions).where(eq(jamSessions.isActive, true));

      for (const session of activeSessions) {
        if (session.scheduledTime !== currentTime) continue;
        const days = session.daysOfWeek.split(",");
        if (!days.includes(currentDay)) continue;

        const lastTriggered = session.lastTriggered;
        if (lastTriggered) {
          const diffMs = now.getTime() - new Date(lastTriggered).getTime();
          if (diffMs < 120000) continue;
        }

        try {
          const spotify = await getUncachableSpotifyClient();
          const uri = session.spotifyUri;
          if (uri.includes(":track:")) {
            await spotify.player.startResumePlayback("", undefined, [uri]);
          } else {
            await spotify.player.startResumePlayback("", uri);
          }
          await db.update(jamSessions).set({ lastTriggered: new Date() }).where(eq(jamSessions.id, session.id));
          console.log(`[Scheduler] Started jam session: ${session.name} at ${currentTime}`);
        } catch (err: any) {
          console.log(`[Scheduler] Failed to start ${session.name}: ${err.message}`);
        }
      }
    } catch (error) {
      // Silent fail for scheduler
    }
  }, 60000);

  app.get("/api/admin/spotify/search", isAdmin, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string" || q.trim().length === 0) {
        return res.status(400).json({ message: "Search query is required" });
      }
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) {
        return res.status(500).json({ message: "RapidAPI key not configured" });
      }
      const response = await fetch(
        `https://spotify-statistics-and-stream-count.p.rapidapi.com/search?q=${encodeURIComponent(q.trim())}`,
        {
          headers: {
            "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com",
            "x-rapidapi-key": rapidApiKey,
          },
        }
      );
      if (!response.ok) {
        return res.status(response.status).json({ message: "Spotify API request failed" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error searching Spotify:", error);
      res.status(500).json({ message: "Failed to search Spotify" });
    }
  });

  app.get("/api/admin/spotify/track/:trackId", isAdmin, async (req: any, res) => {
    try {
      const { trackId } = req.params;
      if (!trackId || typeof trackId !== "string") {
        return res.status(400).json({ message: "Track ID is required" });
      }
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) {
        return res.status(500).json({ message: "RapidAPI key not configured" });
      }
      const response = await fetch(
        `https://spotify-statistics-and-stream-count.p.rapidapi.com/track/${encodeURIComponent(trackId)}`,
        {
          headers: {
            "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com",
            "x-rapidapi-key": rapidApiKey,
          },
        }
      );
      if (!response.ok) {
        return res.status(response.status).json({ message: "Spotify API request failed" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Error fetching Spotify track:", error);
      res.status(500).json({ message: "Failed to fetch Spotify track" });
    }
  });

  return httpServer;
}
