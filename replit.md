# AITIFY MUSIC RADIO

The world's first all-AI music streaming platform. AI artists upload their music and set pre-release dates, giving premium subscribers access to new AI-generated releases 2 weeks before they hit Spotify, Amazon Music, Deezer, YouTube, and Anghami.

## Overview

AITIFY MUSIC RADIO is a full-stack music streaming application built with:
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **Payments**: PayPal Web SDK (sandbox in dev, production in deployed app)

## Key Features

### For Listeners
- Browse and stream music from various artists
- Create and manage playlists
- Like/unlike tracks and follow artists
- Add tracks to playlists from track cards or the music player
- Search for tracks, albums, and artists
- Premium membership for early access to pre-release content
- **Buy Song**: Button on track cards (store link coming soon)
- **AITIFY Music Radio**: Connect Spotify Premium and schedule automated jam sessions

### For Artists
- Artist Portal to manage profile and content
- Upload tracks with genre and metadata
- Set tracks as pre-release (Premium members only)
- View play counts and engagement

### Membership Tiers
- **Free**: Listen to released music, follow artists
- **Silver ($1.99/mo)**: Released music, follow artists, create playlists
- **Bronze ($3.99/mo)**: Released + pre-release music, playlists, videos
- **Gold ($6.99/mo)**: Artist Pro — uploads, MP3/YouTube, marketing, promotions, distribution, analytics, lossless audio
- **Artist Onboarding**: Users must subscribe to Gold ($6.99) before creating an artist profile.
- **Buy Song**: Download button replaced with "Buy Song" button for users (store link coming soon). Admin retains download in Content tab for distribution uploads.

### Distribution System
- Artists can submit "Distribute My Music" requests from the Artist Portal's Distribution tab
- Admin reviews distribution requests in the Admin Portal's Distribution tab (approve/reject with notes)
- Database table: `distributionRequests` (artistId, userId, trackId, status, message, adminNotes)

### Admin Portal
- **Dashboard**: Platform analytics (total users, artists, tracks, plays, revenue)
- **User Management**: View, suspend/unsuspend, make admin, delete users
- **Artist Management**: View all artists, approve/reject applications, create artist profiles (bypass membership)
- **Content Moderation**: Remove tracks/videos + Download tracks for distribution
- **Distribution**: Review and manage artist distribution requests
- **Membership Management**: View all subscriptions

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and context
├── uploads/                # Uploaded audio + cover image files (served via /uploads/:filename)
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
- **jamSessions**: Scheduled Spotify playback sessions
- **jamSessionEngagement**: Engagement tracking (play, save, share, like, skip actions per session)
- **jamSessionListeners**: Tracks which accounts joined/left each jam session

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
- `POST /api/tracks` - Upload new track (multipart/form-data with audioFile)
- `PATCH /api/tracks/:id` - Update own track (title, genre, prerelease)
- `DELETE /api/tracks/:id` - Delete own track (artist only)
- `GET /api/playlists/:id` - Get playlist details
- `GET /api/playlists/:id/tracks` - Get playlist tracks
- `POST /api/playlists/:id/tracks` - Add track to playlist
- `DELETE /api/playlists/:id/tracks/:trackId` - Remove track from playlist
- `GET /api/user/followed-artists/:artistId/check` - Check if following artist
- `POST /api/tracks/:id/play` - Increment play count
- `GET /api/playlists` - User's playlists
- `GET /api/user/liked-tracks` - Liked songs
- `GET /api/user/liked-tracks/:trackId/check` - Check if track is liked
- `POST /api/user/liked-tracks/:trackId` - Like a track
- `DELETE /api/user/liked-tracks/:trackId` - Unlike a track
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
- `GET /api/admin/spotify/search?q=query` - Search Spotify for tracks/artists/albums
- `GET /api/admin/spotify/track/:trackId` - Get full Spotify track details (stream count, album, artists)

### Spotify Integration (authenticated)
- `GET /api/spotify/me` - Spotify profile and Premium status
- `GET /api/spotify/player` - Current playback state
- `GET /api/spotify/devices` - Available Spotify devices
- `POST /api/spotify/play` - Start playback (uri, deviceId)
- `PUT /api/spotify/pause` - Pause playback
- `GET /api/spotify/search?q=query` - Search Spotify catalog
- `GET /api/jam-sessions` - User's scheduled jam sessions
- `POST /api/jam-sessions` - Create jam session
- `PATCH /api/jam-sessions/:id/toggle` - Toggle active/inactive
- `DELETE /api/jam-sessions/:id` - Delete jam session
- `POST /api/jam-sessions/:id/play-now` - Trigger immediate playback
- `POST /api/jam-sessions/:id/join` - Join a session (records listener)
- `POST /api/jam-sessions/:id/leave` - Leave a session
- `POST /api/jam-sessions/:id/engagement` - Record engagement action (play, save, share, like, skip, add_to_playlist)
- `GET /api/jam-sessions/:id/engagement` - Get session engagement detail (listeners, actions, top tracks, stats)
- `GET /api/jam-sessions/engagement/overview` - Get engagement overview across all user's sessions

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
