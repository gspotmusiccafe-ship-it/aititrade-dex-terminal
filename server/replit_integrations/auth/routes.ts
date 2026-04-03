import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        ...user,
        password: undefined,
        hasPassword: !!user.password,
        spotifyProduct: req.user.spotify_product || null,
        spotifyConnected: user.spotifyConnected || !!req.user.access_token,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/update-cashtag", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cashTag } = req.body;
      if (!cashTag || !cashTag.trim()) {
        return res.status(400).json({ message: "Cash App tag is required" });
      }
      const cleanTag = cashTag.trim().startsWith("$") ? cashTag.trim() : `$${cashTag.trim()}`;
      const { db } = await import("../../db");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      await db.update(users).set({ cashTag: cleanTag }).where(eq(users.id, userId));
      res.json({ success: true, cashTag: cleanTag });
    } catch (error) {
      console.error("Error updating cash tag:", error);
      res.status(500).json({ message: "Failed to update Cash App tag" });
    }
  });
}
