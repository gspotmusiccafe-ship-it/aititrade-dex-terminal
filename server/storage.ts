import {
  artists,
  albums,
  tracks,
  videos,
  memberships,
  playlists,
  playlistTracks,
  likedTracks,
  followedArtists,
  recentlyPlayed,
  users,
  distributionRequests,
  lyricsRequests,
  masteringRequests,
  type Artist,
  type InsertArtist,
  type Album,
  type InsertAlbum,
  type Track,
  type InsertTrack,
  type Video,
  type InsertVideo,
  type Membership,
  type InsertMembership,
  type Playlist,
  type InsertPlaylist,
  type TrackWithArtist,
  type AlbumWithArtist,
  type User,
  type DistributionRequest,
  type InsertDistributionRequest,
  type LyricsRequest,
  type InsertLyricsRequest,
  type MasteringRequest,
  type InsertMasteringRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, sql, count } from "drizzle-orm";

export interface IStorage {
  // Artists
  getArtist(id: string): Promise<Artist | undefined>;
  getArtistByUserId(userId: string): Promise<Artist | undefined>;
  createArtist(artist: InsertArtist): Promise<Artist>;
  updateArtist(id: string, data: Partial<InsertArtist>): Promise<Artist | undefined>;
  getTopArtists(limit?: number): Promise<Artist[]>;
  searchArtists(query: string): Promise<Artist[]>;
  getArtistTracks(artistId: string): Promise<TrackWithArtist[]>;
  getArtistAlbums(artistId: string): Promise<AlbumWithArtist[]>;
  
  // Albums
  getAlbum(id: string): Promise<AlbumWithArtist | undefined>;
  createAlbum(album: InsertAlbum): Promise<Album>;
  getNewReleases(limit?: number): Promise<AlbumWithArtist[]>;
  searchAlbums(query: string): Promise<AlbumWithArtist[]>;
  
  // Tracks
  getTrack(id: string): Promise<TrackWithArtist | undefined>;
  createTrack(track: InsertTrack): Promise<Track>;
  getFeaturedTracks(limit?: number): Promise<TrackWithArtist[]>;
  getPrereleaseTracks(limit?: number): Promise<TrackWithArtist[]>;
  searchTracks(query: string): Promise<TrackWithArtist[]>;
  incrementPlayCount(trackId: string): Promise<void>;
  
  // Playlists
  getPlaylist(id: string): Promise<Playlist | undefined>;
  getUserPlaylists(userId: string): Promise<Playlist[]>;
  createPlaylist(playlist: InsertPlaylist): Promise<Playlist>;
  getPlaylistTracks(playlistId: string): Promise<TrackWithArtist[]>;
  addTrackToPlaylist(playlistId: string, trackId: string): Promise<void>;
  removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void>;
  
  // User interactions
  likeTrack(userId: string, trackId: string): Promise<void>;
  unlikeTrack(userId: string, trackId: string): Promise<void>;
  getLikedTracks(userId: string): Promise<TrackWithArtist[]>;
  getLikedTracksCount(userId: string): Promise<number>;
  isTrackLiked(userId: string, trackId: string): Promise<boolean>;
  
  followArtist(userId: string, artistId: string): Promise<void>;
  unfollowArtist(userId: string, artistId: string): Promise<void>;
  getFollowedArtists(userId: string): Promise<Artist[]>;
  isFollowingArtist(userId: string, artistId: string): Promise<boolean>;
  
  // Memberships
  getUserMembership(userId: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined>;
  
  // Videos
  getVideo(videoId: string): Promise<Video | undefined>;
  getArtistVideos(artistId: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  
  // Admin operations
  isUserAdmin(userId: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUser(userId: string): Promise<User | undefined>;
  updateUser(userId: string, data: { isSuspended?: boolean; isAdmin?: boolean }): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  getAllArtists(): Promise<Artist[]>;
  getPendingArtists(): Promise<Artist[]>;
  approveArtist(artistId: string): Promise<Artist | undefined>;
  rejectArtist(artistId: string, reason: string): Promise<Artist | undefined>;
  deleteArtist(artistId: string): Promise<void>;
  deleteTrack(trackId: string): Promise<void>;
  deleteVideo(videoId: string): Promise<void>;
  getAllMemberships(): Promise<(Membership & { user?: User })[]>;
  // Distribution Requests
  createDistributionRequest(request: InsertDistributionRequest): Promise<DistributionRequest>;
  getDistributionRequestsByUser(userId: string): Promise<DistributionRequest[]>;
  getAllDistributionRequests(): Promise<DistributionRequest[]>;
  getPendingDistributionRequests(): Promise<DistributionRequest[]>;
  updateDistributionRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<DistributionRequest | undefined>;
  // Lyrics Requests
  createLyricsRequest(request: InsertLyricsRequest): Promise<LyricsRequest>;
  getLyricsRequestsByUser(userId: string): Promise<LyricsRequest[]>;
  getAllLyricsRequests(): Promise<LyricsRequest[]>;
  updateLyricsRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<LyricsRequest | undefined>;
  // Mastering Requests
  createMasteringRequest(request: InsertMasteringRequest): Promise<MasteringRequest>;
  getMasteringRequestsByUser(userId: string): Promise<MasteringRequest[]>;
  getAllMasteringRequests(): Promise<MasteringRequest[]>;
  updateMasteringRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<MasteringRequest | undefined>;
  
  getAnalytics(): Promise<{
    totalUsers: number;
    totalArtists: number;
    totalTracks: number;
    totalPlays: number;
    premiumMembers: number;
    goldMembers: number;
    totalAlbums: number;
    totalVideos: number;
    totalPlaylists: number;
    estimatedRevenue: number;
    topTracks: { title: string; artistName: string; playCount: number }[];
    topArtists: { name: string; monthlyListeners: number; trackCount: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Artists
  async getArtist(id: string): Promise<Artist | undefined> {
    const [artist] = await db.select().from(artists).where(eq(artists.id, id));
    return artist || undefined;
  }

  async getArtistByUserId(userId: string): Promise<Artist | undefined> {
    const [artist] = await db.select().from(artists).where(eq(artists.userId, userId));
    return artist || undefined;
  }

  async createArtist(artist: InsertArtist): Promise<Artist> {
    const [newArtist] = await db.insert(artists).values(artist).returning();
    return newArtist;
  }

  async updateArtist(id: string, data: Partial<InsertArtist>): Promise<Artist | undefined> {
    const [updated] = await db.update(artists).set(data).where(eq(artists.id, id)).returning();
    return updated || undefined;
  }

  async getTopArtists(limit = 10): Promise<Artist[]> {
    return db.select().from(artists).orderBy(desc(artists.monthlyListeners)).limit(limit);
  }

  async searchArtists(query: string): Promise<Artist[]> {
    return db.select().from(artists).where(ilike(artists.name, `%${query}%`)).limit(20);
  }

  async getArtistTracks(artistId: string): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(tracks.artistId, artistId))
      .orderBy(desc(tracks.playCount));
    
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async getArtistAlbums(artistId: string): Promise<AlbumWithArtist[]> {
    const result = await db
      .select()
      .from(albums)
      .innerJoin(artists, eq(albums.artistId, artists.id))
      .where(eq(albums.artistId, artistId))
      .orderBy(desc(albums.releaseDate));
    
    return result.map(r => ({ ...r.albums, artist: r.artists }));
  }

  // Albums
  async getAlbum(id: string): Promise<AlbumWithArtist | undefined> {
    const [result] = await db
      .select()
      .from(albums)
      .innerJoin(artists, eq(albums.artistId, artists.id))
      .where(eq(albums.id, id));
    
    if (!result) return undefined;
    return { ...result.albums, artist: result.artists };
  }

  async createAlbum(album: InsertAlbum): Promise<Album> {
    const [newAlbum] = await db.insert(albums).values(album).returning();
    return newAlbum;
  }

  async getNewReleases(limit = 10): Promise<AlbumWithArtist[]> {
    const result = await db
      .select()
      .from(albums)
      .innerJoin(artists, eq(albums.artistId, artists.id))
      .orderBy(desc(albums.releaseDate))
      .limit(limit);
    
    return result.map(r => ({ ...r.albums, artist: r.artists }));
  }

  async searchAlbums(query: string): Promise<AlbumWithArtist[]> {
    const result = await db
      .select()
      .from(albums)
      .innerJoin(artists, eq(albums.artistId, artists.id))
      .where(ilike(albums.title, `%${query}%`))
      .limit(20);
    
    return result.map(r => ({ ...r.albums, artist: r.artists }));
  }

  // Tracks
  async getTrack(id: string): Promise<TrackWithArtist | undefined> {
    const [result] = await db
      .select()
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(tracks.id, id));
    
    if (!result) return undefined;
    return { ...result.tracks, artist: result.artists };
  }

  async createTrack(track: InsertTrack): Promise<Track> {
    const [newTrack] = await db.insert(tracks).values(track).returning();
    return newTrack;
  }

  async getFeaturedTracks(limit = 20): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(tracks.isPrerelease, false))
      .orderBy(desc(tracks.playCount))
      .limit(limit);
    
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async getPrereleaseTracks(limit = 10): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(tracks.isPrerelease, true))
      .orderBy(desc(tracks.createdAt))
      .limit(limit);
    
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async searchTracks(query: string): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(
        or(
          ilike(tracks.title, `%${query}%`),
          ilike(artists.name, `%${query}%`)
        )
      )
      .limit(20);
    
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async incrementPlayCount(trackId: string): Promise<void> {
    await db
      .update(tracks)
      .set({ playCount: sql`${tracks.playCount} + 1` })
      .where(eq(tracks.id, trackId));
  }

  // Playlists
  async getPlaylist(id: string): Promise<Playlist | undefined> {
    const [playlist] = await db.select().from(playlists).where(eq(playlists.id, id));
    return playlist || undefined;
  }

  async getUserPlaylists(userId: string): Promise<Playlist[]> {
    return db.select().from(playlists).where(eq(playlists.userId, userId));
  }

  async createPlaylist(playlist: InsertPlaylist): Promise<Playlist> {
    const [newPlaylist] = await db.insert(playlists).values(playlist).returning();
    return newPlaylist;
  }

  async getPlaylistTracks(playlistId: string): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.position);
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const [maxPos] = await db
      .select({ max: sql<number>`coalesce(max(${playlistTracks.position}), -1)` })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));
    await db.insert(playlistTracks).values({
      playlistId,
      trackId,
      position: (maxPos?.max ?? -1) + 1,
    });
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await db
      .delete(playlistTracks)
      .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)));
  }

  // User interactions
  async likeTrack(userId: string, trackId: string): Promise<void> {
    await db.insert(likedTracks).values({ userId, trackId }).onConflictDoNothing();
  }

  async unlikeTrack(userId: string, trackId: string): Promise<void> {
    await db
      .delete(likedTracks)
      .where(and(eq(likedTracks.userId, userId), eq(likedTracks.trackId, trackId)));
  }

  async getLikedTracks(userId: string): Promise<TrackWithArtist[]> {
    const result = await db
      .select()
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.trackId, tracks.id))
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .where(eq(likedTracks.userId, userId))
      .orderBy(desc(likedTracks.likedAt));
    
    return result.map(r => ({ ...r.tracks, artist: r.artists }));
  }

  async getLikedTracksCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(likedTracks)
      .where(eq(likedTracks.userId, userId));
    return result?.count || 0;
  }

  async isTrackLiked(userId: string, trackId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(likedTracks)
      .where(and(eq(likedTracks.userId, userId), eq(likedTracks.trackId, trackId)));
    return !!result;
  }

  async followArtist(userId: string, artistId: string): Promise<void> {
    await db.insert(followedArtists).values({ userId, artistId }).onConflictDoNothing();
  }

  async unfollowArtist(userId: string, artistId: string): Promise<void> {
    await db
      .delete(followedArtists)
      .where(and(eq(followedArtists.userId, userId), eq(followedArtists.artistId, artistId)));
  }

  async getFollowedArtists(userId: string): Promise<Artist[]> {
    const result = await db
      .select()
      .from(followedArtists)
      .innerJoin(artists, eq(followedArtists.artistId, artists.id))
      .where(eq(followedArtists.userId, userId))
      .orderBy(desc(followedArtists.followedAt));
    
    return result.map(r => r.artists);
  }

  async isFollowingArtist(userId: string, artistId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(followedArtists)
      .where(and(eq(followedArtists.userId, userId), eq(followedArtists.artistId, artistId)));
    return !!result;
  }

  // Memberships
  async getUserMembership(userId: string): Promise<Membership | undefined> {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)));
    return membership || undefined;
  }

  async createMembership(membership: InsertMembership): Promise<Membership> {
    const [newMembership] = await db.insert(memberships).values(membership).returning();
    return newMembership;
  }

  async updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined> {
    const [updated] = await db.update(memberships).set(data).where(eq(memberships.id, id)).returning();
    return updated || undefined;
  }

  // Videos
  async getVideo(videoId: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    return video;
  }

  async getArtistVideos(artistId: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.artistId, artistId)).orderBy(desc(videos.createdAt));
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  // Admin operations
  async isUserAdmin(userId: string): Promise<boolean> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user?.isAdmin === true;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUser(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user || undefined;
  }

  async updateUser(userId: string, data: { isSuspended?: boolean; isAdmin?: boolean }): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
    return updated || undefined;
  }

  async deleteUser(userId: string): Promise<void> {
    // Delete user's related data first
    // Get user's playlists first to delete playlist tracks
    const userPlaylists = await db.select().from(playlists).where(eq(playlists.userId, userId));
    for (const playlist of userPlaylists) {
      await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id));
    }
    await db.delete(likedTracks).where(eq(likedTracks.userId, userId));
    await db.delete(followedArtists).where(eq(followedArtists.userId, userId));
    await db.delete(playlists).where(eq(playlists.userId, userId));
    await db.delete(memberships).where(eq(memberships.userId, userId));
    await db.delete(recentlyPlayed).where(eq(recentlyPlayed.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async getAllArtists(): Promise<Artist[]> {
    return db.select().from(artists).orderBy(desc(artists.createdAt));
  }

  async getPendingArtists(): Promise<Artist[]> {
    return db.select().from(artists).where(eq(artists.approvalStatus, "pending")).orderBy(desc(artists.createdAt));
  }

  async approveArtist(artistId: string): Promise<Artist | undefined> {
    const [updated] = await db.update(artists).set({ approvalStatus: "approved" }).where(eq(artists.id, artistId)).returning();
    return updated || undefined;
  }

  async rejectArtist(artistId: string, reason: string): Promise<Artist | undefined> {
    const [updated] = await db.update(artists).set({ approvalStatus: "rejected", rejectionReason: reason }).where(eq(artists.id, artistId)).returning();
    return updated || undefined;
  }

  async deleteArtist(artistId: string): Promise<void> {
    // Delete artist's content first, handling all references
    // Get all tracks by this artist
    const artistTracks = await db.select().from(tracks).where(eq(tracks.artistId, artistId));
    // Delete references to artist's tracks
    for (const track of artistTracks) {
      await db.delete(likedTracks).where(eq(likedTracks.trackId, track.id));
      await db.delete(playlistTracks).where(eq(playlistTracks.trackId, track.id));
      await db.delete(recentlyPlayed).where(eq(recentlyPlayed.trackId, track.id));
    }
    // Now safe to delete tracks
    await db.delete(tracks).where(eq(tracks.artistId, artistId));
    await db.delete(videos).where(eq(videos.artistId, artistId));
    await db.delete(albums).where(eq(albums.artistId, artistId));
    await db.delete(followedArtists).where(eq(followedArtists.artistId, artistId));
    await db.delete(artists).where(eq(artists.id, artistId));
  }

  async deleteTrack(trackId: string): Promise<void> {
    await db.delete(likedTracks).where(eq(likedTracks.trackId, trackId));
    await db.delete(playlistTracks).where(eq(playlistTracks.trackId, trackId));
    await db.delete(recentlyPlayed).where(eq(recentlyPlayed.trackId, trackId));
    await db.delete(tracks).where(eq(tracks.id, trackId));
  }

  async deleteVideo(videoId: string): Promise<void> {
    await db.delete(videos).where(eq(videos.id, videoId));
  }

  async getAllMemberships(): Promise<(Membership & { user?: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .leftJoin(users, eq(memberships.userId, users.id))
      .orderBy(desc(memberships.createdAt));
    
    return result.map(r => ({
      ...r.memberships,
      user: r.users || undefined,
    }));
  }

  async getAnalytics(): Promise<{
    totalUsers: number;
    totalArtists: number;
    totalTracks: number;
    totalPlays: number;
    premiumMembers: number;
    goldMembers: number;
    totalAlbums: number;
    totalVideos: number;
    totalPlaylists: number;
    estimatedRevenue: number;
    topTracks: { title: string; artistName: string; playCount: number }[];
    topArtists: { name: string; monthlyListeners: number; trackCount: number }[];
  }> {
    const [userCount] = await db.select({ count: count() }).from(users);
    const [artistCount] = await db.select({ count: count() }).from(artists);
    const [trackCount] = await db.select({ count: count() }).from(tracks);
    const [playSum] = await db.select({ sum: sql<number>`COALESCE(SUM(play_count), 0)` }).from(tracks);
    const [silverCount] = await db.select({ count: count() }).from(memberships).where(and(eq(memberships.tier, "silver"), eq(memberships.isActive, true)));
    const [bronzeCount] = await db.select({ count: count() }).from(memberships).where(and(eq(memberships.tier, "bronze"), eq(memberships.isActive, true)));
    const [goldCount] = await db.select({ count: count() }).from(memberships).where(and(eq(memberships.tier, "gold"), eq(memberships.isActive, true)));
    const paidMemberCount = (silverCount?.count || 0) + (bronzeCount?.count || 0) + (goldCount?.count || 0);
    const [albumCount] = await db.select({ count: count() }).from(albums);
    const [videoCount] = await db.select({ count: count() }).from(videos);
    const [playlistCount] = await db.select({ count: count() }).from(playlists);

    const topTracksData = await db.select({
      title: tracks.title,
      artistName: artists.name,
      playCount: tracks.playCount,
    }).from(tracks)
      .innerJoin(artists, eq(tracks.artistId, artists.id))
      .orderBy(desc(tracks.playCount))
      .limit(5);

    const topArtistsData = await db.select({
      name: artists.name,
      monthlyListeners: artists.monthlyListeners,
      trackCount: sql<number>`CAST(COUNT(${tracks.id}) AS INTEGER)`,
    }).from(artists)
      .leftJoin(tracks, eq(artists.id, tracks.artistId))
      .groupBy(artists.id, artists.name, artists.monthlyListeners)
      .orderBy(desc(artists.monthlyListeners))
      .limit(5);

    const silverRevenue = (silverCount?.count || 0) * 1.99;
    const bronzeRevenue = (bronzeCount?.count || 0) * 3.99;
    const goldRevenue = (goldCount?.count || 0) * 6.99;

    return {
      totalUsers: userCount?.count || 0,
      totalArtists: artistCount?.count || 0,
      totalTracks: trackCount?.count || 0,
      totalPlays: Number(playSum?.sum) || 0,
      premiumMembers: paidMemberCount,
      goldMembers: goldCount?.count || 0,
      totalAlbums: albumCount?.count || 0,
      totalVideos: videoCount?.count || 0,
      totalPlaylists: playlistCount?.count || 0,
      estimatedRevenue: Math.round((silverRevenue + bronzeRevenue + goldRevenue) * 100) / 100,
      topTracks: topTracksData.map(t => ({ title: t.title, artistName: t.artistName, playCount: t.playCount || 0 })),
      topArtists: topArtistsData.map(a => ({ name: a.name, monthlyListeners: a.monthlyListeners || 0, trackCount: a.trackCount })),
    };
  }

  async createDistributionRequest(request: InsertDistributionRequest): Promise<DistributionRequest> {
    const [result] = await db.insert(distributionRequests).values(request).returning();
    return result;
  }

  async getDistributionRequestsByUser(userId: string): Promise<DistributionRequest[]> {
    return db.select().from(distributionRequests).where(eq(distributionRequests.userId, userId)).orderBy(desc(distributionRequests.createdAt));
  }

  async getAllDistributionRequests(): Promise<DistributionRequest[]> {
    return db.select().from(distributionRequests).orderBy(desc(distributionRequests.createdAt));
  }

  async getPendingDistributionRequests(): Promise<DistributionRequest[]> {
    return db.select().from(distributionRequests).where(eq(distributionRequests.status, "pending")).orderBy(desc(distributionRequests.createdAt));
  }

  async updateDistributionRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<DistributionRequest | undefined> {
    const [result] = await db.update(distributionRequests).set(data).where(eq(distributionRequests.id, id)).returning();
    return result;
  }

  async createLyricsRequest(request: InsertLyricsRequest): Promise<LyricsRequest> {
    const [result] = await db.insert(lyricsRequests).values(request).returning();
    return result;
  }

  async getLyricsRequestsByUser(userId: string): Promise<LyricsRequest[]> {
    return db.select().from(lyricsRequests).where(eq(lyricsRequests.userId, userId)).orderBy(desc(lyricsRequests.createdAt));
  }

  async getAllLyricsRequests(): Promise<LyricsRequest[]> {
    return db.select().from(lyricsRequests).orderBy(desc(lyricsRequests.createdAt));
  }

  async updateLyricsRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<LyricsRequest | undefined> {
    const [result] = await db.update(lyricsRequests).set(data).where(eq(lyricsRequests.id, id)).returning();
    return result;
  }

  async createMasteringRequest(request: InsertMasteringRequest): Promise<MasteringRequest> {
    const [result] = await db.insert(masteringRequests).values(request).returning();
    return result;
  }

  async getMasteringRequestsByUser(userId: string): Promise<MasteringRequest[]> {
    return db.select().from(masteringRequests).where(eq(masteringRequests.userId, userId)).orderBy(desc(masteringRequests.createdAt));
  }

  async getAllMasteringRequests(): Promise<MasteringRequest[]> {
    return db.select().from(masteringRequests).orderBy(desc(masteringRequests.createdAt));
  }

  async updateMasteringRequest(id: string, data: { status?: string; adminNotes?: string }): Promise<MasteringRequest | undefined> {
    const [result] = await db.update(masteringRequests).set(data).where(eq(masteringRequests.id, id)).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
