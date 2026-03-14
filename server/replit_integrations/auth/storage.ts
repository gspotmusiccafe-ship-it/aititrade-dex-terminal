import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import { spotifyTokens } from "@shared/schema";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySpotifyId(spotifyId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  markSpotifyConnected(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserBySpotifyId(spotifyId: string): Promise<User | undefined> {
    const tokens = await db.select().from(spotifyTokens).where(eq(spotifyTokens.spotifyUserId, spotifyId));
    if (tokens.length > 0) {
      const [user] = await db.select().from(users).where(eq(users.id, tokens[0].userId));
      return user;
    }
    const [user] = await db.select().from(users).where(eq(users.id, spotifyId));
    return user;
  }

  async markSpotifyConnected(userId: string): Promise<void> {
    await db.update(users).set({ spotifyConnected: true, updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.id) {
      const existingById = await db.select().from(users).where(eq(users.id, userData.id));
      if (existingById.length > 0) {
        const updateData: any = {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        };
        if (userData.email) updateData.email = userData.email;
        if (userData.spotifyConnected) updateData.spotifyConnected = true;

        const [updated] = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userData.id))
          .returning();
        return updated;
      }
    }

    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0) {
        if (userData.id && userData.id !== existingByEmail[0].id) {
          const oldId = existingByEmail[0].id;
          const newId = userData.id;
          const wasAdmin = existingByEmail[0].isAdmin;

          const migrateTables = [
            'artists', 'memberships', 'playlists', 'liked_tracks',
            'followed_artists', 'tips', 'lyrics_requests',
            'mastering_requests', 'distribution_requests',
            'jam_sessions', 'jam_session_engagement', 'jam_session_listeners'
          ];

          for (const table of migrateTables) {
            await db.execute(sql.raw(`UPDATE ${table} SET user_id = '${newId}' WHERE user_id = '${oldId}'`));
          }

          await db.execute(sql`DELETE FROM spotify_tokens WHERE user_id = ${oldId}`);
          await db.execute(sql`DELETE FROM spotify_tokens WHERE user_id = ${newId}`);

          const [updated] = await db
            .update(users)
            .set({
              id: newId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              isAdmin: wasAdmin,
              spotifyConnected: userData.spotifyConnected || false,
              updatedAt: new Date(),
            })
            .where(eq(users.id, oldId))
            .returning();
          return updated;
        }

        const [updated] = await db
          .update(users)
          .set({
            firstName: userData.firstName || existingByEmail[0].firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl || existingByEmail[0].profileImageUrl,
            spotifyConnected: userData.spotifyConnected || existingByEmail[0].spotifyConnected || false,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        return updated;
      }
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
