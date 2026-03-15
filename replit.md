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
- **Music Streaming**: Core functionality for browsing and playing tracks.
- **User Management**: Includes free accounts, various premium membership tiers (Silver, Bronze, Gold/Artist Pro) with tiered access to features like playlists and pre-release content.
- **Artist Portal**: Allows artists to manage profiles, upload tracks, set pre-release dates, and access features like an AI Lyrics Generator (using OpenAI) and an Audio Mastering Engine (utilizing ffmpeg for processing).
- **Admin Portal**: A comprehensive dashboard for platform analytics, user and artist management, content moderation, managing radio playlists (97.7 THE FLAME), radio shows, membership oversight, tracking Spotify stream qualifiers, and the Spotify Royalty Tracker (paste Spotify URLs to auto-load stream counts and track 1K qualification for royalties).
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