# AITITRADE DIGITAL ASSET EXCHANGE

## Overview

AITITRADE DIGITAL ASSET EXCHANGE is the world's first all-AI music digital asset exchange, offering premium subscribers early access to trade AI-generated music assets. It's a full-stack application designed to host AI artists, manage their content, and provide a rich trading and streaming experience. The platform establishes a new market for AI-generated music assets, enabling artists to upload, distribute, and monetize their creations, while offering traders exclusive early access. Key features include asset trading, music streaming, playlist management, artist interaction, premium subscriptions, and an Artist Portal with AI-powered lyrics generation and audio mastering. The business vision is to create a dynamic marketplace for AI-generated assets, fostering a new ecosystem for AI artists and investors. Native radio is **97.7 THE FLAME**, global radio is **97.7 THE FLAME GLOBAL**.

## User Preferences

I want to be communicated with using clear and concise language.
I prefer an iterative development approach, with regular updates and feedback opportunities.
Please ask for my confirmation before implementing any major changes or architectural decisions.
Ensure that the codebase remains clean, well-documented, and follows best practices.
Focus on delivering robust and scalable solutions.

## System Architecture

The application utilizes a full-stack architecture with a focus on a dark-mode first UI/UX.

-   **Frontend**: React + TypeScript with Vite, styled using Tailwind CSS and shadcn/ui components. The design aesthetic is inspired by Spotify, featuring a dark theme with a green accent color.
-   **Backend**: Express.js with TypeScript for API services.
-   **Database**: PostgreSQL, managed with Drizzle ORM.
-   **Authentication**: Primary authentication via email/password, with optional Spotify OAuth 2.0 integration for enhanced features.
-   **Payments**: Cash App ($AITITRADEBROKERAGE) handles ALL transactions — asset trading via `/api/exchange/trade` and account activation ($25 down + $19.79/mo). PayPal used only for artist tipping.
-   **Access Control**: Single-tier model — users must be Sovereign Trust members (checked via `/api/trust/status`) to access the exchange. No free/minter/entry_trader tiers. PremiumGate checks trust membership.

**Key Features & Technical Implementations:**

-   **Trade Portal System**: Six trade portals with dynamic pool ceilings: STANDARD ($2 TBI, 300% MBB, $1K floor), MICRO_700 ($5 TBI, 335% MBB, $700 floor), MID_2K ($10 TBI, 375% MBB, $2K floor), PRO_20 ($20 TBI, $2K floor), PRO_30 ($30 TBI, $3K floor), HIGH_50 ($50 TBI, $5K floor). Each portal defines TBI (Trade Buy-In), MBB (Max Buy-Back multiplier), Early (early exit multiplier), and pool ceiling. Portal assignment is based on asset price via `getPortalForPrice()`. Early exit endpoint (`POST /api/exchange/early-exit`) pays user at the early rate and routes the remainder to house treasury. $2 minimum trade enforced. Portal config API at `GET /api/exchange/portals`, treasury stats at `GET /api/exchange/treasury`.
-   **Sovereign Exchange / Trading Floor**: A Bloomberg Terminal-style interface (emerald-on-black) where music tracks are presented as tradeable assets. Each asset card displays market data, sales, unit price, yield, and capacity. Pool ceilings are dynamic per portal ($700-$5K).
-   **Digital Order System**: Allows users to "ACQUIRE POSITION" on tracks, generating a Digital Tracking Number as proof of ownership. Orders are atomically recorded, incrementing `salesCount`. A digital receipt modal provides proof of ownership, AI model details, and transaction specifics. Asset ownership is ledger-based, with no direct downloads.
-   **AI Data Tags**: Tracks include an `ai_model` identifier (default: `AITIFY-GEN-1`), displayed on all receipt certificates.
-   **Release Types**: `native` (lime green, $1K cap, no royalties, shown on front page/radio) and `global` (bold gold, royalty-bearing, exclusive to Asset Trustees). Native assets receive MNT-977-xxx IDs; Global assets receive TRST-977-xxx IDs. `/api/tracks/featured` and `/api/autopilot/pool` filter for native assets, while `/api/tracks/trust-vault` serves global assets to trustees.
-   **Global Royalty Split**: A dynamic royalty engine routes Global asset royalties to a Trust Vault based on volatility. After a 16% Minter Fee, the remaining revenue is split: volatility ≥ 40 → 50%, volatility 30-39 → 42%, volatility 15-29 → 42%, volatility < 15 → 18% to the Trust Vault.
-   **Trust Vault**: A dedicated page for Asset Trustees displaying global yield assets, a royalty pool dashboard, and an embedded **Global Radio** component.
- **Global Radio (Spotify Web Playback SDK)**: `client/src/components/GlobalRadio.tsx` embedded on the **Landing Page** (free users) and **Home/Front Page** (alongside 97.7 The Flame). **Dual Turntable DJ Console UI** with Deck A/Deck B turntable platters (spinning vinyl animation), VU meters (L/R), crossfader, and Bloomberg-style lime-on-black aesthetic. Uses `Spotify.Player` Web Playback SDK — loads `sdk.scdn.co/spotify-player.js`, creates browser-based device "AITIFY Global Radio", calls `PUT /me/player/play` with `context_uri`. Rotation managed via **self-service admin panel** (`Global Radio` tab in Admin → `global_rotation` DB table). Public API `GET /api/global-rotation` feeds the DJ Console; admin CRUD at `POST/PUT/DELETE /api/admin/global-rotation`. Falls back to `client/src/lib/global-rotation.json` when DB rotation is empty. 30s heartbeat verifies SDK `player.getCurrentState()` — checks `!paused` AND `context.uri` match before logging `SPOTIFY_STREAM` to Trust Sheet. Shows Spotify logo, "SPOTIFY VERIFIED STREAMING" badge, volume control, heartbeat log. `GET /api/spotify/token` provides fresh access token.
-   **YouTube Video Support**: Native player (`player-context.tsx`, `music-player.tsx`) detects YouTube URLs in track `audioUrl` fields. When a YouTube URL is detected: (1) HTML5 audio playback is skipped (no broken audio attempts), (2) video icon appears in player bar to toggle YouTube embed panel, (3) queue advance/prev/next all safely handle YouTube tracks. `extractYouTubeId()` parses watch, embed, and short URL formats.
-   **Trust Certificate (TRST-977)**: Downloadable certificate for trustees, displaying unique identifier, holder name, AI Model, financial terms, Minter Credit schedule, and live Current Trust Valuation. Exportable as PNG or PDF.
-   **Asset Classes**: Tracks can be `standard` (emerald styling) or `inspirational` (violet styling with higher yield bands).
-   **Autopilot Radio**: A DJ console feature that automatically queues high-velocity assets from the pool, prioritizing 2-week pre-release tracks. CEOs can save priority rotations.
-   **2-Week Early Trading Edge**: Pre-release assets are tradeable two weeks before general retail distribution, incentivizing early adoption.
-   **Production Terminal**: Full asset production & distribution console at `/production`. Integrates Suno v3.5 ($0.35/track) for audio generation, Ideogram v2 ($0.03/image) for artwork, and direct-push pipeline ($0.38 total wholesale) to list assets on the trading floor. Shows ledger status, 54/46 split breakdown, and pipeline status tracking.
-   **CEO CLASS — 12-Step Business Credit Program**: An interactive checklist on the dashboard guiding users through business credit development steps, with progress tracking.
-   **PremiumGate Access Control**: A core component (`PremiumGate`) restricts access to most in-app routes to premium users only, ensuring paid content exclusivity.
-   **Artist Portal**: Provides artists with tools for profile management, track uploads, pre-release scheduling, AI Lyrics Generation (using OpenAI), and Audio Mastering (using ffmpeg).
-   **Admin Portal**: A comprehensive dashboard for analytics, user/artist/content management, radio playlist oversight, and Spotify royalty tracking.
-   **JAM Console**: A Bloomberg Terminal-reskinned page for radio and jam sessions, featuring Spotify remote controls and live session management.
-   **Google Sheets Logging Hook**: Logs Radio Stats & Market Engagement data (track completions, heartbeats, market events) to Google Sheets via webhooks for analytics and royalty auditing.
-   **Continuous Broadcast Engine**: An automated system for Global Radio, featuring polling for track ends, time-based show switching, ad-bridge auto-resumes, market-only feeds, and background persistence of music playback.
-   **Market Intelligence Module (Living Market Engine)**: An autonomous "CEO Hands-Off" system for managing market dynamics. It uses a "Fill-to-Close" model where pools close when cumulative buy-ins reach $1,000. Dynamic pricing and fluctuating buy-back rates are core to this system, with a fixed 16% Minter Fee and a paper trade cap.
-   **File Storage**: All uploaded media (audio, images) are stored in Replit Object Storage (GCS-backed) for persistence, accessed via a `/cloud/uploads/` route.

## External Dependencies

-   **Vite**: Frontend build tool.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn/ui**: UI component library.
-   **Express.js**: Backend web application framework.
-   **PostgreSQL**: Relational database.
-   **Drizzle ORM**: TypeScript ORM.
-   **OpenAI API**: For AI Lyrics Generator.
-   **FFmpeg**: For Audio Mastering Engine.
-   **Cash App**: For asset trade payments ($AITITRADEBROKERAGE).
-   **PayPal Web SDK**: For subscription and tipping payment processing.
-   **Spotify OAuth 2.0 API**: For authentication and Spotify features.
-   **Replit Object Storage (GCS-backed)**: Cloud storage for media files.
-   **html-to-image**: For client-side image exports.
-   **Replit Auth**: For primary user authentication.