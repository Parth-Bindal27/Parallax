import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../observability/logger.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabasePath(): string {
  const customPath = process.env.DATABASE_PATH;
  if (customPath) {
    const resolved = path.resolve(customPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return resolved;
  }
  const defaultDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return path.join(defaultDir, 'parallax.db');
}

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }
  const targetPath = dbPath || getDatabasePath();
  logger.info(`Opening database at ${targetPath}`);
  
  dbInstance = new DatabaseSync(targetPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');

  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
      logger.info('Database closed gracefully');
    } catch (err) {
      logger.error('Error closing database', { error: String(err) });
    }
    dbInstance = null;
  }
}
