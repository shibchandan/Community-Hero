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
import { router as apiRouter } from './server/routes';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable 'trust proxy' so Express and express-rate-limit correctly recognize real client IPs behind Cloud Run proxies
app.set('trust proxy', 1);

// Set up security headers using Helmet
// Note: We set contentSecurityPolicy to false in dev/iframe environment to allow Vite's inline script injection,
// while keeping other robust security headers (XSS filter, frame options, clickjacking protection, etc.) active.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Apply basic rate limiting to API routes to protect against abuse and spam reports
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Set up JSON & URL-encoded body parsing with file limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiter specifically to API endpoints
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
