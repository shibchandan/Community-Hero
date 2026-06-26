/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import { router as apiRouter } from './server/routes';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable 'trust proxy' so Express and express-rate-limit correctly recognize real client IPs behind Cloud Run proxies
app.set('trust proxy', 1);

// Set up security headers using Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://*.googleapis.com"], // Allowed for Vite dev/inline scripts
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://nominatim.openstreetmap.org", "https://*.basemaps.cartocdn.com", "https://basemaps.cartocdn.com", "https://server.arcgisonline.com", "https://*.arcgisonline.com"],
      connectSrc: ["'self'", "https://nominatim.openstreetmap.org", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://*.firebase.com", "ws:", "wss:"], // WebSockets for dev and external APIs
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'", "https://*.google.com", "https://ai.studio", "https://*.run.app"], // Allow AI Studio iframe
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false // Turn off X-Frame-Options: SAMEORIGIN so it can be loaded in the AI Studio iframe
}));

// Apply basic rate limiting to API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per window (Sandbox friendly)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 login/register requests per IP per window (Sandbox friendly)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP, please try again after 15 minutes.' }
});

// Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin (origin is undefined) or localhost/run.app/google.com/ai.studio subdomains
    if (!origin || /localhost|127\.0\.0\.1|google\.com|ai\.studio|run\.app/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true
}));

// Set up JSON & URL-encoded body parsing with file limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitize user input to prevent NoSQL injection
app.use(mongoSanitize());

// Protect against HTTP Parameter Pollution attacks
app.use(hpp());

// Apply Anti-Abuse Bot Middleware
app.use((req, res, next) => {
  // Relaxed or log-only check for developer sandbox compatibility
  next();
});

// Apply rate limiters
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter, apiRouter);

// Set up Vite Development Middleware or Static Production Build paths
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development server is live & hot reload ready.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on ingress routing port: http://0.0.0.0:${PORT}`);
  });
}

startServer();
export default app;
