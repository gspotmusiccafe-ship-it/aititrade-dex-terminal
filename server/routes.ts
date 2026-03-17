import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import express from "express";
import { spawn } from "child_process";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, registerAuthRoutes, isAuthenticated, requireSpotify } from "./replit_integrations/auth";
import { openai } from "./replit_integrations/audio/client";
import { insertArtistSchema, insertTrackSchema, insertPlaylistSchema, insertVideoSchema, artists, tracks, orders, likedTracks, jamSessions, jamSessionEngagement, jamSessionListeners, insertJamSessionSchema, streamQualifiers, spotifyRoyaltyTracks } from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { getSpotifyClientForUser, getSpotifyProfile } from "./spotify";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault, verifyPaypalOrder, createTipOrder, captureTipOrder, createGoldSubscription, getSubscriptionDetails, cancelSubscription } from "./paypal";
import { objectStorageClient } from "./replit_integrations/object_storage";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";

import ffmpegStatic from "ffmpeg-static";
import { execSync } from "child_process";
let FFMPEG_PATH = ffmpegStatic || "ffmpeg";
if (!ffmpegStatic) {
  try {
    FFMPEG_PATH = execSync("which ffmpeg", { encoding: "utf-8" }).trim() || "ffmpeg";
  } catch {
    FFMPEG_PATH = "ffmpeg";
  }
}
console.log(`[mastering] ffmpeg path: ${FFMPEG_PATH}`);

async function uploadToObjectStorage(localFilePath: string, filename: string, contentType: string): Promise<string> {
  const objectName = `uploads/${filename}`;
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const file = bucket.file(objectName);
  await file.save(fs.readFileSync(localFilePath), {
    metadata: { contentType },
  });
  fs.unlink(localFilePath, () => {});
  return `/cloud/${objectName}`;
}

async function deleteFromObjectStorage(cloudPath: string): Promise<void> {
  if (!cloudPath.startsWith("/cloud/")) return;
  const objectName = cloudPath.replace("/cloud/", "");
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const file = bucket.file(objectName);
  try {
    await file.delete();
  } catch (e: any) {
    console.error("Error deleting from object storage:", e.message);
  }
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
  entry_trader: { downloads: 0, previews: 0 },
  exchange_trader: { downloads: 0, previews: -1 },
  mint_factory_ceo: { downloads: -1, previews: -1 },
};

const PAID_TIERS = ["entry_trader", "exchange_trader", "mint_factory_ceo"];

async function getUserTier(userId: string): Promise<string> {
  const membership = await storage.getUserMembership(userId);
  return membership?.tier || "free";
}

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

  app.get("/cloud/uploads/:filename", async (req: any, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const objectName = `uploads/${filename}`;
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found" });
      }
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType || "application/octet-stream";
      const fileSize = parseInt(metadata.size as string, 10);

      res.set("Accept-Ranges", "bytes");
      res.set("Content-Type", contentType);
      if (req.query.download === "true") {
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
      } else {
        res.set("Content-Disposition", "inline");
      }
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Cache-Control", "public, max-age=3600");

      const rangeHeader = req.headers.range;
      if (rangeHeader && fileSize) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        res.set("Content-Length", String(chunkSize));

        const stream = file.createReadStream({ start, end });
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming file" });
          }
        });
        stream.pipe(res);
      } else {
        if (fileSize) {
          res.set("Content-Length", String(fileSize));
        }
        const stream = file.createReadStream();
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming file" });
          }
        });
        stream.pipe(res);
      }
    } catch (error) {
      console.error("Error serving cloud file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // ============ Public Routes ============

  // Featured tracks (radio playlist - only tracks marked as featured by admin)
  app.get("/api/tracks/featured", async (req, res) => {
    try {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      const allResult = await db
        .select()
        .from(tracks)
        .innerJoin(artists, eq(tracks.artistId, artists.id))
        .orderBy(desc(tracks.playCount));
      const allTracks = allResult.map(r => ({ ...r.tracks, artist: r.artists }));
      res.json(allTracks);
    } catch (error) {
      console.error("Error fetching featured tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const { trackId } = req.body;
      if (!trackId || typeof trackId !== "string") return res.status(400).json({ message: "trackId required" });

      const result = await db.transaction(async (tx) => {
        const [track] = await tx.select().from(tracks).where(eq(tracks.id, trackId));
        if (!track) throw new Error("NOT_FOUND");

        const price = parseFloat(track.unitPrice || "0.99");
        if (isNaN(price) || price <= 0) throw new Error("INVALID_PRICE");

        const releaseType = ((track as any).releaseType || "native").toLowerCase();
        const isGlobal = releaseType === "global";
        const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);
        const currentSales = track.salesCount || 0;
        const originatorCredit = parseFloat((price * 0.16).toFixed(4));
        const positionValue = parseFloat((price - originatorCredit).toFixed(4));

        if (isGlobal) {
          const ts = Date.now().toString(36).toUpperCase();
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          const trustId = `TRST-977-${ticker}-${ts.slice(-4)}${rand.slice(0, 2)}`;

          const [order] = await tx.insert(orders).values({
            trackId,
            trackingNumber: trustId,
            unitPrice: price.toString(),
            creatorCredit: "0.16",
            creatorCreditAmount: originatorCredit.toString(),
            positionHolderAmount: positionValue.toString(),
            status: "verified",
          }).returning();

          await tx.update(tracks)
            .set({ salesCount: sql`${tracks.salesCount} + 1` })
            .where(eq(tracks.id, trackId));

          return {
            type: "global" as const,
            order: { id: order.id, trustId: order.trackingNumber, status: order.status, createdAt: order.createdAt },
            receipt: {
              trustId: order.trackingNumber,
              asset: track.title,
              ticker,
              unitPrice: price,
              originatorCredit,
              positionValue,
              aiModel: track.aiModel || "AITIFY-GEN-1",
              releaseType: "global",
              status: "VERIFIED",
              storeUrl: "https://payhip.com/aitifymusicstore",
              timestamp: new Date().toISOString(),
            },
          };
        }

        const currentGross = currentSales * price;
        if (currentGross >= 1000) throw new Error("CEILING_REACHED");

        const seq = String(currentSales + 1).padStart(3, "0");
        const mintId = `MNT-977-${ticker}-${seq}`;

        const [order] = await tx.insert(orders).values({
          trackId,
          trackingNumber: mintId,
          unitPrice: price.toString(),
          creatorCredit: "0.16",
          creatorCreditAmount: originatorCredit.toString(),
          positionHolderAmount: positionValue.toString(),
          status: "confirmed",
        }).returning();

        const [updated] = await tx.update(tracks)
          .set({ salesCount: sql`${tracks.salesCount} + 1` })
          .where(eq(tracks.id, trackId))
          .returning();

        const newSales = updated.salesCount || currentSales + 1;
        const newGross = parseFloat((newSales * price).toFixed(2));
        const capacityPct = Math.min(100, parseFloat(((newGross / 1000) * 100).toFixed(1)));

        return {
          type: "native" as const,
          order: { id: order.id, mintId: order.trackingNumber, status: order.status, createdAt: order.createdAt },
          receipt: {
            mintId: order.trackingNumber,
            asset: track.title,
            ticker,
            unitPrice: price,
            originatorCredit,
            positionValue,
            aiModel: track.aiModel || "AITIFY-GEN-1",
            grossSales: newGross,
            totalMints: newSales,
            mintCap: 1000,
            capacityPct,
            releaseType: "native",
            status: newGross >= 1000 ? "CLOSED" : "MINTED",
            timestamp: new Date().toISOString(),
          },
        };
      });

      res.json(result);
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ message: "Asset not found" });
      if (error.message === "CEILING_REACHED") return res.status(409).json({ message: "TRADE CLOSED — $1K CEILING REACHED" });
      if (error.message === "INVALID_PRICE") return res.status(400).json({ message: "Invalid asset price" });
      console.error("Order placement error:", error);
      res.status(500).json({ message: "Order failed" });
    }
  });

  app.get("/api/mints/total", async (req, res) => {
    try {
      const [result] = await db.select({ total: count() }).from(orders);
      const allTracks = await db.select({
        id: tracks.id,
        title: tracks.title,
        salesCount: tracks.salesCount,
        unitPrice: tracks.unitPrice,
      }).from(tracks);
      const totalGross = allTracks.reduce((sum, t) => sum + ((t.salesCount || 0) * parseFloat(t.unitPrice || "0.99")), 0);
      res.json({
        totalMints: result?.total || 0,
        mintCap: 1000,
        totalGross: parseFloat(totalGross.toFixed(2)),
        assets: allTracks.map(t => ({
          id: t.id,
          title: t.title,
          mints: t.salesCount || 0,
          gross: parseFloat(((t.salesCount || 0) * parseFloat(t.unitPrice || "0.99")).toFixed(2)),
        })),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch mint stats" });
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
      
      if (!membership || membership.tier === "free" || membership.tier === "entry_trader" || !membership.isActive) {
        return res.json([]);
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
      const limit = Math.min(Number(req.query.limit) || 10, 100);
      const albums = await storage.getNewReleases(limit);
      res.json(albums);
    } catch (error) {
      console.error("Error fetching new releases:", error);
      res.status(500).json({ message: "Failed to fetch albums" });
    }
  });

  // Top artists
  app.get("/api/artists/top", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 100);
      const artists = await storage.getTopArtists(limit);
      res.json(artists);
    } catch (error) {
      console.error("Error fetching top artists:", error);
      res.status(500).json({ message: "Failed to fetch artists" });
    }
  });

  app.get("/api/showtown/artists", async (_req, res) => {
    try {
      const allArtists = await db.select({
        id: artists.id,
        name: artists.name,
        bio: artists.bio,
        profileImage: artists.profileImage,
        coverImage: artists.coverImage,
        verified: artists.verified,
        monthlyListeners: artists.monthlyListeners,
        approvalStatus: artists.approvalStatus,
        totalStreams: sql<number>`CAST(COALESCE(SUM(${tracks.playCount}), 0) AS INTEGER)`,
        trackCount: sql<number>`CAST(COUNT(${tracks.id}) AS INTEGER)`,
      })
      .from(artists)
      .leftJoin(tracks, eq(tracks.artistId, artists.id))
      .where(eq(artists.approvalStatus, "approved"))
      .groupBy(artists.id)
      .orderBy(sql`COALESCE(SUM(${tracks.playCount}), 0) DESC`);
      res.json(allArtists.map(a => ({ ...a, totalStreams: Number(a.totalStreams), trackCount: Number(a.trackCount) })));
    } catch (error) {
      console.error("Error fetching showtown artists:", error);
      res.status(500).json({ message: "Failed to fetch showtown data" });
    }
  });

  app.get("/api/showtown/tracks", async (_req, res) => {
    try {
      const allTracks = await db.select({
        id: tracks.id,
        title: tracks.title,
        playCount: tracks.playCount,
        artistId: tracks.artistId,
        genre: tracks.genre,
      })
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(artists.approvalStatus, "approved"))
      .orderBy(desc(tracks.playCount));
      res.json(allTracks.map(t => ({ ...t, playCount: Number(t.playCount) })));
    } catch (error) {
      console.error("Error fetching showtown tracks:", error);
      res.status(500).json({ message: "Failed to fetch showtown tracks" });
    }
  });

  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const leaderboardTracks = await db.select({
        id: tracks.id,
        title: tracks.title,
        playCount: tracks.playCount,
        genre: tracks.genre,
        coverImage: tracks.coverImage,
        artistId: tracks.artistId,
        artistName: artists.name,
        artistImage: artists.profileImage,
        likeCount: sql<number>`CAST(COALESCE((SELECT COUNT(*) FROM liked_tracks WHERE liked_tracks.track_id = ${tracks.id}), 0) AS INTEGER)`,
      })
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(and(eq(artists.approvalStatus, "approved"), eq(tracks.isPrerelease, false)))
      .orderBy(desc(tracks.playCount))
      .limit(50);

      const rankedTracks = leaderboardTracks.map(t => {
        const plays = Number(t.playCount) || 0;
        const likes = Number(t.likeCount) || 0;
        const engagementScore = plays + (likes * 5);
        let rank = "bronze";
        if (engagementScore >= 10000) rank = "platinum";
        else if (engagementScore >= 5000) rank = "gold";
        else if (engagementScore >= 1000) rank = "silver";
        return { ...t, playCount: plays, likeCount: likes, engagementScore, rank };
      });

      rankedTracks.sort((a, b) => b.engagementScore - a.engagementScore);

      const totalStreams = rankedTracks.reduce((sum, t) => sum + t.playCount, 0);
      const artistIds = new Set(rankedTracks.map(t => t.artistId));

      res.json({
        tracks: rankedTracks,
        stats: {
          totalStreams,
          totalArtists: artistIds.size,
          totalTracks: rankedTracks.length,
          topTrack: rankedTracks[0] || null,
        },
      });
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
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

  // Create artist profile (requires Gold membership)
  app.post("/api/artists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user already has an artist profile
      const existing = await storage.getArtistByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "Artist profile already exists" });
      }

      // Require Gold membership
      const membership = await storage.getUserMembership(userId);
      if (!membership || !membership.isActive || membership.tier !== "mint_factory_ceo") {
        return res.status(403).json({ message: "Artist profile requires a Mint Factory CEO ($99 to join) subscription" });
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

      const oldProfileImage = artist.profileImage;
      const oldCoverImage = artist.coverImage;

      if (profileFile) {
        const cloudPath = await uploadToObjectStorage(
          path.join(uploadsDir, profileFile.filename),
          profileFile.filename,
          profileFile.mimetype
        );
        updates.profileImage = cloudPath;
      }
      if (coverFile) {
        const cloudPath = await uploadToObjectStorage(
          path.join(uploadsDir, coverFile.filename),
          coverFile.filename,
          coverFile.mimetype
        );
        updates.coverImage = cloudPath;
      }

      if (Object.keys(updates).length === 0) {
        return res.json(artist);
      }

      const updated = await storage.updateArtist(artist.id, updates);

      if (updates.profileImage && oldProfileImage) {
        if (oldProfileImage.startsWith("/cloud/")) {
          await deleteFromObjectStorage(oldProfileImage);
        } else if (oldProfileImage.startsWith("/uploads/")) {
          fs.unlink(path.join(uploadsDir, path.basename(oldProfileImage)), () => {});
        }
      }
      if (updates.coverImage && oldCoverImage) {
        if (oldCoverImage.startsWith("/cloud/")) {
          await deleteFromObjectStorage(oldCoverImage);
        } else if (oldCoverImage.startsWith("/uploads/")) {
          fs.unlink(path.join(uploadsDir, path.basename(oldCoverImage)), () => {});
        }
      }

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

      const audioUrl = await uploadToObjectStorage(
        path.join(uploadsDir, audioFile.filename),
        audioFile.filename,
        audioFile.mimetype
      );
      let coverImage: string | null = null;
      if (coverFile) {
        coverImage = await uploadToObjectStorage(
          path.join(uploadsDir, coverFile.filename),
          coverFile.filename,
          coverFile.mimetype
        );
      }
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
        const f = path.join(uploadsDir, req.files.audioFile[0].filename);
        if (fs.existsSync(f)) fs.unlink(f, () => {});
      }
      if (req.files?.coverImage?.[0]) {
        const f = path.join(uploadsDir, req.files.coverImage[0].filename);
        if (fs.existsSync(f)) fs.unlink(f, () => {});
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
      if (track.audioUrl.startsWith("/cloud/")) {
        await deleteFromObjectStorage(track.audioUrl);
      } else if (track.audioUrl.startsWith("/uploads/")) {
        const filename = track.audioUrl.replace("/uploads/", "");
        fs.unlink(path.join(uploadsDir, filename), () => {});
      }
      if (track.coverImage?.startsWith("/cloud/")) {
        await deleteFromObjectStorage(track.coverImage);
      } else if (track.coverImage?.startsWith("/uploads/")) {
        const coverFilename = track.coverImage.replace("/uploads/", "");
        fs.unlink(path.join(uploadsDir, coverFilename), () => {});
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

  // Create playlist (Silver+ only)
  app.post("/api/playlists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tier = await getUserTier(userId);
      if (!PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Exchange Trader or higher to create playlists" });
      }
      const validated = insertPlaylistSchema.parse({ ...req.body, userId });
      const playlist = await storage.createPlaylist(validated);
      res.status(201).json(playlist);
    } catch (error) {
      console.error("Error creating playlist:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  // Get playlist details
  app.get("/api/playlists/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const playlist = await storage.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      if (!playlist.isPublic && playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(playlist);
    } catch (error) {
      console.error("Error fetching playlist:", error);
      res.status(500).json({ message: "Failed to fetch playlist" });
    }
  });

  // Get playlist tracks
  app.get("/api/playlists/:id/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const playlist = await storage.getPlaylist(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      if (!playlist.isPublic && playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const tracks = await storage.getPlaylistTracks(req.params.id);
      res.json(tracks);
    } catch (error) {
      console.error("Error fetching playlist tracks:", error);
      res.status(500).json({ message: "Failed to fetch playlist tracks" });
    }
  });

  // Add track to playlist
  app.post("/api/playlists/:id/tracks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId } = req.body;
      if (!trackId || typeof trackId !== "string") {
        return res.status(400).json({ message: "trackId is required" });
      }
      const playlist = await storage.getPlaylist(req.params.id);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const track = await storage.getTrack(trackId);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }
      await storage.addTrackToPlaylist(req.params.id, trackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error adding track to playlist:", error);
      res.status(500).json({ message: "Failed to add track" });
    }
  });

  // Remove track from playlist
  app.delete("/api/playlists/:id/tracks/:trackId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const playlist = await storage.getPlaylist(req.params.id);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.removeTrackFromPlaylist(req.params.id, req.params.trackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing track from playlist:", error);
      res.status(500).json({ message: "Failed to remove track" });
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
      const tier = await getUserTier(userId);
      if (!PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Exchange Trader or higher to like tracks" });
      }
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

  app.get("/api/user/followed-artists/:artistId/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const following = await storage.isFollowingArtist(userId, req.params.artistId);
      res.json({ following });
    } catch (error) {
      res.json({ following: false });
    }
  });

  app.post("/api/user/followed-artists/:artistId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tier = await getUserTier(userId);
      if (!PAID_TIERS.includes(tier)) {
        return res.status(403).json({ message: "Upgrade to Exchange Trader or higher to follow artists" });
      }
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

  app.get("/api/artists/:artistId/followers/count", async (req, res) => {
    try {
      const count = await storage.getArtistFollowerCount(req.params.artistId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching follower count:", error);
      res.status(500).json({ message: "Failed to fetch follower count" });
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

  // Autopilot Playlist routes
  app.get("/api/autopilot/playlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const entries = await storage.getAutopilotPlaylist(userId);
      const trackIds = entries.map(e => e.trackId);
      const trackResults = [];
      for (const tid of trackIds) {
        const t = await storage.getTrack(tid);
        if (t) trackResults.push(t);
      }
      res.json(trackResults);
    } catch (error) {
      console.error("Error fetching autopilot playlist:", error);
      res.status(500).json({ message: "Failed to fetch autopilot playlist" });
    }
  });

  app.post("/api/autopilot/playlist/add", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId } = req.body;
      if (!trackId) return res.status(400).json({ message: "trackId required" });
      const existing = await storage.getAutopilotPlaylist(userId);
      if (existing.some(e => e.trackId === trackId)) {
        return res.status(409).json({ message: "Track already in autopilot playlist" });
      }
      const position = existing.length;
      const entry = await storage.addToAutopilotPlaylist(userId, trackId, position);
      res.json(entry);
    } catch (error) {
      console.error("Error adding to autopilot playlist:", error);
      res.status(500).json({ message: "Failed to add to autopilot playlist" });
    }
  });

  app.post("/api/autopilot/playlist/remove", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId } = req.body;
      if (!trackId) return res.status(400).json({ message: "trackId required" });
      await storage.removeFromAutopilotPlaylist(userId, trackId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from autopilot playlist:", error);
      res.status(500).json({ message: "Failed to remove from autopilot playlist" });
    }
  });

  app.post("/api/autopilot/playlist/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackIds } = req.body;
      if (!Array.isArray(trackIds)) return res.status(400).json({ message: "trackIds array required" });
      await storage.reorderAutopilotPlaylist(userId, trackIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering autopilot playlist:", error);
      res.status(500).json({ message: "Failed to reorder autopilot playlist" });
    }
  });

  app.post("/api/autopilot/playlist/clear", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearAutopilotPlaylist(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing autopilot playlist:", error);
      res.status(500).json({ message: "Failed to clear autopilot playlist" });
    }
  });

  app.get("/api/autopilot/pool", async (req, res) => {
    try {
      const result = await db
        .select()
        .from(tracks)
        .innerJoin(artists, eq(tracks.artistId, artists.id))
        .orderBy(desc(tracks.isPrerelease), desc(tracks.playCount));
      const allTracks = result.map(r => ({ ...r.tracks, artist: r.artists }));
      res.json(allTracks);
    } catch (error) {
      console.error("Error fetching autopilot pool:", error);
      res.status(500).json({ message: "Failed to fetch autopilot pool" });
    }
  });

  // PayPal integration routes (required by PayPal Web SDK)
  app.get("/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/order", isAuthenticated, async (req: any, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/order/:orderID/capture", isAuthenticated, async (req: any, res) => {
    await capturePaypalOrder(req, res);
  });

  // Upgrade membership after PayPal payment is verified server-side
  app.post("/api/user/membership/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tier, paypalOrderId } = req.body;
      
      if (!["entry_trader", "exchange_trader", "mint_factory_ceo"].includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }

      if (!paypalOrderId) {
        return res.status(400).json({ message: "Payment required. Please complete PayPal checkout." });
      }

      const verification = await verifyPaypalOrder(paypalOrderId, tier);
      if (!verification.valid) {
        console.error("PayPal verification failed:", verification.error);
        return res.status(400).json({ message: "Payment verification failed: " + (verification.error || "Unknown error") });
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

  app.post("/api/user/membership/gold-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      if (!membership || membership.tier !== "mint_factory_ceo" || !membership.isActive) {
        return res.status(400).json({ message: "You must complete the $99 Mint Factory CEO joining fee first" });
      }

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      const returnUrl = `${baseUrl}/membership?subscription=success`;
      const cancelUrl = `${baseUrl}/membership?subscription=cancelled`;

      const { subscriptionId, approvalUrl } = await createGoldSubscription(returnUrl, cancelUrl);

      await storage.updateMembership(membership.id, {
        paypalSubscriptionId: subscriptionId,
        subscriptionStatus: "APPROVAL_PENDING",
      });

      res.json({ approvalUrl, subscriptionId });
    } catch (error) {
      console.error("Error creating Gold subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  app.post("/api/user/membership/gold-subscription/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { subscriptionId } = req.body;
      const membership = await storage.getUserMembership(userId);

      if (!membership || membership.tier !== "mint_factory_ceo") {
        return res.status(400).json({ message: "Mint Factory CEO membership not found" });
      }

      const details = await getSubscriptionDetails(subscriptionId || membership.paypalSubscriptionId);

      if (details.status === "ACTIVE" || details.status === "APPROVED") {
        await storage.updateMembership(membership.id, {
          paypalSubscriptionId: details.id,
          subscriptionStatus: details.status,
        });
        res.json({ success: true, status: details.status });
      } else {
        res.json({ success: false, status: details.status, message: "Subscription not yet active" });
      }
    } catch (error) {
      console.error("Error activating Gold subscription:", error);
      res.status(500).json({ message: "Failed to activate subscription" });
    }
  });

  app.get("/api/user/membership/subscription-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);

      if (!membership || !membership.paypalSubscriptionId) {
        return res.json({ hasSubscription: false });
      }

      try {
        const details = await getSubscriptionDetails(membership.paypalSubscriptionId);
        if (details.status !== membership.subscriptionStatus) {
          await storage.updateMembership(membership.id, { subscriptionStatus: details.status });
        }
        res.json({
          hasSubscription: true,
          status: details.status,
          nextBillingTime: details.billing_info?.next_billing_time,
          subscriptionId: membership.paypalSubscriptionId,
        });
      } catch {
        res.json({ hasSubscription: true, status: membership.subscriptionStatus, subscriptionId: membership.paypalSubscriptionId });
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ message: "Failed to check subscription status" });
    }
  });

  // Cancel membership
  app.post("/api/user/membership/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const membership = await storage.getUserMembership(userId);
      
      if (membership) {
        if (membership.paypalSubscriptionId) {
          try {
            await cancelSubscription(membership.paypalSubscriptionId, "User cancelled membership");
          } catch (e) {
            console.error("Error cancelling PayPal subscription:", e);
          }
        }
        await storage.updateMembership(membership.id, { isActive: false, tier: "free", subscriptionStatus: "CANCELLED" });
      }
      
      res.json({ success: true, tier: "free" });
    } catch (error) {
      console.error("Error canceling membership:", error);
      res.status(500).json({ message: "Failed to cancel membership" });
    }
  });

  // ============ Tip Jar ============

  app.get("/api/artists/:id/tips", async (req, res) => {
    try {
      const tipTotal = await storage.getArtistTipTotal(req.params.id);
      res.json(tipTotal);
    } catch (error) {
      console.error("Error fetching tips:", error);
      res.status(500).json({ message: "Failed to fetch tips" });
    }
  });

  app.post("/api/tips/create-order", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, artistId } = req.body;
      const tipAmount = parseFloat(amount);
      if (!tipAmount || tipAmount < 1 || tipAmount > 500) {
        return res.status(400).json({ error: "Tip amount must be between $1 and $500" });
      }
      const artist = await storage.getArtist(artistId);
      if (!artist) {
        return res.status(404).json({ error: "Artist not found" });
      }
      const { jsonResponse, statusCode } = await createTipOrder(tipAmount.toFixed(2), artist.name);
      res.status(statusCode).json(jsonResponse);
    } catch (error) {
      console.error("Failed to create tip order:", error);
      res.status(500).json({ error: "Failed to create tip order" });
    }
  });

  app.post("/api/tips/capture", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { orderID, artistId, message } = req.body;
      if (!orderID || !artistId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const artist = await storage.getArtist(artistId);
      if (!artist) {
        return res.status(404).json({ error: "Artist not found" });
      }
      const existingTip = await storage.getTipByPaypalOrderId(orderID);
      if (existingTip) {
        return res.status(400).json({ error: "Tip already recorded for this order" });
      }
      const { jsonResponse, statusCode } = await captureTipOrder(orderID);
      if (jsonResponse.status === "COMPLETED") {
        const capturedAmount = jsonResponse.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
        if (!capturedAmount?.value) {
          return res.status(400).json({ error: "Could not verify payment amount" });
        }
        await storage.createTip({
          artistId,
          userId,
          amount: capturedAmount.value,
          message: message || null,
          paypalOrderId: orderID,
        });
      }
      res.status(statusCode).json(jsonResponse);
    } catch (error) {
      console.error("Failed to capture tip:", error);
      res.status(500).json({ error: "Failed to capture tip" });
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

      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === true;

      if (!isAdmin) {
        const membership = await storage.getUserMembership(userId);
        const tier = (membership?.isActive !== false ? membership?.tier : "free") || "free";
        const limits = MEMBERSHIP_LIMITS[tier] || MEMBERSHIP_LIMITS.free;

        if (limits.downloads === 0) {
          return res.status(403).json({ message: "Downloads require a Mint Factory CEO membership" });
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
      }

      const audioUrl = track.audioUrl;
      if (!audioUrl || audioUrl === "/demo-audio.mp3" || audioUrl === "/uploads/demo-audio.wav") {
        return res.status(404).json({ message: "No downloadable audio file available" });
      }

      const filename = path.basename(audioUrl);
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

      if (audioUrl.startsWith("/cloud/")) {
        const objectName = audioUrl.replace("/cloud/", "");
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        const file = bucket.file(objectName);
        const [exists] = await file.exists();
        if (!exists) {
          return res.status(404).json({ message: "Audio file not found in storage" });
        }
        const [metadata] = await file.getMetadata();
        res.set("Content-Type", metadata.contentType || mimeTypes[ext] || "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="${safeTitle}${ext}"`);
        const stream = file.createReadStream();
        stream.on("error", (err) => {
          console.error("Download stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming file" });
          }
        });
        stream.pipe(res);
      } else {
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "Audio file not found on server" });
        }
        res.set("Content-Type", mimeTypes[ext] || "application/octet-stream");
        res.set("Content-Disposition", `attachment; filename="${safeTitle}${ext}"`);
        res.sendFile(filePath);
      }
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

  // Delete own video (artists only)
  app.delete("/api/videos/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Not an artist" });
      }
      const video = await storage.getVideo(req.params.id);
      if (!video || video.artistId !== artist.id) {
        return res.status(404).json({ message: "Video not found" });
      }
      await storage.deleteVideo(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting video:", error);
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  // ============ Distribution Request Routes ============

  app.post("/api/distribution-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Artist profile required" });
      }
      const { trackId, message } = req.body;
      const request = await storage.createDistributionRequest({
        artistId: artist.id,
        userId,
        trackId: trackId || null,
        message: message || null,
        status: "pending",
      });
      res.json(request);
    } catch (error) {
      console.error("Error creating distribution request:", error);
      res.status(500).json({ message: "Failed to create distribution request" });
    }
  });

  app.get("/api/distribution-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getDistributionRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching distribution requests:", error);
      res.status(500).json({ message: "Failed to fetch distribution requests" });
    }
  });

  app.delete("/api/distribution-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getDistributionRequestsByUser(userId);
      const request = requests.find(r => r.id === req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteDistributionRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting distribution request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  // ============ Lyrics Requests ============

  app.post("/api/lyrics-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Artist profile required" });
      }
      const { title, lyrics, genre, notes } = req.body;
      if (!title || !lyrics) {
        return res.status(400).json({ message: "Title and lyrics are required" });
      }
      const request = await storage.createLyricsRequest({
        artistId: artist.id,
        userId,
        title,
        lyrics,
        genre: genre || null,
        notes: notes || null,
        status: "pending",
      });
      res.json(request);
    } catch (error) {
      console.error("Error creating lyrics request:", error);
      res.status(500).json({ message: "Failed to create lyrics request" });
    }
  });

  app.get("/api/lyrics-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getLyricsRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching lyrics requests:", error);
      res.status(500).json({ message: "Failed to fetch lyrics requests" });
    }
  });

  // ============ Mastering Requests ============

  app.post("/api/mastering-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Artist profile required" });
      }
      const { trackId, notes } = req.body;
      if (!trackId) {
        return res.status(400).json({ message: "Track is required" });
      }
      const track = await storage.getTrack(trackId);
      if (!track || track.artistId !== artist.id) {
        return res.status(403).json({ message: "You can only submit mastering requests for your own tracks" });
      }
      const request = await storage.createMasteringRequest({
        artistId: artist.id,
        userId,
        trackId,
        notes: notes || null,
        status: "pending",
      });
      res.json(request);
    } catch (error) {
      console.error("Error creating mastering request:", error);
      res.status(500).json({ message: "Failed to create mastering request" });
    }
  });

  app.get("/api/mastering-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getMasteringRequestsByUser(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching mastering requests:", error);
      res.status(500).json({ message: "Failed to fetch mastering requests" });
    }
  });

  // ============ AI Lyrics Generator ============

  app.post("/api/generate-lyrics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Artist profile required" });
      }
      const { prompt, genre, mood, style } = req.body;
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const systemPrompt = `You are a professional songwriter and lyricist. Generate complete, creative, radio-ready song lyrics based on the user's description. 

Format the output as a structured song with clearly labeled sections:
- [Verse 1], [Verse 2], etc.
- [Chorus]
- [Pre-Chorus] (optional)
- [Bridge] (optional)
- [Outro] (optional)

Make the lyrics emotionally engaging, with strong hooks and memorable phrases. Use rhyme schemes and rhythm that fit the genre.${genre ? `\nGenre: ${genre}` : ""}${mood ? `\nMood: ${mood}` : ""}${style ? `\nStyle reference: ${style}` : ""}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 2048,
        temperature: 0.9,
      });

      const lyrics = response.choices[0]?.message?.content || "";
      res.json({ lyrics });
    } catch (error) {
      console.error("Error generating lyrics:", error);
      res.status(500).json({ message: "Failed to generate lyrics" });
    }
  });

  // ============ Audio Mastering ============

  const masteredDir = path.join(process.cwd(), "uploads", "mastered");
  if (!fs.existsSync(masteredDir)) {
    fs.mkdirSync(masteredDir, { recursive: true });
  }

  app.delete("/api/lyrics-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getLyricsRequestsByUser(userId);
      const request = requests.find(r => r.id === req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (request.status === "in_production") {
        return res.status(400).json({ message: "Cannot delete a request that is currently in production" });
      }
      await storage.deleteLyricsRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting lyrics request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  app.delete("/api/mastering-requests/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const request = await storage.getMasteringRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (request.status === "in_production") {
        return res.status(400).json({ message: "Cannot delete a request that is currently in production" });
      }
      await storage.deleteMasteringRequest(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting mastering request:", error);
      res.status(500).json({ message: "Failed to delete request" });
    }
  });

  app.post("/api/master-track/:trackId", isAuthenticated, async (req: any, res) => {
    const isAdminCheck = await storage.isUserAdmin(req.user.claims.sub);
    if (!isAdminCheck) {
      return res.status(403).json({ message: "Only admins can run the mastering engine" });
    }
    try {
      const userId = req.user.claims.sub;
      const artist = await storage.getArtistByUserId(userId);
      if (!artist) {
        return res.status(403).json({ message: "Artist profile required" });
      }

      const track = await storage.getTrack(req.params.trackId);
      if (!track || track.artistId !== artist.id) {
        return res.status(403).json({ message: "You can only master your own tracks" });
      }

      let inputPath: string;
      let tempCloudFile = false;
      if (track.audioUrl.startsWith("/cloud/")) {
        const objectName = track.audioUrl.replace("/cloud/", "");
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        const cloudFile = bucket.file(objectName);
        const [exists] = await cloudFile.exists();
        if (!exists) {
          return res.status(404).json({ message: "Audio file not found in storage" });
        }
        const tempPath = path.join(uploadsDir, `temp-master-${Date.now()}${path.extname(track.audioUrl)}`);
        const [contents] = await cloudFile.download();
        fs.writeFileSync(tempPath, contents);
        inputPath = tempPath;
        tempCloudFile = true;
      } else {
        inputPath = path.join(process.cwd(), track.audioUrl.replace(/^\//, ""));
        if (!fs.existsSync(inputPath)) {
          return res.status(404).json({ message: "Audio file not found" });
        }
      }

      const outputFilename = `mastered-${Date.now()}-${path.basename(track.audioUrl, path.extname(track.audioUrl))}.wav`;
      const outputPath = path.join(masteredDir, outputFilename);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent({ status: "queued", message: "Track queued for mastering..." });

      sendEvent({ status: "processing", message: "Analyzing audio levels...", progress: 10 });

      const ffmpegArgs = [
        "-i", inputPath,
        "-af", [
          "highpass=f=30",
          "lowpass=f=18000",
          "acompressor=threshold=-18dB:ratio=3:attack=5:release=50:makeup=2dB",
          "acompressor=threshold=-12dB:ratio=4:attack=2:release=30:makeup=1dB",
          "equalizer=f=60:t=q:w=1.5:g=2",
          "equalizer=f=200:t=q:w=2:g=-1",
          "equalizer=f=3000:t=q:w=1.5:g=1.5",
          "equalizer=f=8000:t=q:w=2:g=2",
          "equalizer=f=12000:t=q:w=1.5:g=1",
          "alimiter=limit=0.95:level=false",
          "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
        ].join(","),
        "-ar", "44100",
        "-sample_fmt", "s16",
        "-y",
        outputPath,
      ];

      sendEvent({ status: "processing", message: "Applying mastering chain (EQ, compression, limiting)...", progress: 30 });

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
        let stderrData = "";

        ffmpeg.stderr.on("data", (data: Buffer) => {
          stderrData += data.toString();
        });

        ffmpeg.on("close", (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}: ${stderrData.slice(-500)}`));
          }
        });

        ffmpeg.on("error", reject);
      });

      sendEvent({ status: "processing", message: "Normalizing loudness to -14 LUFS (streaming standard)...", progress: 70 });

      sendEvent({ status: "processing", message: "Rendering final mastered file...", progress: 90 });

      if (tempCloudFile) {
        fs.unlink(inputPath, () => {});
      }

      let masteredUrl: string;
      try {
        masteredUrl = await uploadToObjectStorage(outputPath, outputFilename, "audio/wav");
      } catch {
        masteredUrl = `/uploads/mastered/${outputFilename}`;
      }

      const masteringReq = await storage.createMasteringRequest({
        artistId: artist.id,
        userId,
        trackId: track.id,
        notes: "Auto-mastered via AITIFY mastering engine",
        status: "completed",
        masteredUrl,
      });

      sendEvent({
        status: "completed",
        message: "Mastering complete! Your track is now radio-ready.",
        progress: 100,
        masteredUrl,
        requestId: masteringReq.id,
      });

      res.end();
    } catch (error) {
      console.error("Error mastering track:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to master track" });
      } else {
        res.write(`data: ${JSON.stringify({ status: "error", message: "Mastering failed. Please try again." })}\n\n`);
        res.end();
      }
    }
  });

  app.get("/uploads/mastered/:filename", isAuthenticated, async (req: any, res) => {
    const filePath = path.join(masteredDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.set("Content-Disposition", `attachment; filename="${req.params.filename}"`);
      return res.sendFile(filePath);
    }
    try {
      const objectName = `uploads/${req.params.filename}`;
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found" });
      }
      res.set("Content-Disposition", `attachment; filename="${req.params.filename}"`);
      res.set("Content-Type", "audio/wav");
      const stream = file.createReadStream();
      stream.pipe(res);
    } catch {
      return res.status(404).json({ message: "File not found" });
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

  // Admin create artist (bypass membership check)
  app.post("/api/admin/artists/create", isAdmin, async (req: any, res) => {
    try {
      const { userId, name, bio } = req.body;
      if (!userId || !name) {
        return res.status(400).json({ message: "userId and name are required" });
      }
      const existing = await storage.getArtistByUserId(userId);
      if (existing) {
        return res.status(400).json({ message: "This user already has an artist profile" });
      }
      const validated = insertArtistSchema.parse({ userId, name, bio: bio || "" });
      const artist = await storage.createArtist(validated);
      res.status(201).json(artist);
    } catch (error) {
      console.error("Error creating artist (admin bypass):", error);
      res.status(500).json({ message: "Failed to create artist profile" });
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

  app.patch("/api/admin/artists/:id/spotify-url", isAdmin, async (req: any, res) => {
    try {
      const { spotifyProfileUrl } = req.body;
      const [updated] = await db.update(artists).set({ spotifyProfileUrl: spotifyProfileUrl || null }).where(eq(artists.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Artist not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating Spotify URL:", error);
      res.status(500).json({ message: "Failed to update Spotify URL" });
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

  app.delete("/api/admin/tracks/:id", isAdmin, async (req: any, res) => {
    try {
      const track = await storage.getTrack(req.params.id);
      await storage.deleteTrack(req.params.id);
      if (track?.audioUrl?.startsWith("/cloud/")) {
        await deleteFromObjectStorage(track.audioUrl);
      } else if (track?.audioUrl?.startsWith("/uploads/")) {
        const fn = track.audioUrl.replace("/uploads/", "");
        fs.unlink(path.join(uploadsDir, fn), () => {});
      }
      if (track?.coverImage?.startsWith("/cloud/")) {
        await deleteFromObjectStorage(track.coverImage);
      } else if (track?.coverImage?.startsWith("/uploads/")) {
        const fn = track.coverImage.replace("/uploads/", "");
        fs.unlink(path.join(uploadsDir, fn), () => {});
      }
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
      const allTracks = await storage.getAllTracksForAdmin();
      res.json(allTracks);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  // Toggle track featured status for radio playlist
  app.patch("/api/admin/tracks/:id/featured", isAdmin, async (req: any, res) => {
    try {
      const { isFeatured } = req.body;
      await storage.setTrackFeatured(req.params.id, !!isFeatured);
      res.json({ success: true });
    } catch (error) {
      console.error("Error toggling featured:", error);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  // Get radio playlist tracks (featured tracks)
  app.get("/api/admin/radio-playlist", isAdmin, async (req: any, res) => {
    try {
      const radioTracks = await storage.getRadioTracks();
      res.json(radioTracks);
    } catch (error) {
      console.error("Error fetching radio playlist:", error);
      res.status(500).json({ message: "Failed to fetch radio playlist" });
    }
  });

  // === Spotify Playback (Spotify is now the primary auth — tokens stored at login) ===

  app.get("/api/spotify/me", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await getSpotifyProfile(userId);
      res.json(profile);
    } catch (error: any) {
      console.error("Spotify profile error:", error.message);
      res.json({ connected: false, error: error.message });
    }
  });

  app.get("/api/spotify/player", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      const state = await spotify.player.getPlaybackState();
      res.json(state || { is_playing: false });
    } catch (error) {
      res.json({ is_playing: false });
    }
  });

  app.get("/api/spotify/devices", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      const devices = await spotify.player.getAvailableDevices();
      res.json(devices);
    } catch (error) {
      res.json({ devices: [] });
    }
  });

  const isJsonParseError = (msg: string) => msg?.includes("Unexpected token") || msg?.includes("not valid JSON") || msg?.includes("Unexpected non-whitespace");

  app.post("/api/spotify/play", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const { uri, deviceId, context_uri, uris } = req.body;
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      let playContextUri = context_uri;
      let playUris = uris;
      if (uri) {
        if (uri.includes(":track:")) {
          playUris = [uri];
        } else {
          playContextUri = uri;
        }
      }
      await spotify.player.startResumePlayback(deviceId || "", playContextUri, playUris);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Spotify play error:", error);
      if (isJsonParseError(error.message)) return res.json({ success: true });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to start playback"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.put("/api/spotify/pause", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      await spotify.player.pausePlayback("");
      res.json({ success: true });
    } catch (error: any) {
      if (isJsonParseError(error.message)) return res.json({ success: true });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to pause"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.post("/api/spotify/next", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      await spotify.player.skipToNext("");
      res.json({ success: true });
    } catch (error: any) {
      if (isJsonParseError(error.message)) return res.json({ success: true });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to skip"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.post("/api/spotify/previous", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      await spotify.player.skipToPrevious("");
      res.json({ success: true });
    } catch (error: any) {
      if (isJsonParseError(error.message)) return res.json({ success: true });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to go back"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.put("/api/spotify/shuffle", isAuthenticated, requireSpotify, async (req: any, res) => {
    const { state } = req.body;
    const shuffleState = state !== false;
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      await spotify.player.togglePlaybackShuffle(shuffleState);
      res.json({ success: true, shuffle: shuffleState });
    } catch (error: any) {
      if (isJsonParseError(error.message)) return res.json({ success: true, shuffle: shuffleState });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to toggle shuffle"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.put("/api/spotify/repeat", isAuthenticated, requireSpotify, async (req: any, res) => {
    const { state } = req.body;
    const repeatState = state || "off";
    try {
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      await spotify.player.setRepeatMode(repeatState);
      res.json({ success: true, repeat: repeatState });
    } catch (error: any) {
      if (isJsonParseError(error.message)) return res.json({ success: true, repeat: repeatState });
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to set repeat"), code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR" });
    }
  });

  app.get("/api/spotify/search", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const { q, type } = req.query;
      if (!q) return res.status(400).json({ message: "Query required" });
      const userId = req.user.claims.sub;
      const spotify = await getSpotifyClientForUser(userId);
      const searchTypes = (type as string || "track,playlist,album").split(",") as any[];
      const results = await spotify.search(q as string, searchTypes, "US", 10);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Search failed" });
    }
  });

  // Radio Shows - public (active shows for listeners)
  app.get("/api/radio-shows", async (_req: any, res) => {
    try {
      const shows = await storage.getActiveRadioShows();
      res.json(shows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/live-pop-scores", async (_req: any, res) => {
    try {
      const all = await db.select({
        id: spotifyRoyaltyTracks.id,
        spotifyTrackId: spotifyRoyaltyTracks.spotifyTrackId,
        title: spotifyRoyaltyTracks.title,
        artistName: spotifyRoyaltyTracks.artistName,
        streamCount: spotifyRoyaltyTracks.streamCount,
        isQualified: spotifyRoyaltyTracks.isQualified,
        coverArt: spotifyRoyaltyTracks.coverArt,
        lastFetchedAt: spotifyRoyaltyTracks.lastFetchedAt,
      }).from(spotifyRoyaltyTracks).orderBy(desc(spotifyRoyaltyTracks.streamCount));
      const scored = all.map(t => ({
        ...t,
        popScore: Math.min(100, Math.round(((t.streamCount || 0) / 1000) * 100)),
        settlement: ((t.streamCount || 0) * 0.00025).toFixed(4),
        ticker: `$${(t.title || "").replace(/\s+/g, '').toUpperCase().slice(0, 12)}`,
      }));
      res.json(scored);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/market-ticker", async (_req: any, res) => {
    try {
      const all = await db.select({
        id: spotifyRoyaltyTracks.id,
        title: spotifyRoyaltyTracks.title,
        artistName: spotifyRoyaltyTracks.artistName,
        streamCount: spotifyRoyaltyTracks.streamCount,
        isQualified: spotifyRoyaltyTracks.isQualified,
      }).from(spotifyRoyaltyTracks).orderBy(desc(spotifyRoyaltyTracks.streamCount));
      res.json(all);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticker data" });
    }
  });

  // Radio Shows - admin management
  app.get("/api/admin/radio-shows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) return res.status(403).json({ message: "Admin access required" });
      const shows = await storage.getRadioShows();
      res.json(shows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/radio-shows", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { name, slot, spotifyPlaylistUrl, description, isActive, sortOrder } = req.body;
      if (!name || !slot || !spotifyPlaylistUrl) return res.status(400).json({ message: "Name, slot, and playlist URL are required" });
      const show = await storage.createRadioShow({ name, slot, spotifyPlaylistUrl, description, isActive, sortOrder });
      res.json(show);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/radio-shows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) return res.status(403).json({ message: "Admin access required" });
      const show = await storage.updateRadioShow(req.params.id, req.body);
      if (!show) return res.status(404).json({ message: "Show not found" });
      res.json(show);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/radio-shows/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isAdmin = await storage.isUserAdmin(userId);
      if (!isAdmin) return res.status(403).json({ message: "Admin access required" });
      await storage.deleteRadioShow(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

  app.get("/api/jam-sessions/active", isAuthenticated, async (req: any, res) => {
    try {
      const sessions = await db.select().from(jamSessions).where(eq(jamSessions.isActive, true)).orderBy(jamSessions.createdAt);
      const sessionsWithStats = await Promise.all(sessions.map(async (session) => {
        const listenerCount = await db.select({ total: sql<number>`COUNT(DISTINCT ${jamSessionListeners.userId})` })
          .from(jamSessionListeners).where(and(eq(jamSessionListeners.sessionId, session.id), sql`${jamSessionListeners.leftAt} IS NULL`));
        const engagementCount = await db.select({ total: count() })
          .from(jamSessionEngagement).where(eq(jamSessionEngagement.sessionId, session.id));
        const owner = await storage.getUser(session.userId);
        return {
          ...session,
          ownerName: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "DJ" : "DJ",
          activeListeners: Number(listenerCount[0]?.total || 0),
          totalEngagements: Number(engagementCount[0]?.total || 0),
        };
      }));
      res.json(sessionsWithStats);
    } catch (error) {
      console.error("Error fetching active sessions:", error);
      res.status(500).json({ message: "Failed to fetch active sessions" });
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

  app.post("/api/jam-sessions/:id/play-now", isAuthenticated, requireSpotify, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await db.select().from(jamSessions).where(and(eq(jamSessions.id, req.params.id), eq(jamSessions.userId, userId)));
      if (!session.length) return res.status(404).json({ message: "Session not found" });
      const spotify = await getSpotifyClientForUser(userId);
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
      if (isJsonParseError(error.message)) {
        await db.update(jamSessions).set({ lastTriggered: new Date() }).where(eq(jamSessions.id, req.params.id));
        return res.json({ success: true });
      }
      const noDevice = error.message?.includes("No active device");
      res.status(400).json({ 
        message: noDevice ? "NO_ACTIVE_DEVICE" : (error.message || "Failed to start playback"),
        code: noDevice ? "NO_ACTIVE_DEVICE" : "ERROR",
        spotifyUri: noDevice ? session[0].spotifyUri : undefined
      });
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

      const session = await db.select().from(jamSessions).where(eq(jamSessions.id, req.params.id));
      if (!session.length || !session[0].isActive) return res.status(404).json({ message: "Session not found or inactive" });

      const isListener = await db.select().from(jamSessionListeners)
        .where(and(eq(jamSessionListeners.sessionId, req.params.id), eq(jamSessionListeners.userId, userId), sql`${jamSessionListeners.leftAt} IS NULL`));
      const isOwner = session[0].userId === userId;
      if (!isListener.length && !isOwner) return res.status(403).json({ message: "You must join this session before recording engagement" });

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
          const spotify = await getSpotifyClientForUser(session.userId);
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

  app.get("/api/admin/distribution-requests", isAdmin, async (req: any, res) => {
    try {
      const requests = await storage.getAllDistributionRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching distribution requests:", error);
      res.status(500).json({ message: "Failed to fetch distribution requests" });
    }
  });

  app.patch("/api/admin/distribution-requests/:id", isAdmin, async (req: any, res) => {
    try {
      const { status, adminNotes } = req.body;
      if (!status || !["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be approved, rejected, or pending." });
      }
      const request = await storage.updateDistributionRequest(req.params.id, { status, adminNotes });
      if (!request) {
        return res.status(404).json({ message: "Distribution request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating distribution request:", error);
      res.status(500).json({ message: "Failed to update distribution request" });
    }
  });

  // Admin Lyrics Requests
  app.get("/api/admin/lyrics-requests", isAdmin, async (req: any, res) => {
    try {
      const requests = await storage.getAllLyricsRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching lyrics requests:", error);
      res.status(500).json({ message: "Failed to fetch lyrics requests" });
    }
  });

  app.patch("/api/admin/lyrics-requests/:id", isAdmin, async (req: any, res) => {
    try {
      const { status, adminNotes } = req.body;
      if (!status || !["approved", "rejected", "pending", "in_production", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const request = await storage.updateLyricsRequest(req.params.id, { status, adminNotes });
      if (!request) {
        return res.status(404).json({ message: "Lyrics request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating lyrics request:", error);
      res.status(500).json({ message: "Failed to update lyrics request" });
    }
  });

  // Admin Mastering Requests
  app.get("/api/admin/mastering-requests", isAdmin, async (req: any, res) => {
    try {
      const requests = await storage.getAllMasteringRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching mastering requests:", error);
      res.status(500).json({ message: "Failed to fetch mastering requests" });
    }
  });

  app.patch("/api/admin/mastering-requests/:id", isAdmin, async (req: any, res) => {
    try {
      const { status, adminNotes } = req.body;
      if (!status || !["approved", "rejected", "pending", "in_progress", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const request = await storage.updateMasteringRequest(req.params.id, { status, adminNotes });
      if (!request) {
        return res.status(404).json({ message: "Mastering request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating mastering request:", error);
      res.status(500).json({ message: "Failed to update mastering request" });
    }
  });

  app.post("/api/admin/master-request/:requestId", isAdmin, async (req: any, res) => {
    try {
      const masteringReq = await storage.getMasteringRequest(req.params.requestId);
      if (!masteringReq) {
        return res.status(404).json({ message: "Mastering request not found" });
      }

      if (masteringReq.status === "completed") {
        return res.status(409).json({ message: "This track has already been mastered" });
      }

      if (masteringReq.status === "in_progress") {
        return res.status(409).json({ message: "This track is already being processed" });
      }

      const track = await storage.getTrack(masteringReq.trackId);
      if (!track) {
        return res.status(404).json({ message: "Track not found" });
      }

      await storage.updateMasteringRequest(masteringReq.id, { status: "in_progress" });

      let inputPath: string;
      let tempCloudFile = false;
      if (track.audioUrl.startsWith("/cloud/")) {
        const objectName = track.audioUrl.replace("/cloud/", "");
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        const cloudFile = bucket.file(objectName);
        const [exists] = await cloudFile.exists();
        if (!exists) {
          await storage.updateMasteringRequest(masteringReq.id, { status: "rejected", adminNotes: "Audio file not found in storage" });
          return res.status(404).json({ message: "Audio file not found in storage" });
        }
        const tempPath = path.join(uploadsDir, `temp-master-${Date.now()}${path.extname(track.audioUrl)}`);
        const [contents] = await cloudFile.download();
        fs.writeFileSync(tempPath, contents);
        inputPath = tempPath;
        tempCloudFile = true;
      } else {
        inputPath = path.join(process.cwd(), track.audioUrl.replace(/^\//, ""));
        if (!fs.existsSync(inputPath)) {
          await storage.updateMasteringRequest(masteringReq.id, { status: "rejected", adminNotes: "Audio file not found on disk" });
          return res.status(404).json({ message: "Audio file not found" });
        }
      }

      const masteringOutputDir = path.join(process.cwd(), "uploads", "mastered");
      if (!fs.existsSync(masteringOutputDir)) {
        fs.mkdirSync(masteringOutputDir, { recursive: true });
      }

      const outputFilename = `mastered-${Date.now()}-${path.basename(track.audioUrl, path.extname(track.audioUrl))}.wav`;
      const outputPath = path.join(masteringOutputDir, outputFilename);

      const ffmpegArgs = [
        "-i", inputPath,
        "-af", [
          "highpass=f=30",
          "lowpass=f=18000",
          "acompressor=threshold=-18dB:ratio=3:attack=5:release=50:makeup=2dB",
          "acompressor=threshold=-12dB:ratio=4:attack=2:release=30:makeup=1dB",
          "equalizer=f=60:t=q:w=1.5:g=2",
          "equalizer=f=200:t=q:w=2:g=-1",
          "equalizer=f=3000:t=q:w=1.5:g=1.5",
          "equalizer=f=8000:t=q:w=2:g=2",
          "equalizer=f=12000:t=q:w=1.5:g=1",
          "alimiter=limit=0.95:level=false",
          "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
        ].join(","),
        "-ar", "44100",
        "-sample_fmt", "s16",
        "-y",
        outputPath,
      ];

      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);
        let stderrData = "";
        ffmpeg.stderr.on("data", (data: Buffer) => { stderrData += data.toString(); });
        ffmpeg.on("close", (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}: ${stderrData.slice(-500)}`));
        });
        ffmpeg.on("error", reject);
      });

      if (tempCloudFile) {
        fs.unlink(inputPath, () => {});
      }

      let masteredUrl: string;
      try {
        masteredUrl = await uploadToObjectStorage(outputPath, outputFilename, "audio/wav");
      } catch {
        masteredUrl = `/uploads/mastered/${outputFilename}`;
      }

      const updated = await storage.updateMasteringRequest(masteringReq.id, {
        status: "completed",
        masteredUrl,
        adminNotes: "Mastered via AITIFY mastering engine — radio-ready at -14 LUFS",
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error running mastering engine:", error);
      await storage.updateMasteringRequest(req.params.requestId, {
        status: "rejected",
        adminNotes: `Mastering failed: ${error.message || "Unknown error"}`,
      }).catch(() => {});
      res.status(500).json({ message: "Mastering failed: " + (error.message || "Unknown error") });
    }
  });

  const spotifyTrackLookupHandler = async (req: any, res: any) => {
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
        `https://spotify-statistics-and-stream-count.p.rapidapi.com/track/${encodeURIComponent(trackId.trim())}`,
        {
          headers: {
            "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com",
            "x-rapidapi-key": rapidApiKey,
          },
        }
      );
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`Spotify track API error (${response.status}):`, errorBody);
        if (response.status === 429) {
          return res.status(429).json({ message: "Daily API quota exceeded. Try again tomorrow or upgrade the RapidAPI plan." });
        }
        return res.status(response.status).json({ message: `Spotify API request failed (${response.status})` });
      }
      const data = await response.json();
      const streamCount = data.playCount ?? data.playcount ?? data.streamCount ?? null;
      const result = {
        id: data.id || trackId,
        name: data.name || data.title || "Unknown",
        artists: data.artists || [],
        album: data.album || null,
        duration: data.duration || data.duration_ms || 0,
        contentRating: data.contentRating || data.explicit ? "explicit" : "clean",
        streamCount: streamCount,
        trackNumber: data.trackNumber || data.track_number || 1,
        releaseDate: data.album?.releaseDate || data.releaseDate || null,
        coverArt: data.album?.cover?.[0]?.url || data.coverArt?.sources?.[0]?.url || null,
      };
      res.json(result);
    } catch (error) {
      console.error("Error fetching Spotify track:", error);
      res.status(500).json({ message: "Failed to fetch Spotify track" });
    }
  };

  app.get("/api/admin/spotify/track/:trackId", isAdmin, spotifyTrackLookupHandler);

  // ── Stream Qualifier Tracker ────────────────────────────────────────
  app.get("/api/admin/stream-qualifiers", isAdmin, async (req: any, res) => {
    try {
      const qualifiers = await db
        .select({
          id: streamQualifiers.id,
          trackId: streamQualifiers.trackId,
          spotifyStreamCount: streamQualifiers.spotifyStreamCount,
          targetStreams: streamQualifiers.targetStreams,
          isQualified: streamQualifiers.isQualified,
          notes: streamQualifiers.notes,
          updatedAt: streamQualifiers.updatedAt,
          createdAt: streamQualifiers.createdAt,
          trackTitle: tracks.title,
          trackGenre: tracks.genre,
          artistId: tracks.artistId,
          artistName: artists.name,
          coverImage: tracks.coverImage,
        })
        .from(streamQualifiers)
        .leftJoin(tracks, eq(streamQualifiers.trackId, tracks.id))
        .leftJoin(artists, eq(tracks.artistId, artists.id))
        .orderBy(desc(streamQualifiers.spotifyStreamCount));
      res.json(qualifiers);
    } catch (error) {
      console.error("Error fetching stream qualifiers:", error);
      res.status(500).json({ message: "Failed to fetch stream qualifiers" });
    }
  });

  app.post("/api/admin/stream-qualifiers", isAdmin, async (req: any, res) => {
    try {
      const { trackId, spotifyStreamCount, notes } = req.body;
      if (!trackId) return res.status(400).json({ message: "trackId required" });
      const existing = await db.select().from(streamQualifiers).where(eq(streamQualifiers.trackId, trackId));
      if (existing.length > 0) return res.status(409).json({ message: "Track already being tracked" });
      const count = spotifyStreamCount ?? 0;
      const [qualifier] = await db.insert(streamQualifiers).values({
        trackId,
        spotifyStreamCount: count,
        isQualified: count >= 1000,
        notes: notes || null,
      }).returning();
      res.json(qualifier);
    } catch (error) {
      console.error("Error adding stream qualifier:", error);
      res.status(500).json({ message: "Failed to add stream qualifier" });
    }
  });

  app.post("/api/admin/stream-qualifiers/bulk", isAdmin, async (req: any, res) => {
    try {
      const allTracks = await db.select({ id: tracks.id }).from(tracks);
      const existing = await db.select({ trackId: streamQualifiers.trackId }).from(streamQualifiers);
      const existingIds = new Set(existing.map(e => e.trackId));
      const toAdd = allTracks.filter(t => !existingIds.has(t.id));
      if (toAdd.length === 0) return res.json({ added: 0 });
      await db.insert(streamQualifiers).values(toAdd.map(t => ({
        trackId: t.id,
        spotifyStreamCount: 0,
        isQualified: false,
      })));
      res.json({ added: toAdd.length });
    } catch (error) {
      console.error("Error bulk adding qualifiers:", error);
      res.status(500).json({ message: "Failed to bulk add qualifiers" });
    }
  });

  app.patch("/api/admin/stream-qualifiers/:id", isAdmin, async (req: any, res) => {
    try {
      const { spotifyStreamCount, notes, isQualified } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (spotifyStreamCount !== undefined) {
        updates.spotifyStreamCount = spotifyStreamCount;
        updates.isQualified = spotifyStreamCount >= 1000;
      }
      if (isQualified !== undefined) updates.isQualified = isQualified;
      if (notes !== undefined) updates.notes = notes;
      const [qualifier] = await db.update(streamQualifiers)
        .set(updates)
        .where(eq(streamQualifiers.id, req.params.id))
        .returning();
      if (!qualifier) return res.status(404).json({ message: "Qualifier not found" });
      res.json(qualifier);
    } catch (error) {
      console.error("Error updating stream qualifier:", error);
      res.status(500).json({ message: "Failed to update stream qualifier" });
    }
  });

  app.delete("/api/admin/stream-qualifiers/:id", isAdmin, async (req: any, res) => {
    try {
      await db.delete(streamQualifiers).where(eq(streamQualifiers.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting stream qualifier:", error);
      res.status(500).json({ message: "Failed to delete stream qualifier" });
    }
  });

  // ── Spotify Royalty Tracker (external Spotify tracks) ─────────────
  app.get("/api/admin/spotify-royalty-tracks", isAdmin, async (req: any, res) => {
    try {
      const all = await db.select().from(spotifyRoyaltyTracks).orderBy(desc(spotifyRoyaltyTracks.streamCount));
      res.json(all);
    } catch (error) {
      console.error("Error fetching spotify royalty tracks:", error);
      res.status(500).json({ message: "Failed to fetch royalty tracks" });
    }
  });

  app.post("/api/admin/spotify-royalty-tracks", isAdmin, async (req: any, res) => {
    try {
      const { spotifyUrl } = req.body;
      if (!spotifyUrl) return res.status(400).json({ message: "Spotify URL required" });
      const match = spotifyUrl.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
      if (!match) return res.status(400).json({ message: "Invalid Spotify track URL" });
      const spotifyTrackId = match[1];
      const existing = await db.select().from(spotifyRoyaltyTracks).where(eq(spotifyRoyaltyTracks.spotifyTrackId, spotifyTrackId));
      if (existing.length > 0) return res.status(409).json({ message: "Track already being tracked" });
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) return res.status(500).json({ message: "RapidAPI key not configured" });
      const response = await fetch(
        `https://spotify-statistics-and-stream-count.p.rapidapi.com/track/${spotifyTrackId}`,
        { headers: { "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com", "x-rapidapi-key": rapidApiKey } }
      );
      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ message: "API quota exceeded. Try again later." });
        return res.status(response.status).json({ message: `Spotify API error (${response.status})` });
      }
      const data = await response.json();
      const streams = data.playCount ?? data.playcount ?? data.streamCount ?? 0;
      const artistNames = data.artists?.map((a: any) => a.name).join(", ") || "Unknown";
      const [track] = await db.insert(spotifyRoyaltyTracks).values({
        spotifyTrackId,
        spotifyUrl,
        title: data.name || data.title || "Unknown",
        artistName: artistNames,
        albumName: data.album?.name || null,
        coverArt: data.album?.cover?.[0]?.url || data.coverArt?.sources?.[0]?.url || null,
        releaseDate: data.album?.releaseDate || data.releaseDate || null,
        streamCount: streams,
        isQualified: streams >= 1000,
      }).returning();
      res.json(track);
    } catch (error) {
      console.error("Error adding spotify royalty track:", error);
      res.status(500).json({ message: "Failed to add track" });
    }
  });

  app.post("/api/admin/spotify-royalty-tracks/:id/refresh", isAdmin, async (req: any, res) => {
    try {
      const [existing] = await db.select().from(spotifyRoyaltyTracks).where(eq(spotifyRoyaltyTracks.id, req.params.id));
      if (!existing) return res.status(404).json({ message: "Track not found" });
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) return res.status(500).json({ message: "RapidAPI key not configured" });
      const response = await fetch(
        `https://spotify-statistics-and-stream-count.p.rapidapi.com/track/${existing.spotifyTrackId}`,
        { headers: { "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com", "x-rapidapi-key": rapidApiKey } }
      );
      if (!response.ok) {
        if (response.status === 429) return res.status(429).json({ message: "API quota exceeded. Try again later." });
        return res.status(response.status).json({ message: `Spotify API error (${response.status})` });
      }
      const data = await response.json();
      const streams = data.playCount ?? data.playcount ?? data.streamCount ?? 0;
      const [updated] = await db.update(spotifyRoyaltyTracks).set({
        streamCount: streams,
        isQualified: streams >= 1000,
        lastFetchedAt: new Date(),
        title: data.name || data.title || existing.title,
        artistName: data.artists?.map((a: any) => a.name).join(", ") || existing.artistName,
        coverArt: data.album?.cover?.[0]?.url || data.coverArt?.sources?.[0]?.url || existing.coverArt,
      }).where(eq(spotifyRoyaltyTracks.id, req.params.id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing spotify royalty track:", error);
      res.status(500).json({ message: "Failed to refresh track" });
    }
  });

  app.post("/api/admin/spotify-royalty-tracks/refresh-all", isAdmin, async (req: any, res) => {
    try {
      const rapidApiKey = process.env.RAPIDAPI_KEY;
      if (!rapidApiKey) return res.status(500).json({ message: "RapidAPI key not configured" });
      const all = await db.select().from(spotifyRoyaltyTracks);
      let updated = 0;
      let errors = 0;
      for (const track of all) {
        try {
          const response = await fetch(
            `https://spotify-statistics-and-stream-count.p.rapidapi.com/track/${track.spotifyTrackId}`,
            { headers: { "x-rapidapi-host": "spotify-statistics-and-stream-count.p.rapidapi.com", "x-rapidapi-key": rapidApiKey } }
          );
          if (response.status === 429) {
            return res.json({ updated, errors, stopped: true, message: "API quota hit — some tracks not refreshed" });
          }
          if (response.ok) {
            const data = await response.json();
            const streams = data.playCount ?? data.playcount ?? data.streamCount ?? 0;
            await db.update(spotifyRoyaltyTracks).set({
              streamCount: streams,
              isQualified: streams >= 1000,
              lastFetchedAt: new Date(),
              title: data.name || data.title || track.title,
              artistName: data.artists?.map((a: any) => a.name).join(", ") || track.artistName,
              coverArt: data.album?.cover?.[0]?.url || data.coverArt?.sources?.[0]?.url || track.coverArt,
            }).where(eq(spotifyRoyaltyTracks.id, track.id));
            updated++;
          } else {
            errors++;
          }
          await new Promise(r => setTimeout(r, 300));
        } catch {
          errors++;
        }
      }
      res.json({ updated, errors, total: all.length });
    } catch (error) {
      console.error("Error refreshing all spotify royalty tracks:", error);
      res.status(500).json({ message: "Failed to refresh tracks" });
    }
  });

  app.patch("/api/admin/spotify-royalty-tracks/:id", isAdmin, async (req: any, res) => {
    try {
      const { notes } = req.body;
      const [updated] = await db.update(spotifyRoyaltyTracks).set({ notes }).where(eq(spotifyRoyaltyTracks.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ message: "Track not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating spotify royalty track:", error);
      res.status(500).json({ message: "Failed to update track" });
    }
  });

  app.delete("/api/admin/spotify-royalty-tracks/:id", isAdmin, async (req: any, res) => {
    try {
      await db.delete(spotifyRoyaltyTracks).where(eq(spotifyRoyaltyTracks.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting spotify royalty track:", error);
      res.status(500).json({ message: "Failed to delete track" });
    }
  });

  return httpServer;
}
