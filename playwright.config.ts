import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 120_000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
