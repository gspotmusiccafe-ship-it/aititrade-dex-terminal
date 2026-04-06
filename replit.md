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
-   **Payments**: Cash App ($AITITRADEBROKERAGE) handles ALL transactions — asset trading via `/api/exchange/trade` and account activation ($25 down + $19.79/mo). PayPal used only for artist tipping. Cash App flow is P2P: trade creates `pending_cashapp` order with Cash App link, no money credited until admin confirms via `POST /api/admin/confirm-payment`. Admin pending payments panel in Settlement Governor tab shows all awaiting orders. Confirm triggers salesCount +1, enqueue, and settlement check atomically (conditional WHERE prevents race conditions).
-   **Access Control**: Two-tier model — (1) AuthGate: any logged-in user accesses trading floor (Home), trader portal, leaderboard. Sidebar shows only Trading Floor section + Upgrade link. (2) PremiumGate: Sovereign Trust members access Global Trades (radio), Trust Vault, CEO Class, Trust Certificate, Search, Library, Liked Songs. Sidebar shows full Sovereign Trust section. Admin sees everything. After signup/login, users redirect to `/trader` page.

**Key Features & Technical Implementations:**

-   **Trade Portal System (DB-Driven)**: Six trade portals stored in `portal_settings` table with full admin control. Default portals: STANDARD ($2 TBI, 300% MBB, $1K floor), MICRO_700 ($5 TBI, 335% MBB, $700 floor), MID_2K ($10 TBI, 375% MBB, $2K floor), PRO_20 ($20 TBI, $2K floor), PRO_30 ($30 TBI, $3K floor), HIGH_50 ($50 TBI, $5K floor). Each portal defines TBI (Trade Buy-In), MBB (Max Buy-Back multiplier), Early (early exit multiplier), and pool ceiling. Portal assignment is based on asset price via `getPortalForPrice()`. Admin can edit all portal values (TBI, MBB, Early multiplier, Pool ceiling, active/inactive) via Admin → Portals tab. Changes apply immediately to both server and frontend (30s cache with auto-refresh). API: `GET /api/exchange/portals` (public, cached), `GET /api/admin/portals` (admin CRUD), `PUT /api/admin/portals/:id` (admin update). Treasury: `GET /api/exchange/treasury`, `GET /api/admin/treasury-stats`, `POST /api/admin/treasury-withdraw`, `GET /api/admin/early-exit-ledger`. Treasury milestones fire at $100/$500/$1K/$5K/$10K/$25K/$50K/$100K.
-   **Sovereign Exchange / Trading Floor**: A Bloomberg Terminal-style interface (emerald-on-black) where music tracks are presented as tradeable assets. Each asset card displays market data, sales, unit price, yield, and capacity. Pool ceilings are dynamic per portal ($700-$5K).
-   **Digital Order System**: Allows users to "ACQUIRE POSITION" on tracks, generating a Digital Tracking Number as proof of ownership. Orders are atomically recorded, incrementing `salesCount`. A digital receipt modal provides proof of ownership, AI model details, and transaction specifics. Asset ownership is ledger-based, with no direct downloads.
-   **AI Data Tags**: Tracks include an `ai_model` identifier (default: `AITIFY-GEN-1`), displayed on all receipt certificates.
-   **Release Types**: `native` (lime green, $1K cap, no royalties, shown on front page/radio) and `global` (bold gold, royalty-bearing, exclusive to Asset Trustees). Native assets receive MNT-977-xxx IDs; Global assets receive TRST-977-xxx IDs. `/api/tracks/featured` and `/api/autopilot/pool` filter for native assets, while `/api/tracks/trust-vault` serves global assets to trustees.
-   **Global Royalty Split**: A dynamic royalty engine routes Global asset royalties to a Trust Vault based on volatility. After a 16% Minter Fee, the remaining revenue is split: volatility ≥ 40 → 50%, volatility 30-39 → 42%, volatility 15-29 → 42%, volatility < 15 → 18% to the Trust Vault.
-   **Trust Vault**: A dedicated page for Asset Trustees displaying global yield assets, a royalty pool dashboard, and an embedded **Global Radio** component.
- **Global Radio (Spotify Web Playback SDK)**: `client/src/components/GlobalRadio.tsx` embedded on the **Landing Page** (free users) and **Home/Front Page** (alongside 97.7 The Flame). **Dual Turntable DJ Console UI** with Deck A/Deck B turntable platters (spinning vinyl animation), VU meters (L/R), crossfader, and Bloomberg-style lime-on-black aesthetic. Uses `Spotify.Player` Web Playback SDK — loads `sdk.scdn.co/spotify-player.js`, creates browser-based device "AITIFY Global Radio", calls `PUT /me/player/play` with `context_uri`. Rotation managed via **self-service admin panel** (`Global Radio` tab in Admin → `global_rotation` DB table). Public API `GET /api/global-rotation` feeds the DJ Console; admin CRUD at `POST/PUT/DELETE /api/admin/global-rotation`. Falls back to `client/src/lib/global-rotation.json` when DB rotation is empty. 30s heartbeat verifies SDK `player.getCurrentState()` — checks `!paused` AND `context.uri` match before logging `SPOTIFY_STREAM` to Trust Sheet. Shows Spotify logo, "SPOTIFY VERIFIED STREAMING" badge, volume control, heartbeat log. `GET /api/spotify/token` provides fresh access token.
-   **YouTube Video Support**: Native player (`player-context.tsx`, `music-player.tsx`) detects YouTube URLs in track `audioUrl` fields. When a YouTube URL is detected: (1) HTML5 audio playback is skipped (no broken audio attempts), (2) video icon appears in player bar to toggle YouTube embed panel, (3) queue advance/prev/next all safely handle YouTube tracks. `extractYouTubeId()` parses watch, embed, and short URL formats.
-   **Trust Certificate (TRST-977)**: Downloadable certificate for trustees with live performance calculations from `/api/settlement/status`. Shows gross intake, floor retained (54%), CEO gross (46%), $1K settlement cycles completed, total settled, total paid out, settlement ROI, cycle progress bar, fund available, trust pool value, and user share — all auto-refreshing every 15 seconds. Exportable as PNG or PDF.
-   **Asset Classes**: Tracks can be `standard` (emerald styling) or `inspirational` (violet styling with higher yield bands).
-   **Autopilot Radio**: A DJ console feature that automatically queues high-velocity assets from the pool, prioritizing 2-week pre-release tracks. CEOs can save priority rotations.
-   **2-Week Early Trading Edge**: Pre-release assets are tradeable two weeks before general retail distribution, incentivizing early adoption.
-   **Production Terminal**: Full asset production & distribution console at `/production`. Uses OpenAI TTS-1-HD ($0.35/track) for audio generation and DALL-E 3 ($0.03/image) for artwork via Replit AI integration (no external API keys needed). Direct-push pipeline ($0.38 total wholesale) lists assets on the trading floor. Shows ledger status, 54/46 split breakdown, and pipeline status tracking.
-   **CEO CLASS — 12-Step Business Credit Program**: An interactive checklist on the dashboard guiding users through business credit development steps, with progress tracking.
-   **Access Gating**: AuthGate (login-only) protects trading floor and standard pages. PremiumGate (trust membership required) protects Spotify room, Trust Vault, CEO Class, Dashboard. Sidebar shows lock icons on premium items for non-members. Admin section (Mint Factory, Production Center, Admin Portal) hidden from non-admins.
-   **Artist Portal**: Provides artists with tools for profile management, track uploads, pre-release scheduling, AI Lyrics Generation (using OpenAI), and Audio Mastering (using ffmpeg).
-   **Admin Portal**: A comprehensive dashboard for analytics, user/artist/content management, radio playlist oversight, and Spotify royalty tracking.
-   **JAM Console**: A Bloomberg Terminal-reskinned page for radio and jam sessions, featuring Spotify remote controls and live session management.
-   **Google Sheets Logging Hook**: Logs Radio Stats & Market Engagement data (track completions, heartbeats, market events) to Google Sheets via webhooks for analytics and royalty auditing.
-   **Continuous Broadcast Engine**: An automated system for Global Radio, featuring polling for track ends, time-based show switching, ad-bridge auto-resumes, market-only feeds, and background persistence of music playback.
-   **Market Intelligence Module (Living Market Engine)**: An autonomous "CEO Hands-Off" system for managing market dynamics. It uses a "Fill-to-Close" model where pools close when cumulative buy-ins reach $1,000. Dynamic pricing and fluctuating buy-back rates are core to this system, with a fixed 16% Minter Fee and a paper trade cap. Includes a live `MarketEngine` class with demand/supply-driven price updates (`updatePrice()`), impulse liquidity shocks (`impulse()`), volume-target settlement (`settle()` at $1K target), floor/house governor (`adjustBalance()` 50%-90%), and safe-stop circuit breaker. Engine syncs with Kinetic Governor every 10s. API: `GET /api/engine/state`, `POST /api/engine/impulse` (admin), `POST /api/engine/safe-stop` (admin).
-   **Live Monitoring Control Room** (`/live/monitor.html`): Production-grade system monitor with real-time Socket.IO streaming. Panels: Engine Status (price/MBBP/discount/volume/fill/queue/floor-house split/kinetic), Cash Flow & Reconciliation (deposits vs entries with deficit alerts), Settlement Status (progress to $1K threshold with READY alert), Global Wallets (aggregate balances/deposits/earned/withdrawn/net flow), Alerts & Errors (price stall, volume mismatch, queue lock, cash deficit, liquidation zone, settlement threshold), Error Watch (persistent error log), Settlement Queue (FIFO queue viewer), Wallet Lookup (per-user search), Live Event Feed (settlement/reset/discount exit streaming). Backend error detection: PRICE_STALL (no movement >30s), VOLUME_MISMATCH (floor pool drift >$0.50), QUEUE_LOCK (stuck entries with closed market), CASH_DEFICIT (entries exceed deposits). API: `GET /api/engine/monitor`.
-   **Beat Machine (Kie AI / Suno)**: Production center Step 2 uses Kie AI (`KIE_AI_API_KEY`) as primary beat generation engine, with SunoAPI.org (`SUNO_API_KEY`) as fallback. Async generation with polling (`POST /api/production/generate-beat` → `GET /api/production/beat-status/:taskId`). Client at `server/suno-client.ts` handles generate, status polling, and audio download.
-   **Image Generation (`server/image-gen.ts`)**: Tiered fallback — Kie AI Ideogram first, then OpenAI DALL-E 3 proxy, then SVG placeholder generator. All art endpoints (`/api/admin/ideogram-generate`, `/api/distribute/direct-push`, `/api/production/push`, `/api/production/generate-art`) route through `generateArtwork()`. SVG fallbacks served via `/uploads/` with proper `image/svg+xml` MIME type.
-   **Global Investor Portals**: 7 portals for Owner/Investors at `/investor-portals`. Each portal: $5K fund, $500 entry, 10 O/I max, $25 down + $475 over 24 months @ $19.79/mo, 0% interest. 25% base return with 100% max growth. Spotify links per song. Stream count tracking with royalty calculation: $3,330 per 1M streams × 25% = $832.50. Schema: `global_investor_portals` + `global_investor_entries`. API: `GET /api/investor-portals`, `POST /api/investor-portals/:id/join`, admin stream/payment endpoints.
-   **Trader Desk**: Traders can trade positions (ACCEPT/HOLD) directly from their trader desk at `/trader`. Live price/MBBP display, position status badges (QUEUED/HOLDING/SETTLED), profit/loss tracking. Only go to floor to buy more.
-   **Data Persistence**: Orders, settlement cycles, salesCount, and stakes are **preserved across restarts**. No startup purge. Real investor data persists permanently.
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