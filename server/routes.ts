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
import { openai, textToSpeech, performVocal } from "./replit_integrations/audio/client";
import { sunoGenerate, sunoCheckStatus, sunoGenerateAndWait, downloadSunoAudio, isSunoConfigured } from "./suno-client";
import { generateArtwork } from "./image-gen";
import { sonicGenerate, sonicCheckStatus, sonicGenerateAndWait, downloadSonicAudio, isSonicConfigured } from "./sonic-client";
import { insertArtistSchema, insertTrackSchema, insertPlaylistSchema, insertVideoSchema, artists, tracks, orders, likedTracks, jamSessions, jamSessionEngagement, jamSessionListeners, insertJamSessionSchema, streamQualifiers, spotifyRoyaltyTracks, creditSteps, memberships, spotifyTokens, globalRotation, insertGlobalRotationSchema, globalStreamLogs, playbackSchedules, trusts, trustMembers, treasuryLogs, portalSettings, settlementQueue, settlementCycles, stakingPortals, users, masteringRequests, globalInvestorPortals, globalInvestorEntries, payToPlay, marketListings, marketHoldings, marketTransactions, p2pTrades, cryptoPayments } from "@shared/schema";
import { eq, and, or, desc, asc, sql, count, inArray, isNull, isNotNull } from "drizzle-orm";
import { getSpotifyClientForUser, getSpotifyProfile } from "./spotify";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault, verifyPaypalOrder, createTipOrder, captureTipOrder, createGoldSubscription, getSubscriptionDetails, cancelSubscription } from "./paypal";
import { objectStorageClient } from "./replit_integrations/object_storage";
import { getMarketState, getBreathingState, computeLiquiditySplit, computeGlobalRoyaltySplit, generateRecycleValues, invalidateCache, POOL_CEILING, FLOOR_SPLIT, CEO_SPLIT, initTrackPricing, getPortalForPrice, calculateTradeStatus, calculateEarlyExit, checkTreasuryMilestones, loadPortalsFromDb, getPortalConfigs, invalidatePortalCache, PORTALS, enqueueTrader, getSettlementFundBalance, getTraderPositions, traderAcceptOffer, traderDiscountSell, finalizeBlock, getTrustVaultBalance, enrollBanker, getBankerEarnings, withdrawBankerDeposit, enrollStake, getStakePositions, withdrawStakePosition, depositToVaultExternal, getSettlementDashboard, checkAndTriggerSettlement, runSettlementCycle, SETTLEMENT_CYCLE_THRESHOLD, seed81Portals, getPortalTiers, getGrossIntake, getTotalPaidOut, VALID_ENTRIES, getKineticState, setKineticBias, getKineticBias, freezeKineticSplit, unfreezeKineticSplit, isKineticFrozen, liveEngine, getEngineIO, enterSafe, addPosition, getPortfolioValue, getPortfolio, getWallet, recordWalletDeposit, recordWalletEntry, recordWalletPayout, recordWalletWithdrawal, getWalletSummary, computeGlobalIndex, buildMonitor, getEventLog, emergencyReset, logEvent, getSprintLeaderboard, getUserRealizedProfit, checkAllTenKWinners, maybeDistributeBlockTenBonus, getRecentTenKWinners, resetEngineToGenesis } from "./market-governor";
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

  (async () => {
    try {
      const allTracks = await db.select().from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id));
      const existing = await db.select({ trackId: marketListings.trackId }).from(marketListings);
      const existingIds = new Set(existing.map(e => e.trackId).filter(Boolean));
      let added = 0;
      for (const row of allTracks) {
        if (existingIds.has(row.tracks.id)) continue;
        const price = parseFloat(row.tracks.unitPrice || "2.00");
        const poolSize = price >= 4 ? 15 : price >= 2 ? 20 : 25;
        await db.insert(marketListings).values({
          trackId: row.tracks.id,
          title: row.tracks.title,
          artistName: row.artists.name || "AITITRADE",
          coverImage: row.tracks.coverImage || null,
          genre: row.tracks.genre || null,
          basePrice: price.toFixed(2),
          currentPrice: price.toFixed(2),
          highPrice: price.toFixed(2),
          lowPrice: price.toFixed(2),
          volume: 0,
          totalSold: 0,
          maxSupply: poolSize,
          active: true,
        });
        added++;
      }
      if (added > 0) console.log(`[MARKET] Auto-synced ${added} tracks to Music Market listings`);
    } catch (err) {
      console.error("[MARKET] Auto-sync listings failed:", err);
    }
  })();

  console.log(`[STARTUP] Data persistence ON — orders, stakes, and sales preserved across restarts`);

  db.update(masteringRequests)
    .set({ status: "pending", adminNotes: "Auto-reset: server restarted while processing" })
    .where(eq(masteringRequests.status, "in_progress"))
    .then((result) => {
      console.log("[STARTUP] Reset stuck mastering requests (in_progress → pending)");
    })
    .catch((err) => console.error("[STARTUP] Mastering reset error:", err));

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
        ".svg": "image/svg+xml",
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

      if (action === "STREAM_HEARTBEAT" && trackName) {
        try {
          const matchingPortals = await db.select().from(globalInvestorPortals)
            .where(sql`UPPER(${globalInvestorPortals.songTitle}) = UPPER(${trackName})`);
          for (const portal of matchingPortals) {
            await db.update(globalInvestorPortals)
              .set({ totalStreams: sql`COALESCE(${globalInvestorPortals.totalStreams}, 0) + 1` })
              .where(eq(globalInvestorPortals.id, portal.id));
          }
        } catch (e) {
          console.error("[GlobalStream] Investor portal stream increment error:", e);
        }
      }

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
      const userIds = Array.from(new Set(logs.map((l: any) => l.userId).filter(Boolean)));
      const userRows = userIds.length > 0
        ? await db.select().from(users).where(inArray(users.id, userIds as string[]))
        : [];
      const tagById: Record<string, string> = {};
      userRows.forEach((u: any) => { if (u.cashTag) tagById[u.id] = u.cashTag; });
      const enriched = logs.map((l: any) => ({ ...l, cashTag: l.userId ? tagById[l.userId] || null : null }));
      res.json(enriched);
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
              storeUrl: "cashapp",
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
      const requestingUserId = req.user?.claims?.sub;

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return res.status(404).json({ message: "Trade not found" });

      const [requestingUser] = await db.select().from(users).where(eq(users.id, requestingUserId));
      if (!requestingUser?.isAdmin && order.buyerEmail !== requestingUser?.email) {
        return res.status(403).json({ message: "You can only exit your own positions" });
      }

      if (order.status === "settled_early" || order.status === "settled") {
        return res.status(409).json({ message: "Trade already settled" });
      }

      if (order.status === "pending_cashapp") {
        return res.status(400).json({ message: "Payment not confirmed yet — cannot exit unconfirmed position" });
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
        message: "Discount accepted — queued first for settlement.",
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

      const grossIntake = await getGrossIntake();
      const totalVolume = grossIntake;
      const totalPaidOut = await getTotalPaidOut();

      const dashPulse = getKineticState();
      const traderSettlementPool = totalVolume * dashPulse.floorROI;
      const houseRetention = totalVolume * dashPulse.houseMBBP;

      const distanceToClose = 1000 - (totalVolume % 1000);
      const cyclesCompleted = Math.floor(totalVolume / 1000);

      const [orderStats] = await db.select({
        settledCount: sql<number>`COUNT(CASE WHEN status = 'settled_early' THEN 1 END)`,
        activeCount: sql<number>`COUNT(CASE WHEN status = 'confirmed' THEN 1 END)`,
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
        activeCount: orderStats?.activeCount || 0,
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

      const [floorVolumeResult] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
      }).from(orders).where(
        and(
          isNotNull(orders.buyerEmail),
          sql`${orders.buyerEmail} != ''`,
          inArray(orders.status, ["confirmed", "settled", "settled_early"])
        )
      );
      const activeFloorVolume = parseFloat(floorVolumeResult?.total || "0");

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
      const grossFromOrders = await getGrossIntake();
      const allTracks = await db.select({
        id: tracks.id,
        title: tracks.title,
        salesCount: tracks.salesCount,
        unitPrice: tracks.unitPrice,
      }).from(tracks);
      const perTrackOrders = await db.select({
        trackId: orders.trackId,
        cnt: sql<number>`COUNT(*)`,
        gross: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)`,
      }).from(orders).where(
        and(
          isNotNull(orders.buyerEmail),
          sql`${orders.buyerEmail} != ''`,
          inArray(orders.status, ["confirmed", "settled", "settled_early"])
        )
      ).groupBy(orders.trackId);
      const trackOrderMap = new Map(perTrackOrders.map(r => [r.trackId, { cnt: r.cnt, gross: parseFloat(r.gross || "0") }]));
      res.json({
        totalMints: result?.total || 0,
        mintCap: 1000,
        totalGross: parseFloat(grossFromOrders.toFixed(2)),
        assets: allTracks.map(t => {
          const orderData = trackOrderMap.get(t.id);
          return {
            id: t.id,
            title: t.title,
            mints: orderData?.cnt || 0,
            gross: parseFloat((orderData?.gross || 0).toFixed(2)),
          };
        }),
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
      .where(and(isNotNull(orders.buyerEmail), sql`${orders.buyerEmail} != ''`))
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

  // ════════════════════════════════════════════════════════════════════
  // GENESIS PURGE — Admin-only nuclear reset (preserves catalog/users/portals)
  // ════════════════════════════════════════════════════════════════════
  app.post("/api/admin/genesis-purge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin access required" });
      const { confirm } = req.body || {};
      if (confirm !== "GENESIS") {
        return res.status(400).json({ message: "Confirmation required: send { confirm: 'GENESIS' }" });
      }

      const purgeSql = `
        BEGIN;
        TRUNCATE TABLE orders RESTART IDENTITY CASCADE;
        TRUNCATE TABLE p2p_trades RESTART IDENTITY CASCADE;
        TRUNCATE TABLE settlement_queue RESTART IDENTITY CASCADE;
        TRUNCATE TABLE settlement_cycles RESTART IDENTITY CASCADE;
        TRUNCATE TABLE asset_blocks RESTART IDENTITY CASCADE;
        TRUNCATE TABLE global_investor_entries RESTART IDENTITY CASCADE;
        TRUNCATE TABLE trust_vault_ledger RESTART IDENTITY CASCADE;
        DELETE FROM trust_vault;
        INSERT INTO trust_vault (balance, updated_at) VALUES ('0.00', NOW());
        TRUNCATE TABLE treasury_logs RESTART IDENTITY CASCADE;
        TRUNCATE TABLE global_stream_logs RESTART IDENTITY CASCADE;
        TRUNCATE TABLE ten_k_winners RESTART IDENTITY CASCADE;
        TRUNCATE TABLE ten_k_bonus_distributions RESTART IDENTITY CASCADE;
        TRUNCATE TABLE banker_queue RESTART IDENTITY CASCADE;
        TRUNCATE TABLE banker_ledger RESTART IDENTITY CASCADE;
        TRUNCATE TABLE banker_deposits RESTART IDENTITY CASCADE;
        TRUNCATE TABLE stake_positions RESTART IDENTITY CASCADE;
        TRUNCATE TABLE crypto_payments RESTART IDENTITY CASCADE;
        COMMIT;
      `;
      await db.execute(sql.raw(purgeSql));

      // Deep purge: in-memory engine state, wallets, eventLog, persisted snapshots
      const engineWipe = resetEngineToGenesis();

      console.log(`[GENESIS-PURGE] 🔥 Executed by admin ${user.email || userId} at ${new Date().toISOString()} — engine wiped: ${engineWipe.wiped.join(", ")}`);
      logEvent({ type: "GENESIS_PURGE", admin: user.email || userId, at: new Date().toISOString() });

      res.json({
        ok: true,
        message: "GENESIS PURGE COMPLETE — Market reset to Absolute Zero",
        wiped: [
          "orders", "p2p_trades", "settlement_queue", "settlement_cycles", "asset_blocks",
          "global_investor_entries", "trust_vault_ledger", "treasury_logs", "global_stream_logs",
          "ten_k_winners", "ten_k_bonus_distributions", "banker_queue", "banker_ledger",
          "banker_deposits", "stake_positions", "crypto_payments",
        ],
        preserved: ["tracks", "artists", "albums", "users", "memberships", "global_investor_portals", "portal_settings", "wallets"],
        vaultBalance: "0.00",
        timestamp: new Date().toISOString(),
      });
    } catch (e: any) {
      console.error("Genesis purge failed:", e);
      res.status(500).json({ message: "Purge failed", error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // 10K SPRINT — First-to-$10,000 realized profit competition
  // ════════════════════════════════════════════════════════════════════
  app.get("/api/leaderboard/sprint", async (_req, res) => {
    try {
      await checkAllTenKWinners();
      const bonus = await maybeDistributeBlockTenBonus();
      const rows = await getSprintLeaderboard(50);
      const winners = await getRecentTenKWinners(5);
      res.json({
        target: 10000,
        rows,
        winners,
        latestBonus: bonus.distributed ? bonus : null,
      });
    } catch (e: any) {
      console.error("Sprint leaderboard error:", e);
      res.status(500).json({ message: "Failed to load sprint leaderboard" });
    }
  });

  app.get("/api/leaderboard/sprint/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "auth required" });
      const r = await getUserRealizedProfit(userId);
      res.json({
        userId,
        target: 10000,
        realizedProfit: parseFloat(r.profit.toFixed(2)),
        streamRoyalties: parseFloat(r.streamRoyalties.toFixed(2)),
        totalGains: parseFloat(r.totalGains.toFixed(2)),
        percentToGoal: Math.min(100, parseFloat(((Math.max(r.totalGains, 0) / 10000) * 100).toFixed(2))),
        capped: r.capped,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to load your sprint progress" });
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
              storeUrl: "cashapp",
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

      const tradeUser = await storage.getUser(userId);
      const tradeBuyerEmail = tradeUser?.email || "";
      const tradeBuyerName = (tradeUser?.firstName ? `${tradeUser.firstName}${tradeUser.lastName ? ' ' + tradeUser.lastName : ''}` : tradeUser?.email?.split("@")[0] || "TRADER").toUpperCase();
      const tradeBuyerCashTag = tradeUser?.cashTag || "";

      const [order] = await db.insert(orders).values({
        trackId,
        trackingNumber: trackingNum,
        buyerEmail: tradeBuyerEmail,
        buyerName: tradeBuyerName,
        buyerCashTag: tradeBuyerCashTag,
        unitPrice: parsedAmount.toString(),
        creatorCredit: ceoPct.toFixed(2),
        creatorCreditAmount: ceoTake.toString(),
        positionHolderAmount: floorTake.toString(),
        status: "pending_cashapp",
      }).returning();

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
        indicator: "AWAITING_PAYMENT",
        status: "PENDING_PAYMENT",
        message: "PAYMENT TO $AITITRADEBROKERAGE LOCKS YOUR POSITION — POSITION HELD UNTIL CONFIRMED",
        grossSales: parseFloat(((currentSales) * price).toFixed(2)),
        totalMints: currentSales,
        mintCap: GLOBAL_CEILING,
        capacityPct: Math.min(100, parseFloat(((currentSales * price / GLOBAL_CEILING) * 100).toFixed(1))),
        aiModel: track.aiModel || "AITIFY-GEN-1",
        releaseType: isGlobal ? "global" : "native",
        settlementFund: fundBalance,
        settlementTriggered: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Cash App trade error:", error);
      res.status(500).json({ message: "Failed to process trade" });
    }
  });

  app.post("/api/exchange/buy-song", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId } = req.body;
      if (!trackId) return res.status(400).json({ message: "trackId required" });

      const [track] = await db.select().from(tracks).where(eq(tracks.id, trackId));
      if (!track) return res.status(404).json({ message: "Track not found" });

      const SONG_PRICE = 2.50;
      const ticker = (track.title || "SONG").replace(/\s+/g, "").toUpperCase().slice(0, 8);
      const seq = String((track.salesCount || 0) + 1).padStart(3, "0");
      const trackingNum = `SONG-977-${ticker}-${seq}`;
      const cashAppUrl = `https://cash.app/$AITITRADEBROKERAGE/${SONG_PRICE.toFixed(2)}?note=BUY%20SONG%20${encodeURIComponent(trackingNum)}`;

      const buyer = await storage.getUser(userId);
      const buyerEmail = buyer?.email || "";
      const buyerName = (buyer?.firstName ? `${buyer.firstName}${buyer.lastName ? ' ' + buyer.lastName : ''}` : buyer?.email?.split("@")[0] || "BUYER").toUpperCase();
      const buyerCashTag = buyer?.cashTag || "";

      const [artist] = await db.select().from(artists).where(eq(artists.id, track.artistId));

      const [order] = await db.insert(orders).values({
        trackId,
        trackingNumber: trackingNum,
        buyerEmail,
        buyerName,
        buyerCashTag,
        unitPrice: SONG_PRICE.toString(),
        creatorCredit: "1.00",
        creatorCreditAmount: SONG_PRICE.toString(),
        positionHolderAmount: "0",
        status: "pending_cashapp",
        portalName: "SONG_PURCHASE",
      }).returning();

      console.log(`[BUY SONG] ${buyerName} | ${track.title} | $${SONG_PRICE} | ${trackingNum}`);

      res.json({
        instruction: `SEND $${SONG_PRICE.toFixed(2)} TO $AITITRADEBROKERAGE VIA CASH APP`,
        url: cashAppUrl,
        cashtag: "$AITITRADEBROKERAGE",
        note: `BUY SONG ${trackingNum}`,
        trackingNumber: trackingNum,
        ticker: `$${ticker}`,
        asset: track.title,
        artistName: artist?.name || "Unknown",
        price: SONG_PRICE,
        status: "PENDING_PAYMENT",
        message: "SEND PAYMENT TO COMPLETE YOUR SONG PURCHASE",
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Buy song error:", error);
      res.status(500).json({ message: "Failed to process song purchase" });
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
          "highpass=f=28",
          "lowpass=f=19000",
          "equalizer=f=60:t=q:w=1.2:g=3",
          "equalizer=f=100:t=q:w=1.5:g=2.5",
          "equalizer=f=200:t=q:w=1.8:g=1",
          "equalizer=f=400:t=q:w=1.5:g=-0.5",
          "equalizer=f=800:t=q:w=2:g=-1",
          "equalizer=f=2500:t=q:w=2:g=1.5",
          "equalizer=f=5000:t=q:w=1.5:g=1",
          "equalizer=f=8000:t=q:w=2:g=0.5",
          "equalizer=f=12000:t=q:w=1.5:g=1",
          "equalizer=f=16000:t=q:w=2:g=0.5",
          "acompressor=threshold=-18dB:ratio=2:attack=15:release=150:makeup=2dB:knee=6dB",
          "acompressor=threshold=-10dB:ratio=3:attack=5:release=50:makeup=1dB",
          "alimiter=limit=0.95:level=false:attack=3:release=50",
          "loudnorm=I=-11:TP=-1:LRA=8:print_format=json",
        ].join(","),
        "-ar", "48000",
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

      const masteredUrl = `/uploads/mastered/${outputFilename}`;
      try {
        const objectName = `mastered/${outputFilename}`;
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        const cloudFile = bucket.file(objectName);
        await cloudFile.save(fs.readFileSync(outputPath), { metadata: { contentType: "audio/wav" } });
        console.log(`[MASTERING] Also backed up to cloud: ${objectName}`);
      } catch {
        console.log(`[MASTERING] Cloud backup skipped — local file ready`);
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
      res.set("Content-Type", "audio/wav");
      return res.sendFile(filePath);
    }
    try {
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const paths = [`mastered/${req.params.filename}`, `uploads/${req.params.filename}`, `uploads/mastered/${req.params.filename}`];
      for (const objectName of paths) {
        const file = bucket.file(objectName);
        const [exists] = await file.exists();
        if (exists) {
          res.set("Content-Disposition", `attachment; filename="${req.params.filename}"`);
          res.set("Content-Type", "audio/wav");
          const stream = file.createReadStream();
          return stream.pipe(res);
        }
      }
      return res.status(404).json({ message: "Mastered file not found" });
    } catch {
      return res.status(404).json({ message: "Mastered file not found" });
    }
  });

  app.get("/api/download/cloud", isAuthenticated, async (req: any, res) => {
    try {
      const objectName = req.query.path ? decodeURIComponent(req.query.path as string) : "";
      if (!objectName) return res.status(400).json({ message: "No object path specified (?path=...)" });
      console.log(`[DOWNLOAD] Cloud request for: ${objectName}`);
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).json({ message: "File not found in cloud storage" });
      }
      const filename = path.basename(objectName);
      const isStream = req.query.stream === "true";
      if (isStream) {
        res.set("Content-Type", "audio/wav");
      } else {
        res.set("Content-Disposition", `attachment; filename="${filename}"`);
        res.set("Content-Type", "audio/wav");
      }
      const stream = file.createReadStream();
      stream.pipe(res);
    } catch (error: any) {
      console.error("[DOWNLOAD] Cloud download error:", error.message);
      return res.status(500).json({ message: "Download failed" });
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

  app.get("/api/admin/recent-traders", isAdmin, async (req: any, res) => {
    try {
      const recentOrders = await db.select({
        id: orders.id,
        buyerEmail: orders.buyerEmail,
        buyerName: orders.buyerName,
        unitPrice: orders.unitPrice,
        portalName: orders.portalName,
        status: orders.status,
        trackId: orders.trackId,
        createdAt: orders.createdAt,
      }).from(orders)
        .where(and(isNotNull(orders.buyerEmail), sql`${orders.buyerEmail} != ''`))
        .orderBy(desc(orders.createdAt))
        .limit(20);

      const enriched = await Promise.all(recentOrders.map(async (o) => {
        const [track] = await db.select({ title: tracks.title }).from(tracks).where(eq(tracks.id, o.trackId)).limit(1);
        const [traderUser] = await db.select({ profileImageUrl: users.profileImageUrl, firstName: users.firstName })
          .from(users).where(eq(users.email, o.buyerEmail || "")).limit(1);
        return {
          ...o,
          trackTitle: track?.title || "UNKNOWN",
          profileImage: traderUser?.profileImageUrl || null,
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("[ADMIN] Recent traders error:", error);
      res.status(500).json({ message: "Failed to fetch recent traders" });
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

      let audioUrl: string;
      let sunoId: string;
      let engineUsed: string;

      if (isSunoConfigured()) {
        const songs = await sunoGenerateAndWait({
          prompt: prompt.slice(0, 5000),
          style: (style || "R&B, Smooth, Melodic").slice(0, 1000),
          title: (prompt.split("\n")[0] || "Admin Beat").slice(0, 80),
          instrumental: !!makeInstrumental,
        });
        if (!songs.length) throw new Error("Suno returned no songs");
        const localId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        audioUrl = await downloadSunoAudio(songs[0].audioUrl, localId);
        sunoId = songs[0].id;
        engineUsed = "suno-v4.5";
      } else {
        const voice = makeInstrumental ? "alloy" : "onyx";
        const audioBuffer = await performVocal(prompt.slice(0, 4096), style || "R&B, Smooth, Melodic", voice, "mp3");
        sunoId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const audioFilePath = path.join(process.cwd(), "uploads", `${sunoId}.mp3`);
        fs.writeFileSync(audioFilePath, audioBuffer);
        audioUrl = `/uploads/${sunoId}.mp3`;
        engineUsed = "ai-vocal-fallback";
      }

      const wholesaleCost = 0.35;
      const floor54 = parseFloat((wholesaleCost * 0.54).toFixed(4));
      const ceoGross46 = parseFloat((wholesaleCost * 0.46).toFixed(4));

      console.log(`[AUDIO_GEN] Generated: ${sunoId} | Engine: ${engineUsed} | Wholesale: $${wholesaleCost}`);

      res.json({
        status: "MINTING_PENDING",
        suno_id: sunoId,
        audioUrl,
        asset_class: "AI_GENERATED_AUDIO",
        wholesale_cost: wholesaleCost,
        trade_status: "MINTING_PENDING",
        split: {
          floor: floor54,
          ceoGross: ceoGross46,
        },
        prompt,
        style: style || "pop",
        engine: engineUsed,
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

      const artResult = await generateArtwork({
        prompt,
        negativePrompt: "blur, low quality, watermark, text overlay",
        style: "AUTO",
      });

      console.log(`[ART_GEN] Generated via ${artResult.engine}: ${artResult.localPath}`);

      res.json({
        status: "ART_READY",
        imageUrl: artResult.localPath,
        asset_class: "AI_GENERATED_ARTWORK",
        wholesale_cost: 0.03,
        prompt,
        model: artResult.engine,
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

      if (isSunoConfigured()) {
        try {
          const songs = await sunoGenerateAndWait({
            prompt: audioPrompt.slice(0, 5000),
            style: (style || "R&B, Smooth, Melodic").slice(0, 1000),
            title: (title || "AITIFY Beat").slice(0, 80),
            instrumental: !!makeInstrumental,
          });
          if (songs.length > 0) {
            const localId = `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const localUrl = await downloadSunoAudio(songs[0].audioUrl, localId);
            audioAsset = { suno_id: songs[0].id, audioUrl: localUrl, status: "MINTING_PENDING" };
            console.log(`[DIRECT_PUSH] Suno audio: ${localUrl}`);
          }
        } catch (e: any) {
          console.error(`[DIRECT_PUSH] Suno audio failed: ${e.message}`);
        }
      } else {
        try {
          const voice = makeInstrumental ? "alloy" : "onyx";
          const audioBuffer = await performVocal(audioPrompt.slice(0, 4096), style || "R&B, Smooth, Melodic", voice, "mp3");
          const audioId = `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const audioFilePath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
          fs.writeFileSync(audioFilePath, audioBuffer);
          audioAsset = { suno_id: audioId, audioUrl: `/uploads/${audioId}.mp3`, status: "MINTING_PENDING" };
          console.log(`[DIRECT_PUSH] AI vocal fallback: ${audioId}`);
        } catch (e: any) {
          console.error(`[DIRECT_PUSH] Audio failed: ${e.message}`);
        }
      }

      try {
        const artResult = await generateArtwork({
          prompt: artPrompt,
          negativePrompt: "blur, low quality, watermark, text overlay",
          style: "AUTO",
        });
        visualAsset = { imageUrl: artResult.localPath, status: "ART_READY" };
        console.log(`[DIRECT_PUSH] Artwork generated via ${artResult.engine}: ${artResult.localPath}`);
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

      const {
        prompt, style, voiceType, makeInstrumental, title, description,
        autoLyrics, negativeTags, styleWeight, weirdnessConstraint,
        taskType, continueClipId, audioWeight,
      } = req.body;
      if (!prompt && !description) return res.status(400).json({ message: "Prompt or description required" });

      if (isSonicConfigured()) {
        const isAutoMode = !!description && !prompt;
        const mode = taskType === "cover_music" ? "cover" : isAutoMode ? "auto" : autoLyrics ? "custom+autoLyrics" : "custom";
        console.log(`[BEAT-GEN] Sonic (MusicAPI.ai): mode=${mode}, tags=${style}, instrumental=${makeInstrumental}`);

        const vocalGender: "m" | "f" | undefined = voiceType?.includes("female") ? "f" : voiceType?.includes("male") ? "m" : undefined;

        const taskId = await sonicGenerate({
          prompt: prompt ? prompt.slice(0, 5000) : undefined,
          tags: (style || "R&B, Smooth, Melodic").slice(0, 1000),
          negativeTags: negativeTags || undefined,
          title: (title || "AITIFY Beat").slice(0, 80),
          instrumental: !!makeInstrumental,
          gptDescription: isAutoMode ? description.slice(0, 2000) : undefined,
          autoLyrics: !!autoLyrics,
          vocalGender,
          styleWeight: typeof styleWeight === "number" ? styleWeight : undefined,
          weirdnessConstraint: typeof weirdnessConstraint === "number" ? weirdnessConstraint : undefined,
          taskType: taskType || "generate",
          continueClipId: continueClipId || undefined,
          audioWeight: typeof audioWeight === "number" ? audioWeight : undefined,
        });

        res.json({
          taskId,
          engine: "sonic",
          status: "GENERATING",
          message: "Beat submitted to Sonic — poll /api/production/beat-status for updates",
        });
      } else if (isSunoConfigured()) {
        const vocalGender: "m" | "f" | undefined = voiceType?.includes("female") ? "f" : voiceType?.includes("male") ? "m" : undefined;

        console.log(`[BEAT-GEN] Submitting to Suno: style=${style}, vocal=${vocalGender}, instrumental=${makeInstrumental}`);

        const taskId = await sunoGenerate({
          prompt: prompt.slice(0, 5000),
          style: (style || "R&B, Smooth, Melodic").slice(0, 1000),
          title: (title || "AITIFY Beat").slice(0, 80),
          instrumental: !!makeInstrumental,
          vocalGender,
        });

        res.json({
          taskId,
          engine: "suno",
          status: "GENERATING",
          message: "Beat submitted to Suno — poll /api/production/beat-status for updates",
        });
      } else {
        console.log(`[BEAT-GEN] No music API key — using AI vocal engine: style=${style}, voice=${voiceType}`);
        const voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = voiceType?.includes("female") ? "shimmer" : voiceType?.includes("male-deep") ? "onyx" : voiceType?.includes("male-raspy") ? "echo" : "onyx";
        const audioBuffer = await performVocal(prompt.slice(0, 4096), style || "R&B, Smooth, Melodic", voice, "mp3");
        const audioId = `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const audioPath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
        fs.writeFileSync(audioPath, audioBuffer);
        const audioUrl = `/uploads/${audioId}.mp3`;
        console.log(`[BEAT-GEN] AI vocal generated: ${audioUrl} (${audioBuffer.length} bytes)`);

        res.json({
          audioUrl,
          taskId: audioId,
          sunoId: audioId,
          engine: "vocal",
          status: "READY",
        });
      }
    } catch (error: any) {
      console.error("[BEAT-GEN] Error:", error.message);
      res.status(500).json({ message: error.message || "Beat generation failed" });
    }
  });

  app.get("/api/production/beat-status/:taskId", isAuthenticated, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      if (!taskId) return res.status(400).json({ message: "taskId required" });

      const engine = (req.query.engine as string) || "auto";

      if (engine === "sonic" || (engine === "auto" && isSonicConfigured())) {
        const result = await sonicCheckStatus(taskId);

        if ((result.status === "SUCCESS" || result.status === "complete") && result.songs && result.songs.length > 0) {
          const song = result.songs[0];
          const localId = `sonic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const audioSrc = song.audioUrl || song.streamUrl || "";
          const localUrl = audioSrc ? await downloadSonicAudio(audioSrc, localId) : "";

          res.json({
            status: "READY",
            audioUrl: localUrl,
            songId: song.id,
            imageUrl: song.imageUrl || null,
            duration: song.duration || 0,
            engine: "sonic",
            songs: result.songs.map(s => ({
              id: s.id,
              audioUrl: s.audioUrl,
              imageUrl: s.imageUrl,
              title: s.title,
              duration: s.duration,
            })),
          });
        } else if (result.status === "FAILED") {
          res.json({ status: "FAILED", engine: "sonic", message: "Sonic generation failed" });
        } else {
          res.json({ status: "GENERATING", engine: "sonic", message: "Still generating..." });
        }
      } else {
        const result = await sunoCheckStatus(taskId);

        if (result.status === "SUCCESS" && result.songs && result.songs.length > 0) {
          const song = result.songs[0];
          const localId = `suno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const localUrl = await downloadSunoAudio(song.audioUrl, localId);

          res.json({
            status: "READY",
            audioUrl: localUrl,
            songId: song.id,
            imageUrl: song.imageUrl || null,
            duration: song.duration || 0,
            engine: "suno",
            songs: result.songs.map(s => ({
              id: s.id,
              audioUrl: s.audioUrl,
              imageUrl: s.imageUrl,
              title: s.title,
              duration: s.duration,
            })),
          });
        } else if (result.status === "FAILED") {
          res.json({ status: "FAILED", engine: "suno", message: "Suno generation failed" });
        } else {
          res.json({ status: "GENERATING", engine: "suno", message: "Still generating..." });
        }
      }
    } catch (error: any) {
      console.error("[BEAT-STATUS] Error:", error.message);
      res.status(500).json({ message: error.message || "Status check failed" });
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

      console.log(`[ART-GEN] Generating artwork...`);

      const artResult = await generateArtwork({
        prompt: artPrompt,
        negativePrompt: "blur, low quality, watermark, text overlay",
        style: "AUTO",
      });

      console.log(`[ART-GEN] Result via ${artResult.engine}: ${artResult.localPath}`);

      res.json({ imageUrl: artResult.localPath, status: "READY", engine: artResult.engine });
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
      let tm = member.length > 0 ? member[0] : null;
      let outstanding = tm ? parseFloat(tm.outstandingBalance || "475.00") : 500.00;

      if (!tm && !adminUser[0].isAdmin) {
        return res.status(403).json({
          error: "PROMISSORY NOTE ACTIVATION REQUIRED",
          message: "You must be a trust member to push assets. Activate your $25 down payment.",
          redirect: "/membership",
        });
      }

      if (tm && outstanding <= 0 && !adminUser[0].isAdmin) {
        return res.status(403).json({
          error: "NOTE FULLY AMORTIZED",
          message: "Your promissory note is fully paid. Contact admin to renew.",
        });
      }

      console.log(`[PUSHER] ${userId} pushing asset: "${title}" | Trust: ${tm?.trustId || "ADMIN_DIRECT"} | Balance: $${outstanding}`);

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
      } else if (isSunoConfigured()) {
        try {
          const vocalGender: "m" | "f" | undefined = makeInstrumental ? undefined : "m";
          const songs = await sunoGenerateAndWait({
            prompt: (audioPrompt || title).slice(0, 5000),
            style: (style || "R&B, Smooth, Melodic").slice(0, 1000),
            title: title.slice(0, 80),
            instrumental: !!makeInstrumental,
            vocalGender,
          });
          if (songs.length > 0) {
            const localId = `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const localUrl = await downloadSunoAudio(songs[0].audioUrl, localId);
            audioAsset = { suno_id: songs[0].id, audioUrl: localUrl, status: "MINTING_PENDING" };
            console.log(`[PUSHER] Suno audio: ${localUrl}`);
          }
        } catch (e: any) {
          console.error(`[PUSHER] Suno audio failed: ${e.message}`);
        }
      } else {
        try {
          const voice = makeInstrumental ? "alloy" : "onyx";
          const audioBuffer = await performVocal((audioPrompt || title).slice(0, 4096), style || "R&B, Smooth, Melodic", voice, "mp3");
          const audioId = `push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const audioFilePath = path.join(process.cwd(), "uploads", `${audioId}.mp3`);
          fs.writeFileSync(audioFilePath, audioBuffer);
          audioAsset = { suno_id: audioId, audioUrl: `/uploads/${audioId}.mp3`, status: "MINTING_PENDING" };
          console.log(`[PUSHER] Audio generated via AI vocal fallback: ${audioAsset.audioUrl}`);
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
          const artResult = await generateArtwork({
            prompt: artPrompt,
            negativePrompt: "blur, low quality, watermark, text overlay",
            style: "AUTO",
          });
          visualAsset = { imageUrl: artResult.localPath, status: "ART_READY" };
          console.log(`[PUSHER] Art generated via ${artResult.engine}: ${artResult.localPath}`);
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

      let newBalance = outstanding;
      if (tm) {
        newBalance = parseFloat((outstanding - totalWholesale).toFixed(2));
        await db.update(trustMembers)
          .set({ outstandingBalance: newBalance.toString() })
          .where(eq(trustMembers.id, tm.id));
      }

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
          monthlyCommitment: tm?.monthlyCommitment || "0",
          monthsRemaining: tm?.monthsRemaining || 0,
          trustId: tm?.trustId || "ADMIN_DIRECT",
        },
        amortization: tm ? `$${tm.monthlyCommitment}/MO × ${tm.monthsRemaining} MONTHS REMAINING` : "ADMIN DIRECT — NO AMORTIZATION",
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
        discountSellRate: 0.85,
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
      const { queueId, caughtPrice } = req.body;
      if (!queueId) return res.status(400).json({ message: "queueId required" });
      const parsedCatch = typeof caughtPrice === "number" ? caughtPrice : parseFloat(caughtPrice);
      const result = await traderAcceptOffer(queueId, userId, parsedCatch);
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Accept error:", error);
      res.status(500).json({ message: "Failed to accept settlement" });
    }
  });

  app.post("/api/settlement/discount-sell", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { queueId } = req.body;
      if (!queueId) return res.status(400).json({ message: "queueId required" });
      const result = await traderDiscountSell(queueId, userId);
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Discount sell error:", error);
      res.status(500).json({ message: "Failed to discount sell position" });
    }
  });

  app.get("/api/blocks/active-leader", async (_req, res) => {
    try {
      const { assetBlocks } = await import("@shared/schema");
      const [leader] = await db.select({
        id: assetBlocks.id,
        trackId: assetBlocks.trackId,
        blockNumber: assetBlocks.blockNumber,
        totalIntake: assetBlocks.totalIntake,
        ceiling: assetBlocks.ceiling,
        budget: assetBlocks.budget,
        maxTraders: assetBlocks.maxTraders,
        status: assetBlocks.status,
      }).from(assetBlocks)
        .where(eq(assetBlocks.status, "OPEN"))
        .orderBy(desc(sql`CAST(${assetBlocks.totalIntake} AS DECIMAL)`))
        .limit(1);

      if (!leader) {
        return res.json({
          active: false,
          ceiling: 1000,
          totalIntake: 0,
          remaining: 1000,
          fillPct: 0,
          budget: 522,
          maxTraders: 115,
          eligibleCount: 0,
          rolloverCount: 0,
        });
      }

      const intake = parseFloat(leader.totalIntake || "0");
      const ceiling = parseFloat(leader.ceiling || "1000");
      const [{ traders }] = await db.select({
        traders: sql<number>`CAST(COUNT(*) AS INTEGER)`,
      }).from(settlementQueue).where(eq(settlementQueue.blockId, leader.id));
      const traderCount = Number(traders) || 0;
      const eligibleCount = Math.min(traderCount, leader.maxTraders);
      const rolloverCount = Math.max(0, traderCount - leader.maxTraders);

      res.json({
        active: true,
        blockId: leader.id,
        blockNumber: leader.blockNumber,
        trackId: leader.trackId,
        totalIntake: intake,
        ceiling,
        remaining: parseFloat(Math.max(0, ceiling - intake).toFixed(2)),
        fillPct: parseFloat(Math.min(100, (intake / ceiling) * 100).toFixed(2)),
        budget: parseFloat(leader.budget || "522"),
        maxTraders: leader.maxTraders,
        traderCount,
        eligibleCount,
        rolloverCount,
        status: leader.status,
      });
    } catch (error: any) {
      console.error("[BLOCKS] Active leader error:", error);
      res.status(500).json({ message: "Failed to fetch active block" });
    }
  });

  app.get("/api/blocks/:trackId", async (req, res) => {
    try {
      const { trackId } = req.params;
      const { assetBlocks } = await import("@shared/schema");
      const rows = await db.select().from(assetBlocks)
        .where(eq(assetBlocks.trackId, trackId))
        .orderBy(desc(assetBlocks.blockNumber))
        .limit(50);
      res.json(rows);
    } catch (error: any) {
      console.error("[BLOCKS] List error:", error);
      res.status(500).json({ message: "Failed to fetch blocks" });
    }
  });

  app.get("/api/admin/blocks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { assetBlocks } = await import("@shared/schema");
      const rows = await db.select().from(assetBlocks).orderBy(desc(assetBlocks.id)).limit(200);
      res.json(rows);
    } catch (error: any) {
      console.error("[ADMIN BLOCKS] Error:", error);
      res.status(500).json({ message: "Failed to fetch blocks" });
    }
  });

  app.post("/api/admin/blocks/:id/finalize", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const blockId = parseInt(req.params.id, 10);
      if (!Number.isFinite(blockId)) return res.status(400).json({ message: "Invalid block id" });
      const result = await finalizeBlock(blockId);
      res.json(result);
    } catch (error: any) {
      console.error("[ADMIN BLOCKS] Finalize error:", error);
      res.status(500).json({ message: "Failed to finalize block" });
    }
  });

  app.get("/api/trust-vault/balance", async (_req, res) => {
    try {
      const balance = await getTrustVaultBalance();
      res.json({ balance, updatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("[VAULT] Balance error:", error);
      res.status(500).json({ message: "Failed to fetch vault balance" });
    }
  });

  app.get("/api/trust-vault/ledger", async (_req, res) => {
    try {
      const { trustVaultLedger } = await import("@shared/schema");
      const rows = await db.select().from(trustVaultLedger).orderBy(desc(trustVaultLedger.id)).limit(100);
      res.json(rows);
    } catch (error: any) {
      console.error("[VAULT] Ledger error:", error);
      res.status(500).json({ message: "Failed to fetch vault ledger" });
    }
  });

  app.post("/api/banker/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, cashTag, note } = req.body || {};
      const parsed = parseFloat(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const result = await enrollBanker(userId, parsed, cashTag, note);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (error: any) {
      console.error("[BANKER] Enroll error:", error);
      res.status(500).json({ message: "Failed to enroll banker" });
    }
  });

  app.get("/api/banker/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = await getBankerEarnings(userId);
      res.json(data);
    } catch (error: any) {
      console.error("[BANKER] Earnings error:", error);
      res.status(500).json({ message: "Failed to fetch banker data" });
    }
  });

  app.post("/api/banker/withdraw/:depositId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const depositId = parseInt(req.params.depositId, 10);
      if (!Number.isFinite(depositId)) return res.status(400).json({ message: "Invalid deposit id" });
      const result = await withdrawBankerDeposit(userId, depositId);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (error: any) {
      console.error("[BANKER] Withdraw error:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.post("/api/stake/enroll", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, cashTag } = req.body || {};
      const parsed = parseFloat(amount);
      if (!Number.isFinite(parsed)) return res.status(400).json({ message: "Invalid amount" });
      const result = await enrollStake(userId, parsed, cashTag);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (error: any) {
      console.error("[STAKE] Enroll error:", error);
      res.status(500).json({ message: "Failed to enroll stake" });
    }
  });

  app.get("/api/stake/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positions = await getStakePositions(userId);
      res.json({ positions });
    } catch (error: any) {
      console.error("[STAKE] Me error:", error);
      res.status(500).json({ message: "Failed to fetch stake positions" });
    }
  });

  app.post("/api/stake/withdraw/:positionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const positionId = parseInt(req.params.positionId, 10);
      if (!Number.isFinite(positionId)) return res.status(400).json({ message: "Invalid position id" });
      const result = await withdrawStakePosition(userId, positionId);
      if (!result.success) return res.status(400).json(result);
      res.json(result);
    } catch (error: any) {
      console.error("[STAKE] Withdraw error:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  app.get("/api/admin/banker/queue", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const { bankerQueue, bankerLedger } = await import("@shared/schema");
      const queue = await db.select().from(bankerQueue).orderBy(asc(bankerQueue.position));
      const recentStrikes = await db.select().from(bankerLedger).orderBy(desc(bankerLedger.id)).limit(50);
      res.json({ queue, recentStrikes });
    } catch (error: any) {
      console.error("[ADMIN BANKER] Error:", error);
      res.status(500).json({ message: "Failed to fetch banker queue" });
    }
  });

  app.post("/api/admin/settlement/settle-now", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { queueId } = req.body;
      if (!queueId) return res.status(400).json({ message: "queueId required" });

      const [entry] = await db.select().from(settlementQueue).where(eq(settlementQueue.id, queueId));
      if (!entry) return res.status(404).json({ message: "Queue entry not found" });
      if (entry.status === "SETTLED") return res.status(400).json({ message: "Already settled" });

      const buyIn = parseFloat(entry.buyIn || "0");
      const locked = parseFloat(entry.lockedMbbp || entry.currentMultiplier || "1.01");
      const kinetic = getKineticState();
      const floorPct = kinetic.floorROI;
      const payout = parseFloat((buyIn * locked * floorPct).toFixed(2));

      const grossIntake = await getGrossIntake();
      const totalPaid = await getTotalPaidOut();
      const fundAvailable = parseFloat((grossIntake - totalPaid).toFixed(2));

      if (payout > fundAvailable) {
        return res.status(400).json({ message: `Insufficient funds. Payout $${payout.toFixed(2)} exceeds available $${fundAvailable.toFixed(2)} (Gross $${grossIntake.toFixed(2)} - Paid $${totalPaid.toFixed(2)})` });
      }

      await db.update(settlementQueue).set({
        status: "SETTLED",
        acceptedMultiplier: locked.toFixed(2),
        payoutAmount: payout.toFixed(2),
        currentOffer: payout.toFixed(2),
        currentMultiplier: locked.toFixed(2),
        settledAt: new Date(),
      }).where(eq(settlementQueue.id, queueId));

      const traderEmail = entry.userId || "unknown";
      console.log(`[ADMIN SETTLE] Manual settle: ${traderEmail} | $${buyIn} × ${locked.toFixed(4)} MBBP × ${(floorPct * 100).toFixed(0)}% floor = $${payout.toFixed(2)} payout`);

      res.json({
        message: `SETTLED — $${payout.toFixed(2)} payout at ${locked.toFixed(4)}x MBBP, ${(floorPct * 100).toFixed(0)}% floor split`,
        queueId,
        buyIn,
        lockedMbbp: locked,
        floorPct: Math.round(floorPct * 100),
        payout,
      });
    } catch (error: any) {
      console.error("[ADMIN SETTLE] Error:", error);
      res.status(500).json({ message: "Failed to settle trade" });
    }
  });

  const STAKING_TIERS: Array<{ amount: number; terms: Array<{ days: number; returnPct: number }> }> = [
    { amount: 10,  terms: [{ days: 45, returnPct: 10 }, { days: 90, returnPct: 12 }, { days: 180, returnPct: 14 }] },
    { amount: 25,  terms: [{ days: 45, returnPct: 12 }, { days: 90, returnPct: 14 }, { days: 180, returnPct: 16 }] },
    { amount: 50,  terms: [{ days: 45, returnPct: 14 }, { days: 90, returnPct: 16 }, { days: 180, returnPct: 18 }] },
    { amount: 75,  terms: [{ days: 45, returnPct: 18 }, { days: 90, returnPct: 20 }, { days: 180, returnPct: 23 }] },
    { amount: 100, terms: [{ days: 45, returnPct: 20 }, { days: 90, returnPct: 22 }, { days: 180, returnPct: 25 }] },
  ];

  app.get("/api/staking/tiers", (_req, res) => {
    res.json(STAKING_TIERS);
  });

  app.get("/api/staking/my-stakes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stakes = await db.select().from(stakingPortals)
        .where(eq(stakingPortals.userId, userId))
        .orderBy(desc(stakingPortals.stakedAt));
      res.json(stakes);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch stakes" });
    }
  });

  app.post("/api/staking/stake", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, termDays } = req.body;

      const parsedAmount = parseFloat(amount);
      const validAmounts = [10, 25, 50, 75, 100];
      const validTerms = [45, 90, 180];
      if (!validAmounts.includes(parsedAmount)) return res.status(400).json({ message: `Invalid amount. Valid: ${validAmounts.join(", ")}` });
      if (!validTerms.includes(termDays)) return res.status(400).json({ message: `Invalid term. Valid: ${validTerms.join(", ")} days` });

      const tier = STAKING_TIERS.find(t => t.amount === parsedAmount);
      const termInfo = tier?.terms.find(t => t.days === termDays);
      if (!tier || !termInfo) return res.status(400).json({ message: "Invalid staking configuration" });

      const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const maturesAt = new Date(Date.now() + termDays * 24 * 60 * 60 * 1000);

      const traderTag = currentUser?.cashTag ? `$${currentUser.cashTag.replace(/^\$/, "")}` : (currentUser?.firstName || (currentUser?.email ? currentUser.email.split("@")[0] : null) || "TRADER");
      const [stake] = await db.insert(stakingPortals).values({
        userId,
        userEmail: currentUser?.email || "",
        displayName: traderTag,
        amount: parsedAmount.toFixed(2),
        termDays,
        returnPct: termInfo.returnPct.toFixed(2),
        status: "PENDING",
        maturesAt,
      }).returning();

      console.log(`[STAKING] New stake: ${currentUser?.email || userId} | $${parsedAmount} | ${termDays} days | ${termInfo.returnPct}% return | Matures: ${maturesAt.toISOString()}`);

      res.json({
        message: `Stake $${parsedAmount} for ${termDays} days at ${termInfo.returnPct}% — Send via Cash App to $AITITRADEBROKERAGE`,
        stake,
        cashtag: "$AITITRADEBROKERAGE",
      });
    } catch (error: any) {
      console.error("[STAKING] Error:", error);
      res.status(500).json({ message: "Failed to create stake" });
    }
  });

  app.post("/api/admin/staking/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { stakeId } = req.body;
      if (!stakeId) return res.status(400).json({ message: "stakeId required" });

      const [stake] = await db.select().from(stakingPortals).where(eq(stakingPortals.id, stakeId));
      if (!stake) return res.status(404).json({ message: "Stake not found" });

      await db.update(stakingPortals).set({ status: "ACTIVE" }).where(eq(stakingPortals.id, stakeId));
      console.log(`[STAKING] CONFIRMED: ${stake.userEmail} | $${stake.amount} | ${stake.termDays} days | ${stake.returnPct}%`);
      res.json({ message: "Stake confirmed and active", stakeId });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to confirm stake" });
    }
  });

  app.post("/api/admin/staking/settle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { stakeId } = req.body;
      if (!stakeId) return res.status(400).json({ message: "stakeId required" });

      const [stake] = await db.select().from(stakingPortals).where(eq(stakingPortals.id, stakeId));
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.status === "SETTLED") return res.status(400).json({ message: "Already settled" });

      const principal = parseFloat(stake.amount || "0");
      const returnPct = parseFloat(stake.returnPct || "0");
      const payout = parseFloat((principal + (principal * returnPct / 100)).toFixed(2));

      await db.update(stakingPortals).set({
        status: "SETTLED",
        settledAt: new Date(),
        payoutAmount: payout.toFixed(2),
      }).where(eq(stakingPortals.id, stakeId));

      console.log(`[STAKING] SETTLED: ${stake.userEmail} | $${principal} + ${returnPct}% = $${payout} payout`);
      res.json({ message: `Settled — $${payout} payout`, stakeId, payout });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to settle stake" });
    }
  });

  app.post("/api/admin/staking/delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { stakeId } = req.body;
      if (!stakeId) return res.status(400).json({ message: "stakeId required" });

      const [stake] = await db.select().from(stakingPortals).where(eq(stakingPortals.id, stakeId));
      if (!stake) return res.status(404).json({ message: "Stake not found" });

      await db.delete(stakingPortals).where(eq(stakingPortals.id, stakeId));
      console.log(`[STAKING] DELETED: ${stake.userEmail} | $${stake.amount} | ${stake.termDays} days | Status was: ${stake.status}`);
      res.json({ message: "Stake deleted", stakeId });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete stake" });
    }
  });

  app.get("/api/admin/staking/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const allStakes = await db.select().from(stakingPortals).orderBy(desc(stakingPortals.stakedAt));
      res.json(allStakes);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch all stakes" });
    }
  });

  app.post("/api/admin/settlement/run-cycle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
      const result = await runSettlementCycle(true);
      res.json(result);
    } catch (error: any) {
      console.error("[SETTLEMENT] Admin cycle error:", error);
      res.status(500).json({ message: "Failed to run settlement cycle" });
    }
  });

  app.post("/api/admin/purge-inflated", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const realInvestorEmail = "jmariemusic@yahoo.com";

      const fakeOrders = await db.select({ id: orders.id }).from(orders).where(
        sql`${orders.buyerEmail} != ${realInvestorEmail} OR ${orders.buyerEmail} IS NULL`
      );

      let deletedOrderCount = 0;
      if (fakeOrders.length > 0) {
        const deleted = await db.delete(orders).where(
          sql`${orders.buyerEmail} != ${realInvestorEmail} OR ${orders.buyerEmail} IS NULL`
        ).returning({ id: orders.id });
        deletedOrderCount = deleted.length;
      }

      const queueEntries = await db.select({ id: settlementQueue.id }).from(settlementQueue);
      let queueClearedCount = 0;
      if (queueEntries.length > 0) {
        const deleted = await db.delete(settlementQueue).returning({ id: settlementQueue.id });
        queueClearedCount = deleted.length;
      }

      const cycleEntries = await db.select({ id: settlementCycles.id }).from(settlementCycles);
      let cyclesClearedCount = 0;
      if (cycleEntries.length > 0) {
        const deleted = await db.delete(settlementCycles).returning({ id: settlementCycles.id });
        cyclesClearedCount = deleted.length;
      }

      const [remaining] = await db.select({ cnt: sql<string>`COUNT(*)`, total: sql<string>`COALESCE(SUM(CAST(unit_price AS DECIMAL)), 0)` }).from(orders);

      console.log(`[ADMIN PURGE] Removed ${deletedOrderCount} orders, ${queueClearedCount} queue, ${cyclesClearedCount} cycles. Remaining: ${remaining?.cnt || 0} orders, $${remaining?.total || 0}`);

      res.json({
        purged: true,
        ordersRemoved: deletedOrderCount,
        queueCleared: queueClearedCount,
        cyclesCleared: cyclesClearedCount,
        remainingOrders: parseInt(remaining?.cnt || "0"),
        remainingGross: parseFloat(remaining?.total || "0"),
      });
    } catch (error: any) {
      console.error("[ADMIN PURGE] Error:", error);
      res.status(500).json({ message: error.message || "Purge failed" });
    }
  });

  app.get("/api/admin/pending-payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const pending = await db.select().from(orders).where(eq(orders.status, "pending_cashapp")).orderBy(orders.createdAt);

      const buyerEmails = Array.from(new Set(pending.map((o: any) => o.buyerEmail).filter(Boolean)));
      const buyerRows = buyerEmails.length > 0
        ? await db.select().from(users).where(inArray(users.email, buyerEmails as string[]))
        : [];
      const cashByEmail: Record<string, string> = {};
      buyerRows.forEach((u: any) => { if (u.email && u.cashTag) cashByEmail[u.email.toLowerCase()] = u.cashTag; });

      const enriched = pending.map((order: any) => {
        const tag = order.buyerCashTag || cashByEmail[(order.buyerEmail || "").toLowerCase()] || null;
        return {
          ...order,
          cashTag: tag,
          traderTag: tag ? `$${tag.replace(/^\$/, "")}` : (order.buyerName || (order.buyerEmail ? order.buyerEmail.split("@")[0] : null) || "TRADER"),
          userEmail: order.buyerEmail || order.buyerName || "Unknown",
        };
      });
      
      res.json(enriched);
    } catch (error) {
      console.error("[ADMIN] Pending payments error:", error);
      res.status(500).json({ message: "Failed to fetch pending payments" });
    }
  });

  app.post("/api/admin/confirm-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ message: "orderId required" });

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!order) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "pending_cashapp") {
        return res.status(400).json({ message: `Order already ${order.status}` });
      }

      const [updated] = await db.update(orders)
        .set({ status: "confirmed" })
        .where(and(eq(orders.id, orderId), eq(orders.status, "pending_cashapp")))
        .returning();
      
      if (!updated) {
        return res.status(409).json({ message: "Order already confirmed (race condition)" });
      }

      const parsedAmount = parseFloat(order.unitPrice || "0");
      await db.update(tracks)
        .set({ salesCount: sql`${tracks.salesCount} + 1` })
        .where(eq(tracks.id, order.trackId!));

      let buyerUserId = order.buyerEmail || "";
      let buyerCashTag = order.buyerCashTag || "";
      if (order.buyerEmail) {
        const [buyerUser] = await db.select().from(users).where(eq(users.email, order.buyerEmail)).limit(1);
        if (buyerUser) {
          buyerUserId = buyerUser.id;
          buyerCashTag = buyerUser.cashTag || buyerCashTag;
        }
      }

      const startMbbp = 1.01;
      await enqueueTrader(order.id, buyerUserId, order.trackId!, parsedAmount, startMbbp, buyerCashTag);
      const settlementTriggered = await checkAndTriggerSettlement();

      console.log(`[CONFIRM] Admin confirmed payment for order ${orderId} — $${parsedAmount} — START MBBP: $${startMbbp} — trader must ENTER POSITION to lock live price`);

      res.json({
        message: "Payment confirmed — position locked and enqueued",
        orderId,
        amount: parsedAmount,
        settlementTriggered,
      });
    } catch (error: any) {
      console.error("[CONFIRM] Error:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // TRADER PORTAL — Individual trader profile + positions
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/trader/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = decodeURIComponent(req.params.userId);
      const requestingUserId = req.user?.claims?.sub;

      const requestingUser = await storage.getUser(requestingUserId);

      let user = await storage.getUser(targetUserId);
      
      if (!user && targetUserId.includes("@")) {
        const [foundUser] = await db.select().from(users).where(eq(users.email, targetUserId)).limit(1);
        if (foundUser) user = foundUser;
      }

      if (!user) {
        const hasOrders = await db.select({ cnt: sql<number>`CAST(COUNT(*) AS INTEGER)` })
          .from(orders)
          .where(eq(orders.buyerEmail, targetUserId));
        
        if (hasOrders[0]?.cnt > 0) {
          const traderOrders = await db.select({
            id: orders.id,
            trackId: orders.trackId,
            trackingNumber: orders.trackingNumber,
            unitPrice: orders.unitPrice,
            portalName: orders.portalName,
            status: orders.status,
            createdAt: orders.createdAt,
          }).from(orders)
            .where(eq(orders.buyerEmail, targetUserId))
            .orderBy(desc(orders.createdAt))
            .limit(50);

          const positions = await Promise.all(traderOrders.map(async (o) => {
            const [track] = await db.select({ title: tracks.title, coverImage: tracks.coverImage, buyBackRate: tracks.buyBackRate }).from(tracks).where(eq(tracks.id, o.trackId)).limit(1);
            const buyIn = parseFloat(o.unitPrice || "5.00");
            const buyBack = parseFloat(track?.buyBackRate || (buyIn * 1.80).toFixed(2));
            const queueEntry = await db.select().from(settlementQueue).where(eq(settlementQueue.orderId, o.id)).limit(1);
            const qe = queueEntry[0];
            return {
              ...o,
              queueId: qe?.id || null,
              trackTitle: track?.title || "UNKNOWN",
              coverImage: track?.coverImage || null,
              buyIn,
              buyBack: qe ? parseFloat(qe.currentOffer || buyBack.toString()) : buyBack,
              roi: qe ? parseFloat((((parseFloat(qe.currentOffer || "0") - buyIn) / buyIn) * 100).toFixed(1)) : parseFloat((((buyBack - buyIn) / buyIn) * 100).toFixed(1)),
              queuePosition: qe?.queuePosition || null,
              queueStatus: qe?.status || null,
              currentMultiplier: qe ? parseFloat(qe.currentMultiplier || "1.25") : null,
              currentOffer: qe ? parseFloat(qe.currentOffer || "0") : null,
            };
          }));

          const totalInvested = positions.reduce((sum, p) => sum + p.buyIn, 0);
          const totalBuyBack = positions.reduce((sum, p) => sum + p.buyBack, 0);

          return res.json({
            trader: {
              id: targetUserId,
              username: traderOrders[0]?.portalName ? targetUserId.split("@")[0].toUpperCase() : "TRADER",
              profileImage: null,
              isAdmin: false,
            },
            trust: null,
            positions,
            summary: {
              totalPositions: positions.length,
              totalInvested: parseFloat(totalInvested.toFixed(2)),
              totalBuyBack: parseFloat(totalBuyBack.toFixed(2)),
              projectedROI: totalInvested > 0 ? parseFloat((((totalBuyBack - totalInvested) / totalInvested) * 100).toFixed(1)) : 0,
            },
          });
        }

        return res.status(404).json({ message: "Trader not found" });
      }

      const actualUserId = user.id;
      if (actualUserId !== requestingUserId && !requestingUser?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const trustMember = await db.select().from(trustMembers).where(eq(trustMembers.userId, actualUserId)).limit(1);
      const isTrustMember = trustMember.length > 0;
      const tm = trustMember[0] || null;

      const traderOrders = await db.select({
        id: orders.id,
        trackId: orders.trackId,
        trackingNumber: orders.trackingNumber,
        unitPrice: orders.unitPrice,
        portalName: orders.portalName,
        status: orders.status,
        createdAt: orders.createdAt,
      }).from(orders)
        .where((() => {
          const conditions = [];
          if (user.email) conditions.push(eq(orders.buyerEmail, user.email));
          const fullName = user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`.toUpperCase() : null;
          if (fullName) conditions.push(eq(orders.buyerName, fullName));
          if (conditions.length === 0) return sql`false`;
          return conditions.length === 1 ? conditions[0] : or(...conditions);
        })())
        .orderBy(desc(orders.createdAt))
        .limit(50);

      const positions = await Promise.all(traderOrders.map(async (o) => {
        const [track] = await db.select({ title: tracks.title, coverImage: tracks.coverImage, buyBackRate: tracks.buyBackRate }).from(tracks).where(eq(tracks.id, o.trackId)).limit(1);
        const buyIn = parseFloat(o.unitPrice || "5.00");
        const buyBack = parseFloat(track?.buyBackRate || (buyIn * 1.80).toFixed(2));
        const queueEntry = await db.select().from(settlementQueue).where(eq(settlementQueue.orderId, o.id)).limit(1);
        const qe = queueEntry[0];
        return {
          ...o,
          queueId: qe?.id || null,
          trackTitle: track?.title || "UNKNOWN",
          coverImage: track?.coverImage || null,
          buyIn,
          buyBack: qe ? parseFloat(qe.currentOffer || buyBack.toString()) : buyBack,
          roi: qe ? parseFloat((((parseFloat(qe.currentOffer || "0") - buyIn) / buyIn) * 100).toFixed(1)) : parseFloat((((buyBack - buyIn) / buyIn) * 100).toFixed(1)),
          queuePosition: qe?.queuePosition || null,
          queueStatus: qe?.status || null,
          currentMultiplier: qe ? parseFloat(qe.currentMultiplier || "1.25") : null,
          currentOffer: qe ? parseFloat(qe.currentOffer || "0") : null,
          payoutAmount: qe?.payoutAmount ? parseFloat(qe.payoutAmount) : null,
        };
      }));

      const totalInvested = positions.reduce((sum, p) => sum + p.buyIn, 0);
      const totalBuyBack = positions.reduce((sum, p) => sum + p.buyBack, 0);

      res.json({
        trader: {
          id: targetUserId,
          username: user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user.email?.split("@")[0] || "ANON",
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

  app.patch("/api/admin/tracks/:id/video", isAdmin, async (req: any, res) => {
    try {
      const { videoUrl } = req.body;
      await db.update(tracks).set({ videoUrl: videoUrl || null }).where(eq(tracks.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating video URL:", error);
      res.status(500).json({ message: "Failed to update video URL" });
    }
  });

  // === MUSIC MARKET — RETAIL STOCK EXCHANGE ===

  const STOCK_PRICE_CEILING = 500.00;
  const P2P_FEE_RATE = 0.02;
  const ESCALATION_INTERVAL = 5;

  function applyPriceCeiling(price: number): number {
    return Math.min(STOCK_PRICE_CEILING, parseFloat(price.toFixed(2)));
  }

  async function applyEscalationTx(tx: any, listingId: string, title: string): Promise<{ stepped: boolean; oldPrice: number; newPrice: number; pct: number; totalSold: number }> {
    const [fresh] = await tx.select({
      totalSold: marketListings.totalSold,
      currentPrice: marketListings.currentPrice,
    }).from(marketListings).where(eq(marketListings.id, listingId)).for("update");
    const totalSold = Number(fresh?.totalSold || 0);
    const oldPrice = parseFloat(fresh?.currentPrice || "0");
    if (totalSold === 0 || totalSold % ESCALATION_INTERVAL !== 0 || oldPrice >= STOCK_PRICE_CEILING) {
      return { stepped: false, oldPrice, newPrice: oldPrice, pct: 0, totalSold };
    }
    const pct = 1 + Math.random() * 19;
    const stepped = applyPriceCeiling(oldPrice * (1 + pct / 100));
    await tx.update(marketListings).set({
      currentPrice: stepped.toFixed(2),
      highPrice: sql`GREATEST(CAST(high_price AS DECIMAL), ${stepped.toFixed(2)})`,
    }).where(eq(marketListings.id, listingId));
    console.log(`[ESCALATION LADDER] ${title} | ${totalSold} units sold | $${oldPrice.toFixed(2)} → $${stepped.toFixed(2)} (+${pct.toFixed(2)}%)`);
    return { stepped: true, oldPrice, newPrice: stepped, pct, totalSold };
  }

  function getMarketPrice(listing: any): number {
    const base = parseFloat(listing.basePrice || "1.00");
    const current = parseFloat(listing.currentPrice || base.toString());
    const t = Date.now() / 1000;
    const seed = listing.id ? listing.id.charCodeAt(0) * 7919 + (listing.id.charCodeAt(1) || 0) * 1301 : 0;
    const s1 = Math.sin(seed + t * 0.013) * 0.08;
    const s2 = Math.sin(seed * 0.7 + t * 0.037) * 0.05;
    const s3 = Math.sin(seed * 1.3 + t * 0.091) * 0.03;
    const s4 = Math.sin(seed * 0.3 + t * 0.0017) * 0.12;
    const volumeBoost = Math.min(0.5, (listing.totalSold || 0) * 0.005);
    const drift = s1 + s2 + s3 + s4 + volumeBoost;
    const spike = Math.sin(seed * 2.1 + t * 0.003) > 0.92 ? 0.15 : 0;
    const price = current * (1 + drift + spike);
    return Math.max(0.25, parseFloat(price.toFixed(2)));
  }

  function getTargetPrice(listing: any): number {
    const base = parseFloat(listing.basePrice || "1.00");
    const current = parseFloat(listing.currentPrice || base.toString());
    const high = parseFloat(listing.highPrice || current.toString());
    const volume = listing.totalSold || 0;
    const t = Date.now() / 1000;
    const seed = listing.id ? listing.id.charCodeAt(0) * 4793 + (listing.id.charCodeAt(2) || 0) * 2311 : 0;

    const longWave = Math.sin(seed + t * 0.00008) * 0.5 + 0.5;
    const midWave = Math.sin(seed * 0.6 + t * 0.00025) * 0.5 + 0.5;
    const shortPulse = Math.sin(seed * 1.3 + t * 0.0009) * 0.3 + 0.7;

    const demandCurve = Math.min(5.0, volume * 0.05);
    const scarcityPremium = 2.5 + longWave * 3.0 + midWave * 1.5;
    const highWaterMark = Math.max(high, current) * 1.6;
    const growthFactor = 1.0 + (base >= 4 ? 1.8 : base >= 2 ? 1.2 : 0.8);

    const rawTarget = current * scarcityPremium * growthFactor + demandCurve + highWaterMark * 0.5;
    const jitter = shortPulse * (Math.sin(seed * 2.3 + t * 0.0004) * 0.08 + 1.0);
    const target = rawTarget * jitter;

    return Math.max(current * 2.5, parseFloat(target.toFixed(2)));
  }

  function getAnalystSignal(listing: any): { signal: string; momentum: string } {
    const live = getMarketPrice(listing);
    const target = getTargetPrice(listing);
    const spread = ((target - live) / live) * 100;

    const signal = spread > 200 ? "STRONG BUY" : spread > 100 ? "BUY" : spread > 50 ? "ACCUMULATE" : "NEUTRAL";
    const momentum = spread > 150 ? "SURGING" : spread > 80 ? "BULLISH" : spread > 30 ? "RISING" : "STEADY";

    return { signal, momentum };
  }

  app.get("/api/market/listings", async (_req, res) => {
    try {
      const listings = await db.select().from(marketListings).where(eq(marketListings.active, true)).orderBy(desc(marketListings.totalSold));
      const holdingCounts = await db.select({
        listingId: marketHoldings.listingId,
        cnt: sql<number>`COUNT(*)`,
      }).from(marketHoldings).groupBy(marketHoldings.listingId);
      const countMap = new Map(holdingCounts.map(h => [h.listingId, Number(h.cnt) || 0]));

      const resaleCounts = await db.select({
        listingId: marketHoldings.listingId,
        cnt: sql<number>`COUNT(*)`,
      }).from(marketHoldings).where(eq(marketHoldings.listedForSale, true)).groupBy(marketHoldings.listingId);
      const resaleMap = new Map(resaleCounts.map(r => [r.listingId, Number(r.cnt) || 0]));

      const withPrices = listings.map(l => {
        const analyst = getAnalystSignal(l);
        const maxSupply = l.maxSupply || 25;
        const holders = countMap.get(l.id) || 0;
        return {
          ...l,
          livePrice: getMarketPrice(l),
          targetPrice: getTargetPrice(l),
          analystSignal: analyst.signal,
          momentum: analyst.momentum,
          maxSupply,
          holders,
          seatsLeft: Math.max(0, maxSupply - holders),
          poolFull: holders >= maxSupply,
          resaleCount: resaleMap.get(l.id) || 0,
        };
      });
      res.json(withPrices);
    } catch (error) {
      console.error("Market listings error:", error);
      res.status(500).json({ message: "Failed to fetch listings" });
    }
  });

  app.get("/api/market/listings/:id", async (req, res) => {
    try {
      const [listing] = await db.select().from(marketListings).where(eq(marketListings.id, req.params.id));
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      const recent = await db.select().from(marketTransactions).where(eq(marketTransactions.listingId, req.params.id)).orderBy(desc(marketTransactions.createdAt)).limit(20);
      const resaleOffers = await db.select({
        id: marketHoldings.id,
        askPrice: marketHoldings.askPrice,
        userId: marketHoldings.userId,
      }).from(marketHoldings).where(
        and(eq(marketHoldings.listingId, req.params.id), eq(marketHoldings.listedForSale, true))
      ).orderBy(asc(marketHoldings.askPrice));
      const maxSupply = listing.maxSupply || 25;
      const holdingTotal = await db.select({ cnt: sql<number>`COUNT(*)` }).from(marketHoldings)
        .where(eq(marketHoldings.listingId, req.params.id));
      const holders = Number(holdingTotal[0]?.cnt) || 0;

      res.json({
        ...listing,
        livePrice: getMarketPrice(listing),
        targetPrice: getTargetPrice(listing),
        recentTrades: recent,
        resaleOffers,
        maxSupply,
        holders,
        seatsLeft: Math.max(0, maxSupply - holders),
        poolFull: holders >= maxSupply,
        resaleCount: resaleOffers.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch listing" });
    }
  });

  app.post("/api/market/buy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Login required" });
      const { listingId, fromResaleId } = req.body;
      if (!listingId) return res.status(400).json({ message: "Listing ID required" });

      const [listing] = await db.select().from(marketListings).where(eq(marketListings.id, listingId));
      if (!listing || !listing.active) return res.status(404).json({ message: "Listing not found" });

      const maxSupply = listing.maxSupply || 25;

      let price: number;
      let sellerId: string | null = null;
      const isP2P = !!fromResaleId;

      if (fromResaleId) {
        const [resale] = await db.select().from(marketHoldings).where(
          and(eq(marketHoldings.id, fromResaleId), eq(marketHoldings.listedForSale, true))
        );
        if (!resale) return res.status(404).json({ message: "Resale offer not found" });
        if (resale.listingId !== listingId) return res.status(400).json({ message: "Resale offer does not match this listing" });
        if (resale.userId === userId) return res.status(400).json({ message: "Cannot buy your own listing" });
        price = applyPriceCeiling(parseFloat(resale.askPrice || "0"));
        sellerId = resale.userId;
        await db.delete(marketHoldings).where(eq(marketHoldings.id, fromResaleId));
      } else {
        price = applyPriceCeiling(parseFloat(listing.currentPrice || listing.basePrice || "1.00"));
      }

      const buyerFee = parseFloat((price * P2P_FEE_RATE).toFixed(2));
      const sellerFee = parseFloat((price * P2P_FEE_RATE).toFixed(2));
      const buyerPays = parseFloat((price + buyerFee).toFixed(2));
      const sellerNet = parseFloat((price - sellerFee).toFixed(2));
      const houseTake = isP2P ? parseFloat((buyerFee + sellerFee).toFixed(2)) : buyerFee;

      const trackingNumber = `MKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const cashtag = "$AITITRADEBROKERAGE";
      const cashAppUrl = `https://cash.app/$AITITRADEBROKERAGE/${buyerPays.toFixed(2)}`;

      const userRecord = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);

      const result = await db.transaction(async (tx) => {
        if (!fromResaleId) {
          const currentHolders = await tx.select({ cnt: sql<number>`COUNT(*)` }).from(marketHoldings)
            .where(eq(marketHoldings.listingId, listingId));
          const holdingCount = Number(currentHolders[0]?.cnt) || 0;
          if (holdingCount >= maxSupply) {
            throw new Error(`POOL_FULL:${maxSupply}:${holdingCount}`);
          }
        }

        const [holding] = await tx.insert(marketHoldings).values({
          userId,
          listingId,
          purchasePrice: price.toFixed(2),
          quantity: 1,
          listedForSale: false,
        }).returning();

        await tx.insert(marketTransactions).values({
          listingId,
          buyerId: userId,
          sellerId,
          price: price.toFixed(2),
          type: fromResaleId ? "P2P_RESALE" : "BUY",
        });

        if (isP2P && sellerId) {
          await tx.insert(p2pTrades).values({
            assetType: "MUSIC_STOCK",
            assetId: listingId,
            assetLabel: listing.title,
            sellerId,
            buyerId: userId,
            salePrice: price.toFixed(2),
            buyerFee: buyerFee.toFixed(2),
            sellerFee: sellerFee.toFixed(2),
            houseFeeCollected: houseTake.toFixed(2),
            buyerPays: buyerPays.toFixed(2),
            sellerNet: sellerNet.toFixed(2),
            trackingNumber,
            verified: Math.abs(houseTake - price * 0.04) < 0.01,
          });
        }

        if (sellerId) {
          await tx.update(marketHoldings).set({
            listedForSale: false,
            askPrice: null,
          }).where(and(eq(marketHoldings.userId, sellerId), eq(marketHoldings.listingId, listingId)));
        }

        const buyerDisplayName = userRecord ? [userRecord.firstName, userRecord.lastName].filter(Boolean).join(" ") || "Market Buyer" : "Market Buyer";
        await tx.insert(orders).values({
          trackId: listing.trackId || listingId,
          trackingNumber,
          buyerEmail: userRecord?.email || userId,
          buyerName: buyerDisplayName,
          buyerCashTag: userRecord?.cashTag || null,
          unitPrice: price.toFixed(2),
          creatorCredit: "0.00",
          status: "confirmed",
          portalName: "MUSIC_MARKET",
        });

        const newHigh = Math.max(parseFloat(listing.highPrice || "0"), price);
        const newLow = listing.lowPrice && parseFloat(listing.lowPrice) > 0
          ? Math.min(parseFloat(listing.lowPrice), price) : price;
        await tx.update(marketListings).set({
          currentPrice: applyPriceCeiling(price).toFixed(2),
          highPrice: applyPriceCeiling(newHigh).toFixed(2),
          lowPrice: newLow.toFixed(2),
          volume: sql`COALESCE(${marketListings.volume}, 0) + 1`,
          totalSold: sql`COALESCE(${marketListings.totalSold}, 0) + 1`,
        }).where(eq(marketListings.id, listingId));

        const escalationResult = await applyEscalationTx(tx, listingId, listing.title);

        return { holding, escalationResult };
      });

      const escalation = result.escalationResult;

      const vaultNote = isP2P
        ? `P2P trade: ${listing.title} @ $${price.toFixed(2)} | Buyer fee $${buyerFee.toFixed(2)} + Seller fee $${sellerFee.toFixed(2)}`
        : `Initial buy: ${listing.title} @ $${price.toFixed(2)} | Fee $${buyerFee.toFixed(2)}`;
      await depositToVaultExternal(houseTake, vaultNote, listing.trackId || listingId, isP2P ? "P2P_TRADE_FEE" : "MARKET_BUY_FEE");

      logEvent("MARKET_BUY", `${userRecord?.displayName || userId} bought "${listing.title}" @ $${price.toFixed(2)} | Buyer pays $${buyerPays.toFixed(2)} | Seller nets $${sellerNet.toFixed(2)} | Vault +$${houseTake.toFixed(2)}${escalation.stepped ? ` | LADDER STEP +${escalation.pct.toFixed(2)}% → $${escalation.newPrice.toFixed(2)}` : ""} — ${trackingNumber}`);

      res.json({
        success: true,
        holding: result,
        price,
        buyerFee,
        sellerFee,
        buyerPays,
        sellerNet,
        houseTake,
        isP2P,
        sellerId,
        escalation: escalation.stepped ? { from: escalation.oldPrice, to: escalation.newPrice, pct: escalation.pct } : null,
        priceCeiling: STOCK_PRICE_CEILING,
        trackingNumber,
        cashtag,
        cashAppUrl,
        title: listing.title,
        artistName: listing.artistName,
        message: isP2P
          ? `P2P TRADE LOCKED: "${listing.title}" @ $${price.toFixed(2)}. You pay $${buyerPays.toFixed(2)} (incl. 2% fee). Seller receives $${sellerNet.toFixed(2)}. Send payment to ${cashtag}.`
          : `Position locked: "${listing.title}" @ $${price.toFixed(2)}. You pay $${buyerPays.toFixed(2)} (incl. 2% house fee). Send payment to ${cashtag}.`,
      });
    } catch (error: any) {
      if (error?.message?.startsWith("POOL_FULL:")) {
        const parts = error.message.split(":");
        return res.status(400).json({
          message: `POOL FULL — All ${parts[1]} seats taken. Buy from current owners on the resale board.`,
          poolFull: true,
          maxSupply: parseInt(parts[1]),
          holdingCount: parseInt(parts[2]),
        });
      }
      console.error("Market buy error:", error);
      res.status(500).json({ message: "Purchase failed" });
    }
  });

  app.post("/api/market/sell", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Login required" });
      const { holdingId, askPrice } = req.body;
      if (!holdingId || !askPrice) return res.status(400).json({ message: "Holding ID and ask price required" });
      const price = parseFloat(askPrice);
      if (price < 0.25) return res.status(400).json({ message: "Minimum ask price is $0.25" });

      const [holding] = await db.select().from(marketHoldings).where(
        and(eq(marketHoldings.id, holdingId), eq(marketHoldings.userId, userId))
      );
      if (!holding) return res.status(404).json({ message: "Holding not found" });

      await db.update(marketHoldings).set({
        listedForSale: true,
        askPrice: price.toFixed(2),
      }).where(eq(marketHoldings.id, holdingId));

      res.json({ success: true, message: `Listed for sale at $${price.toFixed(2)}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to list for sale" });
    }
  });

  app.post("/api/market/cancel-sale", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { holdingId } = req.body;
      const [holding] = await db.select().from(marketHoldings).where(
        and(eq(marketHoldings.id, holdingId), eq(marketHoldings.userId, userId))
      );
      if (!holding) return res.status(404).json({ message: "Holding not found" });
      await db.update(marketHoldings).set({ listedForSale: false, askPrice: null }).where(eq(marketHoldings.id, holdingId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel" });
    }
  });

  app.get("/api/market/portfolio", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Login required" });
      const holdings = await db.select().from(marketHoldings).where(eq(marketHoldings.userId, userId));
      const listingIds = [...new Set(holdings.map(h => h.listingId))];
      let listings: any[] = [];
      if (listingIds.length > 0) {
        listings = await db.select().from(marketListings).where(inArray(marketListings.id, listingIds));
      }
      const listingMap = new Map(listings.map(l => [l.id, l]));
      const portfolio = holdings.map(h => {
        const listing = listingMap.get(h.listingId);
        const livePrice = listing ? getMarketPrice(listing) : parseFloat(h.purchasePrice || "0");
        const purchasePrice = parseFloat(h.purchasePrice || "0");
        return {
          ...h,
          title: listing?.title || "Unknown",
          artistName: listing?.artistName || "Unknown",
          coverImage: listing?.coverImage,
          livePrice,
          profitLoss: parseFloat((livePrice - purchasePrice).toFixed(2)),
          roiPct: purchasePrice > 0 ? parseFloat(((livePrice - purchasePrice) / purchasePrice * 100).toFixed(1)) : 0,
        };
      });
      const totalValue = portfolio.reduce((s, p) => s + p.livePrice, 0);
      const totalInvested = portfolio.reduce((s, p) => s + parseFloat(p.purchasePrice || "0"), 0);
      res.json({ holdings: portfolio, totalValue, totalInvested, totalPL: totalValue - totalInvested });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio" });
    }
  });

  app.get("/api/market/leaderboard", async (_req, res) => {
    try {
      const allHoldings = await db.select().from(marketHoldings);
      const allListings = await db.select().from(marketListings);
      const listingMap = new Map(allListings.map(l => [l.id, l]));
      const userPortfolios = new Map<string, number>();
      for (const h of allHoldings) {
        const listing = listingMap.get(h.listingId);
        const livePrice = listing ? getMarketPrice(listing) : parseFloat(h.purchasePrice || "0");
        userPortfolios.set(h.userId, (userPortfolios.get(h.userId) || 0) + livePrice);
      }
      const allUsers = await db.select({ id: users.id, username: users.username, profileImage: users.profileImage, displayName: users.displayName }).from(users);
      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const board = Array.from(userPortfolios.entries())
        .map(([userId, value]) => {
          const u = userMap.get(userId);
          return { userId, username: u?.displayName || u?.username || "Trader", profileImage: u?.profileImage, portfolioValue: parseFloat(value.toFixed(2)), holdings: allHoldings.filter(h => h.userId === userId).length };
        })
        .sort((a, b) => b.portfolioValue - a.portfolioValue)
        .slice(0, 50);
      const first10k = board.find(b => b.portfolioValue >= 10000);
      res.json({ leaderboard: board, first10k: first10k || null, contestGoal: 10000 });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/admin/market/add-listing", isAdmin, async (req: any, res) => {
    try {
      const { title, artistName, coverImage, genre, basePrice, trackId } = req.body;
      if (!title || !artistName) return res.status(400).json({ message: "Title and artist name required" });
      const price = parseFloat(basePrice) || 1.00;
      const poolSize = price >= 4 ? 15 : price >= 2 ? 20 : 25;
      const [listing] = await db.insert(marketListings).values({
        trackId: trackId || null,
        title,
        artistName,
        coverImage: coverImage || null,
        genre: genre || null,
        basePrice: price.toFixed(2),
        currentPrice: price.toFixed(2),
        highPrice: price.toFixed(2),
        lowPrice: price.toFixed(2),
        volume: 0,
        totalSold: 0,
        maxSupply: poolSize,
        active: true,
      }).returning();
      res.json(listing);
    } catch (error) {
      console.error("Add listing error:", error);
      res.status(500).json({ message: "Failed to add listing" });
    }
  });

  app.post("/api/admin/market/sync-tracks", isAdmin, async (req: any, res) => {
    try {
      const allTracks = await db.select().from(tracks).innerJoin(artists, eq(tracks.artistId, artists.id));
      const existing = await db.select({ trackId: marketListings.trackId }).from(marketListings);
      const existingIds = new Set(existing.map(e => e.trackId).filter(Boolean));
      let added = 0;
      for (const row of allTracks) {
        if (existingIds.has(row.tracks.id)) continue;
        const price = parseFloat(row.tracks.unitPrice || "2.00");
        const poolSize = price >= 4 ? 15 : price >= 2 ? 20 : 25;
        await db.insert(marketListings).values({
          trackId: row.tracks.id,
          title: row.tracks.title,
          artistName: row.artists.name || "AITITRADE",
          coverImage: row.tracks.coverImage || null,
          genre: row.tracks.genre || null,
          basePrice: price.toFixed(2),
          currentPrice: price.toFixed(2),
          highPrice: price.toFixed(2),
          lowPrice: price.toFixed(2),
          volume: 0,
          totalSold: 0,
          maxSupply: poolSize,
          active: true,
        });
        added++;
      }
      res.json({ success: true, added, total: allTracks.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync" });
    }
  });

  app.delete("/api/admin/market/listing/:id", isAdmin, async (req: any, res) => {
    try {
      await db.delete(marketListings).where(eq(marketListings.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  // === PAY-TO-PLAY (Non-native radio features) ===

  app.get("/api/pay-to-play", async (_req, res) => {
    try {
      const items = await db.select().from(payToPlay).where(eq(payToPlay.active, true)).orderBy(desc(payToPlay.createdAt));
      res.json(items);
    } catch (error) {
      console.error("Error fetching pay-to-play:", error);
      res.status(500).json({ message: "Failed to fetch" });
    }
  });

  app.get("/api/admin/pay-to-play", isAdmin, async (_req, res) => {
    try {
      const items = await db.select().from(payToPlay).orderBy(desc(payToPlay.createdAt));
      res.json(items);
    } catch (error) {
      console.error("Error fetching pay-to-play:", error);
      res.status(500).json({ message: "Failed to fetch" });
    }
  });

  app.post("/api/admin/pay-to-play", isAdmin, async (req: any, res) => {
    try {
      const { artistName, songTitle, videoUrl, coverImage, genre, fee, cashTag, maxPlays, notes } = req.body;
      if (!artistName || !songTitle || !videoUrl) {
        return res.status(400).json({ message: "Artist name, song title, and video URL are required" });
      }
      const [item] = await db.insert(payToPlay).values({
        artistName,
        songTitle,
        videoUrl,
        coverImage: coverImage || null,
        genre: genre || null,
        fee: fee || "25.00",
        cashTag: cashTag || null,
        maxPlays: maxPlays || 100,
        notes: notes || null,
        submittedBy: req.user.claims.sub,
        feePaid: false,
        paymentConfirmed: false,
        active: false,
        plays: 0,
      }).returning();
      res.json(item);
    } catch (error) {
      console.error("Error creating pay-to-play:", error);
      res.status(500).json({ message: "Failed to create" });
    }
  });

  app.patch("/api/admin/pay-to-play/:id/confirm", isAdmin, async (req: any, res) => {
    try {
      await db.update(payToPlay).set({ paymentConfirmed: true, feePaid: true, active: true }).where(eq(payToPlay.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to confirm" });
    }
  });

  app.patch("/api/admin/pay-to-play/:id/deactivate", isAdmin, async (req: any, res) => {
    try {
      await db.update(payToPlay).set({ active: false }).where(eq(payToPlay.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate" });
    }
  });

  app.patch("/api/admin/pay-to-play/:id/activate", isAdmin, async (req: any, res) => {
    try {
      await db.update(payToPlay).set({ active: true }).where(eq(payToPlay.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to activate" });
    }
  });

  app.delete("/api/admin/pay-to-play/:id", isAdmin, async (req: any, res) => {
    try {
      await db.delete(payToPlay).where(eq(payToPlay.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete" });
    }
  });

  app.post("/api/pay-to-play/:id/played", async (req, res) => {
    try {
      const [item] = await db.select().from(payToPlay).where(eq(payToPlay.id, req.params.id));
      if (!item) return res.status(404).json({ message: "Not found" });
      const newPlays = (item.plays || 0) + 1;
      const updates: any = { plays: newPlays };
      if (item.maxPlays && newPlays >= item.maxPlays) {
        updates.active = false;
      }
      await db.update(payToPlay).set(updates).where(eq(payToPlay.id, req.params.id));
      res.json({ plays: newPlays, maxPlays: item.maxPlays, active: updates.active !== false });
    } catch (error) {
      res.status(500).json({ message: "Failed to update" });
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

  app.delete("/api/admin/mastering-requests/bulk/processed", isAdmin, async (_req: any, res) => {
    try {
      const processed = await db.select().from(masteringRequests)
        .where(sql`${masteringRequests.status} IN ('completed', 'rejected')`);
      let deleted = 0;
      for (const req of processed) {
        if (req.masteredUrl) {
          try {
            if (req.masteredUrl.startsWith("/uploads/mastered/")) {
              const localPath = path.join(masteredDir, path.basename(req.masteredUrl));
              if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            }
            const filename = path.basename(req.masteredUrl);
            const bucket = objectStorageClient.bucket(BUCKET_ID);
            await bucket.file(`mastered/${filename}`).delete().catch(() => {});
            if (req.masteredUrl.startsWith("/cloud/")) {
              await bucket.file(req.masteredUrl.replace("/cloud/", "")).delete().catch(() => {});
            }
          } catch {}
        }
        await db.delete(masteringRequests).where(eq(masteringRequests.id, req.id));
        deleted++;
      }
      console.log(`[MASTERING] Bulk deleted ${deleted} processed requests`);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to bulk delete" });
    }
  });

  app.delete("/api/admin/mastering-requests/:id", isAdmin, async (req: any, res) => {
    try {
      const request = await storage.getMasteringRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.masteredUrl) {
        try {
          if (request.masteredUrl.startsWith("/uploads/mastered/")) {
            const localPath = path.join(masteredDir, path.basename(request.masteredUrl));
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
          }
          if (request.masteredUrl.startsWith("/cloud/")) {
            const objectName = request.masteredUrl.replace("/cloud/", "");
            const bucket = objectStorageClient.bucket(BUCKET_ID);
            await bucket.file(objectName).delete().catch(() => {});
          }
          const filename = path.basename(request.masteredUrl);
          const bucket = objectStorageClient.bucket(BUCKET_ID);
          await bucket.file(`mastered/${filename}`).delete().catch(() => {});
        } catch {}
      }
      await db.delete(masteringRequests).where(eq(masteringRequests.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to delete" });
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
          "highpass=f=28",
          "lowpass=f=19000",
          "equalizer=f=60:t=q:w=1.2:g=3",
          "equalizer=f=100:t=q:w=1.5:g=2.5",
          "equalizer=f=200:t=q:w=1.8:g=1",
          "equalizer=f=400:t=q:w=1.5:g=-0.5",
          "equalizer=f=800:t=q:w=2:g=-1",
          "equalizer=f=2500:t=q:w=2:g=1.5",
          "equalizer=f=5000:t=q:w=1.5:g=1",
          "equalizer=f=8000:t=q:w=2:g=0.5",
          "equalizer=f=12000:t=q:w=1.5:g=1",
          "equalizer=f=16000:t=q:w=2:g=0.5",
          "acompressor=threshold=-18dB:ratio=2:attack=15:release=150:makeup=2dB:knee=6dB",
          "acompressor=threshold=-10dB:ratio=3:attack=5:release=50:makeup=1dB",
          "alimiter=limit=0.95:level=false:attack=3:release=50",
          "loudnorm=I=-11:TP=-1:LRA=8:print_format=json",
        ].join(","),
        "-ar", "48000",
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

      const masteredUrl = `/uploads/mastered/${outputFilename}`;
      try {
        const objectName = `mastered/${outputFilename}`;
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        const cloudFile = bucket.file(objectName);
        await cloudFile.save(fs.readFileSync(outputPath), { metadata: { contentType: "audio/wav" } });
        console.log(`[MASTERING] Also backed up to cloud: ${objectName}`);
      } catch {
        console.log(`[MASTERING] Cloud backup skipped — local file ready`);
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

  async function getSpotifyClientCredentialsToken(): Promise<string | null> {
    try {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret) return null;
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Authorization": `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      if (!tokenRes.ok) return null;
      const tokenData = await tokenRes.json();
      return tokenData.access_token || null;
    } catch { return null; }
  }

  async function fetchSpotifyTrackMetadata(trackId: string): Promise<any | null> {
    const token = await getSpotifyClientCredentialsToken();
    if (!token) return null;
    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  async function fetchRapidApiStreamCount(trackId: string): Promise<number | null> {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) return null;
    try {
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
        console.log(`[STREAM] RapidAPI returned ${response.status} for track ${trackId}`);
        return null;
      }
      const data = await response.json();
      return data.playCount ?? data.playcount ?? data.streamCount ?? null;
    } catch { return null; }
  }

  const spotifyTrackLookupHandler = async (req: any, res: any) => {
    try {
      const { trackId } = req.params;
      if (!trackId || typeof trackId !== "string") {
        return res.status(400).json({ message: "Track ID is required" });
      }
      const spotifyData = await fetchSpotifyTrackMetadata(trackId.trim());
      if (!spotifyData) {
        return res.status(404).json({ message: "Track not found on Spotify" });
      }
      const streamCount = await fetchRapidApiStreamCount(trackId.trim());
      const result = {
        id: spotifyData.id || trackId,
        name: spotifyData.name || "Unknown",
        artists: spotifyData.artists?.map((a: any) => ({ name: a.name, id: a.id })) || [],
        album: spotifyData.album ? {
          name: spotifyData.album.name,
          releaseDate: spotifyData.album.release_date || null,
          cover: spotifyData.album.images?.map((img: any) => ({ url: img.url, width: img.width, height: img.height })) || [],
        } : null,
        duration: spotifyData.duration_ms || 0,
        contentRating: spotifyData.explicit ? "explicit" : "clean",
        streamCount: streamCount,
        trackNumber: spotifyData.track_number || 1,
        releaseDate: spotifyData.album?.release_date || null,
        coverArt: spotifyData.album?.images?.[0]?.url || null,
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
      const spotifyData = await fetchSpotifyTrackMetadata(spotifyTrackId);
      if (!spotifyData) return res.status(404).json({ message: "Track not found on Spotify" });
      const streams = await fetchRapidApiStreamCount(spotifyTrackId) ?? 0;
      const artistNames = spotifyData.artists?.map((a: any) => a.name).join(", ") || "Unknown";
      const [track] = await db.insert(spotifyRoyaltyTracks).values({
        spotifyTrackId,
        spotifyUrl,
        title: spotifyData.name || "Unknown",
        artistName: artistNames,
        albumName: spotifyData.album?.name || null,
        coverArt: spotifyData.album?.images?.[0]?.url || null,
        releaseDate: spotifyData.album?.release_date || null,
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
      const spotifyData = await fetchSpotifyTrackMetadata(existing.spotifyTrackId);
      const streams = await fetchRapidApiStreamCount(existing.spotifyTrackId) ?? existing.streamCount ?? 0;
      const updateData: any = {
        streamCount: streams,
        isQualified: streams >= 1000,
        lastFetchedAt: new Date(),
      };
      if (spotifyData) {
        updateData.title = spotifyData.name || existing.title;
        updateData.artistName = spotifyData.artists?.map((a: any) => a.name).join(", ") || existing.artistName;
        updateData.coverArt = spotifyData.album?.images?.[0]?.url || existing.coverArt;
      }
      const [updated] = await db.update(spotifyRoyaltyTracks).set(updateData).where(eq(spotifyRoyaltyTracks.id, req.params.id)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error refreshing spotify royalty track:", error);
      res.status(500).json({ message: "Failed to refresh track" });
    }
  });

  app.post("/api/admin/spotify-royalty-tracks/refresh-all", isAdmin, async (req: any, res) => {
    try {
      const all = await db.select().from(spotifyRoyaltyTracks);
      let updated = 0;
      let errors = 0;
      for (const track of all) {
        try {
          const spotifyData = await fetchSpotifyTrackMetadata(track.spotifyTrackId);
          const streams = await fetchRapidApiStreamCount(track.spotifyTrackId);
          const updateData: any = {
            lastFetchedAt: new Date(),
          };
          if (streams !== null) {
            updateData.streamCount = streams;
            updateData.isQualified = streams >= 1000;
          }
          if (spotifyData) {
            updateData.title = spotifyData.name || track.title;
            updateData.artistName = spotifyData.artists?.map((a: any) => a.name).join(", ") || track.artistName;
            updateData.coverArt = spotifyData.album?.images?.[0]?.url || track.coverArt;
          }
          await db.update(spotifyRoyaltyTracks).set(updateData).where(eq(spotifyRoyaltyTracks.id, track.id));
          updated++;
          await new Promise(r => setTimeout(r, 200));
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

  app.get("/api/engine/state", async (_req, res) => {
    try {
      res.json(liveEngine.getState());
    } catch (error) {
      console.error("Engine state error:", error);
      res.status(500).json({ message: "Failed to get engine state" });
    }
  });

  app.post("/api/engine/discount-exit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });

      if (!liveEngine.marketOpen) {
        return res.status(400).json({ message: "Market is closed" });
      }

      const result = liveEngine.acceptDiscount(userId);
      if (!result.ok) {
        return res.status(400).json({ message: result.error || "Not in queue" });
      }

      const userPositions = await db.select().from(settlementQueue)
        .where(and(eq(settlementQueue.userId, userId), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])))
        .orderBy(asc(settlementQueue.createdAt))
        .limit(1);

      if (userPositions.length > 0) {
        const pos = userPositions[0];
        const buyIn = parseFloat(pos.buyIn || "0");
        const discountOffer = parseFloat((buyIn * result.discountPrice).toFixed(2));
        await db.update(settlementQueue).set({
          lockedMbbp: result.discountPrice.toFixed(4),
          currentOffer: discountOffer.toString(),
          currentMultiplier: result.discountPrice.toFixed(4),
          queuePosition: 0,
          status: "QUEUED",
        }).where(eq(settlementQueue.id, pos.id));
        console.log(`[ENGINE] Discount exit QUEUED FIRST: ${userId} | $${buyIn} × ${result.discountPrice.toFixed(4)} = $${discountOffer} | Moved to position #0`);
      }

      res.json({ message: "Discount accepted — you are FIRST in settlement queue", expectedPayout: result.payout, discountPrice: result.discountPrice, state: liveEngine.getState() });
    } catch (error) {
      console.error("Engine discount exit error:", error);
      res.status(500).json({ message: "Failed to process discount exit" });
    }
  });

  app.post("/api/engine/safe-stop", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const { threshold } = req.body;
      const result = liveEngine.safeStop(parseFloat(threshold || "0.25"));
      res.json(result);
    } catch (error) {
      console.error("Engine safe-stop error:", error);
      res.status(500).json({ message: "Failed to check safe stop" });
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

  app.post("/api/kinetic/freeze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      const frozen = freezeKineticSplit();
      const state = getKineticState();
      res.json({
        message: `Split FROZEN at ${Math.round(frozen.floor * 100)}/${Math.round(frozen.house * 100)}`,
        frozen: true,
        state,
      });
    } catch (error) {
      console.error("Kinetic freeze error:", error);
      res.status(500).json({ message: "Failed to freeze split" });
    }
  });

  app.post("/api/kinetic/unfreeze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

      unfreezeKineticSplit();
      const state = getKineticState();
      res.json({
        message: "Split UNFROZEN — oscillator live",
        frozen: false,
        state,
      });
    } catch (error) {
      console.error("Kinetic unfreeze error:", error);
      res.status(500).json({ message: "Failed to unfreeze split" });
    }
  });

  app.post("/api/trade/execute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { trackId, amount, type } = req.body;

      if (!trackId) {
        return res.status(400).json({ message: "trackId required" });
      }

      if (!liveEngine.marketOpen) {
        return res.status(400).json({ message: "Market is closed — wait for next cycle" });
      }

      if (type === "SELL") {
        const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const userEmail = currentUser?.email || "";

        let positions = await db.select().from(settlementQueue)
          .where(and(
            eq(settlementQueue.userId, userId),
            eq(settlementQueue.trackId, trackId),
            inArray(settlementQueue.status, ["QUEUED", "OFFERED"])
          ))
          .orderBy(asc(settlementQueue.createdAt));

        if (positions.length === 0 && userEmail) {
          positions = await db.select().from(settlementQueue)
            .where(and(
              eq(settlementQueue.userId, userEmail),
              eq(settlementQueue.trackId, trackId),
              inArray(settlementQueue.status, ["QUEUED", "OFFERED"])
            ))
            .orderBy(asc(settlementQueue.createdAt));
          if (positions.length > 0) {
            for (const pos of positions) {
              await db.update(settlementQueue).set({ userId }).where(eq(settlementQueue.id, pos.id));
            }
          }
        }

        if (positions.length === 0) {
          return res.status(400).json({ message: "No open position for this song — BUY IN first via Cash App, then SELL to lock price" });
        }

        const currentMbbp = liveEngine.mbbp;

        for (const pos of positions) {
          const buyIn = parseFloat(pos.buyIn || "0");
          const newOffer = parseFloat((buyIn * currentMbbp).toFixed(2));
          await db.update(settlementQueue).set({
            lockedMbbp: currentMbbp.toFixed(4),
            currentOffer: newOffer.toString(),
            currentMultiplier: currentMbbp.toFixed(4),
          }).where(eq(settlementQueue.id, pos.id));
        }

        const [trackInfo] = await db.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
        const songName = trackInfo?.title || trackId;
        console.log(`[SELL] ${userId} | Song: ${songName} | LOCKED MBBP: $${currentMbbp.toFixed(4)} | ${positions.length} position(s) updated`);

        return res.json({
          status: "SELL_LOCKED",
          type: "SELL",
          lockedMbbp: currentMbbp,
          positions: positions.length,
          message: `${songName} locked at MBBP $${currentMbbp.toFixed(4)} — queued for settlement`,
        });
      }

      if (type === "DISCOUNT_SELL") {
        const [discountUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const discountEmail = discountUser?.email || "";
        const queueId = req.body.queueId;

        let userPositions: any[] = [];

        if (queueId) {
          userPositions = await db.select().from(settlementQueue)
            .where(and(eq(settlementQueue.id, queueId), eq(settlementQueue.userId, userId), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])));
          if (userPositions.length === 0 && discountEmail) {
            userPositions = await db.select().from(settlementQueue)
              .where(and(eq(settlementQueue.id, queueId), eq(settlementQueue.userId, discountEmail), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])));
          }
        }

        if (userPositions.length === 0 && trackId) {
          userPositions = await db.select().from(settlementQueue)
            .where(and(eq(settlementQueue.userId, userId), eq(settlementQueue.trackId, trackId), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])))
            .orderBy(asc(settlementQueue.createdAt))
            .limit(1);
          if (userPositions.length === 0 && discountEmail) {
            userPositions = await db.select().from(settlementQueue)
              .where(and(eq(settlementQueue.userId, discountEmail), eq(settlementQueue.trackId, trackId), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])))
              .orderBy(asc(settlementQueue.createdAt))
              .limit(1);
          }
        }

        if (userPositions.length === 0) {
          return res.status(400).json({ message: "No open position found — BUY IN first via Cash App" });
        }

        if (userPositions[0].userId !== userId) {
          await db.update(settlementQueue).set({ userId }).where(eq(settlementQueue.id, userPositions[0].id));
        }

        const pos = userPositions[0];
        const buyIn = parseFloat(pos.buyIn || "0");
        const currentMbbp = liveEngine.mbbp;
        const discountRate = Math.max(0.5, currentMbbp * 0.85);
        const discountPayout = parseFloat((buyIn * discountRate).toFixed(2));

        await db.update(settlementQueue).set({
          lockedMbbp: discountRate.toFixed(4),
          currentOffer: discountPayout.toString(),
          currentMultiplier: discountRate.toFixed(4),
          queuePosition: 0,
          status: "QUEUED",
        }).where(eq(settlementQueue.id, pos.id));

        const [trackInfo] = await db.select().from(tracks).where(eq(tracks.id, pos.trackId)).limit(1);
        const songName = trackInfo?.title || pos.trackId;
        console.log(`[DISCOUNT SELL] ${userId} | Song: ${songName} | DISCOUNT RATE: ${discountRate.toFixed(4)}x | $${buyIn} → $${discountPayout} | QUEUED FIRST`);

        return res.json({
          status: "DISCOUNT_QUEUED",
          type: "DISCOUNT_SELL",
          queued: true,
          discountPrice: discountRate,
          expectedPayout: discountPayout,
          message: `Discount sell at ${discountRate.toFixed(4)}x — $${discountPayout.toFixed(2)} queued FIRST for settlement`,
        });
      }

      return res.status(400).json({ message: "Invalid trade type. Use SELL or DISCOUNT_SELL" });
    } catch (error: any) {
      console.error("Trade execute error:", error);
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
        .where(
          or(
            eq(orders.status, "test"),
            isNull(orders.buyerEmail),
            eq(orders.buyerEmail, ""),
          )
        );
      const testCount = testOrders.length;

      if (testCount > 0) {
        const testIds = testOrders.map(o => o.id);
        await db.delete(settlementQueue).where(inArray(settlementQueue.orderId, testIds));
        await db.delete(orders).where(inArray(orders.id, testIds));
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

  app.use("/live", express.static(path.join(process.cwd(), "public")));

  app.get("/buy", (req, res) => {
    const userId = (req.query.user as string) || "anon";
    const amount = Number(req.query.amount || 1);
    const result = enterSafe(userId, amount);
    if (!result.ok) {
      if (result.error === "QUEUE_LOCKED") {
        return res.status(429).json({ status: "busy", message: "Queue locked, try again" });
      }
      if (result.error === "INSUFFICIENT_FUNDS") {
        return res.status(400).json({ status: "error", message: "Insufficient funds — deposit first" });
      }
      return res.status(400).json({ status: "error", message: result.error });
    }
    res.json({ status: "ok", queuePosition: result.position, price: liveEngine.P_current });
  });

  app.get("/wallet", (req, res) => {
    const user = req.query.user as string;
    if (!user) return res.status(400).json({ error: "user required" });
    res.json(getWalletSummary(user));
  });

  app.get("/withdraw", (req, res) => {
    const user = req.query.user as string;
    const amount = Number(req.query.amount || 0);
    if (!user) return res.status(400).json({ error: "user required" });
    if (!amount || amount <= 0) return res.status(400).json({ error: "valid amount required" });
    const wallet = recordWalletWithdrawal(user, amount);
    if (!wallet) return res.json({ ok: false, error: "NOT ENOUGH BALANCE" });
    res.json({ ok: true, balance: parseFloat(wallet.balance.toFixed(2)) });
  });

  app.get("/discount", async (req, res) => {
    const userId = req.query.user as string;
    if (!userId) return res.status(400).json({ error: "user required" });

    if (!liveEngine.marketOpen) {
      return res.status(400).json({ error: "Market is closed" });
    }

    const result = liveEngine.acceptDiscount(userId);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    const userPositions = await db.select().from(settlementQueue)
      .where(and(eq(settlementQueue.userId, userId), inArray(settlementQueue.status, ["QUEUED", "OFFERED"])))
      .orderBy(asc(settlementQueue.createdAt))
      .limit(1);

    if (userPositions.length > 0) {
      const pos = userPositions[0];
      const buyIn = parseFloat(pos.buyIn || "0");
      const discountOffer = parseFloat((buyIn * result.discountPrice).toFixed(2));
      await db.update(settlementQueue).set({
        lockedMbbp: result.discountPrice.toFixed(4),
        currentOffer: discountOffer.toString(),
        currentMultiplier: result.discountPrice.toFixed(4),
        queuePosition: 0,
        status: "QUEUED",
      }).where(eq(settlementQueue.id, pos.id));
      console.log(`[ENGINE] Discount exit QUEUED FIRST: ${userId} | $${buyIn} × ${result.discountPrice.toFixed(4)} = $${discountOffer} | Position #0`);
    }

    const eio = getEngineIO();
    if (eio) {
      eio.emit("discount_exit", {
        userId,
        expectedPayout: result.payout,
        discountPrice: result.discountPrice,
        mbbp: liveEngine.mbbp,
        time: Date.now(),
        queued: true,
      });
    }

    res.json({ status: "ok", queued: true, expectedPayout: result.payout, discountPrice: result.discountPrice });
  });

  app.get("/market-status", (_req, res) => {
    res.json({
      price: parseFloat(liveEngine.P_current.toFixed(4)),
      mbbp: parseFloat(liveEngine.mbbp.toFixed(4)),
      discountOffer: parseFloat(liveEngine.discountOffer.toFixed(4)),
      marketOpen: liveEngine.marketOpen,
      volume: parseFloat(liveEngine.totalVolume.toFixed(2)),
      target: liveEngine.targetVolume,
      fillPct: parseFloat(((liveEngine.totalVolume / liveEngine.targetVolume) * 100).toFixed(1)),
      cycle: liveEngine.cycle,
      queueSize: liveEngine.queue.length,
      floorPool: parseFloat((liveEngine.totalVolume * liveEngine.floorPercent).toFixed(2)),
      housePool: parseFloat((liveEngine.totalVolume * liveEngine.housePercent).toFixed(2)),
      split: `${Math.round(liveEngine.floorPercent * 100)}/${Math.round(liveEngine.housePercent * 100)}`,
    });
  });

  app.get("/api/engine/portfolio", (req, res) => {
    const userId = (req.query.user as string) || "anon";
    res.json(getPortfolioValue(userId));
  });

  app.get("/api/engine/portfolio/positions", (req, res) => {
    const userId = (req.query.user as string) || "anon";
    res.json(getPortfolio(userId));
  });

  app.get("/api/engine/monitor", (_req: any, res: any) => {
    res.json(buildMonitor());
  });

  app.get("/api/wallet/:userId", isAuthenticated, (req: any, res: any) => {
    const { userId } = req.params;
    res.json(getWalletSummary(userId));
  });

  app.get("/api/wallet", isAuthenticated, (req: any, res: any) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(getWalletSummary(userId));
  });

  app.post("/api/wallet/deposit", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      const wallet = recordWalletDeposit(userId, amount);
      res.json({ balance: parseFloat(wallet.balance.toFixed(2)), deposited: parseFloat(wallet.deposited.toFixed(2)) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/wallet/withdraw", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { amount } = req.body;
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount required" });
      }
      const wallet = recordWalletWithdrawal(userId, amount);
      if (!wallet) return res.status(400).json({ message: "Insufficient balance" });
      res.json({ balance: parseFloat(wallet.balance.toFixed(2)), withdrawn: parseFloat(wallet.withdrawn.toFixed(2)) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/engine/global-index", (_req: any, res: any) => {
    res.json({ value: computeGlobalIndex(), time: Date.now() });
  });

  app.get("/api/engine/events", (req, res) => {
    const limit = Math.min(Number(req.query.limit || 100), 500);
    const events = getEventLog();
    res.json(events.slice(-limit));
  });

  app.post("/api/engine/emergency-reset", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Auth required" });
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });
    emergencyReset();
    res.json({ status: "reset", price: liveEngine.P_current });
  });

  app.post("/api/engine/replay", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ message: "Auth required" });
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) return res.status(403).json({ message: "Admin only" });

    const events = getEventLog();
    const limit = Math.min(Number(req.body.limit || 50), 200);
    const replayEvents = events.slice(-limit);

    const eio = getEngineIO();
    if (eio) {
      let i = 0;
      const interval = setInterval(() => {
        if (i >= replayEvents.length) {
          clearInterval(interval);
          return;
        }
        eio.emit("replay_event", replayEvents[i]);
        i++;
      }, 100);
    }

    res.json({ status: "replaying", count: replayEvents.length });
  });

  // ═══════════════════ GLOBAL INVESTOR PORTALS ═══════════════════

  const INVESTOR_PORTALS_SEED = [
    { portalName: "PORTAL #1", songTitle: "I GOT WHAT YOU NEED", spotifyUrl: "https://open.spotify.com/track/4vCWf0lXZYkHMXUXoa4i3V?si=60bd414653584173", spotifyUri: "spotify:track:4vCWf0lXZYkHMXUXoa4i3V" },
    { portalName: "PORTAL #2", songTitle: "YOUR BODY IS MY PLAYGROUND", spotifyUrl: "https://open.spotify.com/track/7jNfn0Y5hgkhTtNMaFtF9v?si=ccc2d4ff58024c89", spotifyUri: "spotify:track:7jNfn0Y5hgkhTtNMaFtF9v" },
    { portalName: "PORTAL #3", songTitle: "SCENE BY SCENE", spotifyUrl: "https://open.spotify.com/track/3q3S1IcGkvpKUTjKAYzVIW?si=ab142c793a5e4982", spotifyUri: "spotify:track:3q3S1IcGkvpKUTjKAYzVIW" },
    { portalName: "PORTAL #4", songTitle: "CAN'T FOLLOW THROUGH", spotifyUrl: "https://open.spotify.com/track/3mC8dtkXh1V3TG3gnnVegx?si=42fa33de5630481e", spotifyUri: "spotify:track:3mC8dtkXh1V3TG3gnnVegx" },
    { portalName: "PORTAL #5", songTitle: "QUEEN BEE", spotifyUrl: "https://open.spotify.com/track/6Qv8vrx2LttmBWLLuWBwrN?si=822278c18e0843c7", spotifyUri: "spotify:track:6Qv8vrx2LttmBWLLuWBwrN" },
    { portalName: "PORTAL #6", songTitle: "ZODIAC SIGN", spotifyUrl: "https://open.spotify.com/track/4iSUSYeTXgTP7Bk8NdXEH8?si=fbf07851e3fd4dc9", spotifyUri: "spotify:track:4iSUSYeTXgTP7Bk8NdXEH8" },
    { portalName: "PORTAL #7", songTitle: "UNFAILING LOVE", spotifyUrl: "https://open.spotify.com/track/6sv9XZYAWpnCFCWCFTXNR8?si=25459f4095c54cb6", spotifyUri: "spotify:track:6sv9XZYAWpnCFCWCFTXNR8" },
  ];

  (async () => {
    try {
      const existing = await db.select({ cnt: sql<number>`CAST(COUNT(*) AS INTEGER)` }).from(globalInvestorPortals);
      if ((existing[0]?.cnt || 0) === 0) {
        for (const p of INVESTOR_PORTALS_SEED) {
          await db.insert(globalInvestorPortals).values({
            portalName: p.portalName,
            songTitle: p.songTitle,
            spotifyUrl: p.spotifyUrl,
            spotifyUri: p.spotifyUri,
          });
        }
        console.log("[INVESTOR PORTALS] Seeded 7 portals");
      } else {
        console.log(`[INVESTOR PORTALS] Already have ${existing[0]?.cnt} portals`);
      }
    } catch (e: any) {
      console.error("[INVESTOR PORTALS] Seed error:", e.message);
    }
  })();

  app.get("/api/investor-portals", async (_req, res) => {
    try {
      const portals = await db.select().from(globalInvestorPortals).orderBy(asc(globalInvestorPortals.createdAt));
      const entries = await db.select().from(globalInvestorEntries);
      const result = portals.map(p => ({
        ...p,
        investors: entries.filter(e => e.portalId === p.id).map(e => ({
          id: e.id,
          portalId: e.portalId,
          userId: e.userId,
          displayName: e.displayName,
          status: e.status,
          downPaymentPaid: e.downPaymentPaid,
          listedForResale: e.listedForResale,
          askPrice: e.askPrice,
          joinedAt: e.joinedAt,
        })),
        spotsRemaining: (p.maxInvestors || 10) - (p.currentInvestors || 0),
        totalRaised: entries.filter(e => e.portalId === p.id && e.downPaymentPaid).reduce((sum, e) => sum + parseFloat(e.totalPaid || "0"), 0),
        royaltyEarned: p.totalStreams ? parseFloat((((p.totalStreams || 0) * 0.00333) * 0.25).toFixed(2)) : 0,
        royaltyProgress: p.totalStreams ? parseFloat((((p.totalStreams || 0) / 1000000) * 100).toFixed(4)) : 0,
      }));
      res.json(result);
    } catch (error: any) {
      console.error("[INVESTOR PORTALS] List error:", error);
      res.status(500).json({ message: "Failed to load portals" });
    }
  });

  app.post("/api/investor-portals/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const portalId = req.params.id;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { cashTag } = req.body;

      const [portal] = await db.select().from(globalInvestorPortals).where(eq(globalInvestorPortals.id, portalId));
      if (!portal) return res.status(404).json({ message: "Portal not found" });
      if (portal.status !== "OPEN") return res.status(400).json({ message: "Portal is closed" });
      if ((portal.currentInvestors || 0) >= (portal.maxInvestors || 10)) return res.status(400).json({ message: "Portal is full" });

      const existing = await db.select().from(globalInvestorEntries)
        .where(and(eq(globalInvestorEntries.portalId, portalId), eq(globalInvestorEntries.userId, userId)));
      if (existing.length > 0) return res.status(400).json({ message: "Already joined this portal" });

      const displayName = user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email?.split("@")[0] || "INVESTOR";

      await db.insert(globalInvestorEntries).values({
        portalId,
        userId,
        userEmail: user?.email || "",
        displayName: displayName.toUpperCase(),
        cashTag: cashTag || "",
        status: "PENDING",
      });

      await db.update(globalInvestorPortals)
        .set({ currentInvestors: sql`COALESCE(current_investors, 0) + 1` })
        .where(eq(globalInvestorPortals.id, portalId));

      const updatedCount = (portal.currentInvestors || 0) + 1;
      if (updatedCount >= (portal.maxInvestors || 10)) {
        await db.update(globalInvestorPortals).set({ status: "FILLED" }).where(eq(globalInvestorPortals.id, portalId));
      }

      res.json({ success: true, message: `Joined ${portal.songTitle} — $25 down payment required via Cash App` });
    } catch (error: any) {
      console.error("[INVESTOR PORTALS] Join error:", error);
      res.status(500).json({ message: "Failed to join portal" });
    }
  });

  app.post("/api/admin/investor-portals/:id/update-streams", isAdmin, async (req: any, res) => {
    try {
      const { streams } = req.body;
      if (typeof streams !== "number") return res.status(400).json({ message: "streams (number) required" });
      await db.update(globalInvestorPortals)
        .set({ totalStreams: streams })
        .where(eq(globalInvestorPortals.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to update streams" });
    }
  });

  app.post("/api/admin/investor-entries/:id/confirm-payment", isAdmin, async (req: any, res) => {
    try {
      const amount = parseFloat(req.body.amount) || 25;
      const [entry] = await db.select().from(globalInvestorEntries).where(eq(globalInvestorEntries.id, req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      const newTotal = parseFloat(entry.totalPaid || "0") + amount;
      const isDown = !entry.downPaymentPaid && amount >= 25;
      // Portal Primary intake is tracked on globalInvestorEntries.totalPaid
      // (read by getGrossIntake() as the "portalIntake" stream — single source of truth)
      await db.update(globalInvestorEntries).set({
        totalPaid: newTotal.toFixed(2),
        downPaymentPaid: isDown ? true : entry.downPaymentPaid,
        monthsPaid: (entry.monthsPaid || 0) + 1,
        status: "ACTIVE",
      }).where(eq(globalInvestorEntries.id, req.params.id));

      res.json({ success: true, newTotal, contributedToGrossIntake: amount });
    } catch (error: any) {
      console.error("[CONFIRM PAYMENT]", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  app.delete("/api/admin/investor-entries/:id", isAdmin, async (req: any, res) => {
    try {
      const [entry] = await db.select().from(globalInvestorEntries).where(eq(globalInvestorEntries.id, req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      await db.delete(globalInvestorEntries).where(eq(globalInvestorEntries.id, req.params.id));
      await db.update(globalInvestorPortals).set({
        currentInvestors: sql`GREATEST(COALESCE(${globalInvestorPortals.currentInvestors}, 1) - 1, 0)`,
      }).where(eq(globalInvestorPortals.id, entry.portalId));
      console.log(`[INVESTOR] Removed investor ${entry.displayName} from portal ${entry.portalId} — non-payment`);
      res.json({ success: true, message: `Removed ${entry.displayName}` });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to remove investor" });
    }
  });

  app.post("/api/admin/investor-portals/create", isAdmin, async (req: any, res) => {
    try {
      const { songTitle, portalName, totalStreams, targetRaise, entryPrice, downPayment, monthlyPayment, termMonths, maxInvestors, baseReturnPct, maxReturnPct, spotifyUrl, spotifyUri } = req.body;
      if (!songTitle) return res.status(400).json({ message: "Song title required" });
      const [portal] = await db.insert(globalInvestorPortals).values({
        portalName: portalName || songTitle,
        songTitle,
        totalStreams: totalStreams || 0,
        targetRaise: targetRaise || "5000",
        entryPrice: entryPrice || "500",
        downPayment: downPayment || "25",
        monthlyPayment: monthlyPayment || "19.79",
        termMonths: termMonths || 24,
        maxInvestors: maxInvestors || 10,
        baseReturnPct: baseReturnPct || "25",
        maxReturnPct: maxReturnPct || "100",
        spotifyUrl: spotifyUrl || null,
        spotifyUri: spotifyUri || null,
        status: "OPEN",
      }).returning();
      console.log(`[INVESTOR PORTAL] Created: "${songTitle}" streams=${totalStreams || 0}`);
      res.json(portal);
    } catch (error: any) {
      console.error("[INVESTOR PORTAL] Create failed:", error.message);
      res.status(500).json({ message: "Failed to create portal" });
    }
  });

  app.post("/api/admin/investor-portals/bulk-create", isAdmin, async (req: any, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "items array required" });
      }
      const extractUri = (url: string): string | null => {
        if (!url) return null;
        const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/);
        return m ? `spotify:${m[1]}:${m[2]}` : null;
      };
      const created: any[] = [];
      const skipped: any[] = [];
      for (const raw of items) {
        const songTitle = String(raw.songTitle || "").trim();
        const spotifyUrl = String(raw.spotifyUrl || "").trim() || null;
        const totalStreams = Math.max(0, parseInt(raw.totalStreams) || 0);
        if (!songTitle) { skipped.push({ raw, reason: "missing songTitle" }); continue; }
        const existing = await db.select().from(globalInvestorPortals)
          .where(sql`UPPER(${globalInvestorPortals.songTitle}) = UPPER(${songTitle})`);
        if (existing.length > 0) {
          await db.update(globalInvestorPortals).set({
            totalStreams,
            spotifyUrl: spotifyUrl || existing[0].spotifyUrl,
            spotifyUri: spotifyUrl ? extractUri(spotifyUrl) : existing[0].spotifyUri,
          }).where(eq(globalInvestorPortals.id, existing[0].id));
          skipped.push({ songTitle, reason: "updated existing", id: existing[0].id });
          continue;
        }
        const [portal] = await db.insert(globalInvestorPortals).values({
          portalName: songTitle,
          songTitle,
          totalStreams,
          targetRaise: "5000",
          entryPrice: "500",
          downPayment: "25",
          monthlyPayment: "19.79",
          termMonths: 24,
          maxInvestors: 10,
          baseReturnPct: "25",
          maxReturnPct: "100",
          spotifyUrl,
          spotifyUri: extractUri(spotifyUrl || ""),
          status: "OPEN",
        }).returning();
        created.push(portal);
      }
      console.log(`[BULK PORTALS] Created ${created.length}, updated/skipped ${skipped.length}`);
      res.json({ created: created.length, skipped: skipped.length, details: { created, skipped } });
    } catch (error: any) {
      console.error("[BULK PORTALS] Failed:", error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // ─── PORTAL SEAT P2P RESALE — links Global Trading Portals to the same 2% two-way fee + Vault logic ───
  const PORTAL_FEE_RATE = 0.02;

  app.post("/api/investor-portals/entries/:entryId/list-resale", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { askPrice } = req.body;
      const ask = parseFloat(askPrice);
      if (!ask || ask < 25) return res.status(400).json({ message: "Ask price must be ≥ $25" });
      if (ask > 500) return res.status(400).json({ message: "Ask price cannot exceed $500 portal ceiling" });

      const [entry] = await db.select().from(globalInvestorEntries)
        .where(and(eq(globalInvestorEntries.id, req.params.entryId), eq(globalInvestorEntries.userId, userId)));
      if (!entry) return res.status(404).json({ message: "Entry not found or not yours" });
      if (!entry.downPaymentPaid) return res.status(400).json({ message: "Down payment must be confirmed before resale" });

      await db.update(globalInvestorEntries).set({
        listedForResale: true,
        askPrice: ask.toFixed(2),
        listedAt: new Date(),
      }).where(eq(globalInvestorEntries.id, req.params.entryId));

      logEvent("PORTAL_LIST_RESALE", `${entry.displayName} listed seat in ${entry.portalId} @ $${ask.toFixed(2)}`);
      res.json({ success: true, message: `Seat listed for resale at $${ask.toFixed(2)}` });
    } catch (e: any) {
      console.error("[PORTAL RESALE] List error:", e);
      res.status(500).json({ message: "Failed to list seat" });
    }
  });

  app.post("/api/investor-portals/entries/:entryId/cancel-resale", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [entry] = await db.select().from(globalInvestorEntries)
        .where(and(eq(globalInvestorEntries.id, req.params.entryId), eq(globalInvestorEntries.userId, userId)));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      await db.update(globalInvestorEntries).set({
        listedForResale: false,
        askPrice: null,
        listedAt: null,
      }).where(eq(globalInvestorEntries.id, req.params.entryId));
      res.json({ success: true, message: "Listing cancelled" });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to cancel listing" });
    }
  });

  app.get("/api/investor-portals/resale-board", async (_req, res) => {
    try {
      const offers = await db.select().from(globalInvestorEntries)
        .where(eq(globalInvestorEntries.listedForResale, true))
        .orderBy(asc(globalInvestorEntries.askPrice));
      res.json(offers.map(o => ({
        entryId: o.id,
        portalId: o.portalId,
        sellerName: o.displayName,
        askPrice: parseFloat(o.askPrice || "0"),
        buyerPays: parseFloat((parseFloat(o.askPrice || "0") * (1 + PORTAL_FEE_RATE)).toFixed(2)),
        sellerNets: parseFloat((parseFloat(o.askPrice || "0") * (1 - PORTAL_FEE_RATE)).toFixed(2)),
        listedAt: o.listedAt,
      })));
    } catch (e: any) {
      res.status(500).json({ message: "Failed to load resale board" });
    }
  });

  app.post("/api/investor-portals/buy-resale/:entryId", isAuthenticated, async (req: any, res) => {
    try {
      const buyerId = req.user.claims.sub;
      const buyer = await storage.getUser(buyerId);
      const { cashTag } = req.body;
      const trackingNumber = `PRT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const result = await db.transaction(async (tx) => {
        const [offer] = await tx.select().from(globalInvestorEntries)
          .where(and(eq(globalInvestorEntries.id, req.params.entryId), eq(globalInvestorEntries.listedForResale, true)))
          .for("update");
        if (!offer) throw new Error("OFFER_GONE");
        if (offer.userId === buyerId) throw new Error("SELF_BUY");

        const dup = await tx.select().from(globalInvestorEntries)
          .where(and(eq(globalInvestorEntries.portalId, offer.portalId), eq(globalInvestorEntries.userId, buyerId)));
        if (dup.length > 0) throw new Error("ALREADY_IN_PORTAL");

        const price = parseFloat(offer.askPrice || "0");
        const buyerFee = parseFloat((price * PORTAL_FEE_RATE).toFixed(2));
        const sellerFee = parseFloat((price * PORTAL_FEE_RATE).toFixed(2));
        const buyerPays = parseFloat((price + buyerFee).toFixed(2));
        const sellerNet = parseFloat((price - sellerFee).toFixed(2));
        const houseTake = parseFloat((buyerFee + sellerFee).toFixed(2));

        const buyerName = buyer?.firstName ? `${buyer.firstName}${buyer.lastName ? ' ' + buyer.lastName : ''}` : buyer?.email?.split("@")[0] || "INVESTOR";

        await tx.update(globalInvestorEntries).set({
          userId: buyerId,
          userEmail: buyer?.email || "",
          displayName: buyerName.toUpperCase(),
          cashTag: cashTag || buyer?.cashTag || "",
          listedForResale: false,
          askPrice: null,
          listedAt: null,
        }).where(eq(globalInvestorEntries.id, offer.id));

        const [tradeRow] = await tx.insert(p2pTrades).values({
          assetType: "PORTAL_SEAT",
          assetId: offer.id,
          assetLabel: offer.portalId,
          sellerId: offer.userId || "UNKNOWN",
          buyerId,
          salePrice: price.toFixed(2),
          buyerFee: buyerFee.toFixed(2),
          sellerFee: sellerFee.toFixed(2),
          houseFeeCollected: houseTake.toFixed(2),
          buyerPays: buyerPays.toFixed(2),
          sellerNet: sellerNet.toFixed(2),
          trackingNumber,
          verified: Math.abs(houseTake - price * 0.04) < 0.01,
        }).returning();

        // P2P intake feeds gross via the p2p_trades table directly (single source of truth)
        const [portalRow] = await tx.select().from(globalInvestorPortals).where(eq(globalInvestorPortals.id, offer.portalId));

        return { offer, price, buyerFee, sellerFee, buyerPays, sellerNet, houseTake, sellerName: offer.displayName, tradeId: tradeRow.id, portal: portalRow };
      });

      const portal = result.portal;
      const cashtag = "$AITITRADEBROKERAGE";

      await depositToVaultExternal(
        result.houseTake,
        `Portal P2P: ${portal?.songTitle || result.offer.portalId} | Buyer fee $${result.buyerFee.toFixed(2)} + Seller fee $${result.sellerFee.toFixed(2)}`,
        portal?.songTitle || null,
        "PORTAL_P2P_FEE"
      );

      logEvent("PORTAL_P2P_BUY", `Seat in "${portal?.songTitle}" — Seller ${result.sellerName} → Buyer ${buyerId} | Price $${result.price.toFixed(2)} | Buyer pays $${result.buyerPays.toFixed(2)} | Seller nets $${result.sellerNet.toFixed(2)} | Vault +$${result.houseTake.toFixed(2)} — ${trackingNumber}`);

      res.json({
        success: true,
        ...result,
        portalName: portal?.portalName,
        songTitle: portal?.songTitle,
        trackingNumber,
        cashtag,
        cashAppUrl: `https://cash.app/$AITITRADEBROKERAGE/${result.buyerPays.toFixed(2)}`,
        message: `PORTAL SEAT ACQUIRED — "${portal?.songTitle}" @ $${result.price.toFixed(2)}. You pay $${result.buyerPays.toFixed(2)} (incl. 2% fee). Seller receives $${result.sellerNet.toFixed(2)}. Send to ${cashtag}.`,
      });
    } catch (e: any) {
      if (e.message === "OFFER_GONE") return res.status(410).json({ message: "This seat was just bought by someone else." });
      if (e.message === "SELF_BUY") return res.status(400).json({ message: "Cannot buy your own listed seat." });
      if (e.message === "ALREADY_IN_PORTAL") return res.status(400).json({ message: "You already own a seat in this portal." });
      console.error("[PORTAL P2P BUY] Error:", e);
      res.status(500).json({ message: "Failed to buy seat" });
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // P2P EXCHANGE AUDIT — verifies Buyer 2% + Seller 2% = 4% to Vault
  // ═══════════════════════════════════════════════════════════════
  app.get("/api/audit/p2p/:txId", async (req, res) => {
    try {
      const txId = parseInt(req.params.txId);
      const [tx] = await db.select().from(p2pTrades).where(eq(p2pTrades.id, txId));
      if (!tx) return res.status(404).json({ ok: false, error: "TRADE_NOT_FOUND" });

      const salePrice = parseFloat(tx.salePrice);
      const houseFeeCollected = parseFloat(tx.houseFeeCollected);
      const expected = parseFloat((salePrice * 0.04).toFixed(2));
      const drift = parseFloat((houseFeeCollected - expected).toFixed(2));

      if (Math.abs(drift) >= 0.01) {
        return res.status(409).json({
          ok: false,
          error: "FEE CALCULATION ERROR: Double-dip not enforced.",
          tx, expected, actual: houseFeeCollected, drift,
        });
      }

      const message = `P2P Sync Verified: Asset ${tx.assetId} moved to New Owner. Vault +${tx.houseFeeCollected}`;
      console.log(`[P2P AUDIT] ${message}`);
      res.json({
        ok: true,
        verified: true,
        message,
        tx,
        math: {
          salePrice, expected, actual: houseFeeCollected, drift,
          buyerFee: parseFloat(tx.buyerFee),
          sellerFee: parseFloat(tx.sellerFee),
          buyerPays: parseFloat(tx.buyerPays),
          sellerNet: parseFloat(tx.sellerNet),
        },
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // DUAL-TRACK CRYPTO BRIDGE — BSC (BEP-20) USDC / USDT / BNB
  //   Manual Lane (≥$50)  — Founder wallet display + tx-hash + admin verify
  //   Auto Lane   (<$50)  — NOWPayments invoice + IPN webhook
  // ════════════════════════════════════════════════════════════════════
  const CRYPTO_MANUAL_THRESHOLD = 50;
  const FOUNDER_BSC_WALLET = process.env.FOUNDER_BSC_WALLET || "0x0000000000000000000000000000000000000000";
  const SUPPORTED_COINS = ["USDC", "USDT", "BNB"] as const;
  const COIN_META: Record<string, { contract: string | null; decimals: number; label: string }> = {
    USDC: { contract: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", decimals: 18, label: "USD Coin (BEP-20)" },
    USDT: { contract: "0x55d398326f99059ff775485246999027b3197955", decimals: 18, label: "Tether (BEP-20)" },
    BNB:  { contract: null, decimals: 18, label: "Build and Build (Native BSC Gas)" },
  };

  // Public coin manifest — used by frontend selector
  app.get("/api/crypto/manifest", (_req, res) => {
    res.json({
      coins: SUPPORTED_COINS.map(c => ({ symbol: c, ...COIN_META[c] })),
      chain: "BNB Smart Chain (BEP-20)",
      manualThreshold: CRYPTO_MANUAL_THRESHOLD,
      walletAddress: FOUNDER_BSC_WALLET,
      walletConfigured: FOUNDER_BSC_WALLET !== "0x0000000000000000000000000000000000000000",
      autoEnabled: !!process.env.NOWPAYMENTS_API_KEY,
      warning: "SEND ONLY VIA BNB SMART CHAIN (BEP-20). Sending via Ethereum or other chains will result in permanent loss of funds.",
    });
  });

  // ── FULFILLMENT — translates a settled crypto payment into the actual asset transfer
  async function fulfillCryptoSettlement(payment: any): Promise<{ fulfilled: boolean; detail: string }> {
    const { id: paymentId, purpose, referenceId, userId, userEmail, amountUsd } = payment;
    const amt = parseFloat(amountUsd);
    if (!purpose) return { fulfilled: false, detail: "no purpose" };

    if (purpose === "portal_entry") {
      const portalId = referenceId;
      if (!portalId) return { fulfilled: false, detail: "missing portal referenceId" };
      const [portal] = await db.select().from(globalInvestorPortals).where(eq(globalInvestorPortals.id, portalId));
      if (!portal) return { fulfilled: false, detail: `portal ${portalId} not found` };

      const existing = await db.select().from(globalInvestorEntries)
        .where(and(eq(globalInvestorEntries.portalId, portalId), eq(globalInvestorEntries.userId, userId)));

      if (existing.length === 0) {
        if ((portal.currentInvestors || 0) >= (portal.maxInvestors || 10)) {
          return { fulfilled: false, detail: "portal full — refund manually" };
        }
        const user = await storage.getUser(userId);
        const displayName = user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : (user?.email || userEmail || "INVESTOR").split("@")[0];
        await db.insert(globalInvestorEntries).values({
          portalId, userId, userEmail: user?.email || userEmail || "",
          displayName: displayName.toUpperCase(), cashTag: user?.cashTag || "",
          status: "ACTIVE", downPaymentPaid: amt >= 25, totalPaid: amt.toFixed(2), monthsPaid: 1,
        });
        await db.update(globalInvestorPortals)
          .set({ currentInvestors: sql`COALESCE(current_investors, 0) + 1` })
          .where(eq(globalInvestorPortals.id, portalId));
        const updatedCount = (portal.currentInvestors || 0) + 1;
        if (updatedCount >= (portal.maxInvestors || 10)) {
          await db.update(globalInvestorPortals).set({ status: "FILLED" }).where(eq(globalInvestorPortals.id, portalId));
        }
        return { fulfilled: true, detail: `Portal seat granted in "${portal.songTitle}" — $${amt.toFixed(2)} crypto` };
      } else {
        const entry = existing[0];
        const newTotal = parseFloat(entry.totalPaid || "0") + amt;
        await db.update(globalInvestorEntries).set({
          totalPaid: newTotal.toFixed(2),
          downPaymentPaid: !entry.downPaymentPaid && amt >= 25 ? true : entry.downPaymentPaid,
          monthsPaid: (entry.monthsPaid || 0) + 1,
          status: "ACTIVE",
        }).where(eq(globalInvestorEntries.id, entry.id));
        return { fulfilled: true, detail: `Portal payment +$${amt.toFixed(2)} → totalPaid $${newTotal.toFixed(2)}` };
      }
    }

    if (purpose === "portal_resale") {
      const offerId = referenceId;
      if (!offerId) return { fulfilled: false, detail: "missing resale referenceId" };
      const trackingNumber = `PRT-CRYPTO-${Date.now().toString(36).toUpperCase()}`;
      try {
        const result = await db.transaction(async (tx) => {
          const [offer] = await tx.select().from(globalInvestorEntries)
            .where(and(eq(globalInvestorEntries.id, offerId), eq(globalInvestorEntries.listedForResale, true)))
            .for("update");
          if (!offer) throw new Error("OFFER_GONE");
          if (offer.userId === userId) throw new Error("SELF_BUY");
          const dup = await tx.select().from(globalInvestorEntries)
            .where(and(eq(globalInvestorEntries.portalId, offer.portalId), eq(globalInvestorEntries.userId, userId)));
          if (dup.length > 0) throw new Error("ALREADY_IN_PORTAL");

          const price = parseFloat(offer.askPrice || "0");
          const buyerFee = parseFloat((price * 0.02).toFixed(2));
          const sellerFee = parseFloat((price * 0.02).toFixed(2));
          const houseTake = parseFloat((buyerFee + sellerFee).toFixed(2));
          const buyerPays = parseFloat((price + buyerFee).toFixed(2));
          const sellerNet = parseFloat((price - sellerFee).toFixed(2));

          const buyer = await storage.getUser(userId);
          const buyerName = buyer?.firstName ? `${buyer.firstName}${buyer.lastName ? ' ' + buyer.lastName : ''}` : (buyer?.email || userEmail || "INVESTOR").split("@")[0];

          await tx.update(globalInvestorEntries).set({
            userId, userEmail: buyer?.email || userEmail || "",
            displayName: buyerName.toUpperCase(), cashTag: buyer?.cashTag || "",
            listedForResale: false, askPrice: null, listedAt: null,
          }).where(eq(globalInvestorEntries.id, offer.id));

          await tx.insert(p2pTrades).values({
            assetType: "PORTAL_SEAT", assetId: offer.id, assetLabel: offer.portalId,
            sellerId: offer.userId || "UNKNOWN", buyerId: userId,
            salePrice: price.toFixed(2), buyerFee: buyerFee.toFixed(2),
            sellerFee: sellerFee.toFixed(2), houseFeeCollected: houseTake.toFixed(2),
            buyerPays: buyerPays.toFixed(2), sellerNet: sellerNet.toFixed(2),
            trackingNumber, verified: Math.abs(houseTake - price * 0.04) < 0.01,
          });
          return { offer, price, houseTake };
        });
        await depositToVaultExternal(result.houseTake, `Crypto P2P: portal seat | Vault double-dip 4% on $${result.price.toFixed(2)}`, null, "PORTAL_P2P_FEE_CRYPTO");
        return { fulfilled: true, detail: `Portal seat ownership transferred via crypto — Vault +$${result.houseTake.toFixed(2)}` };
      } catch (e: any) {
        return { fulfilled: false, detail: `resale-fulfill: ${e.message}` };
      }
    }

    return { fulfilled: false, detail: `purpose "${purpose}" fulfillment not yet implemented` };
  }

  // Initiate — routes to manual or auto lane based on amount
  app.post("/api/crypto/initiate", async (req, res) => {
    try {
      const userId = (req as any).user?.claims?.sub || req.body.userId;
      const userEmail = (req as any).user?.claims?.email || req.body.userEmail || null;
      const { amountUsd, coin, purpose, referenceId } = req.body;
      if (!userId) return res.status(401).json({ error: "Authentication required" });
      if (!SUPPORTED_COINS.includes(coin)) return res.status(400).json({ error: "Unsupported coin. Use USDC, USDT, or BNB on BSC." });
      const amt = parseFloat(String(amountUsd));
      if (!isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Invalid amount" });
      if (!purpose) return res.status(400).json({ error: "purpose required (portal_entry|portal_resale|floor_trade|music_stock)" });

      const lane = amt >= CRYPTO_MANUAL_THRESHOLD ? "manual" : "auto";

      if (lane === "manual") {
        const [row] = await db.insert(cryptoPayments).values({
          userId, userEmail, purpose, referenceId: referenceId || null,
          amountUsd: amt.toFixed(2), coin, chain: "BSC", lane: "manual",
          walletAddress: FOUNDER_BSC_WALLET, status: "awaiting_payment",
        }).returning();
        return res.json({
          ok: true, lane: "manual", paymentId: row.id,
          wallet: FOUNDER_BSC_WALLET, coin, amountUsd: amt,
          chain: "BNB Smart Chain (BEP-20)",
          contract: COIN_META[coin].contract,
          warning: "SEND ONLY VIA BNB SMART CHAIN (BEP-20). Other chains = permanent loss.",
          instruction: `Send exactly $${amt.toFixed(2)} of ${coin} to the address above, then paste your Transaction Hash below.`,
        });
      }

      // AUTO LANE — NOWPayments
      if (!process.env.NOWPAYMENTS_API_KEY) {
        // Graceful fallback: if processor not yet configured, still create a manual record
        const [row] = await db.insert(cryptoPayments).values({
          userId, userEmail, purpose, referenceId: referenceId || null,
          amountUsd: amt.toFixed(2), coin, chain: "BSC", lane: "manual",
          walletAddress: FOUNDER_BSC_WALLET, status: "awaiting_payment",
        }).returning();
        return res.json({
          ok: true, lane: "manual", paymentId: row.id, fallback: true,
          wallet: FOUNDER_BSC_WALLET, coin, amountUsd: amt,
          chain: "BNB Smart Chain (BEP-20)",
          contract: COIN_META[coin].contract,
          notice: "Auto processor not configured — routed to manual verification.",
        });
      }

      const payCurrency = coin === "BNB" ? "bnbbsc" : (coin === "USDC" ? "usdcbsc" : "usdtbsc");
      const npRes = await fetch("https://api.nowpayments.io/v1/invoice", {
        method: "POST",
        headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          price_amount: amt, price_currency: "usd", pay_currency: payCurrency,
          order_id: `${purpose}-${Date.now()}`,
          order_description: `AITITRADE ${purpose} ${referenceId || ""}`.trim(),
          ipn_callback_url: `${req.protocol}://${req.get("host")}/api/crypto/webhook/nowpayments`,
        }),
      });
      if (!npRes.ok) {
        const errText = await npRes.text();
        return res.status(502).json({ error: "NOWPayments invoice failed", detail: errText });
      }
      const invoice: any = await npRes.json();
      const [row] = await db.insert(cryptoPayments).values({
        userId, userEmail, purpose, referenceId: referenceId || null,
        amountUsd: amt.toFixed(2), coin, chain: "BSC", lane: "auto",
        nowPaymentsId: String(invoice.id || invoice.invoice_id || ""),
        status: "awaiting_payment",
      }).returning();
      return res.json({ ok: true, lane: "auto", paymentId: row.id, invoiceUrl: invoice.invoice_url, nowPaymentsId: row.nowPaymentsId });
    } catch (e: any) {
      console.error("[CRYPTO] initiate error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Manual: user submits tx hash → status=awaiting_admin
  app.post("/api/crypto/submit-hash", async (req, res) => {
    try {
      const { paymentId, txHash } = req.body;
      if (!paymentId || !txHash) return res.status(400).json({ error: "paymentId and txHash required" });
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return res.status(400).json({ error: "Invalid BSC transaction hash format (must be 0x + 64 hex chars)" });
      const [row] = await db.update(cryptoPayments)
        .set({ txHash, status: "awaiting_admin" })
        .where(and(eq(cryptoPayments.id, paymentId), eq(cryptoPayments.lane, "manual")))
        .returning();
      if (!row) return res.status(404).json({ error: "Payment not found" });
      res.json({ ok: true, paymentId: row.id, status: row.status, bscScanUrl: `https://bscscan.com/tx/${txHash}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin verify — settles a manual crypto payment AND fulfills the asset
  app.post("/api/crypto/admin/verify/:id", isAdmin, async (req: any, res) => {
    try {
      const adminEmail = req.user?.claims?.email;
      const id = parseInt(req.params.id);
      const [row] = await db.update(cryptoPayments)
        .set({ status: "settled", verifiedAt: new Date(), verifiedBy: adminEmail || "admin" })
        .where(and(eq(cryptoPayments.id, id), eq(cryptoPayments.status, "awaiting_admin")))
        .returning();
      if (!row) return res.status(404).json({ error: "Payment not found or not awaiting verification" });
      const fulfilled = await fulfillCryptoSettlement(row);
      console.log(`[CRYPTO][ADMIN] #${id} settled by ${adminEmail} — fulfillment: ${fulfilled.detail}`);
      res.json({ ok: true, payment: row, fulfillment: fulfilled });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // NOWPayments IPN webhook — verifies HMAC signature, auto-settles, then fulfills
  app.post("/api/crypto/webhook/nowpayments", async (req, res) => {
    try {
      // Signature verification per NOWPayments IPN spec (HMAC-SHA512 of sorted JSON body)
      const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
      if (ipnSecret) {
        const sig = req.headers["x-nowpayments-sig"] as string | undefined;
        if (!sig) return res.status(401).json({ error: "missing x-nowpayments-sig" });
        const crypto = await import("crypto");
        const sortedBody = JSON.stringify(req.body, Object.keys(req.body).sort());
        const expected = crypto.createHmac("sha512", ipnSecret).update(sortedBody).digest("hex");
        if (sig !== expected) {
          console.warn("[CRYPTO][WEBHOOK] Invalid signature — rejected");
          return res.status(401).json({ error: "invalid signature" });
        }
      } else {
        console.warn("[CRYPTO][WEBHOOK] NOWPAYMENTS_IPN_SECRET not configured — webhook accepted WITHOUT signature verification (dev only)");
      }

      const { payment_status, invoice_id, payment_id, pay_address } = req.body || {};
      const npId = String(invoice_id || payment_id || "");
      if (!npId) return res.status(400).json({ error: "missing id" });
      if (["finished", "confirmed", "sending"].includes(String(payment_status))) {
        const [row] = await db.update(cryptoPayments)
          .set({
            status: "settled",
            verifiedAt: new Date(),
            verifiedBy: "nowpayments-webhook",
            walletAddress: pay_address || null,
          })
          .where(and(eq(cryptoPayments.nowPaymentsId, npId), eq(cryptoPayments.status, "awaiting_payment")))
          .returning();
        if (row) {
          const fulfilled = await fulfillCryptoSettlement(row);
          console.log(`[CRYPTO][AUTO] Webhook settled #${row.id} (${npId}) — fulfillment: ${fulfilled.detail}`);
        } else {
          console.log(`[CRYPTO][AUTO] Webhook ${npId} — no matching pending row`);
        }
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[CRYPTO][WEBHOOK]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Admin queue — pending manual verifications
  app.get("/api/crypto/admin/pending", isAdmin, async (_req, res) => {
    const pending = await db.select().from(cryptoPayments).where(eq(cryptoPayments.status, "awaiting_admin")).orderBy(desc(cryptoPayments.createdAt));
    res.json(pending);
  });

  // User's own crypto payment history
  app.get("/api/crypto/my-payments", async (req, res) => {
    const userId = (req as any).user?.claims?.sub || (req.query.userId as string);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const rows = await db.select().from(cryptoPayments).where(eq(cryptoPayments.userId, userId)).orderBy(desc(cryptoPayments.createdAt));
    res.json(rows);
  });

  // Universal Gross Intake breakdown — Floor + P2P + Portal Primary
  app.get("/api/audit/intake", async (_req, res) => {
    try {
      const { getMarketIntakeBreakdown } = await import("./market-governor");
      const breakdown = await getMarketIntakeBreakdown();
      const cyclePct = parseFloat(((breakdown.total % 1000) / 10).toFixed(2));
      const remainingToNextK = parseFloat((1000 - (breakdown.total % 1000)).toFixed(2));
      const cyclesCompleted = Math.floor(breakdown.total / 1000);
      res.json({
        ok: true,
        streams: {
          floorIntake: breakdown.floorIntake,
          p2pIntake: breakdown.p2pIntake,
          portalIntake: breakdown.portalIntake,
          cryptoIntake: breakdown.cryptoIntake,
        },
        total: breakdown.total,
        cycle: { cyclesCompleted, cyclePct, remainingToNextK, nextKAt: (cyclesCompleted + 1) * 1000 },
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/audit/p2p", async (_req, res) => {
    try {
      const trades = await db.select().from(p2pTrades).orderBy(desc(p2pTrades.createdAt));
      let passed = 0, failed = 0;
      const breaches: any[] = [];
      for (const t of trades) {
        const sp = parseFloat(t.salePrice);
        const expected = parseFloat((sp * 0.04).toFixed(2));
        const actual = parseFloat(t.houseFeeCollected);
        if (Math.abs(actual - expected) < 0.01) passed++;
        else { failed++; breaches.push({ id: t.id, expected, actual, drift: actual - expected }); }
      }
      res.json({
        ok: failed === 0,
        totalTrades: trades.length,
        passed, failed, breaches,
        totalVaultGain: trades.reduce((s, t) => s + parseFloat(t.houseFeeCollected), 0).toFixed(2),
        totalVolume: trades.reduce((s, t) => s + parseFloat(t.salePrice), 0).toFixed(2),
        trades,
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get("/api/admin/investor-portals", isAdmin, async (_req: any, res) => {
    try {
      const portals = await db.select().from(globalInvestorPortals).orderBy(asc(globalInvestorPortals.createdAt));
      const entries = await db.select().from(globalInvestorEntries);
      const result = portals.map(p => ({
        ...p,
        investors: entries.filter(e => e.portalId === p.id),
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to load portals" });
    }
  });

  return httpServer;
}
