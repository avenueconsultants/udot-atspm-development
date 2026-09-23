import type { PedatLocationData, RawDataPoint } from '@/api/reports'
import { fireEvent, render, screen } from '@testing-library/react'
import PedatChartsContainer from './PedatChartsContainer'

jest.mock('@/features/charts/components/apacheEChart', () => ({
  __esModule: true,
  default: function ChartStub() {
    return null
  },
}))

jest.mock('./PedatMapContainer', () => ({
  __esModule: true,
  default: function MapStub() {
    return null
  },
}))

const createObjectURL = jest.fn<string, [Blob]>(() => 'blob:pedestrian-export')
const revokeObjectURL = jest.fn()
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

beforeEach(() => {
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    // Capture downloads through their Blob instead of navigating in jsdom.
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
})

async function downloadCsv(buttonName: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  const blob = createObjectURL.mock.calls[0][0]
  expect(blob.type).toBe('text/csv;charset=utf-8;')
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:pedestrian-export')
  const bytes = new Uint8Array(await blob.arrayBuffer())
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  return blob.text()
}

it('exports generated raw data, nullable counts, and legacy timestamps without changing CSV columns', async () => {
  const legacyPoint = {
    pedestrianCount: 3,
    timeStamp: '2026-09-01T10:00:00Z',
  }
  const rawData: RawDataPoint[] = [
    { timestamp: '2026-09-01T08:00:00Z', pedestrianCount: 0 },
    { timestamp: '2026-09-01T09:00:00Z', pedestrianCount: null },
    legacyPoint,
    { pedestrianCount: 9 },
  ]
  const data: PedatLocationData[] = [
    {
      locationIdentifier: '1001',
      names: 'Main, "North"',
      areas: 'Salt Lake City, County',
      latitude: 40.75,
      longitude: null,
      rawData,
    },
    { locationIdentifier: '1002', rawData: null },
  ]
  const { rerender } = render(<PedatChartsContainer data={data} phase="All" />)

  const csv = await downloadCsv('Download Data')
  expect(csv).toBe(
    [
      'Signal ID,Address,Timestamp,Count,City,Latitude,Longitude',
      '1001,"Main, ""North""",2026-09-01T08:00:00.000Z,0,Salt Lake City,40.750000,',
      '1001,"Main, ""North""",2026-09-01T09:00:00.000Z,,Salt Lake City,40.750000,',
      '1001,"Main, ""North""",2026-09-01T10:00:00.000Z,3,Salt Lake City,40.750000,',
    ].join('\r\n')
  )

  createObjectURL.mockClear()
  rerender(<PedatChartsContainer data={data} phase="2" />)
  const phaseCsv = await downloadCsv('Download Data')
  expect(phaseCsv).toContain(
    'Signal ID,Phase,Address,Timestamp,Count,City,Latitude,Longitude'
  )
  expect(phaseCsv).toContain(
    '1001,2,"Main, ""North""",2026-09-01T08:00:00.000Z,0,'
  )
})

it('exports supplied statistics and preserves raw-data fallback calculations', async () => {
  const data: PedatLocationData[] = [
    {
      locationIdentifier: '1001',
      statisticData: {
        count: 99,
        mean: 11,
        std: 1,
        min: 1,
        twentyFifthPercentile: 3,
        fiftiethPercentile: 7,
        seventyFifthPercentile: 9,
        max: 15,
        missingCount: 2,
      },
      rawData: [{ pedestrianCount: 1000 }],
    },
    {
      locationIdentifier: '1002',
      statisticData: null,
      rawData: [{ pedestrianCount: 2 }, { pedestrianCount: 4 }],
    },
    { locationIdentifier: '1003', rawData: null },
  ]
  render(<PedatChartsContainer data={data} />)

  expect(await downloadCsv('Download Statistics')).toBe(
    [
      'Signal ID,count,mean,std,min,25%,50%,75%,max,Missing Count',
      '1001,99,11,1,1,3,7,9,15,2',
      '1002,6,3,1,2,2.5,3,3.5,4,0',
      '1003,0,0,0,0,0,0,0,0,0',
    ].join('\r\n')
  )
})
