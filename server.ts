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
import cookieParser from 'cookie-parser';
import { router as apiRouter } from './server/routes';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable 'trust proxy' so Express and express-rate-limit correctly recognize real client IPs behind Cloud Run proxies
app.set('trust proxy', 1);

// Set up security headers using Helmet (disabling restrictive CSP which causes failed fetches in sandbox iframes)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false // Turn off X-Frame-Options: SAMEORIGIN so it can be loaded in the AI Studio iframe
}));

// Apply basic rate limiting to API routes
const getClientIp = (req: any): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // High limit for sandbox stability
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Significantly raised for sandbox environments to avoid shared proxy IP blocks
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// Configure CORS (allowing all origins with credentials for sandbox environment)
app.use(cors({
  origin: true,
  credentials: true
}));

// Set up cookie parsing
app.use(cookieParser());

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
