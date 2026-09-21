import type { Page } from '@playwright/test'
import type { DetectionTypeGroup, DeviceGroup } from '../src/api/config'
import type { WatchDogDashboardGroup } from '../src/api/reports'
import { odataCollection } from '../src/test/fixtures/api'
import { stubEndpoint, type ApiHosts } from './support/api'
import { readChartOption } from './support/echarts'
import { signIn } from './support/session'
import { expect, test } from './support/strictApi'
import {
  summaryDetectionCounts,
  summaryDevices,
  watchdogSummary,
} from './support/watchdogSummaryFixtures'

const dashboardPath = '/api/v1/WatchDogDashboard/getDashboardGroup'
const chartIds = [
  'watchdog-device-count-chart',
  'watchdog-detection-type-count-chart',
  'watchdog-controller-type-chart',
  'watchdog-issue-type-chart',
  'watchdog-detection-type-chart',
]

async function stubSummary(
  page: Page,
  hosts: ApiHosts,
  dashboard: WatchDogDashboardGroup = watchdogSummary,
  devices: DeviceGroup[] = summaryDevices,
  detectionCounts: DetectionTypeGroup[] = summaryDetectionCounts
) {
  // The page opens on Logs before the user selects Summary. Explicitly
  // answer those lookups and the shared chrome; every stub pins the verb.
  for (const path of [
    '/MenuItems',
    '/Area',
    '/Region',
    '/Jurisdiction',
    '/Location/GetLocationsForSearch',
    '/WatchDogIgnoreEvent',
  ]) {
    await stubEndpoint(page, {
      host: hosts.config,
      path,
      method: 'GET',
      body: odataCollection(path.slice(1), []),
    })
  }
  await stubEndpoint(page, {
    host: hosts.identity,
    path: '/Profile',
    method: 'GET',
    body: { firstName: 'Test', lastName: 'User' },
  })
  await stubEndpoint(page, {
    host: hosts.reports,
    path: '/Watchdog/GetIssueTypes',
    method: 'GET',
    body: [],
  })
  const deviceRequests = await stubEndpoint(page, {
    host: hosts.config,
    path: '/Device/GetActiveDevicesCount',
    method: 'GET',
    body: devices,
  })
  const detectionRequests = await stubEndpoint(page, {
    host: hosts.config,
    path: '/Location/GetDetectionTypeCount',
    method: 'GET',
    body: detectionCounts,
  })
  const reportRequests = await stubEndpoint(page, {
    host: hosts.reports,
    path: dashboardPath,
    method: 'POST',
    body: dashboard,
  })
  return { deviceRequests, detectionRequests, reportRequests }
}

async function openSummary(page: Page) {
  await page.goto('/watchdog')
  await page.getByRole('tab', { name: 'Summary Report' }).click()
  await expect(
    page.getByRole('button', { name: 'Generate Summary' })
  ).toBeVisible()
}

async function expectCharts(page: Page) {
  for (const id of chartIds) {
    await expect(page.locator('#' + id + ' canvas').first()).toBeVisible()
  }
}

async function series(page: Page, id: string) {
  return (await readChartOption(page, '#' + id)).series
}

test.use({ timezoneId: 'America/Denver' })
test.beforeEach(async ({ context, baseURL, page }) => {
  await signIn(context, baseURL, 'Watchdog:View')
  await page.clock.setFixedTime(new Date('2026-03-16T18:00:00Z'))
})

test('sends the edited date range and renders all five charts from generated response models', async ({
  page,
  apiHosts,
}) => {
  const { reportRequests, deviceRequests, detectionRequests } =
    await stubSummary(page, apiHosts)
  await openSummary(page)
  expect(reportRequests).toHaveLength(0)
  await page.getByLabel('Start', { exact: true }).fill('Mar 01, 2026')
  await page.getByLabel('End', { exact: true }).fill('Mar 15, 2026')
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)

  expect(reportRequests).toHaveLength(1)
  expect(reportRequests[0].postDataJSON()).toEqual({
    start: '2026-03-01',
    end: '2026-03-15',
  })
  expect(deviceRequests).toHaveLength(1)
  await expect
    .poll(() =>
      detectionRequests.map((request) =>
        new URL(request.url()).searchParams.get('date')
      )
    )
    .toContain('2026-03-15')
  await expect
    .poll(() => series(page, chartIds[0]))
    .toMatchObject([
      { type: 'pie', data: [{ name: 'Acme: \nC1 - 1.0', value: 8 }] },
    ])
  await expect
    .poll(() => series(page, chartIds[1]))
    .toMatchObject([
      { type: 'pie', data: [{ name: 'Advance Count', value: 12 }] },
    ])
  await expect
    .poll(() => series(page, chartIds[2]))
    .toMatchObject([
      {
        type: 'sunburst',
        data: [
          {
            name: 'Acme\n100.0%',
            children: [
              {
                name: 'C1',
                children: [
                  {
                    name: '1.0',
                    children: [{ name: 'LowDetectorHits\n100.0%', value: 6 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  await expect
    .poll(() => series(page, chartIds[3]))
    .toMatchObject([
      {
        type: 'sunburst',
        data: [
          {
            name: 'LowDetectorHits\n100.0%',
            children: [
              {
                name: 'Acme',
                children: [
                  { name: 'C1', children: [{ name: '1.0\n100.0%', value: 6 }] },
                ],
              },
            ],
          },
        ],
      },
    ])
  await expect
    .poll(() => series(page, chartIds[4]))
    .toMatchObject([{ type: 'bar', name: 'Video', data: [6] }])
})

test('updates legends and unconfigured-issue visibility without another report request', async ({
  page,
  apiHosts,
}) => {
  const { reportRequests } = await stubSummary(page, apiHosts)
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)

  await page.getByText('LowDetectorHits', { exact: true }).click()
  await expect
    .poll(() => series(page, chartIds[3]))
    .toMatchObject([{ data: [] }])
  await page.getByText('LowDetectorHits', { exact: true }).click()
  await expect
    .poll(() => series(page, chartIds[3]))
    .toMatchObject([{ data: [{ name: 'LowDetectorHits\n100.0%' }] }])
  await page.getByRole('checkbox', { name: 'Unconfigured issue types' }).check()
  await expect
    .poll(() => series(page, chartIds[2]))
    .toMatchObject([
      {
        data: [
          {
            children: [
              {
                children: [
                  {
                    children: [
                      { name: 'LowDetectorHits\n75.0%', value: 6 },
                      { name: 'UnconfiguredDetector\n25.0%', value: 2 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ])
  expect(reportRequests).toHaveLength(1)
})

test('renders an empty report without inventing chart data', async ({
  page,
  apiHosts,
}) => {
  await stubSummary(
    page,
    apiHosts,
    { controllerTypeGroup: [], issueTypeGroup: [], detectionTypeGroup: [] },
    [],
    []
  )
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  for (const id of chartIds) {
    await expect(page.locator('#' + id)).toBeVisible()
  }
  for (const id of chartIds.slice(0, 4)) {
    await expect.poll(() => series(page, id)).toMatchObject([{ data: [] }])
  }
  await expect.poll(() => series(page, chartIds[4])).toEqual([])
  await expect(page.getByText(/^Error loading data/)).toHaveCount(0)
})

test('accepts nullable dashboard groups and missing count fields', async ({
  page,
  apiHosts,
}) => {
  await stubSummary(
    page,
    apiHosts,
    {
      controllerTypeGroup: null,
      issueTypeGroup: null,
      detectionTypeGroup: null,
    },
    [{ manufacturer: null, model: null, firmware: null }],
    [{ id: null }]
  )
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expect(
    page.getByRole('heading', { name: 'Device Type Breakdown' })
  ).toBeVisible()
  await expect
    .poll(() => series(page, chartIds[0]))
    .toMatchObject([
      { data: [{ name: 'Unknown: \nUnknown - Unknown', value: 0 }] },
    ])
  await expect
    .poll(() => series(page, chartIds[1]))
    .toMatchObject([{ data: [{ name: 'Unknown', value: 0 }] }])
  for (const id of chartIds.slice(2)) {
    await expect(page.locator('#' + id)).toHaveCount(0)
  }
  await expect(
    page.getByRole('button', { name: 'Generate Summary' })
  ).toBeEnabled()
  await expect(page.getByText(/^Error loading data/)).toHaveCount(0)
})

test('shows a failed report request and successfully retries the same date range', async ({
  page,
  apiHosts,
}) => {
  const { reportRequests } = await stubSummary(page, apiHosts)
  const failed = await stubEndpoint(page, {
    host: apiHosts.reports,
    path: dashboardPath,
    method: 'POST',
    status: 503,
    body: { detail: 'Summary temporarily unavailable' },
  })
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expect(page.getByText(/^Error loading data/)).toBeVisible()
  expect(failed).toHaveLength(1)
  expect(reportRequests).toHaveLength(0)
  await expect(page.locator('#' + chartIds[0])).toHaveCount(0)

  const retried = await stubEndpoint(page, {
    host: apiHosts.reports,
    path: dashboardPath,
    method: 'POST',
    body: watchdogSummary,
  })
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)
  expect(retried).toHaveLength(1)
  expect(retried[0].postDataJSON()).toEqual(failed[0].postDataJSON())
  await expect(page.getByText(/^Error loading data/)).toHaveCount(0)
})

test('regenerates with the new end date and replaces the previous chart values', async ({
  page,
  apiHosts,
}) => {
  const { reportRequests } = await stubSummary(page, apiHosts)
  const counts = await stubEndpoint(page, {
    host: apiHosts.config,
    path: '/Location/GetDetectionTypeCount',
    method: 'GET',
    respond: (request) => [
      {
        id: 'Advance Count',
        count:
          new URL(request.url()).searchParams.get('date') === '2026-03-15'
            ? 17
            : 12,
      } satisfies DetectionTypeGroup,
    ],
  })
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)
  await expect
    .poll(() => series(page, chartIds[1]))
    .toMatchObject([{ data: [{ value: 12 }] }])

  const secondReport = await stubEndpoint(page, {
    host: apiHosts.reports,
    path: dashboardPath,
    method: 'POST',
    body: {
      ...watchdogSummary,
      issueTypeGroup: [
        {
          name: 'RecordCount',
          products: [
            {
              name: 'Acme',
              model: [{ name: 'C1', firmware: [{ name: '1.0', counts: 9 }] }],
            },
          ],
        },
      ],
    } satisfies WatchDogDashboardGroup,
  })
  await page.getByLabel('End', { exact: true }).fill('Mar 15, 2026')
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)
  expect(reportRequests).toHaveLength(1)
  expect(secondReport).toHaveLength(1)
  expect(secondReport[0].postDataJSON()).toEqual({
    start: '2025-03-16',
    end: '2026-03-15',
  })
  expect(
    counts.map((request) => new URL(request.url()).searchParams.get('date'))
  ).toEqual(['2026-03-16', '2026-03-15'])
  await expect
    .poll(() => series(page, chartIds[1]))
    .toMatchObject([{ data: [{ name: 'Advance Count', value: 17 }] }])
  await expect
    .poll(() => series(page, chartIds[3]))
    .toMatchObject([
      {
        data: [
          {
            name: 'RecordCount\n100.0%',
            children: [{ children: [{ children: [{ value: 9 }] }] }],
          },
        ],
      },
    ])
  await expect(page.getByText('LowDetectorHits', { exact: true })).toHaveCount(
    0
  )
})

for (const failure of [
  {
    label: 'device counts',
    path: '/Device/GetActiveDevicesCount',
    status: 503,
    body: summaryDevices,
  },
  {
    label: 'detection counts',
    path: '/Location/GetDetectionTypeCount',
    status: 403,
    body: summaryDetectionCounts,
  },
]) {
  test(
    'reports unavailable ' +
      failure.label +
      ' and retries them with Generate Summary',
    async ({ page, apiHosts }) => {
      const { reportRequests } = await stubSummary(page, apiHosts)
      await stubEndpoint(page, {
        host: apiHosts.config,
        path: failure.path,
        method: 'GET',
        status: failure.status,
        body: { detail: failure.label + ' unavailable' },
      })
      await openSummary(page)
      await expect(
        page.getByRole('alert').filter({ hasText: /^Error loading data/ })
      ).toContainText(failure.label + ' unavailable')
      await page.getByRole('button', { name: 'Generate Summary' }).click()
      await expect.poll(() => reportRequests.length).toBe(1)
      await expect(
        page.getByRole('alert').filter({ hasText: /^Error loading data/ })
      ).toContainText(failure.label + ' unavailable')
      await expect(page.locator('#' + chartIds[0])).toHaveCount(0)

      const recovered = await stubEndpoint(page, {
        host: apiHosts.config,
        path: failure.path,
        method: 'GET',
        body: failure.body,
      })
      await page.getByRole('button', { name: 'Generate Summary' }).click()
      await expectCharts(page)
      expect(recovered).toHaveLength(1)
      expect(reportRequests).toHaveLength(2)
      expect(reportRequests[1].postDataJSON()).toEqual(
        reportRequests[0].postDataJSON()
      )
      await expect(
        page.getByRole('alert').filter({ hasText: /^Error loading data/ })
      ).toHaveCount(0)
    }
  )
}

test('preserves chart selections while count queries refresh after reconnect', async ({
  page,
  apiHosts,
}) => {
  const { reportRequests } = await stubSummary(page, apiHosts)
  await openSummary(page)
  await page.getByRole('button', { name: 'Generate Summary' }).click()
  await expectCharts(page)
  const toggle = page.getByRole('checkbox', {
    name: 'Unconfigured issue types',
  })
  await toggle.check()
  await page.getByText('LowDetectorHits', { exact: true }).click()
  await expect
    .poll(() => series(page, chartIds[3]))
    .toMatchObject([{ data: [] }])

  let releaseCounts: () => void = () => {
    throw new Error('Count response not initialized')
  }
  const countsReady = new Promise<void>((resolve) => {
    releaseCounts = resolve
  })
  const refreshedPaths: string[] = []
  await page.route(
    (url) =>
      url.origin === apiHosts.config &&
      (url.pathname.endsWith('/Device/GetActiveDevicesCount') ||
        url.pathname.endsWith('/Location/GetDetectionTypeCount')),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      const pathname = new URL(route.request().url()).pathname
      refreshedPaths.push(pathname)
      await countsReady
      await route.fulfill({
        json: pathname.endsWith('/Device/GetActiveDevicesCount')
          ? summaryDevices
          : summaryDetectionCounts,
      })
    }
  )
  try {
    // These are the browser events React Query uses to resume stale queries.
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await expect.poll(() => refreshedPaths.length).toBe(2)
    expect(
      refreshedPaths.some((path) =>
        path.endsWith('/Device/GetActiveDevicesCount')
      )
    ).toBe(true)
    expect(
      refreshedPaths.some((path) =>
        path.endsWith('/Location/GetDetectionTypeCount')
      )
    ).toBe(true)
    await expect(
      page.getByRole('button', { name: 'Generate Summary' })
    ).toBeDisabled()
    await expect(toggle).toBeChecked()
    await expect(
      page.locator('#' + chartIds[2] + ' canvas').first()
    ).toBeVisible()
    await expect
      .poll(() => series(page, chartIds[3]))
      .toMatchObject([{ data: [] }])
    releaseCounts()
    await expect(
      page.getByRole('button', { name: 'Generate Summary' })
    ).toBeEnabled()
    await expect(toggle).toBeChecked()
    await expect
      .poll(() => series(page, chartIds[3]))
      .toMatchObject([{ data: [] }])
    expect(reportRequests).toHaveLength(1)
  } finally {
    releaseCounts()
  }
})
