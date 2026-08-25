// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - playwright.config.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // `next dev`'s on-demand compiler serializes route compilation, so
  // multiple workers hammering it with concurrent cold navigations time out
  // (each first-visit compile can take longer than the parallel requests can
  // wait). A single worker avoids that contention; it only costs wall-clock
  // time on a suite this size. E2E_BASE_URL points at a pre-built server, so
  // it doesn't have this problem and can go fully parallel.
  fullyParallel: !!process.env.E2E_BASE_URL,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.E2E_BASE_URL ? undefined : 1,
  reporter: 'html',
  // `next dev` compiles each route on its first request, which can push a
  // cold navigation's time-to-interactive past the 5s assertion default -
  // give assertions more room locally without letting a genuinely broken
  // page hang for too long.
  expect: { timeout: process.env.E2E_BASE_URL ? 5_000 : 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Skipped when E2E_BASE_URL points at an already-running server (e.g. in CI
  // against a deployed environment) - only start one for local runs.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
