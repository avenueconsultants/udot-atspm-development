// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/route-editor.spec.ts
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
import type { Approach, DirectionType, RouteDto } from '../src/api/config'
import {
  DirectionTypes,
  DirectionTypesName,
} from '../src/api/config/config-api.schemas'
import { odataCollection } from '../src/test/fixtures/api'
import { approachNorthbound } from '../src/test/fixtures/config'
import { blockMapTiles, jsonResponse, stubEndpoint } from './support/api'
import { mockAppShell } from './support/mockAppShell'
import {
  distance1001to1002,
  link1001,
  link1002,
  routeSearchLocations,
  routeView,
} from './support/routeFixtures'
import { signIn } from './support/session'
import { stubApiHosts } from './support/stubApiHosts'

// The route editor reads a RouteDto (System.Text.Json, so integer direction
// ids), offers each link the directions of its location's approaches (OData,
// so member names), and writes the whole route back through UpsertRoute. The
// direction picker is where the two meet - it has to send the integer the
// DTO expects, not the name it was shown.

const directionType = (
  id: DirectionTypesName,
  description: string
): DirectionType => ({
  abbreviation: id,
  description,
  displayOrder: 0,
  id,
  created: null,
  modified: null,
  createdBy: null,
  modifiedBy: null,
})

const southbound = (id: number, locationId: number): Approach => ({
  ...approachNorthbound,
  id,
  locationId,
  description: 'Southbound',
  protectedPhaseNumber: 6,
  directionTypeId: DirectionTypesName.SB,
  directionType: directionType(DirectionTypesName.SB, 'Southbound'),
})

// GET /Approach?filter=locationId eq {id}&expand=directionType
const approachesByLocation: Record<string, Approach[]> = {
  '1': [approachNorthbound, southbound(2, 1)],
  '2': [
    { ...approachNorthbound, id: 3, locationId: 2 },
    southbound(4, 2),
    {
      ...approachNorthbound,
      id: 5,
      locationId: 2,
      description: 'Eastbound',
      protectedPhaseNumber: 4,
      directionTypeId: DirectionTypesName.EB,
      directionType: directionType(DirectionTypesName.EB, 'Eastbound'),
    },
  ],
}

const stubBackend = async (page: Page, route: RouteDto = routeView) => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)
  await blockMapTiles(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', routeSearchLocations),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/RouteDistance',
    body: odataCollection('RouteDistance', [distance1001to1002]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: `/GetRouteView/${route.id}`,
    body: route,
  })
  const approachRequests = await stubEndpoint(page, {
    host: hosts.config,
    path: '/Approach',
    method: 'GET',
    respond: (request) => {
      const filter = new URL(request.url()).searchParams.get('filter') ?? ''
      const locationId = /locationId eq (\d+)/.exec(filter)?.[1] ?? ''
      return odataCollection('Approach', approachesByLocation[locationId] ?? [])
    },
  })

  // The editor draws the route through OSRM's public match service; keep the
  // suite off the internet and deterministic.
  await page.route('https://router.project-osrm.org/**', (route) =>
    route.fulfill(
      jsonResponse({
        matchings: [
          {
            distance: 365.76,
            geometry: {
              coordinates: [
                [link1001.longitude, link1001.latitude],
                [link1002.longitude, link1002.latitude],
              ],
            },
          },
        ],
      })
    )
  )

  return { hosts, approachRequests }
}

// The rows are drag handles, so the accessibility tree exposes each one as
// a button rather than a row - find them by their location label instead.
const primaryDirectionOf = (page: Page, locationIdentifier: string) =>
  page
    .locator('tr', { hasText: `#${locationIdentifier} -` })
    .getByRole('combobox')
    .first()

test.beforeEach(({ context, baseURL }) => signIn(context, baseURL))

test('offers each link the directions of its own approaches', async ({
  page,
}) => {
  const { approachRequests } = await stubBackend(page)

  await page.goto(`/admin/routes/${routeView.id}/edit`)

  await expect(page.getByLabel('Route Name')).toHaveValue(routeView.name)
  const primary = primaryDirectionOf(page, '1002')
  await expect(primary).toContainText('Northbound')

  await primary.click()
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options).toHaveCount(3)
  await expect(options.filter({ hasText: 'Eastbound' })).toBeVisible()
  await page.keyboard.press('Escape')

  // The descriptions can only come from the Approach entity set with
  // directionType expanded - the Location/{key}/approaches navigation action
  // ignores query options and never populates them.
  const queries = approachRequests.map((request) => new URL(request.url()))
  expect(
    queries.some(
      (url) =>
        url.searchParams.get('filter') === 'locationId eq 2' &&
        url.searchParams.get('expand') === 'directionType'
    )
  ).toBe(true)
})

test('changing a direction saves the numeric direction id and its phase', async ({
  page,
}) => {
  const { hosts } = await stubBackend(page)
  const upserts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/UpsertRoute',
    method: 'POST',
    respond: (request) => request.postDataJSON(),
  })

  await page.goto(`/admin/routes/${routeView.id}/edit`)
  const primary = primaryDirectionOf(page, '1002')
  await expect(primary).toContainText('Northbound')

  await primary.click()
  await page.getByRole('option').filter({ hasText: 'Eastbound' }).click()
  await expect(primary).toContainText('Eastbound')

  await page.getByRole('button', { name: 'Save Route' }).click()

  await expect(page.getByText('Route saved successfully')).toBeVisible()
  expect(upserts).toHaveLength(1)
  const payload = upserts[0].postDataJSON()
  expect(payload.id).toBe(routeView.id)
  const [first, second] = payload.routeLocations
  expect(second).toMatchObject({
    locationIdentifier: '1002',
    primaryDirectionId: DirectionTypes.EB,
    primaryDirectionDescription: 'Eastbound',
    primaryPhase: 4,
    isPrimaryOverlap: false,
    opposingDirectionId: DirectionTypes.SB,
    opposingPhase: 6,
  })
  expect(first.nextLocationDistance).toMatchObject({ distance: 1200 })
})

test('a link without a distance to the next one blocks the save', async ({
  page,
}) => {
  const { hosts } = await stubBackend(page, {
    ...routeView,
    routeLocations: [
      { ...link1001, nextLocationDistanceId: null, nextLocationDistance: null },
      link1002,
    ],
  })
  const upserts = await stubEndpoint(page, {
    host: hosts.config,
    path: '/UpsertRoute',
    method: 'POST',
    respond: (request) => request.postDataJSON(),
  })

  await page.goto(`/admin/routes/${routeView.id}/edit`)
  await expect(primaryDirectionOf(page, '1002')).toContainText('Northbound')

  await page.getByRole('button', { name: 'Save Route' }).click()

  await expect(
    page.getByText('The highlighted fields are required.')
  ).toBeVisible()
  expect(upserts).toHaveLength(0)
})
