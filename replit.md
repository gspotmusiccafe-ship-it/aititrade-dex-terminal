# AITIFY MUSIC RADIO

## Overview

AITIFY MUSIC RADIO is the world's first all-AI music streaming platform, designed to give premium subscribers early access to AI-generated music. It's a full-stack application built to host AI artists, manage their content, and provide a rich streaming experience for listeners. The platform aims to create a new market for AI-generated music, allowing artists to upload, distribute, and monetize their creations, while offering listeners unique, exclusive content. Key capabilities include music streaming, playlist management, artist interaction, premium subscriptions for early releases, and an Artist Portal for content management, AI-powered lyrics generation, and audio mastering.

## User Preferences

I want to be communicated with using clear and concise language.
I prefer an iterative development approach, with regular updates and feedback opportunities.
Please ask for my confirmation before implementing any major changes or architectural decisions.
Ensure that the codebase remains clean, well-documented, and follows best practices.
Focus on delivering robust and scalable solutions.

## System Architecture

The application employs a full-stack architecture:
- **Frontend**: React + TypeScript with Vite, Tailwind CSS for styling, and shadcn/ui for components. The UI/UX is dark-mode-first with a green accent color, inspired by Spotify's aesthetic.
- **Backend**: Express.js with TypeScript for API services.
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Authentication**: Primary authentication uses email/password. Optional Spotify OAuth 2.0 is integrated for enhanced Spotify-related features.
- **Payments**: PayPal Web SDK handles all payment transactions for subscriptions and artist tips.

**Key Features & Technical Implementations:**
- **Sovereign Exchange / Trading Floor**: Bloomberg Terminal-style UI (emerald-on-black, font-mono) with Asset Cards for each track. Tracks display as tradeable assets with ticker symbols, gross sales, units sold, unit price, yield, and capacity bars. $1K sales ceiling per asset with 60% capacity warnings and settlement locks at $300/15 holders.
- **Digital Order System**: "ACQUIRE POSITION" button generates a Digital Tracking Number as proof of ownership. Orders are recorded in the `orders` table with atomic transaction-based placement (race-condition-safe). Each order increments the track's `salesCount`. The Digital Photo Proof receipt modal displays "CERTIFIED AI-GENERATED ASSET" badge, OWNER ID as sole proof of ownership, AI Model/Generation ID tag, asset ticker, unit price, 16% originator credit disbursement, ledger gross, capacity %, and GSR FUND verification seal. Neural Network DNA aesthetic with emerald-on-black circuit grid background and Cpu watermark. No hard asset downloads — orders are ledger entries (paper trades).
- **AI Data Tags**: Every asset carries an `ai_model` column (default: `AITIFY-GEN-1`) in the `tracks` table. The AI Model ID is displayed on every receipt certificate.
- **Release Types (Structural Pivot)**: `native` (LIME GREEN, paper trade minting with $1K cap — shown on front page/radio) and `global` (BOLD GOLD, royalty-bearing trust vault exclusive — only accessible to Asset Trustees). Set via `release_type` column in `tracks` table. Native assets get MNT-977-xxx Mint IDs; Global assets get TRST-977-xxx Trust IDs. `/api/tracks/featured` and `/api/autopilot/pool` filter to native-only. `/api/tracks/trust-vault` returns global assets (403 for non-trustees). `/api/royalty-pool` distributes 16% of global sales to trustees proportionally. Non-trustees see "TRUST CERTIFICATE REQUIRED — $25 DOWN" gate on global cards.
- **Trust Vault**: Dedicated page at `/trust-vault` showing global yield assets exclusively for Asset Trustees. Features royalty pool dashboard (global assets count, gross sales, royalty rate, total pool, trust units, user share). Non-trustees see a locked gate redirecting to `/membership`. Sidebar link: bold gold "Trust Vault" with Globe icon.
- **Asset Classes**: `standard` (emerald styling) and `inspirational` (violet styling with yield band 30%-45%). Set via `asset_class` column in `tracks` table.
- **Autopilot Radio**: AUTOPILOT toggle in the MusicPlayer DJ console. When ON, the player automatically queues the next high-velocity asset from the pool when the current track ends, prioritizing 2-week pre-release (early) assets. Pool loaded from `/api/autopilot/pool` endpoint (sorted: prerelease first, then by play count). Global Trust Playlist (`autopilot_playlists` table) allows CEOs to save priority rotation. Player context manages `autopilot`, `autopilotPool` state and `toggleAutopilot`/`setAutopilotPool` methods.
- **2-Week Early Trading Edge**: Pre-release assets are tradeable 2 weeks before retail distribution (Spotify, Amazon, YouTube). Autopilot prioritizes these assets. Landing page hero and features section reflect this positioning. "Asset Architects" (formerly "AI Artists") mint high-velocity assets.
- **Free Tier Gating**: Front Page Investors (free tier) can see the asset ticker and market data on cards but cannot "Acquire Position" — they see a "PREMIUM TRADING ACCOUNT REQUIRED" lock linking to /membership. Only paid tiers can place orders.
- **Music Streaming**: Core functionality for browsing and playing tracks.
- **Dual-Stream Revenue Model**: Two paid streams — MINTOR (Mint Factory CEO, $9.99/mo via Bluevine, lime green, can mint & trade assets) and TRUST INVESTOR (Asset Trustee, $500 total / $25 down / 0% interest / $19.79/mo × 24 via Bluevine, bold gold, trust certificates). Users can hold BOTH statuses simultaneously (`tier` + `trustInvestor` boolean). `checkIsPremium()` in App.tsx accepts either stream as premium. Checkout URLs centralized in `client/src/lib/checkout-config.ts` (`BLUEVINE_MINT_URL`, `BLUEVINE_TRUST_URL`). Free tier = "Front Page Investor".
- **CEO CLASS — 12-Step Business Credit Program**: Full interactive checklist at `/dashboard`. Steps: (1) Entity Setup, (2) EIN/DUNS Registration, (3) Tier 1 Trade Lines, (4) Business Bank Account, (5) Credit Monitoring, (6) Tier 2 Trade Lines, (7) Business Insurance, (8) Fleet & Fuel Cards, (9) Business Credit Cards, (10) Business Line of Credit, (11) SBA Loan Readiness, (12) Credit Portfolio Optimization. Progress tracked in `credit_steps` table (per-user, status: locked/in_progress/completed). Completed = bold lime green checkmarks, In Progress = bold gold. Admin users bypass isMintor/isTrustee checks for testing. Sidebar nav: "CEO Class" link with GraduationCap icon.
- **PremiumGate Access Control**: `PremiumGate` component in App.tsx enforces tier-based access. Unauthenticated and free-tier ("Front Page Investor") users see LandingPage only. All inside-app routes (/, /search, /library, /radio, /leaderboard, /artist/:id, /admin, /artist-portal, /liked, /playlist/:id, /browse/:section) require a paid tier. `/membership` remains public for upgrades. Sidebar and header chrome only render for premium users. The `useIsPremiumUser` hook checks `/api/user/membership` to determine tier status.
- **Artist Portal**: Allows artists to manage profiles, upload tracks, set pre-release dates, and access features like an AI Lyrics Generator (using OpenAI) and an Audio Mastering Engine (utilizing ffmpeg for processing).
- **Admin Portal**: A comprehensive dashboard for platform analytics, user and artist management, content moderation, managing radio playlists (97.7 THE FLAME), radio shows, membership oversight, tracking Spotify stream qualifiers, and the Spotify Royalty Tracker (paste Spotify URLs to auto-load stream counts and track 1K qualification for royalties).
- **JAM Console**: Bloomberg Terminal-reskinned Radio & Jam Sessions page with Spotify remote controls, engagement tracking, and live session management. All Spotify mutations (play, pause, skip, shuffle, repeat) intact.
- **Distribution System**: Facilitates artists submitting music for distribution, with admin review and approval workflows.
- **Leaderboard**: Displays ranked tracks based on engagement scores, with a badging system (Bronze/Silver/Gold/Platinum) and promotional features.
- **File Storage**: All uploaded files (audio, images) are stored in Replit Object Storage (GCS-backed) for persistence and scalability. Files are uploaded via Multer, then transferred to object storage, and served via a `/cloud/uploads/` route.

## External Dependencies

- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **Express.js**: Backend web application framework.
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: TypeScript ORM for database interaction.
- **OpenAI API**: Used for the AI Lyrics Generator feature in the Artist Portal.
- **FFmpeg**: Utilized by the Audio Mastering Engine for audio processing.
- **PayPal Web SDK**: Integrated for payment processing for memberships and artist tipping.
- **Spotify OAuth 2.0 API**: For user authentication and enabling Spotify-specific features like playback controls and jam sessions.
- **Replit Object Storage (GCS-backed)**: Persistent cloud storage for all media files.
- **Replit Auth**: Manages user accounts for primary authentication.