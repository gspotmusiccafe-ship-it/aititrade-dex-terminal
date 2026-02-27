# AITIFY MUSIC

A Spotify-like music streaming platform with exclusive early access for premium members. Artists can upload their music and set pre-release dates, giving premium subscribers access to new releases 2 weeks before they go public.

## Overview

AITIFY MUSIC is a full-stack music streaming application built with:
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)

## Key Features

### For Listeners
- Browse and stream music from various artists
- Create and manage playlists
- Like tracks and follow artists
- Search for tracks, albums, and artists
- Premium membership for early access to pre-release content

### For Artists
- Artist Portal to manage profile and content
- Upload tracks with genre and metadata
- Set tracks as pre-release (Premium members only)
- View play counts and engagement

### Membership Tiers
- **Free**: Stream public releases, create playlists
- **Premium**: 2-week early access to releases, lossless audio, offline downloads
- **Artist Pro**: All Premium features + unlimited uploads, analytics

### Admin Portal
- **Dashboard**: Platform analytics (total users, artists, tracks, plays, revenue)
- **User Management**: View, suspend/unsuspend, make admin, delete users
- **Artist Management**: View all artists, approve/reject applications
- **Content Moderation**: Remove tracks/videos that violate guidelines
- **Membership Management**: View all subscriptions

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and context
├── uploads/                # Uploaded audio files (served via /uploads/:filename)
├── server/                 # Express backend
│   ├── routes.ts          # API endpoints (includes multer file upload + protected audio serving)
│   ├── storage.ts         # Database operations
│   ├── db.ts              # Database connection
│   └── seed.ts            # Demo data seeding
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Drizzle schema definitions
```

## Database Schema

- **users**: User accounts (managed by Replit Auth)
- **sessions**: Session storage for auth
- **artists**: Artist profiles linked to users
- **albums**: Music albums with release dates
- **tracks**: Individual songs with streaming URLs
- **videos**: Music video content
- **playlists**: User-created playlists
- **memberships**: User subscription tiers
- **likedTracks**: User's liked songs
- **followedArtists**: User's followed artists

## API Endpoints

### Public
- `GET /api/tracks/featured` - Trending tracks
- `GET /api/tracks/prerelease` - Early access tracks
- `GET /api/albums/new` - New releases
- `GET /api/artists/top` - Popular artists
- `GET /api/artists/:id` - Artist details
- `GET /api/search?q=query` - Search content

### Authenticated
- `GET /api/user/artist-profile` - User's artist profile
- `POST /api/artists` - Create artist profile
- `POST /api/tracks` - Upload new track
- `GET /api/playlists` - User's playlists
- `GET /api/user/liked-tracks` - Liked songs
- `GET /api/user/followed-artists` - Followed artists

### Admin (requires isAdmin=true)
- `GET /api/admin/check` - Check if user is admin
- `GET /api/admin/analytics` - Platform statistics
- `GET /api/admin/users` - All users list
- `PATCH /api/admin/users/:id/suspend` - Suspend/unsuspend user
- `PATCH /api/admin/users/:id/admin` - Toggle admin status
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/artists` - All artists
- `GET /api/admin/artists/pending` - Pending artist applications
- `PATCH /api/admin/artists/:id/approve` - Approve artist
- `PATCH /api/admin/artists/:id/reject` - Reject artist
- `DELETE /api/admin/artists/:id` - Delete artist
- `DELETE /api/admin/tracks/:id` - Remove track (moderation)
- `DELETE /api/admin/videos/:id` - Remove video (moderation)
- `GET /api/admin/memberships` - All memberships

## Theme

The app uses a dark-mode-first design with a green accent color (similar to Spotify's brand aesthetic). Theme colors are configured in:
- `client/src/index.css` - CSS custom properties
- `tailwind.config.ts` - Tailwind color configuration

## Running the Project

The app runs on port 5000 with a single command:
```bash
npm run dev
```

This starts both the Express API server and Vite development server.

## Development Notes

- Authentication is handled by Replit Auth - no custom login forms needed
- Database migrations: `npm run db:push`
- Demo data is automatically seeded on first startup
- The music player context manages global playback state
- To make a user an admin: Run `UPDATE users SET is_admin = true WHERE id = 'user-id';` in the database
