import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const artists = pgTable("artists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  bio: text("bio"),
  profileImage: text("profile_image"),
  coverImage: text("cover_image"),
  verified: boolean("verified").default(false),
  monthlyListeners: integer("monthly_listeners").default(0),
  approvalStatus: varchar("approval_status").default("pending"),
  rejectionReason: text("rejection_reason"),
  spotifyProfileUrl: text("spotify_profile_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const albums = pgTable("albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull().references(() => artists.id),
  title: varchar("title").notNull(),
  coverImage: text("cover_image"),
  releaseDate: timestamp("release_date"),
  isPrerelease: boolean("is_prerelease").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tracks = pgTable("tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull().references(() => artists.id),
  albumId: varchar("album_id").references(() => albums.id),
  title: varchar("title").notNull(),
  duration: integer("duration").notNull(),
  audioUrl: text("audio_url").notNull(),
  coverImage: text("cover_image"),
  playCount: integer("play_count").default(0),
  isPrerelease: boolean("is_prerelease").default(false),
  releaseDate: timestamp("release_date"),
  genre: varchar("genre"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull().references(() => artists.id),
  title: varchar("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").notNull(),
  viewCount: integer("view_count").default(0),
  isPrerelease: boolean("is_prerelease").default(false),
  releaseDate: timestamp("release_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  tier: varchar("tier").notNull().default("free"),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  downloadsUsed: integer("downloads_used").default(0),
  previewsUsed: integer("previews_used").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlistTracks = pgTable("playlist_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playlistId: varchar("playlist_id").notNull().references(() => playlists.id),
  trackId: varchar("track_id").notNull().references(() => tracks.id),
  position: integer("position").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const likedTracks = pgTable("liked_tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  trackId: varchar("track_id").notNull().references(() => tracks.id),
  likedAt: timestamp("liked_at").defaultNow(),
});

export const followedArtists = pgTable("followed_artists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  artistId: varchar("artist_id").notNull().references(() => artists.id),
  followedAt: timestamp("followed_at").defaultNow(),
});

export const recentlyPlayed = pgTable("recently_played", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  trackId: varchar("track_id").notNull().references(() => tracks.id),
  playedAt: timestamp("played_at").defaultNow(),
});

export const jamSessions = pgTable("jam_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  spotifyUri: text("spotify_uri").notNull(),
  spotifyName: text("spotify_name"),
  spotifyType: varchar("spotify_type").default("track"),
  scheduledTime: varchar("scheduled_time").notNull(),
  daysOfWeek: text("days_of_week").notNull().default("0,1,2,3,4,5,6"),
  isActive: boolean("is_active").default(true),
  lastTriggered: timestamp("last_triggered"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jamSessionEngagement = pgTable("jam_session_engagement", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  action: varchar("action").notNull(),
  trackName: text("track_name"),
  trackArtist: text("track_artist"),
  spotifyUri: text("spotify_uri"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jamSessionListeners = pgTable("jam_session_listeners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: varchar("user_name"),
  userEmail: varchar("user_email"),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

export const radioShows = pgTable("radio_shows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slot: varchar("slot").notNull(),
  spotifyPlaylistUrl: text("spotify_playlist_url").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const distributionRequests = pgTable("distribution_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull(),
  userId: varchar("user_id").notNull(),
  trackId: varchar("track_id"),
  status: varchar("status").default("pending"),
  message: text("message"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lyricsRequests = pgTable("lyrics_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  lyrics: text("lyrics").notNull(),
  genre: varchar("genre"),
  notes: text("notes"),
  status: varchar("status").default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const masteringRequests = pgTable("mastering_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull(),
  userId: varchar("user_id").notNull(),
  trackId: varchar("track_id").notNull(),
  notes: text("notes"),
  status: varchar("status").default("pending"),
  adminNotes: text("admin_notes"),
  masteredUrl: text("mastered_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const spotifyTokens = pgTable("spotify_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  spotifyUserId: varchar("spotify_user_id"),
  spotifyDisplayName: varchar("spotify_display_name"),
  spotifyEmail: varchar("spotify_email"),
  spotifyProduct: varchar("spotify_product"),
  spotifyImage: text("spotify_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const artistsRelations = relations(artists, ({ many }) => ({
  tracks: many(tracks),
  albums: many(albums),
  videos: many(videos),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  artist: one(artists, { fields: [albums.artistId], references: [artists.id] }),
  tracks: many(tracks),
}));

export const tracksRelations = relations(tracks, ({ one }) => ({
  artist: one(artists, { fields: [tracks.artistId], references: [artists.id] }),
  album: one(albums, { fields: [tracks.albumId], references: [albums.id] }),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  artist: one(artists, { fields: [videos.artistId], references: [artists.id] }),
}));

export const tips = pgTable("tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  artistId: varchar("artist_id").notNull().references(() => artists.id),
  userId: varchar("user_id").notNull(),
  amount: varchar("amount").notNull(),
  message: text("message"),
  paypalOrderId: varchar("paypal_order_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playlistsRelations = relations(playlists, ({ many }) => ({
  tracks: many(playlistTracks),
}));

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistTracks.playlistId], references: [playlists.id] }),
  track: one(tracks, { fields: [playlistTracks.trackId], references: [tracks.id] }),
}));

// Insert schemas
export const insertArtistSchema = createInsertSchema(artists).omit({ id: true, createdAt: true });
export const insertAlbumSchema = createInsertSchema(albums).omit({ id: true, createdAt: true });
export const insertTrackSchema = createInsertSchema(tracks).omit({ id: true, createdAt: true, playCount: true });
export const insertVideoSchema = createInsertSchema(videos).omit({ id: true, createdAt: true, viewCount: true });
export const insertMembershipSchema = createInsertSchema(memberships).omit({ id: true, createdAt: true });
export const insertPlaylistSchema = createInsertSchema(playlists).omit({ id: true, createdAt: true });
export const insertPlaylistTrackSchema = createInsertSchema(playlistTracks).omit({ id: true, addedAt: true });
export const insertLikedTrackSchema = createInsertSchema(likedTracks).omit({ id: true, likedAt: true });
export const insertFollowedArtistSchema = createInsertSchema(followedArtists).omit({ id: true, followedAt: true });
export const insertRadioShowSchema = createInsertSchema(radioShows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJamSessionSchema = createInsertSchema(jamSessions).omit({ id: true, createdAt: true, lastTriggered: true });
export const insertJamSessionEngagementSchema = createInsertSchema(jamSessionEngagement).omit({ id: true, createdAt: true });
export const insertJamSessionListenerSchema = createInsertSchema(jamSessionListeners).omit({ id: true, joinedAt: true, leftAt: true });
export const insertDistributionRequestSchema = createInsertSchema(distributionRequests).omit({ id: true, createdAt: true });
export const insertLyricsRequestSchema = createInsertSchema(lyricsRequests).omit({ id: true, createdAt: true });
export const insertMasteringRequestSchema = createInsertSchema(masteringRequests).omit({ id: true, createdAt: true });
export const insertTipSchema = createInsertSchema(tips).omit({ id: true, createdAt: true });

// Types
export type InsertArtist = z.infer<typeof insertArtistSchema>;
export type Artist = typeof artists.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type Album = typeof albums.$inferSelect;
export type InsertTrack = z.infer<typeof insertTrackSchema>;
export type Track = typeof tracks.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlists.$inferSelect;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type LikedTrack = typeof likedTracks.$inferSelect;
export type FollowedArtist = typeof followedArtists.$inferSelect;
export type InsertRadioShow = z.infer<typeof insertRadioShowSchema>;
export type RadioShow = typeof radioShows.$inferSelect;
export type InsertJamSession = z.infer<typeof insertJamSessionSchema>;
export type JamSession = typeof jamSessions.$inferSelect;
export type InsertJamSessionEngagement = z.infer<typeof insertJamSessionEngagementSchema>;
export type JamSessionEngagement = typeof jamSessionEngagement.$inferSelect;
export type InsertJamSessionListener = z.infer<typeof insertJamSessionListenerSchema>;
export type JamSessionListener = typeof jamSessionListeners.$inferSelect;
export type InsertDistributionRequest = z.infer<typeof insertDistributionRequestSchema>;
export type DistributionRequest = typeof distributionRequests.$inferSelect;
export type InsertLyricsRequest = z.infer<typeof insertLyricsRequestSchema>;
export type LyricsRequest = typeof lyricsRequests.$inferSelect;
export type InsertMasteringRequest = z.infer<typeof insertMasteringRequestSchema>;
export type MasteringRequest = typeof masteringRequests.$inferSelect;
export type InsertTip = z.infer<typeof insertTipSchema>;
export type Tip = typeof tips.$inferSelect;

// Extended types for frontend use
export type TrackWithArtist = Track & { artist: Artist };
export type AlbumWithArtist = Album & { artist: Artist };
export type ArtistWithStats = Artist & { trackCount?: number };
