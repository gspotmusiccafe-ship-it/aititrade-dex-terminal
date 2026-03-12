import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const newId = userData.id!;

    const existingById = await db.select().from(users).where(eq(users.id, newId));
    if (existingById.length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, newId))
        .returning();
      return updated;
    }

    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0) {
        const oldId = existingByEmail[0].id;

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
            updatedAt: new Date(),
          })
          .where(eq(users.id, oldId))
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
