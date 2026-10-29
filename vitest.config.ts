import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    fileParallelism: false,
    env: {
      ALLOW_LOCAL_FIXTURES: 'true',
      PORT: '3001'
    }
  },
  resolve: {
    alias: {
      '@parallax/shared': path.resolve(__dirname, './packages/shared/src')
    }
  }
});
