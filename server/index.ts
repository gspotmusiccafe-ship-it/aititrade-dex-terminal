import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";

const app = express();
const httpServer = createServer(app);

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
    const [cleanupCheck] = (await db.execute(sql`SELECT COUNT(*) as cnt FROM orders WHERE unit_price::numeric < 1`)).rows as any[];
    const oldOrderCount = parseInt(cleanupCheck?.cnt || "0");
    if (oldOrderCount > 0) {
      await db.execute(sql`DELETE FROM orders WHERE unit_price::numeric < 1`);
      await db.execute(sql`UPDATE tracks SET unit_price = '1' WHERE unit_price::numeric < 1`);
      await db.execute(sql`UPDATE tracks SET sales_count = 0 WHERE sales_count > 0`);
      await db.execute(sql`UPDATE tracks SET play_count = 0 WHERE play_count > 0`);
      console.log(`[CLEANUP] Removed ${oldOrderCount} test orders, fixed prices to $1 minimum, reset counts`);
    }
  } catch (e) {
    console.error("[CLEANUP] Non-critical cleanup error:", e);
  }

  await registerRoutes(httpServer, app);

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

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
