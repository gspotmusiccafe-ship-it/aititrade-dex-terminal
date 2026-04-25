import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import { seedDatabase } from "./seed";

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: "*" },
  path: "/ws",
});

export { io };

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Seed database with demo data
  await seedDatabase();
  
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const bcrypt = await import("bcryptjs");
    const [adminRow] = (await db.execute(sql`SELECT id, password FROM users WHERE id = '31bohcbsxlhgbxwskjpbai674pta'`)).rows as any[];
    if (adminRow && !adminRow.password) {
      const hashed = await bcrypt.hash("Pookie@-1970", 10);
      await db.execute(sql`UPDATE users SET password = ${hashed} WHERE id = '31bohcbsxlhgbxwskjpbai674pta'`);
      console.log("[startup] Admin password set");
    }
  } catch (e) {
    console.error("[startup] Password setup error:", e);
  }

  // One-time migration: reassign gspotmusiccafe data to Spotify account
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const oldId = "53894940";
    const newId = "31bohcbsxlhgbxwskjpbai674pta";
    const [existingOld] = (await db.execute(sql`SELECT id FROM users WHERE id = ${oldId}`)).rows;
    const [existingNew] = (await db.execute(sql`SELECT id FROM users WHERE id = ${newId}`)).rows;
    if (existingOld && existingNew) {
      const [artistCheck] = (await db.execute(sql`SELECT id FROM artists WHERE user_id = ${oldId}`)).rows;
      if (artistCheck) {
        const tables = ['artists', 'memberships', 'playlists', 'liked_tracks', 'followed_artists', 'tips', 'lyrics_requests', 'mastering_requests', 'distribution_requests', 'jam_sessions', 'jam_session_engagement', 'jam_session_listeners'];
        for (const table of tables) {
          await db.execute(sql.raw(`UPDATE ${table} SET user_id = '${newId}' WHERE user_id = '${oldId}'`));
        }
        await db.execute(sql`DELETE FROM spotify_tokens WHERE user_id = ${oldId}`);
        console.log("[migration] Reassigned all data from old account to Spotify account");
      }
    }
  } catch (e) {
    console.error("[migration] Non-critical migration error:", e);
  }

  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const validEntries = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
    await db.execute(sql`DELETE FROM settlement_queue WHERE order_id IN (SELECT id FROM orders WHERE unit_price::numeric < 1)`);
    await db.execute(sql`DELETE FROM orders WHERE unit_price::numeric < 1`);
    await db.execute(sql`UPDATE tracks SET sales_count = 0, play_count = 0`);
    const allTracks = (await db.execute(sql`SELECT id, unit_price FROM tracks`)).rows as any[];
    let fixed = 0;
    for (const t of allTracks) {
      const price = parseFloat(t.unit_price);
      if (!validEntries.includes(price)) {
        const rounded = validEntries.reduce((best, v) => Math.abs(v - price) < Math.abs(best - price) ? v : best, 1);
        await db.execute(sql`UPDATE tracks SET unit_price = ${String(rounded)} WHERE id = ${t.id}`);
        fixed++;
      }
    }
    if (fixed > 0) console.log(`[CLEANUP] Fixed ${fixed} track prices to valid entries, reset all counts`);

    const fakeOrders = (await db.execute(sql`SELECT id FROM orders WHERE buyer_email IS NULL OR buyer_email = ''`)).rows as any[];
    if (fakeOrders.length > 0) {
      const fakeIds = fakeOrders.map((o: any) => o.id);
      for (const fid of fakeIds) {
        await db.execute(sql`DELETE FROM settlement_queue WHERE order_id = ${fid}`);
        await db.execute(sql`DELETE FROM orders WHERE id = ${fid}`);
      }
      console.log(`[CLEANUP] Purged ${fakeOrders.length} fake orders (no buyer email)`);
    }

  } catch (e) {
    console.error("[CLEANUP] Non-critical cleanup error:", e);
  }

  await registerRoutes(httpServer, app);

  const { setEngineIO } = await import("./market-governor");
  setEngineIO(io);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }
const PORT = process.env.PORT || 8080;
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`AITITRADE Station Live on Port ${PORT}`);
  });
})(); // This closes the main async function and keeps the signal clean
