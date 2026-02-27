import { db } from "./db";
import { artists, albums, tracks } from "@shared/schema";

export async function seedDatabase() {
  try {
    // Check if data already exists
    const existingArtists = await db.select().from(artists).limit(1);
    if (existingArtists.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    console.log("Seeding database with demo data...");

    // Create demo artists
    const [artist1] = await db.insert(artists).values({
      userId: "demo-user-1",
      name: "Nova Sound",
      bio: "Electronic music producer pushing the boundaries of synth-wave and ambient soundscapes.",
      verified: true,
      monthlyListeners: 125000,
    }).returning();

    const [artist2] = await db.insert(artists).values({
      userId: "demo-user-2",
      name: "The Midnight Echo",
      bio: "Indie rock band from Los Angeles bringing nostalgic vibes with modern production.",
      verified: true,
      monthlyListeners: 89000,
    }).returning();

    const [artist3] = await db.insert(artists).values({
      userId: "demo-user-3",
      name: "Crystal Waves",
      bio: "R&B and soul artist with smooth vocals and heartfelt lyrics.",
      verified: false,
      monthlyListeners: 45000,
    }).returning();

    const [artist4] = await db.insert(artists).values({
      userId: "demo-user-4",
      name: "Pulse Theory",
      bio: "High-energy EDM duo known for festival anthems and club bangers.",
      verified: true,
      monthlyListeners: 230000,
    }).returning();

    const [artist5] = await db.insert(artists).values({
      userId: "demo-user-5",
      name: "Velvet Dreams",
      bio: "Jazz-influenced neo-soul collective exploring the depths of modern groove.",
      verified: false,
      monthlyListeners: 67000,
    }).returning();

    // Create albums
    const [album1] = await db.insert(albums).values({
      artistId: artist1.id,
      title: "Synthetic Horizons",
      releaseDate: new Date("2024-01-15"),
      isPrerelease: false,
    }).returning();

    const [album2] = await db.insert(albums).values({
      artistId: artist2.id,
      title: "Neon Memories",
      releaseDate: new Date("2024-02-20"),
      isPrerelease: false,
    }).returning();

    const [album3] = await db.insert(albums).values({
      artistId: artist4.id,
      title: "Electric Future",
      releaseDate: new Date("2024-03-10"),
      isPrerelease: true,
    }).returning();

    // Create tracks
    const demoTracks = [
      // Nova Sound tracks
      { artistId: artist1.id, albumId: album1.id, title: "Digital Dawn", duration: 245, audioUrl: "/uploads/demo-audio.wav", playCount: 125000, genre: "Electronic", isPrerelease: false },
      { artistId: artist1.id, albumId: album1.id, title: "Neon Streets", duration: 198, audioUrl: "/uploads/demo-audio.wav", playCount: 98000, genre: "Electronic", isPrerelease: false },
      { artistId: artist1.id, albumId: album1.id, title: "Midnight Protocol", duration: 312, audioUrl: "/uploads/demo-audio.wav", playCount: 76000, genre: "Electronic", isPrerelease: false },
      { artistId: artist1.id, title: "Future Echoes", duration: 267, audioUrl: "/uploads/demo-audio.wav", playCount: 45000, genre: "Electronic", isPrerelease: true },

      // The Midnight Echo tracks
      { artistId: artist2.id, albumId: album2.id, title: "Sunset Boulevard", duration: 234, audioUrl: "/uploads/demo-audio.wav", playCount: 89000, genre: "Indie Rock", isPrerelease: false },
      { artistId: artist2.id, albumId: album2.id, title: "Lost in California", duration: 278, audioUrl: "/uploads/demo-audio.wav", playCount: 67000, genre: "Indie Rock", isPrerelease: false },
      { artistId: artist2.id, title: "Ocean Waves", duration: 195, audioUrl: "/uploads/demo-audio.wav", playCount: 52000, genre: "Indie Rock", isPrerelease: true },

      // Crystal Waves tracks
      { artistId: artist3.id, title: "Velvet Touch", duration: 218, audioUrl: "/uploads/demo-audio.wav", playCount: 45000, genre: "R&B", isPrerelease: false },
      { artistId: artist3.id, title: "Starlight Serenade", duration: 256, audioUrl: "/uploads/demo-audio.wav", playCount: 38000, genre: "R&B", isPrerelease: false },
      { artistId: artist3.id, title: "Golden Hour", duration: 289, audioUrl: "/uploads/demo-audio.wav", playCount: 29000, genre: "R&B", isPrerelease: true },

      // Pulse Theory tracks
      { artistId: artist4.id, albumId: album3.id, title: "Drop Zone", duration: 187, audioUrl: "/uploads/demo-audio.wav", playCount: 230000, genre: "EDM", isPrerelease: false },
      { artistId: artist4.id, albumId: album3.id, title: "Bass Cannon", duration: 205, audioUrl: "/uploads/demo-audio.wav", playCount: 189000, genre: "EDM", isPrerelease: false },
      { artistId: artist4.id, albumId: album3.id, title: "Festival Anthem", duration: 241, audioUrl: "/uploads/demo-audio.wav", playCount: 156000, genre: "EDM", isPrerelease: true },

      // Velvet Dreams tracks
      { artistId: artist5.id, title: "Smooth Operator", duration: 298, audioUrl: "/uploads/demo-audio.wav", playCount: 67000, genre: "Jazz", isPrerelease: false },
      { artistId: artist5.id, title: "Midnight Jazz", duration: 345, audioUrl: "/uploads/demo-audio.wav", playCount: 54000, genre: "Jazz", isPrerelease: false },
    ];

    await db.insert(tracks).values(demoTracks);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
