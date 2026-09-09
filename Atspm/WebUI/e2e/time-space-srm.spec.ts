// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/time-space-srm.spec.ts
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
import { expect, test, type Page } from '@playwright/test'
import { gunzipSync } from 'zlib'
import type { TimeSpaceSrmPhaseOverlay } from '../src/features/charts/timeSpaceDiagram/shared/types'
import { stubEndpoint } from './support/api'
import { ROUTE_ID } from './support/routeFixtures'
import {
  generateCharts,
  HISTORIC_END,
  HISTORIC_START,
  historicUrl,
  stubTimeSpaceHistoric,
  wallClock,
} from './support/timeSpace'

// SRM is an overlay applied to an already-rendered historic diagram: the
// browser gzips the chosen CSV, base64s it and posts it to its own report
// endpoint, and the tracks that come back are merged onto the phase results
// by location, direction and order. Nothing is re-fetched. This spec drives
// the real file input so the encoding runs in the browser rather than in a
// stub, and unzips the payload back to prove it survived the round trip.

// Two rows of a stop-bar collection, small enough to read in a failure and
// long enough that gzip is not a no-op.
const SRM_CSV = [
  'entityId,timestamp,latitude,longitude,speed',
  'veh-1,2026-03-14T16:04:00Z,40.7608,-111.8910,31.4',
  'veh-1,2026-03-14T16:04:10Z,40.7611,-111.8910,28.9',
  'veh-2,2026-03-14T16:09:00Z,40.7575,-111.8762,35.0',
].join('\n')

// One vehicle crossing the corridor: distances are measured from the location
// the track is merged onto, and the last point sits past the next location so
// the transformer also has a segment gap to draw.
const srmTrack = (entityId: string) => ({
  entityId,
  points: [
    {
      time: '2026-03-14T16:04:00',
      distance: 0,
      timestampMs: Date.parse('2026-03-14T16:04:00Z'),
      intersectionId: '1001',
    },
    {
      time: '2026-03-14T16:04:30',
      distance: 300,
      timestampMs: Date.parse('2026-03-14T16:04:30Z'),
      intersectionId: '1001',
    },
    {
      time: '2026-03-14T16:05:00',
      distance: 900,
      timestampMs: Date.parse('2026-03-14T16:05:00Z'),
      intersectionId: '1002',
    },
  ],
  startingIntersection: '1001',
  headingDirection: 0,
})

// Keyed the way mergeSrmOverlaysIntoWrappedData looks them up:
// locationIdentifier | phaseType | order, matching the two primary phases of
// the shared corridor. The keying itself is covered by that function's unit
// tests; what this spec adds is that the browser really does encode, post and
// render the result.
const srmOverlays = [
  {
    locationIdentifier: '1001',
    phaseType: 'Primary',
    order: 1,
    srmEntityTracks: [srmTrack('veh-1')],
  },
  {
    locationIdentifier: '1002',
    phaseType: 'Primary',
    order: 2,
    srmEntityTracks: [srmTrack('veh-2')],
  },
] satisfies TimeSpaceSrmPhaseOverlay[]

const stubSrm = async (page: Page) => {
  const context = await stubTimeSpaceHistoric(page)
  const srm = await stubEndpoint(page, {
    host: context.hosts.reports,
    path: '/TimeSpaceDiagram/getSrmData',
    method: 'POST',
    body: srmOverlays,
  })
  return { ...context, srm }
}

// The chart's own sidebar shows one panel at a time: the accordion is behind
// the Uploads tab and the legend behind the Legend tab.
const openUploads = async (page: Page) => {
  await page.getByRole('tab', { name: 'Uploads' }).click()
  await expect(page.getByRole('button', { name: 'Select CSV' })).toBeVisible()
}

const openLegend = (page: Page) =>
  page.getByRole('tab', { name: 'Legend' }).click()

// Both upload accordions render as regions with the same controls and the
// same "No file selected" placeholder, so everything is addressed inside the
// SRM one.
const srmPanel = (page: Page) =>
  page.getByRole('region').filter({ hasText: 'Select CSV' })

const applyButton = (page: Page) =>
  srmPanel(page).getByRole('button', { name: 'Apply' })

const clearButton = (page: Page) =>
  srmPanel(page).getByRole('button', { name: 'Clear' })

const chooseCsv = (page: Page, name = 'srm.csv') =>
  page.locator('input[type="file"][accept*="csv"]').setInputFiles({
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(SRM_CSV, 'utf8'),
  })

// The legend carries an info icon telling the user to upload SRM data for as
// long as no tracks are on the chart; it is driven by the chart option itself
// (hasSrmSeriesData), so it is the rendered signal that the overlay landed.
const expectSrmPrompt = async (page: Page, present: boolean) => {
  await openLegend(page)
  await expect(page.getByLabel('SRM Collection info')).toHaveCount(
    present ? 1 : 0
  )
}

const runDiagram = async (page: Page) => {
  await page.goto(historicUrl())
  await generateCharts(page)
  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
}

test('applying a CSV posts it gzipped and merges the tracks onto the chart', async ({
  page,
}) => {
  const { srm, diagrams } = await stubSrm(page)

  await runDiagram(page)
  await expectSrmPrompt(page, true)

  await openUploads(page)
  await chooseCsv(page)
  await expect(srmPanel(page).getByText('srm.csv')).toBeVisible()
  await applyButton(page).click()

  // The overlay is merged in the browser; the diagram itself is not re-run.
  await expectSrmPrompt(page, false)
  expect(diagrams).toHaveLength(1)

  expect(srm).toHaveLength(1)
  const payload = srm[0].postDataJSON()
  expect(payload).toMatchObject({
    routeId: ROUTE_ID,
    start: wallClock(HISTORIC_START),
    end: wallClock(HISTORIC_END),
  })
  // gzipAndBase64 runs in the page, so unzipping here proves the encoding the
  // report API is handed actually round-trips. The bytes go in as a
  // Uint8Array because zlib's InputType does not admit this @types/node
  // Buffer generic directly.
  expect(
    gunzipSync(
      new Uint8Array(Buffer.from(payload.srmCsvContentBase64, 'base64'))
    ).toString('utf8')
  ).toBe(SRM_CSV)
})

test('clearing removes the overlay without asking the report API again', async ({
  page,
}) => {
  const { srm } = await stubSrm(page)

  await runDiagram(page)
  await openUploads(page)
  await chooseCsv(page)
  await applyButton(page).click()
  await expectSrmPrompt(page, false)

  await openUploads(page)
  await clearButton(page).click()

  // Back to the diagram as generated: the prompt returns, the file is
  // forgotten, and clearing is a local merge with no second request.
  await expectSrmPrompt(page, true)
  await openUploads(page)
  await expect(srmPanel(page).getByText('No file selected')).toBeVisible()
  expect(srm).toHaveLength(1)
})

test('a failing SRM request is reported in the accordion and applies nothing', async ({
  page,
}) => {
  const { hosts } = await stubTimeSpaceHistoric(page)
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/TimeSpaceDiagram/getSrmData',
    method: 'POST',
    status: 500,
    body: { message: 'srm data unavailable' },
  })

  await runDiagram(page)
  await openUploads(page)

  await chooseCsv(page, 'broken.csv')
  await applyButton(page).click()

  await expect(srmPanel(page).getByText('srm data unavailable')).toBeVisible()
  // The chart is still the one that was generated, prompt and all.
  await expectSrmPrompt(page, true)
  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
})

test('Apply is unavailable until a file is chosen', async ({ page }) => {
  const { srm } = await stubSrm(page)

  await runDiagram(page)
  await openUploads(page)

  await expect(applyButton(page)).toBeDisabled()
  await expect(clearButton(page)).toBeDisabled()

  await chooseCsv(page)

  await expect(applyButton(page)).toBeEnabled()
  expect(srm).toHaveLength(0)
})
