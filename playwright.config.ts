import { defineConfig } from '@playwright/test';

// Real-browser verification gate (docs/generative_levels.md §3's acceptance
// gate; closes the DOM/click/render blind spot neither validateLevels.ts's
// static UI-producer scan (SPRINT_015) nor WitnessReplay.ts's headless ECS
// replay (SPRINT_016) cover — both explicitly disclaim touching the DOM).
export default defineConfig({
  testDir: 'e2e',
  // Generous: solving alone (before any page interaction even starts) can
  // take up to ~65s for the heaviest levels (validateLevels.ts's own timings).
  timeout: 120_000,
  fullyParallel: false, // one shared preview server; keep runs simple/serial
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
