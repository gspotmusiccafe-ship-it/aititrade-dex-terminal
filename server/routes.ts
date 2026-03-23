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
import { insertArtistSchema, insertTrackSchema, insertPlaylistSchema, insertVideoSchema, artists, tracks, orders, likedTracks, jamSessions, jamSessionEngagement, jamSessionListeners, insertJamSessionSchema, streamQualifiers, spotifyRoyaltyTracks, creditSteps, memberships, spotifyTokens, globalRotation, insertGlobalRotationSchema, globalStreamLogs, playbackSchedules, trusts, trustMembers, treasuryLogs, portalSettings, settlementQueue, users } from "@shared/schema";
import { eq, and, or, desc, asc, sql, count, inArray } from "drizzle-orm";
import { getSpotifyClientForUser, getSpotifyProfile } from "./spotify";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault, verifyPaypalOrder, createTipOrder, captureTipOrder, createGoldSubscription, getSubscriptionDetails, cancelSubscription } from "./paypal";
import { objectStorageClient } from "./replit_integrations/object_storage";
import { getMarketState, getBreathingState, computeLiquiditySplit, computeGlobalRoyaltySplit, generateRecycleValues, invalidateCache, POOL_CEILING, FLOOR_SPLIT, CEO_SPLIT, initTrackPricing, getPortalForPrice, calculateTradeStatus, calculateEarlyExit, checkTreasuryMilestones, loadPortalsFromDb, getPortalConfigs, invalidatePortalCache, PORTALS, enqueueTrader, getSettlementFundBalance, getTraderPositions, traderAcceptOffer, traderHoldPosition, getSettlementDashboard, checkAndTriggerSettlement, runSettlementCycle, SETTLEMENT_CYCLE_THRESHOLD, seed81Portals, getPortalTiers, getGrossIntake, VALID_ENTRIES, getKineticState, setKineticBias, getKineticBias } from "./market-governor";
import { logRadioEvent, logMarketEvent, getSignalStatus, setWebhookUrls, initFromEnv as initSheetsFromEnv } from "./sheets-logger";

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
  mintor: { downloads: -1, previews: -1 },
  asset_trustee: { downloads: 0, previews: -1 },
};

const PAID_TIERS = ["entry_trader", "exchange_trader", "mint_factory_ceo", "mintor", "asset_trustee"];

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

  initSheetsFromEnv();
  seed81Portals().then(() => loadPortalsFromDb()).catch(err => console.error("[PORTALS] Init load failed:", err));
  initTrackPricing().catch(err => console.error("[MARKET] Init pricing failed:", err));

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
      res.set("Access-Control-Allow-Origin", "*");
      res.sendFile(filePath);
    } catch (error) {
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  app.options("/cloud/uploads/:filename", (req: any, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Range");
    res.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
    res.status(204).end();
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
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Range");
      res.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
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
        .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
        .orderBy(asc(tracks.sortPosition), asc(tracks.createdAt));
      const allTracks = allResult.map(r => ({ ...r.tracks, artist: r.artists }));
      res.json(allTracks);
    } catch (error) {
      console.error("Error fetching featured tracks:", error);
      res.status(500).json({ message: "Failed to fetch tracks" });
    }
  });

  app.get("/api/tracks/trust-vault", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === true;
      const trustMember = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);
      const isTrustMember = trustMember.length > 0;

      if (!isAdmin && !isTrustMember) {
        return res.status(403).json({
          message: "TRUST VAULT ACCESS DENIED",
          redirect: "/membership",
        });
      }

      const globalResult = await db
        .select()
        .from(tracks)
        .innerJoin(artists, eq(tracks.artistId, artists.id))
        .where(eq(tracks.releaseType, "global"))
        .orderBy(desc(tracks.playCount));
      const globalTracks = globalResult.map(r => ({ ...r.tracks, artist: r.artists }));
      res.json(globalTracks);
    } catch (error) {
      console.error("Error fetching trust vault:", error);
      res.status(500).json({ message: "Failed to fetch trust vault" });
    }
  });

  app.get("/api/royalty-pool", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === true;
      const trustMemberCheck = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);

      if (!isAdmin && trustMemberCheck.length === 0) {
        return res.status(403).json({ message: "Royalty pool access requires Trust membership" });
      }

      const globalTracks = await db
        .select()
        .from(tracks)
        .where(eq(tracks.releaseType, "global"));

      const totalGlobalSales = globalTracks.reduce((sum, t) => {
        return sum + ((t.salesCount || 0) * parseFloat(t.unitPrice || "3.50"));
      }, 0);

      const allTrustees = await db
        .select()
        .from(trustMembers);

      const totalTrustUnits = allTrustees.length;

      const marketState = await getMarketState();
      const royaltySplit = computeGlobalRoyaltySplit(totalGlobalSales, marketState.session.volatility);

      const perUnitShare = totalTrustUnits > 0
        ? parseFloat((royaltySplit.trustVaultAmount / totalTrustUnits).toFixed(4))
        : 0;

      const userShare = allTrustees.find(t => t.userId === userId) ? perUnitShare : 0;

      res.json({
        totalGlobalAssets: globalTracks.length,
        totalGlobalSales: parseFloat(totalGlobalSales.toFixed(2)),
        minterFeeRate: "16%",
        minterFeeAmount: royaltySplit.minterFeeAmount,
        trustVaultRate: `${(royaltySplit.trustVaultRate * 100).toFixed(0)}%`,
        trustVaultAmount: royaltySplit.trustVaultAmount,
        platformAmount: royaltySplit.platformAmount,
        totalTrustUnits,
        perUnitShare,
        userShare,
        currentTrustValuation: royaltySplit.trustVaultAmount,
        volatility: marketState.session.volatility,
        distribution: allTrustees.map(t => ({
          userId: t.userId,
          share: perUnitShare,
        })),
      });
    } catch (error) {
      console.error("Error fetching royalty pool:", error);
      res.status(500).json({ message: "Failed to fetch royalty pool" });
    }
  });

  app.get("/api/market/session", async (_req: any, res) => {
    try {
      const rawState = await getMarketState();
      const state = getBreathingState(rawState);
      const { session, nextFlashTarget, nextFlashAt } = state;
      const poolSummary = state.pools.map((p) => ({
        trackId: p.trackId,
        poolSize: p.poolSize,
        portalName: p.portalName,
        dynamicPrice: p.dynamicPrice,
        buyBackRate: p.buyBackRate,
        paperTradeCap: p.paperTradeCap,
        minterFee: p.minterFee,
        seats: p.seats,
        rushMultiplier: p.rushMultiplier,
        isFlashScheduled: p.flashTriggerMinute !== null,
        liquiditySplit: p.liquiditySplit,
        earlyOffer: p.earlyOffer,
        maxPayout: p.maxPayout,
        houseTake: p.houseTake,
      }));
      res.json({
        ...session,
        nextFlashTarget,
        nextFlashAt,
        pools: poolSummary,
        totalPools: poolSummary.length,
        activePools: state.activePoolCount,
      });
    } catch (error) {
      console.error("Error fetching market session:", error);
      res.status(500).json({ message: "Failed to fetch market session" });
    }
  });

  app.get("/api/market/pool/:trackId", async (req: any, res) => {
    try {
      const rawState = await getMarketState();
      const state = getBreathingState(rawState);
      const pool = state.pools.find((p) => p.trackId === req.params.trackId);
      if (!pool) return res.status(404).json({ message: "Pool not found" });

      const [track] = await db.select().from(tracks).where(eq(tracks.id, req.params.trackId));
      if (!track) return res.status(404).json({ message: "Track not found" });

      const price = parseFloat(track.unitPrice || "3.50");
      const bbRate = parseFloat(track.buyBackRate || "0.18");
      const portal = getPortalForPrice(price);
      const portalCeiling = portal.pool;
      const grossSales = (track.salesCount || 0) * price;
      const split = computeLiquiditySplit(grossSales);
      const poolPct = Math.min(100, (grossSales / portalCeiling) * 100);
      const paperTradeCap = portalCeiling * 0.50;
      const paperTradeUsed = Math.min(100, (grossSales / paperTradeCap) * 100);
      const unitsRemaining = Math.max(0, Math.ceil((portalCeiling - grossSales) / price));
      const tradeStatus = calculateTradeStatus(price, grossSales);

      res.json({
        ...pool,
        currentPrice: price,
        buyBackRate: bbRate,
        grossSales: parseFloat(grossSales.toFixed(2)),
        poolFillPct: parseFloat(poolPct.toFixed(1)),
        paperTradeUsedPct: parseFloat(paperTradeUsed.toFixed(1)),
        paperTradeCap,
        unitsRemaining,
        floor54: split.floor54,
        ceo46: split.ceo46,
        trustTithe: split.trustTithe,
        bounce: split.bounce,
        portalName: portal.name,
        portalCeiling,
        earlyOffer: tradeStatus.earlyOffer,
        maxPayout: tradeStatus.maxPayout,
        houseTake: tradeStatus.houseTake,
        tradeStatus: tradeStatus.status,
        session: state.session,
      });
    } catch (error) {
      console.error("Error fetching pool:", error);
      res.status(500).json({ message: "Failed to fetch pool data" });
    }
  });

  app.post("/api/logs/radio", isAuthenticated, async (req: any, res) => {
    try {
      const { trackName, isrc, showName, status, duration, poolCapacity } = req.body;
      const userId = req.user?.claims?.sub || "anonymous";
      const success = await logRadioEvent({
        timestamp: new Date().toISOString(),
        userId,
        trackName: trackName || "UNKNOWN",
        isrc: isrc || "N/A",
        showName: showName || "UNKNOWN",
        status: status || "PLAYING",
        duration,
        poolCapacity,
      });
      res.json({ logged: success, signal: success ? "GREEN" : "RED" });
    } catch (error) {
      console.error("Radio log error:", error);
      res.json({ logged: false, signal: "RED" });
    }
  });

  app.post("/api/logs/heartbeat", async (req: any, res) => {
    try {
      const { trackName, isrc, showName, status, progress, duration } = req.body;
      const userId = req.user?.claims?.sub || "anonymous";
      const success = await logRadioEvent({
        timestamp: new Date().toISOString(),
        userId,
        trackName: trackName || "UNKNOWN",
        isrc: isrc || "N/A",
        showName: showName || "HEARTBEAT",
        status: status || "PLAYING",
        duration: progress,
      });
      res.json({ logged: success, signal: success ? "GREEN" : "RED" });
    } catch (error) {
      res.json({ logged: false, signal: "RED" });
    }
  });

  app.get("/api/logs/signal", async (_req: any, res) => {
    const status = getSignalStatus();
    res.json(status);
  });

  app.post("/api/global-stream/log", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || "anonymous";
      const userEmail = req.user?.claims?.email || null;
      const { trackName, artistName, ticker, spotifyUri, portalIndex, action, streamDurationMs, sessionStartedAt } = req.body;
      if (!trackName || !action) return res.status(400).json({ error: "trackName and action required" });
      await db.insert(globalStreamLogs).values({
        userId,
        userEmail,
        trackName,
        artistName: artistName || null,
        ticker: ticker || null,
        spotifyUri: spotifyUri || null,
        portalIndex: portalIndex || 0,
        action,
        streamDurationMs: streamDurationMs || 0,
        sessionStartedAt: sessionStartedAt ? new Date(sessionStartedAt) : null,
      });
      res.json({ logged: true });
    } catch (error) {
      console.error("[GlobalStream] Log error:", error);
      res.json({ logged: false });
    }
  });

  app.get("/api/admin/global-stream/logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const logs = await db.select().from(globalStreamLogs).orderBy(desc(globalStreamLogs.createdAt)).limit(200);
      res.json(logs);
    } catch (error) {
      console.error("[GlobalStream] Fetch logs error:", error);
      res.status(500).json({ error: "Failed to fetch stream logs" });
    }
  });

  app.get("/api/admin/global-stream/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const totalStreams = await db.select({ count: count() }).from(globalStreamLogs).where(eq(globalStreamLogs.action, "STREAM_HEARTBEAT"));
      const totalPlays = await db.select({ count: count() }).from(globalStreamLogs).where(eq(globalStreamLogs.action, "PLAY_START"));
      const totalSkips = await db.select({ count: count() }).from(globalStreamLogs).where(eq(globalStreamLogs.action, "SKIP"));
      const totalDuration = await db.select({ total: sql<number>`COALESCE(SUM(stream_duration_ms), 0)` }).from(globalStreamLogs);
      const uniqueListeners = await db.select({ count: sql<number>`COUNT(DISTINCT user_id)` }).from(globalStreamLogs);
      res.json({
        totalHeartbeats: totalStreams[0]?.count || 0,
        totalPlays: totalPlays[0]?.count || 0,
        totalSkips: totalSkips[0]?.count || 0,
        totalStreamTimeMs: totalDuration[0]?.total || 0,
        uniqueListeners: uniqueListeners[0]?.count || 0,
      });
    } catch (error) {
      console.error("[GlobalStream] Stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/playback-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const schedules = await db.select().from(playbackSchedules).orderBy(asc(playbackSchedules.hour), asc(playbackSchedules.minute));
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch schedules" });
    }
  });

  app.post("/api/admin/playback-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { name, hour, minute, spotifyUri, playlistTitle, daysOfWeek } = req.body;
      if (!name || hour === undefined || minute === undefined || !spotifyUri) {
        return res.status(400).json({ error: "name, hour, minute, spotifyUri required" });
      }
      const [schedule] = await db.insert(playbackSchedules).values({
        name,
        hour: Number(hour),
        minute: Number(minute),
        spotifyUri,
        playlistTitle: playlistTitle || name,
        daysOfWeek: daysOfWeek || "0,1,2,3,4,5,6",
        isActive: true,
      }).returning();
      res.json(schedule);
    } catch (error) {
      console.error("[Schedule] Create error:", error);
      res.status(500).json({ error: "Failed to create schedule" });
    }
  });

  app.patch("/api/admin/playback-schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { id } = req.params;
      const { isActive, hour, minute, name, spotifyUri, playlistTitle, daysOfWeek } = req.body;
      const updates: any = {};
      if (isActive !== undefined) updates.isActive = isActive;
      if (hour !== undefined) updates.hour = Number(hour);
      if (minute !== undefined) updates.minute = Number(minute);
      if (name) updates.name = name;
      if (spotifyUri) updates.spotifyUri = spotifyUri;
      if (playlistTitle) updates.playlistTitle = playlistTitle;
      if (daysOfWeek) updates.daysOfWeek = daysOfWeek;
      const [updated] = await db.update(playbackSchedules).set(updates).where(eq(playbackSchedules.id, id)).returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update schedule" });
    }
  });

  app.delete("/api/admin/playback-schedules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      await db.delete(playbackSchedules).where(eq(playbackSchedules.id, req.params.id));
      res.json({ deleted: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete schedule" });
    }
  });

  app.get("/api/playback-schedules/active", async (_req: any, res) => {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentDay = now.getDay();
      const activeSchedules = await db.select().from(playbackSchedules).where(eq(playbackSchedules.isActive, true));
      const dueSchedules = activeSchedules.filter(s => {
        const days = s.daysOfWeek.split(",").map(Number);
        if (!days.includes(currentDay)) return false;
        if (s.hour === currentHour && s.minute === currentMinute) return true;
        return false;
      });
      res.json(dueSchedules);
    } catch (error) {
      res.status(500).json({ error: "Failed to check schedules" });
    }
  });

  app.post("/api/playback-schedules/:id/triggered", isAuthenticated, async (req: any, res) => {
    try {
      await db.update(playbackSchedules).set({ lastTriggered: new Date() }).where(eq(playbackSchedules.id, req.params.id));
      res.json({ ok: true });
    } catch (error) {
      res.json({ ok: false });
    }
  });

  app.post("/api/logs/webhook-config", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { radioUrl, marketUrl } = req.body;
      setWebhookUrls(radioUrl || null, marketUrl || null);
      res.json({ configured: true, radioUrl: !!radioUrl, marketUrl: !!marketUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to configure webhooks" });
    }
  });

  app.post("/api/orders", async (req: any, res) => {
    try {
      const { trackId } = req.body;
      if (!trackId || typeof trackId !== "string") return res.status(400).json({ message: "trackId required" });

      const [preCheck] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      if (preCheck && (preCheck.releaseType || "native") === "global") {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(403).json({ message: "TRUST VAULT — Authentication required for Global Assets", redirect: "/membership" });
        }
        const user = await storage.getUser(userId);
        const isAdmin = user?.isAdmin === true;
        const tmCheck = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);
        if (!isAdmin && tmCheck.length === 0) {
          return res.status(403).json({ message: "GLOBAL ASSET — Trust Membership Required. Activate your trading account to acquire Global positions.", redirect: "/membership" });
        }
      }

      const result = await db.transaction(async (tx) => {
        const [track] = await tx.select().from(tracks).where(eq(tracks.id, trackId));
        if (!track) throw new Error("NOT_FOUND");

        const releaseType = ((track as any).releaseType || "native").toLowerCase();
        const isGlobal = releaseType === "global";
        const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);
        const currentSales = track.salesCount || 0;

        const price = parseFloat(track.unitPrice || "3.50");
        if (isNaN(price) || price <= 0) throw new Error("INVALID_PRICE");
        if (price < 2.00 && !isGlobal) throw new Error("MIN_TRADE");

        const minterFeeAmt = parseFloat((price * FLOOR_SPLIT).toFixed(4));
        const positionValue = parseFloat((price - minterFeeAmt).toFixed(4));

        if (isGlobal) {
          const ts = Date.now().toString(36).toUpperCase();
          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
          const trustId = `TRST-977-${ticker}-${ts.slice(-4)}${rand.slice(0, 2)}`;

          const [order] = await tx.insert(orders).values({
            trackId,
            trackingNumber: trustId,
            unitPrice: price.toString(),
            creatorCredit: "0.16",
            creatorCreditAmount: minterFeeAmt.toString(),
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
              originatorCredit: minterFeeAmt,
              positionValue,
              aiModel: track.aiModel || "AITIFY-GEN-1",
              releaseType: "global",
              status: "VERIFIED",
              storeUrl: "https://payhip.com/aitifymusicstore",
              timestamp: new Date().toISOString(),
            },
          };
        }

        const buyBackRate = parseFloat(track.buyBackRate || "0.18");
        const currentGross = parseFloat((currentSales * price).toFixed(2));
        const tradePortal = getPortalForPrice(price);
        const portalCeiling = tradePortal.pool;
        const paperTradeCap = portalCeiling * 0.50;

        if (currentGross >= portalCeiling) {
          throw new Error("CEILING_REACHED");
        }

        const newGrossAfter = parseFloat(((currentSales + 1) * price).toFixed(2));
        const split = computeLiquiditySplit(newGrossAfter);
        const tradeStatus = calculateTradeStatus(price, newGrossAfter);

        const seq = String(currentSales + 1).padStart(3, "0");
        const mintId = `MNT-977-${ticker}-${seq}`;

        const [order] = await tx.insert(orders).values({
          trackId,
          trackingNumber: mintId,
          unitPrice: price.toString(),
          creatorCredit: "0.16",
          creatorCreditAmount: minterFeeAmt.toString(),
          positionHolderAmount: positionValue.toString(),
          poolCeiling: portalCeiling,
          portalName: tradePortal.name,
          status: "confirmed",
        }).returning();

        const [updated] = await tx.update(tracks)
          .set({ salesCount: sql`${tracks.salesCount} + 1` })
          .where(eq(tracks.id, trackId))
          .returning();

        invalidateCache();

        const newSales = updated.salesCount || currentSales + 1;
        const newGross = parseFloat((newSales * price).toFixed(2));
        const capacityPct = Math.min(100, parseFloat(((newGross / portalCeiling) * 100).toFixed(1)));

        let poolRecycled = false;
        let recycledData: { newPrice: number; newBuyBackRate: number } | null = null;
        if (newGross >= portalCeiling) {
          const marketState = await getMarketState();
          recycledData = generateRecycleValues(marketState.session.volatility);
          poolRecycled = true;
          await tx.update(tracks)
            .set({
              salesCount: 0,
              unitPrice: recycledData.newPrice.toString(),
              buyBackRate: recycledData.newBuyBackRate.toString(),
            })
            .where(eq(tracks.id, trackId));
          invalidateCache();
        }

        return {
          type: "native" as const,
          order: { id: order.id, mintId: order.trackingNumber, status: order.status, createdAt: order.createdAt },
          receipt: {
            mintId: order.trackingNumber,
            asset: track.title,
            ticker,
            unitPrice: price,
            originatorCredit: minterFeeAmt,
            minterFee: FLOOR_SPLIT,
            buyBackRate,
            buyBackAmount: parseFloat((price * buyBackRate).toFixed(4)),
            positionValue,
            aiModel: track.aiModel || "AITIFY-GEN-1",
            grossSales: newGross,
            totalMints: newSales,
            poolCeiling: portalCeiling,
            paperTradeCap,
            capacityPct,
            releaseType: "native",
            status: poolRecycled ? "SETTLED_REOPENED" : "MINTED",
            poolSize: portalCeiling,
            portalName: tradePortal.name,
            earlyOffer: tradeStatus.earlyOffer,
            maxPayout: tradeStatus.maxPayout,
            houseTake: tradeStatus.houseTake,
            tradeSettlement: tradeStatus.status,
            floor54: split.floor54,
            ceo46: split.ceo46,
            trustTithe: split.trustTithe,
            bounce: split.bounce,
            timestamp: new Date().toISOString(),
            ...(poolRecycled && recycledData ? {
              recycled: {
                newPrice: recycledData.newPrice,
                newBuyBackRate: recycledData.newBuyBackRate,
              },
            } : {}),
          },
        };
      });

      if (result.type === "native" && result.receipt) {
        const r = result.receipt;
        const isClosed = r.status === "CLOSED";
        logMarketEvent({
          timestamp: new Date().toISOString(),
          userId: req.user?.claims?.sub || "anonymous",
          eventType: isClosed ? "POOL_CLOSE" : "BUY_IN",
          trackName: r.asset || "UNKNOWN",
          ticker: r.ticker || "N/A",
          unitPrice: r.unitPrice,
          grossSales: r.grossSales,
          poolSize: r.poolSize || r.mintCap,
          capacityPct: r.capacityPct,
          mintId: r.mintId,
          houseCut: r.floor54 || 0,
          payoutPot: r.ceo46 || 0,
        }).catch(() => {});
      }

      if (result.type === "global" && result.receipt) {
        const r = result.receipt;
        logMarketEvent({
          timestamp: new Date().toISOString(),
          userId: req.user?.claims?.sub || "anonymous",
          eventType: "BUY_IN",
          trackName: r.asset || "UNKNOWN",
          ticker: r.ticker || "N/A",
          unitPrice: r.unitPrice,
          grossSales: r.unitPrice,
          poolSize: 0,
          capacityPct: 0,
          mintId: r.trustId,
          houseCut: 0,
          payoutPot: r.positionValue,
        }).catch(() => {});
      }

      res.json(result);
    } catch (error: any) {
      if (error.message === "NOT_FOUND") return res.status(404).json({ message: "Asset not found" });
      if (error.message === "CEILING_REACHED") return res.status(409).json({ message: "POOL SETTLED — FILL-TO-CLOSE CEILING REACHED. Awaiting re-roll." });
      if (error.message === "INVALID_PRICE") return res.status(400).json({ message: "Invalid asset price" });
      if (error.message === "MIN_TRADE") return res.status(400).json({ message: "Minimum trade is $1.00." });
      console.error("Order placement error:", error);
      res.status(500).json({ message: "Order failed" });
    }
  });

  app.post("/api/exchange/early-exit", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ message: "orderId required" });

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return res.status(404).json({ message: "Trade not found" });

      if (order.status === "settled_early" || order.status === "settled") {
        return res.status(409).json({ message: "Trade already settled" });
      }

      const amount = parseFloat(order.unitPrice || "2.00");
      const { earlyPayout, houseProfit, portal } = calculateEarlyExit(amount);

      await db.update(orders)
        .set({
          status: "settled_early",
          finalPayout: earlyPayout.toString(),
          houseTake: houseProfit.toString(),
          houseTakeAccumulated: houseProfit.toString(),
        })
        .where(eq(orders.id, orderId));

      logMarketEvent({
        timestamp: new Date().toISOString(),
        userId: req.user?.claims?.sub || "anonymous",
        eventType: "EARLY_EXIT",
        trackName: order.trackingNumber || "UNKNOWN",
        ticker: order.trackingNumber?.split("-").slice(2, 3).join("") || "N/A",
        unitPrice: amount,
        grossSales: earlyPayout,
        poolSize: portal.pool,
        capacityPct: 0,
        mintId: order.trackingNumber || "",
        houseCut: houseProfit,
        payoutPot: earlyPayout,
      }).catch(() => {});

      checkTreasuryMilestones().catch(() => {});

      res.json({
        message: "Early exit successful. Paid first.",
        payout: earlyPayout,
        houseTake: houseProfit,
        portal: portal.name,
        status: "SETTLED_EARLY",
      });
    } catch (error) {
      console.error("Early exit error:", error);
      res.status(500).json({ message: "Early exit failed" });
    }
  });

  app.get("/api/exchange/portals", async (_req: any, res) => {
    try {
      const configs = await getPortalConfigs();
      res.json(configs);
    } catch {
      res.json(PORTALS);
    }
  });

  app.get("/api/admin/portals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const all = await db.select().from(portalSettings).orderBy(portalSettings.sortOrder);
      res.json(all);
    } catch (error) {
      console.error("Admin portals error:", error);
      res.status(500).json({ message: "Failed to fetch portals" });
    }
  });

  app.put("/api/admin/portals/bulk-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { portals } = req.body;
      if (!Array.isArray(portals)) return res.status(400).json({ message: "portals array required" });

      const results = [];
      for (const p of portals) {
        const updates: any = { updatedAt: new Date() };
        if (p.tbi !== undefined) updates.tbi = p.tbi.toString();
        if (p.mbb !== undefined) updates.mbb = p.mbb.toString();
        if (p.early !== undefined) updates.early = p.early.toString();
        if (p.pool !== undefined) updates.pool = parseInt(p.pool);
        if (p.isActive !== undefined) updates.isActive = p.isActive;

        const [updated] = await db.update(portalSettings)
          .set(updates)
          .where(eq(portalSettings.id, p.id))
          .returning();
        if (updated) results.push(updated);
      }

      invalidatePortalCache();
      await loadPortalsFromDb();
      console.log(`[PORTALS] Admin bulk-updated ${results.length} portals`);

      res.json({ updated: results.length, portals: results });
    } catch (error) {
      console.error("Bulk portal update error:", error);
      res.status(500).json({ message: "Failed to bulk update portals" });
    }
  });

  app.put("/api/admin/portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { tbi, mbb, early, pool, isActive, sortOrder } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (tbi !== undefined) updates.tbi = tbi.toString();
      if (mbb !== undefined) updates.mbb = mbb.toString();
      if (early !== undefined) updates.early = early.toString();
      if (pool !== undefined) updates.pool = parseInt(pool);
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder);

      const [updated] = await db.update(portalSettings)
        .set(updates)
        .where(eq(portalSettings.id, req.params.id))
        .returning();

      if (!updated) return res.status(404).json({ message: "Portal not found" });

      invalidatePortalCache();
      await loadPortalsFromDb();
      console.log(`[PORTALS] Admin updated portal ${updated.name}: TBI=$${tbi}, MBB=${mbb}x, Early=${early}x, Pool=$${pool}`);

      res.json(updated);
    } catch (error) {
      console.error("Portal update error:", error);
      res.status(500).json({ message: "Failed to update portal" });
    }
  });

  app.get("/api/admin/treasury-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const allNative = await db.select({
        salesCount: tracks.salesCount,
        unitPrice: tracks.unitPrice,
      }).from(tracks).where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`);

      const totalVolume = allNative.reduce((sum, t) => {
        return sum + ((t.salesCount || 0) * parseFloat(t.unitPrice || "2.00"));
      }, 0);

      const dashPulse = getKineticState();
      const traderSettlementPool = totalVolume * dashPulse.floorROI;
      const houseRetention = totalVolume * dashPulse.houseMBBP;

      const distanceToClose = 1000 - (totalVolume % 1000);
      const cyclesCompleted = Math.floor(totalVolume / 1000);
      const payoutPerK = Math.round(1000 * dashPulse.floorROI);
      const totalPaidOut = cyclesCompleted * payoutPerK;

      const [orderStats] = await db.select({
        settledCount: sql<number>`COUNT(CASE WHEN status = 'settled_early' THEN 1 END)`,
        holdingCount: sql<number>`COUNT(CASE WHEN status = 'confirmed' THEN 1 END)`,
        totalOrders: sql<number>`COUNT(*)`,
      }).from(orders);

      res.json({
        status: "SYSTEM ACTIVE",
        signal: "100%",
        totalVolume: parseFloat(totalVolume.toFixed(2)),
        totalRevenue: parseFloat(houseRetention.toFixed(2)),
        payoutPool: parseFloat(traderSettlementPool.toFixed(2)),
        activeVolume: parseFloat(totalVolume.toFixed(2)),
        distanceToClose: parseFloat(distanceToClose.toFixed(2)),
        cyclesCompleted,
        totalPaidOut: parseFloat(totalPaidOut.toFixed(2)),
        settledCount: orderStats?.settledCount || 0,
        holdingCount: orderStats?.holdingCount || 0,
        totalOrders: orderStats?.totalOrders || 0,
        complianceStatus: "ADHERED TO MINT FACTORY",
      });
    } catch (error) {
      console.error("Treasury stats error:", error);
      res.status(500).json({ error: "Signal Interrupted" });
    }
  });

  app.post("/api/admin/treasury-withdraw", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { amount, destination, note } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      if (!destination) return res.status(400).json({ message: "Destination required" });

      const [{ totalHouse }] = await db.select({
        totalHouse: sql<string>`COALESCE(SUM(CAST(house_take AS DECIMAL)), 0)`,
      }).from(orders);

      const [{ totalWithdrawn }] = await db.select({
        totalWithdrawn: sql<string>`COALESCE(SUM(CAST(amount AS DECIMAL)), 0)`,
      }).from(treasuryLogs).where(eq(treasuryLogs.type, "WITHDRAWAL"));

      const available = parseFloat(totalHouse || "0") - parseFloat(totalWithdrawn || "0");
      if (amount > available) {
        return res.status(400).json({ message: "Insufficient treasury funds", available });
      }

      const [log] = await db.insert(treasuryLogs).values({
        amount: amount.toString(),
        destination,
        type: "WITHDRAWAL",
        note: note || null,
        executedBy: userId,
      }).returning();

      console.log(`[TREASURY] WITHDRAWAL: $${amount} to ${destination} by ${userId}`);

      res.json({
        success: true,
        withdrawal: log,
        remaining: parseFloat((available - amount).toFixed(2)),
      });
    } catch (error) {
      console.error("Treasury withdrawal error:", error);
      res.status(500).json({ message: "Withdrawal failed" });
    }
  });

  app.get("/api/admin/treasury-withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const withdrawals = await db.select().from(treasuryLogs)
        .orderBy(desc(treasuryLogs.createdAt))
        .limit(50);

      res.json(withdrawals);
    } catch (error) {
      console.error("Treasury withdrawals error:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.get("/api/admin/early-exit-ledger", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const exits = await db.select({
        id: orders.id,
        trackingNumber: orders.trackingNumber,
        unitPrice: orders.unitPrice,
        finalPayout: orders.finalPayout,
        houseTake: orders.houseTake,
        portalName: orders.portalName,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.status, "settled_early"))
      .orderBy(desc(orders.createdAt))
      .limit(100);

      res.json(exits);
    } catch (error) {
      console.error("Early exit ledger error:", error);
      res.status(500).json({ message: "Failed to fetch ledger" });
    }
  });

  app.get("/api/exchange/treasury", async (_req: any, res) => {
    try {
      const [treasuryResult] = await db.select({
        totalRevenue: sql<string>`COALESCE(SUM(CAST(house_take AS DECIMAL)), 0)`,
        settledCount: sql<number>`COUNT(CASE WHEN status = 'settled_early' THEN 1 END)`,
      }).from(orders);

      const allNative = await db.select({
        salesCount: tracks.salesCount,
        unitPrice: tracks.unitPrice,
      }).from(tracks).where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`);

      const activeFloorVolume = allNative.reduce((sum, t) => {
        return sum + ((t.salesCount || 0) * parseFloat(t.unitPrice || "2.00"));
      }, 0);

      const totalRevenue = parseFloat(treasuryResult?.totalRevenue || "0");
      const totalVolume = activeFloorVolume + totalRevenue;
      const efficiency = totalVolume > 0 ? parseFloat(((activeFloorVolume / totalVolume) * 100).toFixed(1)) : 0;

      res.json({
        balance: totalRevenue,
        formattedBalance: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalRevenue),
        activeFloorVolume: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(activeFloorVolume),
        efficiency: `${efficiency}%`,
        settledCount: treasuryResult?.settledCount || 0,
      });
    } catch (error) {
      console.error("Treasury stats error:", error);
      res.status(500).json({ message: "Failed to fetch treasury stats" });
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
      const totalGross = allTracks.reduce((sum, t) => sum + ((t.salesCount || 0) * parseFloat(t.unitPrice || "3.50")), 0);
      res.json({
        totalMints: result?.total || 0,
        mintCap: 1000,
        totalGross: parseFloat(totalGross.toFixed(2)),
        assets: allTracks.map(t => ({
          id: t.id,
          title: t.title,
          mints: t.salesCount || 0,
          gross: parseFloat(((t.salesCount || 0) * parseFloat(t.unitPrice || "3.50")).toFixed(2)),
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
      .where(eq(tracks.isPrerelease, false))
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

  app.get("/api/leaderboard/traders", async (_req, res) => {
    try {
      const traderRows = await db.select({
        usrId: orders.buyerEmail,
        buyerName: orders.buyerName,
        totalInvested: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
        tradeCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        earlyExits: sql<number>`CAST(COUNT(CASE WHEN status = 'settled_early' THEN 1 END) AS INTEGER)`,
        totalPayout: sql<string>`COALESCE(SUM(CAST(final_payout AS DECIMAL)), 0)`,
        avgPrice: sql<string>`ROUND(AVG(CAST(unit_price AS DECIMAL)), 2)`,
      })
      .from(orders)
      .groupBy(orders.buyerEmail, orders.buyerName)
      .orderBy(sql`SUM(CAST(unit_price AS DECIMAL)) DESC`)
      .limit(50);

      const traders = traderRows.map((t, i) => {
        const invested = parseFloat(t.totalInvested || "0");
        const payout = parseFloat(t.totalPayout || "0");
        const roi = invested > 0 ? parseFloat(((payout / invested) * 100).toFixed(1)) : 0;
        let tier = "BRONZE";
        if (invested >= 500) tier = "PLATINUM";
        else if (invested >= 200) tier = "GOLD";
        else if (invested >= 50) tier = "SILVER";

        return {
          rank: i + 1,
          traderId: t.usrId || `trader-${i}`,
          name: t.buyerName || t.usrId || "Anonymous Trader",
          totalInvested: invested,
          tradeCount: t.tradeCount || 0,
          earlyExits: t.earlyExits || 0,
          totalPayout: payout,
          roi,
          avgPrice: parseFloat(t.avgPrice || "0"),
          tier,
        };
      });

      const totalVolume = traders.reduce((s, t) => s + t.totalInvested, 0);
      const totalTrades = traders.reduce((s, t) => s + Number(t.tradeCount), 0);

      res.json({
        traders,
        stats: {
          totalVolume: parseFloat(totalVolume.toFixed(2)),
          totalTraders: traders.length,
          totalTrades,
          topTrader: traders[0] || null,
        },
      });
    } catch (error) {
      console.error("Error fetching traders leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch traders leaderboard" });
    }
  });

  app.post("/api/create-trader", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      const existing = await db.select().from(memberships).where(eq(memberships.userId, userId)).limit(1);
      if (existing.length > 0) {
        return res.json({ message: "Trader account already exists", status: "active" });
      }

      await db.insert(memberships).values({
        userId,
        tier: "trial",
        status: "active",
        paymentMethod: "trial",
      });

      console.log(`[TRADER] Trial account created for ${userId}`);
      res.json({ message: "Trial trader account activated", status: "active" });
    } catch (error) {
      console.error("Create trader error:", error);
      res.status(500).json({ message: "Failed to create trader account" });
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
        .where(sql`COALESCE(${tracks.releaseType}, 'native') = 'native'`)
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

  app.post("/api/orders/paypal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId, paypalOrderId } = req.body;
      if (!trackId || !paypalOrderId) {
        return res.status(400).json({ message: "trackId and paypalOrderId required" });
      }

      const [preCheck] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      if (!preCheck) return res.status(404).json({ message: "Track not found" });

      const releaseType = ((preCheck as any).releaseType || "native").toLowerCase();
      const isGlobal = releaseType === "global";
      if (isGlobal) {
        const user = await storage.getUser(userId);
        const isAdmin = user?.isAdmin === true;
        const tmCheck2 = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);
        if (!isAdmin && tmCheck2.length === 0) {
          return res.status(403).json({ message: "GLOBAL ASSET — Trust Membership Required." });
        }
      }

      const existingOrder = await db.select().from(orders).where(eq(orders.trackingNumber, paypalOrderId)).limit(1);
      if (existingOrder.length > 0) {
        return res.status(400).json({ message: "PayPal order already used" });
      }

      const result = await db.transaction(async (tx) => {
        const [track] = await tx.select().from(tracks).where(eq(tracks.id, trackId));
        if (!track) throw new Error("NOT_FOUND");

        const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);
        const currentSales = track.salesCount || 0;
        const price = parseFloat(track.unitPrice || "1");
        if (isNaN(price) || price <= 0) throw new Error("INVALID_PRICE");

        const GLOBAL_CEILING = 1000.00;

        if (!isGlobal) {
          const currentGross = parseFloat((currentSales * price).toFixed(2));
          if (currentGross >= GLOBAL_CEILING) throw new Error("CEILING_REACHED");
        }

        const tradePulse = isGlobal ? null : getKineticState();
        const tFloorPct = isGlobal ? 0.54 : tradePulse!.floorROI;
        const tCeoPct = isGlobal ? 0.46 : tradePulse!.houseMBBP;
        const floorTake = parseFloat((price * tFloorPct).toFixed(4));
        const ceoTake = parseFloat((price * tCeoPct).toFixed(4));
        const trustTithe10 = parseFloat((ceoTake * 0.10).toFixed(4));
        const bounce36 = parseFloat((ceoTake - trustTithe10).toFixed(4));
        const isPriority = price < 21.00;

        console.log(`[AITITRADE] ${isGlobal ? "GLOBAL" : "FLOOR"} Trade $${price} | Floor${Math.round(tFloorPct*100)}: $${floorTake} | CEO${Math.round(tCeoPct*100)}: $${ceoTake} | Tithe: $${trustTithe10} | Bounce: $${bounce36} | Priority: ${isPriority ? "HIGH" : "CYCLE_HOLD"}`);

        const seq = String(currentSales + 1).padStart(3, "0");
        const prefix = isGlobal ? "TRST" : "MNT";
        const trackingNum = `${prefix}-977-${ticker}-${seq}`;

        const [order] = await tx.insert(orders).values({
          trackId,
          trackingNumber: trackingNum,
          unitPrice: price.toString(),
          creatorCredit: tCeoPct.toFixed(2),
          creatorCreditAmount: ceoTake.toString(),
          positionHolderAmount: floorTake.toString(),
          status: "verified",
        }).returning();

        await tx.update(tracks)
          .set({ salesCount: sql`${tracks.salesCount} + 1` })
          .where(eq(tracks.id, trackId));

        const newGross = parseFloat(((currentSales + 1) * price).toFixed(2));

        if (isGlobal) {
          return {
            type: "global" as const,
            receipt: {
              trustId: order.trackingNumber,
              asset: track.title,
              ticker,
              unitPrice: price,
              floorRetained: floorTake,
              ceoGross: ceoTake,
              trustTithe: trustTithe10,
              bounce: bounce36,
              aiModel: track.aiModel || "AITIFY-GEN-1",
              releaseType: "global",
              priority: isPriority ? "HIGH" : "CYCLE_HOLD",
              indicator: "STIMULATION_ACTIVE",
              status: "TRADE_EXECUTED",
              storeUrl: "https://payhip.com/aitifymusicstore",
              timestamp: new Date().toISOString(),
            },
          };
        }

        const capacityPct = Math.min(100, parseFloat(((newGross / GLOBAL_CEILING) * 100).toFixed(1)));
        return {
          type: "native" as const,
          receipt: {
            mintId: order.trackingNumber,
            asset: track.title,
            ticker,
            unitPrice: price,
            floorRetained: floorTake,
            ceoGross: ceoTake,
            trustTithe: trustTithe10,
            bounce: bounce36,
            aiModel: track.aiModel || "AITIFY-GEN-1",
            grossSales: newGross,
            totalMints: currentSales + 1,
            mintCap: GLOBAL_CEILING,
            capacityPct,
            priority: isPriority ? "HIGH" : "CYCLE_HOLD",
            indicator: "STIMULATION_ACTIVE",
            status: newGross >= GLOBAL_CEILING ? "CLOSED" : "TRADE_EXECUTED",
            timestamp: new Date().toISOString(),
          },
        };
      });

      res.json(result);
    } catch (error: any) {
      console.error("PayPal trade order error:", error);
      if (error.message === "CEILING_REACHED") {
        return res.status(400).json({ message: "Pool closed — ceiling reached" });
      }
      res.status(500).json({ message: "Failed to process trade order" });
    }
  });

  app.post("/api/exchange/trade", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId, amount } = req.body;
      if (!trackId || !amount) {
        return res.status(400).json({ message: "trackId and amount required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 1) {
        return res.status(400).json({ message: "Minimum trade amount is $1.00" });
      }

      const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      if (!track) return res.status(404).json({ message: "Track not found" });

      const isGlobal = track.releaseType === "global";
      const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);
      const price = Math.max(1, parseFloat(track.unitPrice || "1"));
      const currentSales = track.salesCount || 0;

      const GLOBAL_CEILING = 1000.00;
      if (!isGlobal) {
        const currentGross = parseFloat((currentSales * price).toFixed(2));
        if (currentGross >= GLOBAL_CEILING) {
          return res.status(400).json({ message: "Pool closed — ceiling reached" });
        }
      }

      const kineticSplit = isGlobal ? { floor: 0.54, ceo: 0.46 } : getKineticState();
      const floorPct = isGlobal ? 0.54 : kineticSplit.floorROI;
      const ceoPct = isGlobal ? 0.46 : kineticSplit.houseMBBP;
      const floorTake = parseFloat((parsedAmount * floorPct).toFixed(4));
      const ceoTake = parseFloat((parsedAmount * ceoPct).toFixed(4));
      const trustTithe10 = parseFloat((ceoTake * 0.10).toFixed(4));
      const bounce = parseFloat((ceoTake - trustTithe10).toFixed(4));
      const isPriority = parsedAmount < 21.00;

      console.log(`[CASH APP TRADE] ${isGlobal ? "GLOBAL" : "FLOOR"} | Asset: ${ticker} | Total: $${parsedAmount} | Floor${Math.round(floorPct*100)}: $${floorTake} | CEO${Math.round(ceoPct*100)}: $${ceoTake} | Tithe: $${trustTithe10} | Bounce: $${bounce} | Priority: ${isPriority ? "HIGH" : "CYCLE_HOLD"}`);

      const seq = String(currentSales + 1).padStart(3, "0");
      const prefix = isGlobal ? "TRST" : "MNT";
      const trackingNum = `${prefix}-977-${ticker}-${seq}`;

      const cashAppUrl = `https://cash.app/$AITITRADEBROKERAGE/${parsedAmount.toFixed(2)}?note=AITITRADE%20${encodeURIComponent(trackingNum)}`;

      const [order] = await db.insert(orders).values({
        trackId,
        trackingNumber: trackingNum,
        unitPrice: parsedAmount.toString(),
        creatorCredit: ceoPct.toFixed(2),
        creatorCreditAmount: ceoTake.toString(),
        positionHolderAmount: floorTake.toString(),
        status: "pending_cashapp",
      }).returning();

      await db.update(tracks)
        .set({ salesCount: sql`${tracks.salesCount} + 1` })
        .where(eq(tracks.id, trackId));

      let settlementTriggered = false;
      if (!isGlobal) {
        await enqueueTrader(order.id, userId, trackId, parsedAmount);
        settlementTriggered = await checkAndTriggerSettlement();
      }

      const newGross = parseFloat(((currentSales + 1) * price).toFixed(2));
      const capacityPct = Math.min(100, parseFloat(((newGross / GLOBAL_CEILING) * 100).toFixed(1)));
      const fundBalance = await getSettlementFundBalance();

      res.json({
        instruction: `SEND $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE VIA CASH APP`,
        url: cashAppUrl,
        cashtag: "$AITITRADEBROKERAGE",
        note: `AITITRADE ${trackingNum}`,
        trackingNumber: trackingNum,
        ticker,
        asset: track.title,
        unitPrice: price,
        floorRetained: floorTake,
        ceoGross: ceoTake,
        trustTithe: trustTithe10,
        bounce: bounce,
        priority: isPriority ? "HIGH" : "CYCLE_HOLD",
        indicator: "STIMULATION_ACTIVE",
        status: newGross >= GLOBAL_CEILING ? "CLOSED" : "STIMULATION_PENDING",
        message: "PAYMENT TO $AITITRADEBROKERAGE LOCKS YOUR POSITION",
        grossSales: newGross,
        totalMints: currentSales + 1,
        mintCap: GLOBAL_CEILING,
        capacityPct,
        aiModel: track.aiModel || "AITIFY-GEN-1",
        releaseType: isGlobal ? "global" : "native",
        settlementFund: fundBalance,
        settlementTriggered,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Cash App trade error:", error);
      res.status(500).json({ message: "Failed to process trade" });
    }
  });

  app.post("/api/exchange/trade-spotify", isAuthenticated, async (req: any, res) => {
    try {
      const { spotifyTrackId, amount } = req.body;
      if (!spotifyTrackId || !amount) {
        return res.status(400).json({ message: "spotifyTrackId and amount required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount < 1) {
        return res.status(400).json({ message: "Minimum trade amount is $1.00" });
      }

      const floor54 = parseFloat((parsedAmount * 0.54).toFixed(4));
      const ceoTake46 = parseFloat((parsedAmount * 0.46).toFixed(4));
      const trustTithe10 = parseFloat((ceoTake46 * 0.10).toFixed(4));
      const bounce36 = parseFloat((ceoTake46 - trustTithe10).toFixed(4));
      const isPriority = parsedAmount < 21.00;

      console.log(`[SPOTIFY TRADE] Track: ${spotifyTrackId} | Total: $${parsedAmount} | Floor54: $${floor54} | CEO46: $${ceoTake46} | Tithe: $${trustTithe10} | Bounce: $${bounce36} | Priority: ${isPriority ? "HIGH" : "CYCLE_HOLD"}`);

      const cashAppUrl = `https://cash.app/$AITITRADEBROKERAGE/${parsedAmount.toFixed(2)}`;

      res.json({
        instruction: `SEND $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE VIA CASH APP`,
        paymentLink: cashAppUrl,
        cashtag: "$AITITRADEBROKERAGE",
        assetClass: "SPOTIFY_GLOBAL",
        spotifyTrackId,
        split: {
          floor: floor54,
          ceoGross: ceoTake46,
          trustTithe: trustTithe10,
          bounce: bounce36,
        },
        priority: isPriority ? "HIGH" : "CYCLE_HOLD",
        indicator: "STIMULATION_ACTIVE",
        status: "STIMULATION_PENDING",
        message: `SEND $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE TO LOCK THIS SPOTIFY POSITION`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Spotify trade error:", error);
      res.status(500).json({ message: "Failed to process Spotify trade" });
    }
  });

  app.post("/api/proxy/p2p-trade", isAuthenticated, async (req: any, res) => {
    try {
      const buyerId = req.user.claims.sub;
      const { sellerTradeId, amount } = req.body;
      if (!sellerTradeId || !amount) {
        return res.status(400).json({ message: "sellerTradeId and amount required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const p2pPulse = getKineticState();
      const floor54 = parseFloat((parsedAmount * p2pPulse.floorROI).toFixed(4));
      const ceoTake46 = parseFloat((parsedAmount * p2pPulse.houseMBBP).toFixed(4));
      const trustTithe10 = parseFloat((ceoTake46 * 0.10).toFixed(4));
      const bounce36 = parseFloat((ceoTake46 - trustTithe10).toFixed(4));

      const brokerageLink = "https://cash.app/$AITITRADEBROKERAGE";

      console.log(`[P2P TRADE] Buyer: ${buyerId} | Seller Trade: ${sellerTradeId} | Total: $${parsedAmount} | Split: ${Math.round(p2pPulse.floorROI*100)}/${Math.round(p2pPulse.houseMBBP*100)}`);
      console.log(`[LEDGER] Floor: $${floor54} | CEO Bounce: $${bounce36} | Trust: $${trustTithe10}`);

      res.json({
        status: "P2P_INITIATED",
        instruction: `TRANSFER $${parsedAmount.toFixed(2)} TO BROKERAGE TO SETTLE PEER TRADE`,
        cashAppUrl: brokerageLink,
        cashtag: "$AITITRADEBROKERAGE",
        sellerTradeId,
        buyerId,
        split: {
          floor: floor54,
          ceoGross: ceoTake46,
          trustTithe: trustTithe10,
          bounce: bounce36,
        },
        indicator: "STIMULATION_ACTIVE",
        message: `SEND $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE — P2P SETTLEMENT`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("P2P trade error:", error);
      res.status(500).json({ message: "Failed to initiate P2P trade" });
    }
  });

  app.post("/api/exchange/p2p-settle", isAuthenticated, async (req: any, res) => {
    try {
      const { amount, assetId, spotifyTrackId } = req.body;

      if (!amount) {
        return res.status(400).json({ message: "amount required" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const settlePulse = getKineticState();
      const floor54 = parseFloat((parsedAmount * settlePulse.floorROI).toFixed(4));
      const ceoGross46 = parseFloat((parsedAmount * settlePulse.houseMBBP).toFixed(4));
      const trustTithe10 = parseFloat((ceoGross46 * 0.10).toFixed(4));
      const bounce36 = parseFloat((ceoGross46 - trustTithe10).toFixed(4));

      const cashAppUrl = "https://cash.app/$AITITRADEBROKERAGE";
      const ref = assetId || spotifyTrackId || "SPOT_ASSET";

      console.log(`[P2P SETTLE] Asset: ${ref} | Amount: $${parsedAmount.toFixed(2)} | Split: ${Math.round(settlePulse.floorROI*100)}/${Math.round(settlePulse.houseMBBP*100)}`);
      console.log(`[LEDGER] Floor: $${floor54} | CEO Bounce: $${bounce36} | Trust Tithe: $${trustTithe10}`);

      res.json({
        status: "STIMULATION_READY",
        instruction: "SEND TO CASH APP TO LOCK POSITION",
        url: cashAppUrl,
        cashtag: "$AITITRADEBROKERAGE",
        ref,
        split: {
          floor: floor54,
          ceoGross: ceoGross46,
          trustTithe: trustTithe10,
          bounce: bounce36,
        },
        indicators: {
          floor: "STABLE",
          load: "54%",
          signal: "97.7 THE FLAME",
        },
        priority: parsedAmount < 21 ? "HIGH" : "STANDARD",
        message: `TRANSFER $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE. USE REF: ${ref}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("P2P settle error:", error);
      res.status(500).json({ message: "Failed to initiate P2P settlement" });
    }
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
      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const isAdmin = adminUser.length > 0 && adminUser[0].isAdmin;
      if (!isAdmin) {
        const artist = await storage.getArtistByUserId(userId);
        if (!artist) {
          return res.status(403).json({ message: "Artist profile required" });
        }
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
        model: "gpt-4o",
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

  app.post("/api/admin/suno-generate", isAdmin, async (req: any, res) => {
    try {
      const { prompt, style, makeInstrumental } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "prompt required" });
      }

      console.log(`[AUDIO_GEN] Initiating Generation: ${prompt}`);
      console.log(`[AUDIO_GEN] Style: ${style || "default"} | Instrumental: ${!!makeInstrumental}`);

      const voice = makeInstrumental ? "alloy" : "nova";
      const speechRes = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice,
        input: prompt.slice(0, 4096),
        response_format: "mp3",
        speed: 0.95,
      });

      const audioBuffer = Buffer.from(await speechRes.arrayBuffer());
      const audioId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const audioFilePath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
      fs.writeFileSync(audioFilePath, audioBuffer);

      const wholesaleCost = 0.35;
      const floor54 = parseFloat((wholesaleCost * 0.54).toFixed(4));
      const ceoGross46 = parseFloat((wholesaleCost * 0.46).toFixed(4));

      console.log(`[AUDIO_GEN] Generated: ${audioId} | Wholesale: $${wholesaleCost}`);

      res.json({
        status: "MINTING_PENDING",
        suno_id: audioId,
        audioUrl: `/uploads/${audioId}.mp3`,
        asset_class: "AI_GENERATED_AUDIO",
        wholesale_cost: wholesaleCost,
        trade_status: "MINTING_PENDING",
        split: {
          floor: floor54,
          ceoGross: ceoGross46,
        },
        prompt,
        style: style || "pop",
        engine: "openai-tts-1-hd",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[AUDIO_GEN] Generation error:", error);
      res.status(500).json({ message: "Failed to generate audio asset" });
    }
  });

  app.post("/api/admin/ideogram-generate", isAdmin, async (req: any, res) => {
    try {
      const { trackTitle, customPrompt, aspectRatio } = req.body;

      if (!trackTitle && !customPrompt) {
        return res.status(400).json({ message: "trackTitle or customPrompt required" });
      }

      const prompt = customPrompt || `Cinematic trading floor style album art for "${trackTitle}", neon green and obsidian, high-tech digital asset style`;

      console.log(`[ART_GEN] Generating art for: ${trackTitle || "custom"}`);
      console.log(`[ART_GEN] Prompt: ${prompt.slice(0, 80)}...`);

      const dalleRes = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
      });

      const imageUrl = dalleRes.data?.[0]?.url || null;
      const wholesaleCost = 0.03;

      console.log(`[ART_GEN] Generated: ${imageUrl ? "OK" : "NO_URL"} | Cost: $${wholesaleCost}`);

      res.json({
        status: "ART_READY",
        imageUrl,
        asset_class: "AI_GENERATED_ARTWORK",
        wholesale_cost: wholesaleCost,
        prompt,
        model: "dall-e-3",
        aspect_ratio: aspectRatio || "1:1",
        trackTitle: trackTitle || null,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[ART_GEN] Generation error:", error);
      res.status(500).json({ message: "Failed to generate artwork" });
    }
  });

  app.post("/api/distribute/direct-push", isAdmin, async (req: any, res) => {
    try {
      const { prompt, title, style, price, makeInstrumental, aspectRatio } = req.body;

      if (!title) {
        return res.status(400).json({ message: "title required" });
      }

      console.log(`[DIRECT_PUSH] Initiating full asset pipeline: "${title}"`);

      const audioPrompt = prompt || title;
      const artPrompt = `Cinematic trading floor style album art for "${title}", neon green and obsidian, high-tech digital asset style`;

      let audioAsset = { suno_id: null as string | null, audioUrl: null as string | null, status: "FAILED" };
      let visualAsset = { imageUrl: null as string | null, status: "FAILED" };

      try {
        const voice = makeInstrumental ? "alloy" : "nova";
        const speechRes = await openai.audio.speech.create({
          model: "tts-1-hd",
          voice,
          input: audioPrompt.slice(0, 4096),
          response_format: "mp3",
          speed: 0.95,
        });
        const audioBuffer = Buffer.from(await speechRes.arrayBuffer());
        const audioId = `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const audioFilePath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
        fs.writeFileSync(audioFilePath, audioBuffer);
        audioAsset = { suno_id: audioId, audioUrl: `/uploads/${audioId}.mp3`, status: "MINTING_PENDING" };
        console.log(`[DIRECT_PUSH] Audio generated: ${audioId}`);
      } catch (e: any) {
        console.error(`[DIRECT_PUSH] Audio failed: ${e.message}`);
      }

      try {
        const dalleRes = await openai.images.generate({
          model: "dall-e-3",
          prompt: artPrompt,
          n: 1,
          size: "1024x1024",
          quality: "hd",
        });
        visualAsset = { imageUrl: dalleRes.data?.[0]?.url || null, status: "ART_READY" };
        console.log(`[DIRECT_PUSH] Artwork generated: ${visualAsset.imageUrl ? "OK" : "NO_URL"}`);
      } catch (e: any) {
        console.error(`[DIRECT_PUSH] Art failed: ${e.message}`);
      }

      const ticker = title.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
      const unitPrice = parseFloat(String(price || 25.00));
      const wholesaleCost = 0.35 + 0.03;
      const floor54 = parseFloat((unitPrice * 0.54).toFixed(4));
      const ceoGross46 = parseFloat((unitPrice * 0.46).toFixed(4));
      const trustTithe10 = parseFloat((ceoGross46 * 0.10).toFixed(4));
      const bounce36 = parseFloat((ceoGross46 - trustTithe10).toFixed(4));

      console.log(`[DIRECT_PUSH] $${ticker} | Price: $${unitPrice} | Wholesale: $${wholesaleCost}`);
      console.log(`[DIRECT_PUSH] Split — Floor: $${floor54} | Bounce: $${bounce36} | Trust: $${trustTithe10}`);

      res.json({
        status: "ASSET_LIVE",
        ticker: `$${ticker}`,
        title,
        audio: {
          suno_id: audioAsset.suno_id,
          status: audioAsset.status,
          audioUrl: audioAsset.audioUrl,
          engine: "openai-tts-1-hd",
        },
        artwork: {
          imageUrl: visualAsset.imageUrl,
          status: visualAsset.status,
          engine: "dall-e-3",
        },
        pricing: {
          unitPrice,
          wholesaleCost,
          margin: parseFloat((unitPrice - wholesaleCost).toFixed(2)),
          floorSupport: 1000.00,
        },
        split: {
          floor: floor54,
          ceoGross: ceoGross46,
          trustTithe: trustTithe10,
          bounce: bounce36,
          mandate: "KINETIC",
        },
        settlement: "https://cash.app/$AITITRADEBROKERAGE",
        cashtag: "$AITITRADEBROKERAGE",
        priority: unitPrice < 21 ? "HIGH" : "STANDARD",
        message: "ASSET DISTRIBUTED TO FLOOR. STIMULATION READY.",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[DIRECT_PUSH] Pipeline error:", error);
      res.status(500).json({ message: "Failed to execute direct push distribution" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // INDIVIDUAL GENERATORS — Preview before Push
  // ═══════════════════════════════════════════════════════════════

  app.post("/api/production/generate-beat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!adminUser.length || !adminUser[0].isAdmin) {
        return res.status(403).json({ message: "ADMIN ACCESS ONLY" });
      }

      const { prompt, style, voiceType, makeInstrumental } = req.body;
      if (!prompt) return res.status(400).json({ message: "Prompt required" });

      console.log(`[BEAT-GEN] Generating audio: style=${style}, voice=${voiceType}, instrumental=${makeInstrumental}`);

      const voice = voiceType?.includes("female") ? "nova" : voiceType?.includes("male-deep") ? "onyx" : voiceType?.includes("male-raspy") ? "echo" : "alloy";

      const speechResponse = await openai.audio.speech.create({
        model: "tts-1-hd",
        voice,
        input: prompt.slice(0, 4096),
        response_format: "mp3",
        speed: 0.95,
      });

      const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());
      const audioId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const audioPath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
      fs.writeFileSync(audioPath, audioBuffer);

      const audioUrl = `/uploads/${audioId}.mp3`;
      console.log(`[BEAT-GEN] Audio generated: ${audioUrl} (${audioBuffer.length} bytes)`);

      res.json({
        audioUrl,
        sunoId: audioId,
        status: "READY",
      });
    } catch (error: any) {
      console.error("[BEAT-GEN] Error:", error.message);
      res.status(500).json({ message: error.message || "Beat generation failed" });
    }
  });

  app.post("/api/production/generate-art", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!adminUser.length || !adminUser[0].isAdmin) {
        return res.status(403).json({ message: "ADMIN ACCESS ONLY" });
      }

      const { prompt } = req.body;
      const artPrompt = prompt || "Cinematic album artwork, neon green and obsidian, high-tech digital asset trading floor style";

      console.log(`[ART-GEN] Generating artwork via DALL-E`);

      const dalleRes = await openai.images.generate({
        model: "dall-e-3",
        prompt: artPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
      });

      const imageUrl = dalleRes.data?.[0]?.url || null;
      console.log(`[ART-GEN] DALL-E result: ${imageUrl ? "OK" : "NO_URL"}`);

      res.json({ imageUrl, status: imageUrl ? "READY" : "NO_URL" });
    } catch (error: any) {
      console.error("[ART-GEN] Error:", error.message);
      res.status(500).json({ message: error.message || "Art generation failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // THE PUSHER ENGINE — Trust Member Production Pipeline
  // Suno/Ideogram → DB Track → Ledger Debit → Floor Listing
  // ═══════════════════════════════════════════════════════════════
  app.post("/api/production/push", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!adminUser.length || !adminUser[0].isAdmin) {
        return res.status(403).json({ message: "MINT FACTORY — ADMIN ACCESS ONLY" });
      }

      const { title, audioPrompt, visualPrompt, style, unitPrice, makeInstrumental } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Asset title required" });
      }

      const member = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);
      if (member.length === 0) {
        return res.status(403).json({
          error: "PROMISSORY NOTE ACTIVATION REQUIRED",
          message: "You must be a trust member to push assets. Activate your $25 down payment.",
          redirect: "/membership",
        });
      }

      const tm = member[0];
      const outstanding = parseFloat(tm.outstandingBalance || "475.00");

      if (outstanding <= 0) {
        return res.status(403).json({
          error: "NOTE FULLY AMORTIZED",
          message: "Your promissory note is fully paid. Contact admin to renew.",
        });
      }

      console.log(`[PUSHER] ${userId} pushing asset: "${title}" | Trust: ${tm.trustId} | Balance: $${outstanding}`);

      let audioAsset = { suno_id: null as string | null, audioUrl: null as string | null, status: "SKIPPED" };
      let visualAsset = { imageUrl: null as string | null, status: "SKIPPED" };

      const wholesaleAudio = 0.35;
      const wholesaleArt = 0.03;
      const totalWholesale = wholesaleAudio + wholesaleArt;

      const preGenAudio = req.body.preGeneratedAudioUrl;
      const preGenArt = req.body.preGeneratedArtUrl;

      if (preGenAudio) {
        audioAsset = { suno_id: req.body.preGeneratedSunoId || null, audioUrl: preGenAudio, status: "MINTING_PENDING" };
        console.log(`[PUSHER] Using pre-generated audio: ${preGenAudio}`);
      } else {
        try {
          const voice = makeInstrumental ? "alloy" : "nova";
          const speechRes = await openai.audio.speech.create({
            model: "tts-1-hd",
            voice,
            input: (audioPrompt || title).slice(0, 4096),
            response_format: "mp3",
            speed: 0.95,
          });
          const audioBuffer = Buffer.from(await speechRes.arrayBuffer());
          const audioId = `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const audioFilePath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
          fs.writeFileSync(audioFilePath, audioBuffer);
          audioAsset = { suno_id: audioId, audioUrl: `/uploads/${audioId}.mp3`, status: "MINTING_PENDING" };
          console.log(`[PUSHER] Audio generated via TTS: ${audioAsset.audioUrl}`);
        } catch (e: any) {
          console.error(`[PUSHER] Audio gen error:`, e.message);
          audioAsset.status = "GEN_ERROR";
        }
      }

      if (preGenArt) {
        visualAsset = { imageUrl: preGenArt, status: "ART_READY" };
        console.log(`[PUSHER] Using pre-generated art: ${preGenArt}`);
      } else {
        try {
          const artPrompt = visualPrompt || `Cinematic trading floor style album art for "${title}", neon green and obsidian, high-tech digital asset style`;
          const dalleRes = await openai.images.generate({
            model: "dall-e-3",
            prompt: artPrompt,
            n: 1,
            size: "1024x1024",
            quality: "hd",
          });
          visualAsset = { imageUrl: dalleRes.data?.[0]?.url || null, status: "ART_READY" };
          console.log(`[PUSHER] DALL-E generated: ${visualAsset.imageUrl ? "OK" : "NO_URL"}`);
        } catch (e: any) {
          console.error(`[PUSHER] Art gen error:`, e.message);
          visualAsset.status = "GEN_ERROR";
        }
      }

      const ticker = title.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      const price = parseFloat(String(unitPrice || 5.00));
      const buyBack = parseFloat((price * 1.80).toFixed(2));

      const defaultArtistId = "ac86c1b3-363b-4567-be22-2691d3adcb6e";

      const [newTrack] = await db.insert(tracks).values({
        artistId: defaultArtistId,
        title,
        duration: 180,
        audioUrl: audioAsset.audioUrl || `suno-pending://${audioAsset.suno_id || "queue"}`,
        coverImage: visualAsset.imageUrl || null,
        unitPrice: price.toString(),
        buyBackRate: buyBack.toString(),
        salesCount: 0,
        assetClass: "standard",
        releaseType: "native",
        aiModel: "AITIFY-GEN-1",
        isFeatured: true,
        isPrerelease: false,
        genre: style || "Global Trade Beat",
      }).returning();

      const newBalance = parseFloat((outstanding - totalWholesale).toFixed(2));
      await db.update(trustMembers)
        .set({ outstandingBalance: newBalance.toString() })
        .where(eq(trustMembers.id, tm.id));

      console.log(`[PUSHER] Asset ${ticker} LIVE | Track ID: ${newTrack.id} | Wholesale: $${totalWholesale} | New Balance: $${newBalance}`);

      const floor54 = parseFloat((price * FLOOR_SPLIT).toFixed(4));
      const ceo46 = parseFloat((price * CEO_SPLIT).toFixed(4));
      const trustTithe = parseFloat((ceo46 * 0.10).toFixed(4));
      const bounce = parseFloat((ceo46 - trustTithe).toFixed(4));

      res.json({
        status: "PUSHED",
        assetTicker: `$${ticker}`,
        trackId: newTrack.id,
        title,
        audio: { suno_id: audioAsset.suno_id, status: audioAsset.status, engine: "chirp-v3.5" },
        artwork: { imageUrl: visualAsset.imageUrl, status: visualAsset.status, engine: "ideogram-v2" },
        pricing: { unitPrice: price, buyBack, roi: parseFloat((((buyBack - price) / price) * 100).toFixed(1)), wholesaleCost: totalWholesale },
        split: { floor: floor54, ceoGross: ceo46, trustTithe, bounce, mandate: "KINETIC" },
        ledger: {
          previousBalance: outstanding,
          debit: totalWholesale,
          newBalance,
          monthlyCommitment: tm.monthlyCommitment,
          monthsRemaining: tm.monthsRemaining,
          trustId: tm.trustId,
        },
        amortization: `$${tm.monthlyCommitment}/MO × ${tm.monthsRemaining} MONTHS REMAINING`,
        settlement: "https://cash.app/$AITITRADEBROKERAGE",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[PUSHER] Pipeline error:", error);
      res.status(500).json({ message: "Production push failed" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // SETTLEMENT ENGINE — $1K Accumulated Intake FIFO Cycle
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/settlement/status", isAuthenticated, async (req: any, res) => {
    try {
      const dashboard = await getSettlementDashboard();
      res.json({
        ...dashboard,
        splitMandate: "KINETIC",
        earlyAcceptMultiplier: 1.25,
        holdBonusPerCycle: 0.15,
      });
    } catch (error: any) {
      console.error("[SETTLEMENT] Status error:", error);
      res.status(500).json({ message: "Failed to fetch settlement status" });
    }
  });

  app.get("/api/settlement/my-positions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await getTraderPositions(userId);
      const fundBalance = await getSettlementFundBalance();
      res.json({ positions, fundBalance, cycleThreshold: SETTLEMENT_CYCLE_THRESHOLD });
    } catch (error: any) {
      console.error("[SETTLEMENT] Positions error:", error);
      res.status(500).json({ message: "Failed to fetch positions" });
    }
  });

  app.post("/api/settlement/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueId } = req.body;
      if (!queueId) return res.status(400).json({ message: "queueId required" });
      const result = await traderAcceptOffer(queueId, userId);
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Accept error:", error);
      res.status(500).json({ message: "Failed to accept settlement" });
    }
  });

  app.post("/api/settlement/hold", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueId } = req.body;
      if (!queueId) return res.status(400).json({ message: "queueId required" });
      const result = await traderHoldPosition(queueId, userId);
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Hold error:", error);
      res.status(500).json({ message: "Failed to hold position" });
    }
  });

  app.post("/api/admin/settlement/run-cycle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const result = await runSettlementCycle();
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Admin cycle error:", error);
      res.status(500).json({ message: "Failed to run settlement cycle" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // TRADER PORTAL — Individual trader profile + positions
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/trader/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.userId;
      const requestingUserId = req.user?.claims?.sub;

      const requestingUser = await storage.getUser(requestingUserId);
      if (targetUserId !== requestingUserId && !requestingUser?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ message: "Trader not found" });
      }

      const trustMember = await db.select().from(trustMembers).where(eq(trustMembers.userId, targetUserId)).limit(1);
      const isTrustMember = trustMember.length > 0;
      const tm = trustMember[0] || null;

      const traderOrders = await db.select({
        id: orders.id,
        trackId: orders.trackId,
        trackingNumber: orders.trackingNumber,
        unitPrice: orders.unitPrice,
        status: orders.status,
        createdAt: orders.createdAt,
      }).from(orders)
        .where((() => {
          const conditions = [];
          if (user.email) conditions.push(eq(orders.buyerEmail, user.email));
          if (user.username) conditions.push(eq(orders.buyerName, user.username));
          if (conditions.length === 0) return sql`false`;
          return conditions.length === 1 ? conditions[0] : or(...conditions);
        })())
        .orderBy(desc(orders.createdAt))
        .limit(50);

      const positions = await Promise.all(traderOrders.map(async (o) => {
        const [track] = await db.select({ title: tracks.title, coverImage: tracks.coverImage, buyBackRate: tracks.buyBackRate }).from(tracks).where(eq(tracks.id, o.trackId)).limit(1);
        const buyIn = parseFloat(o.unitPrice || "5.00");
        const buyBack = parseFloat(track?.buyBackRate || (buyIn * 1.80).toFixed(2));
        return {
          ...o,
          trackTitle: track?.title || "UNKNOWN",
          coverImage: track?.coverImage || null,
          buyIn,
          buyBack,
          roi: parseFloat((((buyBack - buyIn) / buyIn) * 100).toFixed(1)),
        };
      }));

      const totalInvested = positions.reduce((sum, p) => sum + p.buyIn, 0);
      const totalBuyBack = positions.reduce((sum, p) => sum + p.buyBack, 0);

      res.json({
        trader: {
          id: targetUserId,
          username: user.username || "ANON",
          profileImage: user.profileImageUrl || null,
          isAdmin: user.isAdmin || false,
        },
        trust: isTrustMember ? {
          trustId: tm!.trustId,
          noteAmount: tm!.promissoryNoteAmount || 500,
          outstandingBalance: parseFloat(tm!.outstandingBalance || "475.00"),
          monthlyCommitment: tm!.monthlyCommitment || "19.79",
          monthsRemaining: tm!.monthsRemaining || 24,
          isBeneficiary: tm!.isBeneficiary,
          giftedYield: parseFloat(tm!.giftedYield || "0.00"),
        } : null,
        positions,
        summary: {
          totalPositions: positions.length,
          totalInvested: parseFloat(totalInvested.toFixed(2)),
          totalBuyBack: parseFloat(totalBuyBack.toFixed(2)),
          projectedROI: totalInvested > 0 ? parseFloat((((totalBuyBack - totalInvested) / totalInvested) * 100).toFixed(1)) : 0,
        },
      });
    } catch (error: any) {
      console.error("[TRADER_PORTAL] Error:", error);
      res.status(500).json({ message: "Failed to load trader portal" });
    }
  });

  app.post("/api/trust/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const existingMember = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);
      if (existingMember.length > 0) {
        return res.status(409).json({ message: "Already a trust member", trustId: existingMember[0].trustId });
      }

      let activeTrust = await db.select().from(trusts).where(eq(trusts.status, "OPEN")).limit(1);

      if (activeTrust.length === 0) {
        const seedId = `ALPHA-50`;
        await db.insert(trusts).values({ id: seedId, status: "OPEN", maxMembers: 50 });
        activeTrust = [{ id: seedId, status: "OPEN", maxMembers: 50, parentTrustId: null, createdAt: new Date() }];
        console.log(`[TRUST] Seeded initial trust: ${seedId}`);
      }

      const currentTrust = activeTrust[0];

      const [memberCountResult] = await db.select({ value: count() }).from(trustMembers).where(eq(trustMembers.trustId, currentTrust.id));
      const memberCount = memberCountResult?.value || 0;

      if (memberCount >= (currentTrust.maxMembers || 50)) {
        await db.update(trusts).set({ status: "CLOSED" }).where(eq(trusts.id, currentTrust.id));
        const newTrustId = `TRUST-${Date.now()}`;
        await db.insert(trusts).values({ id: newTrustId, status: "OPEN", maxMembers: 50, parentTrustId: currentTrust.id });
        console.log(`[TRUST] ${currentTrust.id} CLOSED at ${memberCount} members. Spawned ${newTrustId}`);

        const [newMember] = await db.insert(trustMembers).values({
          userId,
          trustId: newTrustId,
          promissoryNoteAmount: 500,
          outstandingBalance: "475.00",
          monthlyCommitment: "19.79",
          monthsRemaining: 24,
          isBeneficiary: true,
          giftedYield: "0.00",
        }).returning();

        return res.json({
          status: "TRUST_JOINED",
          trustId: newTrustId,
          member: newMember,
          note: "Sub-trust spawned — previous trust closed at capacity",
          activation: 25.00,
          promissoryNote: 500,
          outstandingBalance: 475.00,
          monthlyCommitment: 19.79,
          months: 24,
        });
      }

      const [newMember] = await db.insert(trustMembers).values({
        userId,
        trustId: currentTrust.id,
        promissoryNoteAmount: 500,
        outstandingBalance: "475.00",
        monthlyCommitment: "19.79",
        monthsRemaining: 24,
        isBeneficiary: true,
        giftedYield: "0.00",
      }).returning();

      console.log(`[TRUST] User ${userId} joined ${currentTrust.id} — seat ${memberCount + 1}/50`);

      res.json({
        status: "TRUST_JOINED",
        trustId: currentTrust.id,
        seat: memberCount + 1,
        member: newMember,
        activation: 25.00,
        promissoryNote: 500,
        outstandingBalance: 475.00,
        monthlyCommitment: 19.79,
        months: 24,
        message: `SEAT ${memberCount + 1}/50 LOCKED IN ${currentTrust.id}`,
      });
    } catch (error: any) {
      console.error("[TRUST] Join error:", error);
      res.status(500).json({ message: "Failed to join trust" });
    }
  });

  app.get("/api/trust/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const member = await db.select().from(trustMembers).where(eq(trustMembers.userId, userId)).limit(1);

      if (member.length === 0) {
        return res.json({ isMember: false });
      }

      const trust = await db.select().from(trusts).where(eq(trusts.id, member[0].trustId)).limit(1);
      const [seatCount] = await db.select({ value: count() }).from(trustMembers).where(eq(trustMembers.trustId, member[0].trustId));

      res.json({
        isMember: true,
        member: member[0],
        trust: trust[0] || null,
        seats: {
          filled: seatCount?.value || 0,
          max: trust[0]?.maxMembers || 50,
        },
      });
    } catch (error: any) {
      console.error("[TRUST] Status error:", error);
      res.status(500).json({ message: "Failed to get trust status" });
    }
  });

  app.post("/api/trust/settle-yield", isAdmin, async (req: any, res) => {
    try {
      const { assetId, trustId, totalYield } = req.body;

      if (!trustId || !totalYield) {
        return res.status(400).json({ message: "trustId and totalYield required" });
      }

      const yieldAmount = parseFloat(totalYield);
      if (isNaN(yieldAmount) || yieldAmount <= 0) {
        return res.status(400).json({ message: "Invalid totalYield" });
      }

      const trust = await db.select().from(trusts).where(eq(trusts.id, trustId)).limit(1);
      if (trust.length === 0) {
        return res.status(404).json({ message: "Trust not found" });
      }

      const members = await db.select().from(trustMembers).where(eq(trustMembers.trustId, trustId));
      if (members.length === 0) {
        return res.status(400).json({ message: "No beneficiaries in this trust" });
      }

      const ceoSplit = parseFloat((yieldAmount * 0.50).toFixed(4));
      const trustGift = parseFloat((yieldAmount * 0.50).toFixed(4));
      const perMemberShare = parseFloat((trustGift / members.length).toFixed(4));

      console.log(`[YIELD SETTLE] Trust: ${trustId} | Asset: ${assetId || "N/A"} | Total: $${yieldAmount.toFixed(2)}`);
      console.log(`[YIELD SETTLE] CEO Vault: $${ceoSplit.toFixed(2)} | Trust Gift: $${trustGift.toFixed(2)} | Per Member: $${perMemberShare.toFixed(2)} (${members.length} beneficiaries)`);

      for (const member of members) {
        await db.update(trustMembers)
          .set({ giftedYield: sql`CAST(${trustMembers.giftedYield} AS DECIMAL) + ${perMemberShare}` })
          .where(eq(trustMembers.id, member.id));
      }

      console.log(`[YIELD SETTLE] Distribution complete — ${members.length} members credited $${perMemberShare.toFixed(2)} each`);

      res.json({
        status: "YIELD_SETTLED",
        trustId,
        assetId: assetId || null,
        totalYield: yieldAmount,
        ceoVault: ceoSplit,
        trustGift,
        beneficiaries: members.length,
        perMemberShare,
        message: `$${trustGift.toFixed(2)} distributed to ${members.length} beneficiaries ($${perMemberShare.toFixed(2)} each)`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[YIELD SETTLE] Error:", error);
      res.status(500).json({ message: "Failed to settle yield" });
    }
  });

  app.get("/api/admin/trusts", isAdmin, async (req: any, res) => {
    try {
      const allTrusts = await db.select().from(trusts).orderBy(desc(trusts.createdAt));
      const allMembers = await db.select().from(trustMembers);

      const trustData = allTrusts.map(t => ({
        ...t,
        memberCount: allMembers.filter(m => m.trustId === t.id).length,
      }));

      res.json({ trusts: trustData, totalMembers: allMembers.length });
    } catch (error: any) {
      console.error("[TRUST] Admin list error:", error);
      res.status(500).json({ message: "Failed to list trusts" });
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

  // === Global Radio Rotation (self-service management) ===

  app.get("/api/global-rotation", async (_req, res) => {
    try {
      const items = await db.select().from(globalRotation).orderBy(globalRotation.position);
      res.json(items);
    } catch (error) {
      console.error("Error fetching global rotation:", error);
      res.status(500).json({ message: "Failed to fetch global rotation" });
    }
  });

  app.post("/api/admin/global-rotation", isAdmin, async (req: any, res) => {
    try {
      const body = req.body;
      if (!body.ticker || !body.title) {
        return res.status(400).json({ message: "Ticker and Title are required" });
      }
      const maxPos = await db.select({ max: sql<number>`COALESCE(MAX(position), -1)` }).from(globalRotation);
      const nextPos = (maxPos[0]?.max ?? -1) + 1;
      const [item] = await db.insert(globalRotation).values({
        ticker: String(body.ticker).trim(),
        title: String(body.title).trim(),
        type: body.type || "playlist",
        spotifyUri: body.spotifyUri || null,
        spotifyUrl: body.spotifyUrl || null,
        audioUrl: body.audioUrl || null,
        coverImage: body.coverImage || null,
        artistName: body.artistName || null,
        assetClass: body.assetClass || "global",
        matured: body.matured !== false,
        position: nextPos,
      }).returning();
      res.json(item);
    } catch (error) {
      console.error("Error adding global rotation item:", error);
      res.status(500).json({ message: "Failed to add rotation item" });
    }
  });

  app.put("/api/admin/global-rotation/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const body = req.body;
      const updates: any = {};
      if (body.ticker !== undefined) updates.ticker = body.ticker;
      if (body.title !== undefined) updates.title = body.title;
      if (body.type !== undefined) updates.type = body.type;
      if (body.spotifyUri !== undefined) updates.spotifyUri = body.spotifyUri;
      if (body.spotifyUrl !== undefined) updates.spotifyUrl = body.spotifyUrl;
      if (body.audioUrl !== undefined) updates.audioUrl = body.audioUrl;
      if (body.coverImage !== undefined) updates.coverImage = body.coverImage;
      if (body.artistName !== undefined) updates.artistName = body.artistName;
      if (body.assetClass !== undefined) updates.assetClass = body.assetClass;
      if (body.matured !== undefined) updates.matured = body.matured;
      if (body.position !== undefined) updates.position = body.position;
      const [item] = await db.update(globalRotation).set(updates).where(eq(globalRotation.id, id)).returning();
      if (!item) return res.status(404).json({ message: "Rotation item not found" });
      res.json(item);
    } catch (error) {
      console.error("Error updating global rotation item:", error);
      res.status(500).json({ message: "Failed to update rotation item" });
    }
  });

  app.delete("/api/admin/global-rotation/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await db.delete(globalRotation).where(eq(globalRotation.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting global rotation item:", error);
      res.status(500).json({ message: "Failed to delete rotation item" });
    }
  });

  app.post("/api/admin/global-rotation/reorder", isAdmin, async (req: any, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds required" });
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(globalRotation).set({ position: i }).where(eq(globalRotation.id, orderedIds[i]));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering global rotation:", error);
      res.status(500).json({ message: "Failed to reorder rotation" });
    }
  });

  app.post("/api/admin/native-tracks/reorder", isAdmin, async (req: any, res) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds required" });
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(tracks).set({ sortPosition: i }).where(eq(tracks.id, orderedIds[i]));
      }
      res.json({ success: true, message: `Reordered ${orderedIds.length} tracks` });
    } catch (error) {
      console.error("Error reordering native tracks:", error);
      res.status(500).json({ message: "Failed to reorder native tracks" });
    }
  });

  // === Spotify Playback (Spotify is now the primary auth — tokens stored at login) ===

  app.get("/api/spotify/token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [token] = await db.select().from(spotifyTokens).where(eq(spotifyTokens.userId, userId));
      if (!token) return res.status(401).json({ message: "Spotify not connected" });
      const spotify = await getSpotifyClientForUser(userId);
      const freshToken = await spotify.getAccessToken();
      res.json({ accessToken: freshToken?.access_token || token.accessToken });
    } catch (error: any) {
      res.status(401).json({ message: "Spotify not connected or token expired" });
    }
  });

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

      if (action === "play" && trackName) {
        logRadioEvent({
          timestamp: new Date().toISOString(),
          userId,
          trackName: trackName || "UNKNOWN",
          isrc: spotifyUri || "N/A",
          showName: `JAM SESSION: ${session[0].name}`,
          status: "SPOTIFY_STREAM",
          duration: metadata?.duration || undefined,
          poolCapacity: undefined,
        }).catch(() => {});
      }

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

  app.get("/api/credit-steps", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const steps = await db.select().from(creditSteps).where(eq(creditSteps.userId, userId));
      res.json(steps);
    } catch (error) {
      console.error("Error fetching credit steps:", error);
      res.status(500).json({ message: "Failed to fetch credit steps" });
    }
  });

  app.post("/api/credit-steps/update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { stepNumber, status } = req.body;
      if (!stepNumber || !status) {
        return res.status(400).json({ message: "stepNumber and status required" });
      }
      const existing = await db.select().from(creditSteps)
        .where(and(eq(creditSteps.userId, userId), eq(creditSteps.stepNumber, stepNumber)));
      if (existing.length > 0) {
        await db.update(creditSteps)
          .set({
            status,
            completedAt: status === "completed" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(and(eq(creditSteps.userId, userId), eq(creditSteps.stepNumber, stepNumber)));
      } else {
        await db.insert(creditSteps).values({
          userId,
          stepNumber,
          status,
          completedAt: status === "completed" ? new Date() : null,
        });
      }
      const steps = await db.select().from(creditSteps).where(eq(creditSteps.userId, userId));
      res.json(steps);
    } catch (error) {
      console.error("Error updating credit step:", error);
      res.status(500).json({ message: "Failed to update credit step" });
    }
  });

  app.get("/api/kinetic/state", async (_req, res) => {
    try {
      const state = getKineticState();
      const fundBalance = await getSettlementFundBalance();
      const grossIntake = await getGrossIntake();
      res.json({
        ...state,
        floorPct: Math.round(state.floorROI * 100),
        ceoPct: Math.round(state.houseMBBP * 100),
        splitLabel: `${Math.round(state.floorROI * 100)}/${Math.round(state.houseMBBP * 100)}`,
        validEntries: VALID_ENTRIES,
        settlementFund: fundBalance,
        grossIntake,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Kinetic state error:", error);
      res.status(500).json({ message: "Failed to get kinetic state" });
    }
  });

  app.post("/api/kinetic/bias", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { bias } = req.body;
      if (bias !== "NATURAL" && bias !== "FLOOR_HEAVY") {
        return res.status(400).json({ message: "Invalid bias. Use NATURAL or FLOOR_HEAVY" });
      }
      setKineticBias(bias);
      const state = getKineticState();
      res.json({ message: `Bias set to ${bias}`, state });
    } catch (error) {
      console.error("Kinetic bias error:", error);
      res.status(500).json({ message: "Failed to set kinetic bias" });
    }
  });

  app.post("/api/trade/execute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId, amount, type, lockedROI } = req.body;

      if (!trackId || amount === undefined) {
        return res.status(400).json({ message: "trackId and amount required" });
      }

      const parsedAmount = typeof amount === "number" ? amount : parseFloat(amount);
      if (!VALID_ENTRIES.includes(parsedAmount)) {
        return res.status(400).json({ message: `Invalid entry. Valid amounts: ${VALID_ENTRIES.join(", ")}` });
      }

      const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      if (!track) return res.status(404).json({ message: "Track not found" });

      const pulse = getKineticState();
      const finalROI = type === "HOLD_LOCK" && typeof lockedROI === "number" ? lockedROI : pulse.floorROI;
      const payout = parseFloat((parsedAmount + (parsedAmount * finalROI)).toFixed(2));

      const ticker = (track.title || "ASSET").replace(/\s+/g, "").toUpperCase().slice(0, 8);
      const currentSales = track.salesCount || 0;
      const seq = String(currentSales + 1).padStart(3, "0");
      const trackingNum = `KNT-977-${ticker}-${seq}`;

      const floorTake = parseFloat((parsedAmount * pulse.floorROI).toFixed(4));
      const ceoTake = parseFloat((parsedAmount * pulse.houseMBBP).toFixed(4));

      console.log(`[KINETIC TRADE] ${type || "IMPULSE"} | Asset: ${ticker} | Entry: $${parsedAmount} | ROI: ${(finalROI * 100).toFixed(0)}% | Split: ${Math.round(pulse.floorROI*100)}/${Math.round(pulse.houseMBBP*100)} | Payout: $${payout} | Pulse: ${pulse.pulse} | Bias: ${pulse.bias}`);

      const [order] = await db.insert(orders).values({
        trackId,
        trackingNumber: trackingNum,
        unitPrice: parsedAmount.toString(),
        creatorCredit: pulse.houseMBBP.toFixed(2),
        creatorCreditAmount: ceoTake.toString(),
        positionHolderAmount: floorTake.toString(),
        status: "pending_cashapp",
      }).returning();

      await db.update(tracks)
        .set({ salesCount: sql`${tracks.salesCount} + 1` })
        .where(eq(tracks.id, trackId));

      await enqueueTrader(order.id, userId, trackId, parsedAmount);
      const settlementTriggered = await checkAndTriggerSettlement();
      const cashAppUrl = `https://cash.app/$AITITRADEBROKERAGE/${parsedAmount.toFixed(2)}?note=AITITRADE%20${encodeURIComponent(trackingNum)}`;

      res.json({
        status: "POSITION_LOCKED",
        type: type || "IMPULSE",
        trackingNumber: trackingNum,
        entry: parsedAmount,
        roi: finalROI,
        projectedPayout: payout,
        pulse: pulse.pulse,
        bias: pulse.bias,
        floorROI: pulse.floorROI,
        houseMBBP: pulse.houseMBBP,
        url: cashAppUrl,
        cashtag: "$AITITRADEBROKERAGE",
        instruction: `SEND $${parsedAmount.toFixed(2)} TO $AITITRADEBROKERAGE VIA CASH APP`,
        note: `AITITRADE ${trackingNum}`,
        floorRetained: floorTake,
        ceoGross: ceoTake,
        settlementTriggered,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Kinetic trade error:", error);
      res.status(500).json({ message: "Failed to execute trade" });
    }
  });

  app.post("/api/trade/settle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { tbiAmount, type, lockedROI } = req.body;

      if (!tbiAmount) {
        return res.status(400).json({ message: "tbiAmount required" });
      }

      const parsedTbi = typeof tbiAmount === "number" ? tbiAmount : parseFloat(tbiAmount);
      if (!VALID_ENTRIES.includes(parsedTbi)) {
        return res.status(400).json({ message: `Invalid TBI. Valid entries: ${VALID_ENTRIES.join(", ")}` });
      }

      const pulse = getKineticState();
      const finalROI = (type === "HOLD_LOCK" && typeof lockedROI === "number") ? lockedROI : pulse.floorROI;
      const payoutAmount = parseFloat((parsedTbi + (parsedTbi * finalROI)).toFixed(2));

      console.log(`[KINETIC SETTLE] User: ${userId} | TBI: $${parsedTbi} | ROI: ${(finalROI * 100).toFixed(0)}% | Payout: $${payoutAmount} | Pulse: ${pulse.pulse} | Type: ${type || "IMPULSE"}`);

      const queueEntries = await db.select().from(settlementQueue)
        .where(and(
          eq(settlementQueue.userId, userId),
          eq(settlementQueue.status, "QUEUED"),
          eq(settlementQueue.buyIn, parsedTbi.toString()),
        ))
        .orderBy(asc(settlementQueue.createdAt))
        .limit(1);

      if (queueEntries.length > 0) {
        const entry = queueEntries[0];
        await db.update(settlementQueue)
          .set({
            status: "SETTLED",
            payoutAmount: payoutAmount.toString(),
            acceptedMultiplier: (1 + finalROI).toString(),
            settledAt: new Date(),
          })
          .where(eq(settlementQueue.id, entry.id));

        console.log(`[KINETIC SETTLE] Queue entry ${entry.id} settled for $${payoutAmount}`);
      }

      res.json({
        success: true,
        status: "SETTLED_SUCCESS",
        tbiAmount: parsedTbi,
        roiApplied: finalROI,
        payout: payoutAmount,
        pulse: pulse.pulse,
        bias: pulse.bias,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Kinetic settle error:", error);
      res.status(500).json({ message: "Failed to settle trade" });
    }
  });

  app.post("/api/admin/purge-test-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const testOrders = await db.select({ id: orders.id, status: orders.status })
        .from(orders)
        .where(eq(orders.status, "test"));
      const testCount = testOrders.length;

      if (testCount > 0) {
        const testIds = testOrders.map(o => o.id);
        await db.delete(settlementQueue).where(inArray(settlementQueue.orderId, testIds));
        await db.delete(orders).where(eq(orders.status, "test"));
      }

      const [liveVolume] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(orders);

      console.log(`[PURGE] Removed ${testCount} test entries. Live volume: $${liveVolume?.total || "0"} across ${liveVolume?.count || 0} orders`);

      res.json({
        purged: testCount,
        liveVolume: parseFloat(liveVolume?.total || "0"),
        liveOrderCount: liveVolume?.count || 0,
        message: `Purged ${testCount} test entries. Pool refreshed.`,
      });
    } catch (error: any) {
      console.error("Purge test data error:", error);
      res.status(500).json({ message: "Failed to purge test data" });
    }
  });

  return httpServer;
}
