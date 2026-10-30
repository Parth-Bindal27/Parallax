import { createApp } from '../../apps/server/src/app.js';
import type { Server } from 'node:http';

let server: Server | null = null;

export async function ensureTestServer(): Promise<void> {
  try {
    const res = await fetch('http://localhost:3001/health');
    if (res.ok) return;
  } catch {}

  if (!server) {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(3001, () => resolve());
    });
  }
}

export async function closeTestServer(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        server = null;
        resolve();
      });
    });
  }
}
