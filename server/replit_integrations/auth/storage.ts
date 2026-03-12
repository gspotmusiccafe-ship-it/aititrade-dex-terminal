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
    const existingById = await db.select().from(users).where(eq(users.id, userData.id!));
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
        .where(eq(users.id, userData.id!))
        .returning();
      return updated;
    }

    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0) {
        const oldId = existingByEmail[0].id;
        const newId = userData.id!;

        await db.execute(sql`UPDATE artists SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE memberships SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE playlists SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE liked_tracks SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE followed_artists SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE spotify_tokens SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE tips SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE lyrics_requests SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE mastering_requests SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE distribution_requests SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE jam_sessions SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE jam_session_engagement SET user_id = ${newId} WHERE user_id = ${oldId}`);
        await db.execute(sql`UPDATE jam_session_listeners SET user_id = ${newId} WHERE user_id = ${oldId}`);

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
