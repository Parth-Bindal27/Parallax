import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { runMigrations } from './database/migrations.js';
import { closeDatabase } from './database/db.js';
import { browserExecutor } from './browser/browserExecutor.js';
import { logger } from './observability/logger.js';

const PORT = Number(process.env.PORT || 3001);

async function startServer() {
  try {
    logger.info('Initializing PARALLAX backend server...');
    
    // Run database migrations on startup
    runMigrations();

    const app = createApp();

    const server = app.listen(PORT, () => {
      logger.info(`PARALLAX Server running on http://localhost:${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Test Fixture: http://localhost:${PORT}/fixtures/student-ai-tools`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await browserExecutor.close();
        closeDatabase();
        logger.info('PARALLAX Server shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('Fatal error starting PARALLAX server', { error: String(err) });
    process.exit(1);
  }
}

startServer();
