import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const demoOrigin = 'http://127.0.0.1:5193';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: join(tmpdir(), 'shift-prototype-playwright-results'),
  use: { baseURL: demoOrigin, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5193 --strictPort', url: demoOrigin, timeout: 30_000 },
});
