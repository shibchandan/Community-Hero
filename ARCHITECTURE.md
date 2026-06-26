# Civic Intelligence Engine - Architecture & Data Flow

This document provides a graphical overview of the **Civic Intelligence Engine**, visualizing its system architecture, component tree, database schema, and the lifecycle of a civic issue.

## 1. High-Level System Architecture

This diagram illustrates how the frontend React application communicates with the Node.js/Express backend, which in turn orchestrates data persistence with Firebase Firestore and intelligent analysis with the Gemini AI model.

```mermaid
graph TD
    Client["Client Browser<br/>(React, Vite, Leaflet)"]
    
    subgraph Backend ["Node.js / Express Server"]
        Router["API Router<br/>(/api)"]
        RateLimiter["Rate Limiter & Security"]
        AuthLogic["Authentication & Session"]
        IssueLogic["Issue Management"]
        AI_Integration["Gemini AI Integration"]
    end
    
    subgraph External ["External Services"]
        Firestore[("Firebase Firestore<br/>(Persistence)")]
        Gemini["Google Gemini<br/>(AI Analysis)"]
    end

    Client -- "HTTP/REST Requests" --> RateLimiter
    RateLimiter --> Router
    Router --> AuthLogic
    Router --> IssueLogic
    
    AuthLogic -- "Read/Write Credentials" --> Firestore
    IssueLogic -- "Analyze Description/Image" --> AI_Integration
    AI_Integration -- "API Call" --> Gemini
    Gemini -- "Categorization & Severity" --> AI_Integration
    IssueLogic -- "CRUD Issues" --> Firestore
```

## 2. Frontend Component Architecture

The React frontend is composed of modular components handling different aspects of the civic platform.

```mermaid
graph TD
    App["App.tsx<br/>(Main Entry, Routing, State)"]
    
    Auth["AuthPage.tsx<br/>(Login/Register)"]
    Map["InteractiveMap.tsx<br/>(Leaflet, Issue Markers)"]
    Reporter["IssueReporter.tsx<br/>(Drag-and-Drop, Geolocation)"]
    Feed["CommunityFeed.tsx<br/>(List Issues, Upvotes)"]
    SLA["SlaDashboard.tsx<br/>(Authority View, Tracking)"]
    Leaderboard["GamificationLeaderboard.tsx<br/>(Points & Badges)"]
    AuthorityCtrl["AuthorityControl.tsx<br/>(Status Updates)"]

    App --> Auth
    App --> Map
    App --> Reporter
    App --> Feed
    App --> SLA
    App --> Leaderboard
    SLA --> AuthorityCtrl
    Feed --> AuthorityCtrl
```

## 3. Database Schema (Firestore Collections)

The backend stores data in Firebase Firestore across several collections. This Entity-Relationship diagram maps out the core data structures and their relationships.

```mermaid
erDiagram
    USERS {
        string id PK
        string name
        string email
        string role "citizen | authority"
        int points
        int trust_score
        string[] badges
        int completed_reports
        int validations_count
        string area
    }

    ISSUES {
        string id PK
        string category "road | garbage | water | streetlight | safety"
        string title
        string description
        string status
        map location "lat, lng, address, area"
        string severity "low | medium | high"
        string reportedBy FK "User ID"
        string mediaUrl
        string department
        int upvotes
        int downvotes
        map votedUsers
        array comments
        array timeline
        int slaDays
    }

    CREDENTIALS {
        string email PK
        string passwordHash
        string userId FK
    }

    METADATA {
        string docId PK
        map currentUserSession
    }

    USERS ||--o{ ISSUES : "reports"
    USERS ||--o{ CREDENTIALS : "has"
```

## 4. Issue Lifecycle (State Machine)

A civic issue goes through multiple stages from the moment it is reported by a citizen to its final resolution by a municipal authority.

```mermaid
stateDiagram-v2
    [*] --> Reported : Citizen submits issue
    
    Reported --> AI_Verified : Gemini AI analyzes and categorizes
    Reported --> Closed : Flagged as Spam/Duplicate
    
    AI_Verified --> Community_Verified : Receives +2 net community votes
    
    Community_Verified --> Assigned : Authority acknowledges & dispatches
    
    Assigned --> In_Progress : Maintenance crew active on-site
    
    In_Progress --> Resolved : Authority uploads proof of resolution
    
    Resolved --> Closed : Citizen confirms resolution
    Resolved --> In_Progress : Citizen disputes resolution
    
    Closed --> [*]
```
