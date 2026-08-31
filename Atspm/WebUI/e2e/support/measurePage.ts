// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/measurePage.ts
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
import type { Page, Request } from '@playwright/test'
import type { MeasureType, SearchLocation } from '../../src/api/config'
import { odataCollection } from '../../src/test/fixtures/api'
import { stubEndpoint, type ApiHosts } from './api'
import { searchLocationWithMeasure } from './measureFixtures'
import { mockAppShell } from './mockAppShell'
import { stubApiHosts } from './stubApiHosts'

// The performance-measures page, as every measure spec drives it: one
// recorded location deep-linked with the measure under test and a fixed
// one-hour window. The window is the wall-clock literal the pickers show
// and the request echoes, so it is zone-independent.

export const LOCATION_IDENTIFIER = '1001'
export const START = '2026-04-01T08:00:00'
export const END = '2026-04-01T09:00:00'

export const measurePageUrl = (
  chartType: string,
  params: Record<string, string> = {}
) =>
  `/performance-measures?${new URLSearchParams({
    location: LOCATION_IDENTIFIER,
    chartType,
    start: START,
    end: END,
    ...params,
  }).toString()}`

interface MeasurePageStub {
  /** The one measure the page offers, with its seeded options. */
  measure: MeasureType
  /** Everything the measure list returns; defaults to just `measure`. */
  measures?: MeasureType[]
  /** The location the search returns; defaults to one offering `measure`. */
  location?: SearchLocation
  /** The report endpoint's pathname suffix, e.g. '/ApproachSpeed/getReportData'. */
  reportPath: string
  /** What the report endpoint answers. */
  report: unknown
}

// Keeps the page off the live API hosts and answers the three requests a
// measure run makes: the measure list (also the ?expand=measureOptions
// call the defaults come from), the location search, and the report.
// Hands back every report request so a spec can assert what was sent, and
// the hosts for any further endpoint a measure needs stubbed.
export const stubMeasurePage = async (
  page: Page,
  { measure, measures, location, reportPath, report }: MeasurePageStub
): Promise<{ hosts: ApiHosts; reports: Request[] }> => {
  const hosts = await stubApiHosts(page)
  await mockAppShell(page)

  await stubEndpoint(page, {
    host: hosts.config,
    path: '/MeasureType',
    method: 'GET',
    body: odataCollection('MeasureType', measures ?? [measure]),
  })
  await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetLocationsForSearch',
    body: odataCollection('SearchLocations', [
      location ?? searchLocationWithMeasure(measure),
    ]),
  })
  const reports = await stubEndpoint(page, {
    host: hosts.reports,
    path: reportPath,
    method: 'POST',
    body: report,
  })

  return { hosts, reports }
}

// The shared bin-size dropdown, found by its current value.
export const binSizePicker = (page: Page) =>
  page.getByRole('combobox').filter({ hasText: /^(5|15|60)$/ })

export const generateCharts = (page: Page) =>
  page.getByRole('button', { name: 'Generate Charts' }).click()
