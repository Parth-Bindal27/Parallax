import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { apiRouter } from './api/router.js';
import { logger } from './observability/logger.js';

export function createApp(): express.Application {
  const app = express();

  // Configure CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Parse JSON bodies with bounded size limit (10MB)
  app.use(express.json({ limit: '10mb' }));

  // Request correlation logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (!req.path.startsWith('/api/v1/missions/') || !req.path.endsWith('/events')) {
        logger.info(`${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Serve screenshots statically
  const screenshotsDir = path.resolve(process.cwd(), 'data/snapshots/screenshots');
  app.use('/data/snapshots/screenshots', express.static(screenshotsDir));

  // Mount API router
  app.use('/', apiRouter);

  // Serve static web build if present (Unified Single-Process Mode)
  const webDistDir = path.resolve(process.cwd(), 'apps/web/dist');
  if (fs.existsSync(webDistDir)) {
    app.use(express.static(webDistDir));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/fixtures') || req.path.startsWith('/health') || req.path.startsWith('/data')) {
        return next();
      }
      res.sendFile(path.join(webDistDir, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Unhandled error on ${req.method} ${req.path}`, { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message
    });
  });

  return app;
}
