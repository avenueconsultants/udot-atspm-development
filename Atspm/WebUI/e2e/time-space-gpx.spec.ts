// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/time-space-gpx.spec.ts
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
import {
  averageUrl,
  generateCharts,
  historicUrl,
  stubTimeSpaceAverage,
  stubTimeSpaceHistoric,
} from './support/timeSpace'

// Unlike SRM, GPX never leaves the browser: the file is parsed in the page
// (gpxFileParser), the points are turned into a series against the chart's
// own y-axis, and the start/end selects say which stretch of the corridor the
// track is laid across. So this spec asserts on what the chart and the panel
// show, and pins that nothing is posted while a track is added.

// Two track points about a minute apart, inside the window the shared
// corridor is generated for. The parser needs a <time> on the first point or
// it returns nothing at all.
const gpxFile = (
  points: Array<{ lat: number; lon: number; time: string }>
) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="atspm-e2e">
  <trk><name>Main St run</name><trkseg>
${points
  .map(
    (p) =>
      `    <trkpt lat="${p.lat}" lon="${p.lon}"><time>${p.time}</time></trkpt>`
  )
  .join('\n')}
  </trkseg></trk>
</gpx>`

const VALID_GPX = gpxFile([
  { lat: 40.7608, lon: -111.891, time: '2026-03-14T16:04:00Z' },
  { lat: 40.7638, lon: -111.891, time: '2026-03-14T16:05:00Z' },
  { lat: 40.7668, lon: -111.891, time: '2026-03-14T16:06:00Z' },
])

// Well-formed XML with no track points at all: a different failure from a
// document that would not parse, and reported differently.
const EMPTY_GPX = gpxFile([])

// Not XML at all, so DOMParser produces a parsererror document.
const BROKEN_GPX = 'this is not a gpx file'

const chooseGpx = (page: Page, content: string, name = 'run.gpx') =>
  gpxPanel(page)
    .locator('input[type="file"][accept=".gpx"]')
    .first()
    .setInputFiles({
      name,
      mimeType: 'application/gpx+xml',
      buffer: Buffer.from(content, 'utf8'),
    })

// Both upload accordions carry the same control names, so the GPX one is
// addressed by the region its own controls sit in.
const gpxPanel = (page: Page) =>
  page.getByRole('region').filter({ hasText: 'Add another GPX' })

const openUploads = async (page: Page) => {
  await page.getByRole('tab', { name: 'Uploads' }).click()
  await expect(
    page.getByRole('button', { name: 'Add another GPX' })
  ).toBeVisible()
}

// The legend prompts for an upload for as long as no track is on the chart,
// so its absence is the rendered signal that one landed.
const expectGpxPrompt = async (page: Page, present: boolean) => {
  await page.getByRole('tab', { name: 'Legend' }).click()
  await expect(page.getByLabel('GPX Tracks info')).toHaveCount(present ? 1 : 0)
}

const runHistoric = async (page: Page) => {
  await page.goto(historicUrl())
  await generateCharts(page)
  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()
}

test('a parsed GPX track is drawn on the chart without any request', async ({
  page,
}) => {
  const { diagrams, pivots } = await stubTimeSpaceHistoric(page)

  await runHistoric(page)
  await expectGpxPrompt(page, true)

  await openUploads(page)
  await chooseGpx(page, VALID_GPX)

  await expect(gpxPanel(page).getByText('run.gpx')).toBeVisible()
  await expectGpxPrompt(page, false)

  // Parsing and plotting happen in the page; the backend hears nothing new.
  expect(diagrams).toHaveLength(1)
  expect(pivots).toHaveLength(1)
})

test('the start and end selects offer the corridor and default to its ends', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page)

  await runHistoric(page)
  await openUploads(page)

  // getPrimaryTimeSpaceLocations feeds these, so they are the identifiers of
  // the primary phases in route order.
  const start = gpxPanel(page).getByRole('combobox').first()
  await expect(start).toHaveText('1001')
  await expect(gpxPanel(page).getByRole('combobox').nth(1)).toHaveText('1002')

  await start.click()
  await expect(page.getByRole('option')).toHaveText(['1001', '1002'])
  await page.getByRole('option', { name: '1002' }).click()
  await expect(start).toHaveText('1002')
})

test('a file that will not parse is reported on its own row', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page)

  await runHistoric(page)
  await openUploads(page)

  await chooseGpx(page, BROKEN_GPX, 'broken.gpx')

  await expect(gpxPanel(page).getByText('Invalid GPX file')).toBeVisible()
  // A rejected file is not kept, and nothing reaches the chart.
  await expect(gpxPanel(page).getByText('No file selected')).toBeVisible()
  await expectGpxPrompt(page, true)
})

test('a GPX with no track points says so rather than failing to parse', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page)

  await runHistoric(page)
  await openUploads(page)

  await chooseGpx(page, EMPTY_GPX, 'empty.gpx')

  // Well-formed but useless: a different message from a file that would not
  // parse, so the user knows which way it was wrong.
  await expect(
    gpxPanel(page).getByText('No track points found in this GPX file')
  ).toBeVisible()
  await expect(gpxPanel(page).getByText('No file selected')).toBeVisible()
  await expectGpxPrompt(page, true)
})

test('the seeded track is the primary one, and only later ones can be removed', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page)

  await runHistoric(page)
  await openUploads(page)

  await expect(gpxPanel(page).getByText('Primary track')).toHaveCount(1)
  await expect(gpxPanel(page).getByText('Additional track')).toHaveCount(0)
  // The primary row is the one the container seeds, so it has no delete.
  await expect(
    gpxPanel(page).getByRole('button', { name: 'Remove GPX' })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Add another GPX' }).click()
  await page.getByRole('button', { name: 'Add another GPX' }).click()

  await expect(gpxPanel(page).getByText('Additional track')).toHaveCount(2)
  await expect(
    gpxPanel(page).getByRole('button', { name: 'Remove GPX' })
  ).toHaveCount(2)

  await gpxPanel(page)
    .getByRole('button', { name: 'Remove GPX' })
    .first()
    .click()

  await expect(gpxPanel(page).getByText('Additional track')).toHaveCount(1)
  await expect(gpxPanel(page).getByText('Primary track')).toHaveCount(1)
})

test('ignoring a location and showing it again redraws the diagram', async ({
  page,
}) => {
  await stubTimeSpaceHistoric(page)

  await runHistoric(page)

  // The toggles are drawn over the chart, one per location on the corridor;
  // the distances either side are recomputed around an ignored one.
  const ignore1002 = page.getByRole('button', { name: 'Ignore location 1002' })
  await expect(ignore1002).toBeVisible()

  await ignore1002.click()

  await expect(
    page.getByRole('button', { name: 'Show location 1002' })
  ).toBeVisible()
  await expect(ignore1002).toHaveCount(0)
  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()

  await page.getByRole('button', { name: 'Show location 1002' }).click()

  await expect(
    page.getByRole('button', { name: 'Ignore location 1002' })
  ).toBeVisible()
})

test('the 50th percentile tool offers GPX but not the SRM overlay', async ({
  page,
}) => {
  await stubTimeSpaceAverage(page)

  await page.goto(averageUrl())
  await generateCharts(page)
  await expect(page.locator('#time-space-chart canvas').first()).toBeVisible()

  await openUploads(page)

  // SRM is merged onto historic phase results, so it is offered there only.
  await expect(page.getByText('GPX Tracks')).toBeVisible()
  await expect(page.getByText('SRM Overlay')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Select CSV' })).toHaveCount(0)
})
