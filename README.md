# 🏙️ Samadhan Setu: AI-Powered Civic Intelligence Engine

[![Build Status](https://img.shields.io/badge/Build-Success-emerald?style=flat-square)](#)
[![Tech Stack](https://img.shields.io/badge/Tech%20Stack-React%20%7C%20Node%20%7C%20Firestore-blue?style=flat-square)](#)
[![AI Engine](https://img.shields.io/badge/AI%20Core-Gemini%203.5%20Flash-indigo?style=flat-square)](#)
[![Version](https://img.shields.io/badge/Version-1.0.0--beta-orange?style=flat-square)](#)

**Samadhan Setu** ("Solution Bridge") is a robust, production-ready crowd-sourced public utility and civic action platform. Tailored for metropolitan regions (such as Karol Bagh, Connaught Place, and Dwarka in New Delhi), it connects citizens directly with civic authorities (MCD, DJB, DDA, BSES) to automate hazard reporting, streamline municipal workloads, and eliminate bureaucratic delay.

By combining **real-time spatial intelligence**, **community-driven consensus networks**, and **Generative AI via Google's Gemini**, Samadhan Setu completely replaces manual ticket filing with a high-trust, SLA-driven, and highly transparent public ledger.

---

## 🎯 The Civic Problem & Our Solution

### The Friction
1. **Reporting Fatigue**: Traditional portals require tedious forms, resulting in citizens ignoring everyday issues.
2. **Bureaucratic Black Holes**: Reports get lost in incorrect municipal queues, causing weeks of delay in manual triaging.
3. **The Trust Deficit**: Citizens have zero visibility into maintenance schedules, SLA timelines, or actual resolution verification.
4. **Noise & Spam**: Municipal authorities spend up to 40% of their operational bandwidth sorting through duplicate, spam, or false hazard complaints.

### The Samadhan Bridge
- **Instant AI Triage**: Citizens describe an issue in simple conversational language (or upload a photo); Google's **Gemini AI Core** instantly extracts semantic data, labels the urgency, categorizes it, and maps it to the exact responsible civic body.
- **Decentralized Verification**: Crowd-sourced validation (upvotes/downvotes) determines community consensus. A real-time trust score engine filters out spam and boosts critical community-validated tickets.
- **Rigorous SLA Accountability**: Local authorities operate on clear, countdown-based Service Level Agreements (SLAs). They must log maintenance crew assignments, and post public proof-of-resolution to finalize ticket closure.
- **Civic Capital (Gamification)**: Citizens earn reputation points, badges, and local leaderboard ranks, transforming civic duty into a rewarding community game.

---

## ⚡ Key Pillars & Features

### 1. Interactive Civic Radar (Leaflet & GIS Maps)
- Highly polished, interactive dark and light-themed Leaflet map.
- Real-time geolocation tracking with custom citizen beacons.
- Heatmap overlay options to visualize high-risk urban hotspots (potholes, garbage pileups).
- Live category-based and severity-based pin filters for spatial analysis.

### 2. Gemini 3.5 Flash AI Engine
- **Automated Metadata Extraction**: Automatically parses descriptions to determine hazard category and subcategory.
- **Smart Severity Classification**: Gauges public risk level (`Low`, `Medium`, `High`) based on semantic signals.
- **Automated Zonal Routing**: Dynamically directs the ticket to the relevant municipal department:
  - **MCD** (Municipal Corporation of Delhi) -> *Garbage and Sanitation*
  - **DJB** (Delhi Jal Board) -> *Water Supply & Sewage*
  - **DDA** (Delhi Development Authority) -> *Parks, Encroachment & Roads*
  - **BSES / NDMC** -> *Power & Streetlight infrastructure*

### 3. Transparent Citizen Feed & Ledger
- A chronological, highly readable card feed of all local complaints.
- Upvote/downvote mechanics with automatic, state-driven status transitions (e.g., moving to `AI_Verified` or `Community_Verified`).
- Fully-interactive timeline track for every single reported issue, demonstrating a chronological trail of comments, state-updates, and photos.

### 4. Zonal Dispatch & SLA Dashboard (Authority Portal)
- A tailored panel for certified municipal admins.
- Real-time SLA countdown timers with automated warnings for overdue repairs.
- Operational controls to:
  - **Acknowledge** and claim incoming tickets.
  - **Dispatch** crews and enter on-ground maintenance worker profiles.
  - **Resolve** issues by uploading a physical proof-of-resolution file/URL.

### 5. Leaderboard & Gamified Civic Capital
- Personal citizen portfolios containing total issues resolved, validations approved, and dynamic trust ratings.
- Collectible achievement badges:
  - 🏆 **Pothole Patrol** (Reported 5+ road hazards)
  - ⚡ **SLA Champion** (Helped resolve tickets before deadline)
  - 🛡️ **Streetlight Guardian** (Reported dark streets)
- Live community leaderboard tracking the top civic heroes in the area.

---

## 🛠️ Architecture & Tech Stack

```
 ┌─────────────────────────┐      REST/HTTP      ┌───────────────────────────┐
 │   React Client (Vite)   │◄───────────────────►│ Express Backend (Node.js) │
 └────────────┬────────────┘                     └─────────────┬─────────────┘
              │                                                │
              │ Web Spatial                                    ├─► Google Gemini AI
              ▼                                                │   (Auto-Triage & Routing)
       Leaflet Map Engine                                      │
                                                               ▼
                                                       Firebase Firestore
                                                   (Durable Cloud Persistence)
```

- **Frontend Core**: React 18 (Vite SPA) & TypeScript.
- **Animations & Micro-interactions**: Framer Motion (smooth sliding drawers, staggered lists, and tab-switching).
- **Styling UI/UX**: Tailwind CSS configured with custom font pairings (**Inter** for standard body text, **Space Grotesk** for display typography, and **JetBrains Mono** for technical SLA timelines).
- **Database Engine**: Firebase Firestore with fully mapped entities (Users, Issues, Authentication Store, Metadata).
- **Backend Core**: TypeScript Node.js server utilizing Express.
- **AI Core**: `@google/genai` (integrating high-performance Gemini 3.5 Flash models).

---

## 🚀 Local Installation & Setup

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd samadhan-setu
npm install
```

### 2. Environment Configuration
Create a `.env` file at the root of the project to securely house environment secrets:
```env
# Google Gemini API Key (Required for server-side AI triage)
GEMINI_API_KEY=your_gemini_api_key_here

# Mode Settings (Defaults to development)
NODE_ENV=development
```

### 3. Spin Up Development Servers
The project runs as a full-stack, cohesive Express application with integrated Vite asset serving. 
```bash
npm run dev
```
The server will start up on **`http://localhost:3000`** with dynamic hot-reloading for client assets and immediate backend updates.

### 4. Build for Production
```bash
# Bundles the frontend code and compiles server.ts into self-contained CommonJS
npm run build

# Starts the production server
npm run start
```

---

## 🛡️ Hackathon Innovation & Highlight Features

1. **Fully Connected Dynamic Storage**: Unlike standard mock static applications, Samadhan Setu operates with an active cloud-synchronized Firestore database. All status updates, upvotes, and comments immediately persist for all clients.
2. **Secure Credentials Custom-Store**: Due to sandbox and API restrictions, we implemented a custom-engineered SHA-256 password hash-store directly on Firestore. This proxies all user auth securely through backend routes `/api/auth/register` and `/api/auth/login`, ensuring reliable persistent sessions without relying on third-party auth popups.
3. **No-Lag Gemini Proxying**: The application utilizes a secure server-side proxy route `/api/issues/triage` for all Gemini interactions, keeping sensitive API keys invisible to the client browser and preventing client-side scraping.
4. **Double Validation Loop**: Features a dual-approval mechanism. It checks for both machine verification (AI-categorization accuracy) and community consensus (upvotes) before routing directly to field departments.

---

## 📂 Project Structure

```
├── server.ts               # Custom full-stack Express Server entry point
├── package.json            # Application dependencies and build scripts
├── ARCHITECTURE.md         # Extended Visual Diagrams (Mermaid charts, Schema maps)
├── src/
│   ├── main.tsx            # React bootstrap file
│   ├── App.tsx             # Main client-side router, shell layout, and state provider
│   ├── types.ts            # Absolute type safety definitions (User, Issue, Timeline)
│   ├── index.css           # Global typography, dark-mode styling, and Tailwind imports
│   └── components/         # Highly modular React UI components
│       ├── InteractiveMap.tsx      # Advanced Leaflet instance with marker rendering
│       ├── IssueReporter.tsx       # Smart hazard submission form with AI integration
│       ├── CommunityFeed.tsx       # Feed with upvote, filter, and timeline tools
│       ├── SlaDashboard.tsx        # SLA countdown metrics & municipal tools
│       ├── GamificationLeaderboard.tsx # Badge shelf and dynamic score ranking
│       └── Sidebar.tsx             # Responsive collateral navigation layout
```

---

<div align="center">
  <p><b>Samadhan Setu</b> • Built with ❤️ for civic change.</p>
</div>
