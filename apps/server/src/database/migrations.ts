import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabase } from './db.js';
import { logger } from '../observability/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(customDbPath?: string): void {
  const db = getDatabase(customDbPath);
  
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const initialMigrationName = '001_initial_schema.sql';
  const stmt = db.prepare('SELECT id FROM migrations WHERE name = ?');
  const alreadyApplied = stmt.get(initialMigrationName);

  if (!alreadyApplied) {
    logger.info(`Applying migration: ${initialMigrationName}`);
    const schemaPath = path.join(__dirname, 'schema.sql');
    let schemaSql = '';
    
    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } else {
      // Fallback for compiled bundle
      const fallbackPath = path.resolve(process.cwd(), 'apps/server/src/database/schema.sql');
      schemaSql = fs.readFileSync(fallbackPath, 'utf8');
    }

    db.exec(schemaSql);
    
    const insertMigration = db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)');
    insertMigration.run(initialMigrationName, new Date().toISOString());
    logger.info(`Migration ${initialMigrationName} applied successfully`);
  } else {
    logger.debug(`Migration ${initialMigrationName} already applied`);
  }
}
