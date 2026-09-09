// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/location-editor.spec.ts
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
  DetectionHardwareTypes,
  DirectionTypes,
  LaneTypes,
  MovementTypes,
  WatchDogIssueTypesName,
  type WatchDogIgnoreEvent,
} from '../src/api/config/config-api.schemas'
import { odataCollection, odataEntity } from '../src/test/fixtures/api'
import {
  detector10011,
  location1001,
  searchLocations,
} from '../src/test/fixtures/config'
import { blockMapTiles, stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import { signIn } from './support/session'
import { stubApiHosts } from './support/stubApiHosts'

// The location editor is where the two enum conventions meet. It reads a
// Location whose enums are OData member names ('NB', 'V', 'T'), edits it in
// the store, and writes back through UpsertApproach, whose DTO wants the
// integers. Nothing but the real page exercises that round trip, so this
// spec drives it through the browser against the recorded location.

// The page expands detectors down to their detection types and comments, so
// the recorded location gets those (empty) collections the way the API
// sends them.
const locationForEditor = {
  ...location1001,
  approaches: location1001.approaches.map((approach) => ({
    ...approach,
    detectors: approach.detectors.map((detector) => ({
      ...detector,
      detectionTypes: [],
      detectorComments: [],
    })),
  })),
}

const stubBackend = async (page: Page) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)
  await blockMapTiles(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', searchLocations),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/LocationType',
    body: odataCollection('LocationType', [
      { id: 1, name: 'Intersection', icon: null },
    ]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/1',
    method: 'GET',
    body: odataEntity('Location', locationForEditor),
  })

  return hosts
}

const openApproachesTab = async (page: Page) => {
  await page.goto('/admin/locations/1')
  await expect(
    page.getByRole('heading', { name: '1001 - Main St & 400 S' })
  ).toBeVisible()
  await page.getByRole('tab', { name: 'Approaches' }).click()
}

test.beforeEach(({ context, baseURL }) => signIn(context, baseURL))

test('loads the location from its id and lists its approaches', async ({
  page,
}) => {
  await stubBackend(page)

  await openApproachesTab(page)

  await expect(page.getByRole('heading', { name: 'Northbound' })).toBeVisible()
  await expect(page.getByText('1 Detector', { exact: true })).toBeVisible()
})

test('saving an approach sends the DTO integers for every member name it read', async ({
  page,
}) => {
  const hosts = await stubBackend(page)
  const upserts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/UpsertApproach',
    method: 'POST',
    respond: (request) => ({ ...request.postDataJSON(), id: 1 }),
  })

  await openApproachesTab(page)
  await page.getByRole('button', { name: /Northbound/ }).click()

  // Columns: Direction, Description, Protected phase, ...
  const protectedPhase = page
    .getByRole('table', { name: 'edit approach table' })
    .locator('tbody > tr')
    .first()
    .getByRole('gridcell')
    .nth(2)
  await protectedPhase.dblclick()
  const editor = protectedPhase.getByRole('textbox')
  await editor.fill('4')
  await editor.press('Enter')

  await page.getByRole('button', { name: 'save approach' }).click()

  await expect(page.getByText('Approach saved successfully')).toBeVisible()
  expect(upserts).toHaveLength(1)
  const payload = upserts[0].postDataJSON()
  expect(payload).toMatchObject({
    id: 1,
    locationId: 1,
    protectedPhaseNumber: 4,
    directionTypeId: DirectionTypes.NB,
  })
  expect(payload.detectors).toHaveLength(1)
  expect(payload.detectors[0]).toMatchObject({
    id: detector10011.id,
    detectorChannel: detector10011.detectorChannel,
    laneType: LaneTypes.V,
    movementType: MovementTypes.T,
    detectionHardware: DetectionHardwareTypes.NA,
    detectionTypes: [],
  })

  // The saved DTO comes back with integers and the editor shows names again.
  await expect(page.getByRole('heading', { name: 'Northbound' })).toBeVisible()
})

test('ignoring a watchdog issue for the location writes and reads back the member name', async ({
  page,
}) => {
  const hosts = await stubBackend(page)

  // The tab refetches the ignore list after writing, so the stub keeps what
  // it was sent and serves it back - the way the entity set would.
  const ignoreEvents: WatchDogIgnoreEvent[] = []
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/WatchDogIgnoreEvent',
    method: 'GET',
    respond: () => odataCollection('WatchDogIgnoreEvent', ignoreEvents),
  })
  const posts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/WatchDogIgnoreEvent',
    method: 'POST',
    status: 201,
    respond: (request) => {
      const created = { id: 7, ...request.postDataJSON() }
      ignoreEvents.push(created)
      return created
    },
  })

  await page.goto('/admin/locations/1')
  await page.getByRole('tab', { name: 'Watchdog' }).click()

  // The first option row is Record Count; its pill reads 'active' until an
  // ignore event exists for it.
  await page.getByRole('button', { name: 'active' }).first().click()
  await page.getByRole('button', { name: 'Ignore Event' }).click()

  await expect(page.getByText('Watchdog Ignore Event Added')).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(posts[0].postDataJSON()).toMatchObject({
    locationId: 1,
    locationIdentifier: '1001',
    issueType: WatchDogIssueTypesName.RecordCount,
  })
  // Reading the event back by its member name is what flips the pill.
  await expect(
    page.getByRole('button', { name: /^Inactive from/ })
  ).toBeVisible()
})
