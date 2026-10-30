import fs from 'node:fs';
import path from 'node:path';

const destDir = path.resolve('dist/database');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
fs.copyFileSync('src/database/schema.sql', 'dist/database/schema.sql');
