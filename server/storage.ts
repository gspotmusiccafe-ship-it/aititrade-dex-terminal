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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";

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
  
  // User interactions
  likeTrack(userId: string, trackId: string): Promise<void>;
  unlikeTrack(userId: string, trackId: string): Promise<void>;
  getLikedTracks(userId: string): Promise<TrackWithArtist[]>;
  getLikedTracksCount(userId: string): Promise<number>;
  isTrackLiked(userId: string, trackId: string): Promise<boolean>;
  
  followArtist(userId: string, artistId: string): Promise<void>;
  unfollowArtist(userId: string, artistId: string): Promise<void>;
  getFollowedArtists(userId: string): Promise<Artist[]>;
  
  // Memberships
  getUserMembership(userId: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: string, data: Partial<InsertMembership>): Promise<Membership | undefined>;
  
  // Videos
  getArtistVideos(artistId: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
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
  async getArtistVideos(artistId: string): Promise<Video[]> {
    return db.select().from(videos).where(eq(videos.artistId, artistId)).orderBy(desc(videos.createdAt));
  }

  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }
}

export const storage = new DatabaseStorage();
