<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 🏙️ Civic Intelligence Engine

The **Civic Intelligence Engine** is a crowd-sourced public utility platform designed to bridge the gap between citizens and municipal bodies (specifically tailored for India/New Delhi regions, such as Connaught Place, Karol Bagh, and Dwarka).

By leveraging real-time data, community validation, and Gemini AI for automated issue triage, the platform ensures civic hazards like potholes, overflowing garbage, and broken streetlights are efficiently reported, verified, and resolved.

## ✨ Key Features

- **📍 Interactive Reporting & Mapping**: Users can pin hazards on a dark-themed interactive map (powered by Leaflet).
- **🤖 AI Triage**: Integrated with Google's Gemini AI to automatically analyze report descriptions and images, categorize the issue, assign a severity level, and route to the correct municipal department.
- **🗳️ Community Validation**: Citizens can upvote or downvote reported issues to crowd-source validation, reducing noise and prioritizing critical hazards.
- **⏱️ SLA Dashboard & Authority Tools**: Municipal authorities (e.g., MCD, BSES) have dedicated dashboards to track Service Level Agreements (SLAs), assign crews, upload proof-of-resolution images, and update ticket statuses.
- **🏆 Gamification**: Users earn points, trust scores, and badges (e.g., "Pothole Patrol", "SLA Champion") for reporting and validating issues.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Leaflet
- **Backend**: Node.js, Express (with TypeScript)
- **Database**: Firebase Firestore (durable cloud persistence for users, issues, and metadata)
- **AI Integration**: `@google/genai` (Gemini 3.5 Flash)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- Firebase Project configured for Firestore

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Ensure you have your Gemini API key set in your environment file (e.g., `.env.local` or `.env`):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the Application Locally:**
   ```bash
   npm run dev
   ```
   *The development server spins up Vite middleware connected to the Express backend on `http://0.0.0.0:3000`.*

### Building for Production
```bash
npm run build
npm run start
```

## 📚 Architecture

For a detailed visual mapping of the system architecture, component tree, database schema, and issue lifecycle, please see:
👉 **[Architecture Documentation](./ARCHITECTURE.md)**

## 🛡️ Special Architectural Patches

- **Custom Credential Store**: Due to restrictions on Starter Tier Firebase projects, this application implements a custom backend credential store using SHA-256 hashing. Users register and log in directly via secure API endpoints (`/api/auth/login`, `/api/auth/register`) that proxy to the Firestore `credentials` collection, bypassing default email/password auth providers.
