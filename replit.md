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

The application utilizes a full-stack architecture with a focus on a dark-mode first UI/UX, inspired by Spotify's aesthetic with a green accent color.

-   **Frontend**: React + TypeScript with Vite, styled using Tailwind CSS and shadcn/ui components.
-   **Backend**: Express.js with TypeScript for API services.
-   **Database**: PostgreSQL, managed with Drizzle ORM.
-   **Authentication**: Primary via email/password, with optional Spotify OAuth 2.0.
-   **Payments**: Cash App ($AITITRADEBROKERAGE) for all asset trading and account activation. PayPal is used for artist tipping only.
-   **Access Control**: Two-tier model: AuthGate for basic logged-in access, and PremiumGate for Sovereign Trust members to access advanced features like Global Trades and Trust Vault.
-   **Trade Portal System**: DB-driven configurable trade portals (`portal_settings` table) with admin control for TBI, MBB, early exit multipliers, and pool ceilings.
-   **Sovereign Exchange / Trading Floor**: Bloomberg Terminal-style interface for trading music tracks as assets, displaying market data, sales, unit price, yield, and capacity.
-   **Digital Order System**: Users "ACQUIRE POSITION" on tracks, generating a Digital Tracking Number and a digital receipt.
-   **AI Data Tags**: Tracks include an `ai_model` identifier, e.g., `AITIFY-GEN-1`.
-   **Release Types**: `native` (lime green, no royalties, $1K cap) and `global` (bold gold, royalty-bearing, exclusive to Asset Trustees).
-   **Global Royalty Split**: Dynamic royalty engine routes Global asset royalties to a Trust Vault based on volatility.
-   **Trust Vault**: Dedicated page for Asset Trustees with global yield assets, royalty pool dashboard, and embedded Global Radio.
-   **Global Radio**: Spotify Web Playback SDK-powered DJ Console UI with dual turntables and Bloomberg-style aesthetic. Rotation managed via admin panel (`global_rotation` DB table).
-   **YouTube Video Support**: Native player detects and handles YouTube URLs in track `audioUrl`, showing a video icon to toggle an embed panel.
-   **Trust Certificate (TRST-977)**: Downloadable certificate for trustees with live performance calculations, exportable as PNG or PDF.
-   **Asset Classes**: `standard` (emerald) and `inspirational` (violet, higher yield).
-   **Autopilot Radio**: DJ console feature for automatically queuing high-velocity assets, prioritizing 2-week pre-release tracks.
-   **Production Terminal**: Full asset production & distribution console at `/production`. Uses OpenAI TTS-1-HD and DALL-E 3 (via Replit AI integration) for audio generation and artwork.
-   **CEO CLASS — 12-Step Business Credit Program**: Interactive checklist for business credit development.
-   **Artist Portal**: Tools for profile management, track uploads, pre-release scheduling, AI Lyrics Generation, and Audio Mastering.
-   **Admin Portal**: Comprehensive dashboard for analytics, user/artist/content management, and radio playlist oversight.
-   **JAM Console**: Bloomberg Terminal-reskinned page for radio and jam sessions with Spotify remote controls.
-   **Market Intelligence Module (Living Market Engine)**: Autonomous system for managing market dynamics with a "Fill-to-Close" model, dynamic pricing, fluctuating buy-back rates, and a fixed 16% Minter Fee. Includes demand/supply-driven price updates, impulse liquidity shocks, volume-target settlement, and a floor/house governor.
-   **Live Monitoring Control Room**: Real-time Socket.IO streaming monitor with panels for Engine Status, Cash Flow, Settlement Status, Global Wallets, Alerts & Errors, Settlement Queue, Wallet Lookup, and Live Event Feed.
-   **Beat Machine**: Uses Kie AI as primary beat generation engine, with SunoAPI.org as fallback.
-   **Image Generation**: Tiered fallback system: Kie AI Ideogram, then OpenAI DALL-E 3 proxy, then SVG placeholder generator.
-   **Global Investor Portals**: Seven portals for Owner/Investors with specific fund sizes, entry requirements, and return structures.
-   **Trader Desk**: Interface for traders to manage positions (ACCEPT/HOLD) with live market data.
-   **Music Market Pool System**: Each listing has a `maxSupply` (kinetically set by base price: $4+ = 15, $2+ = 20, else 25). Once all seats are filled, direct buys are blocked and buyers must purchase from current holders on the resale board. StockCards show live pool gauge (holders/maxSupply), seats remaining, and "SOLD OUT — RESALE ONLY" badge when full. CashApp dialog shows resale offers with violet-themed buy buttons.
-   **Data Persistence**: All critical data (orders, settlement cycles, salesCount, stakes) is preserved across restarts using PostgreSQL and Replit Object Storage.
-   **File Storage**: Uploaded media (audio, images) stored in Replit Object Storage (GCS-backed).

## External Dependencies

-   **Vite**: Frontend build tool.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **shadcn/ui**: UI component library.
-   **Express.js**: Backend web application framework.
-   **PostgreSQL**: Relational database.
-   **Drizzle ORM**: TypeScript ORM.
-   **OpenAI API**: For AI Lyrics Generator and DALL-E 3 image generation.
-   **FFmpeg**: For Audio Mastering Engine.
-   **Cash App**: For asset trade payments.
-   **PayPal Web SDK**: For subscription and tipping payment processing.
-   **Spotify OAuth 2.0 API**: For authentication and Spotify features.
-   **Replit Object Storage (GCS-backed)**: Cloud storage for media files.
-   **html-to-image**: For client-side image exports.
-   **Replit Auth**: For primary user authentication.
-   **Kie AI**: For beat generation and Ideogram image generation.
-   **SunoAPI.org**: Fallback for beat generation.
-   **Google Sheets API**: For logging radio stats and market engagement data.