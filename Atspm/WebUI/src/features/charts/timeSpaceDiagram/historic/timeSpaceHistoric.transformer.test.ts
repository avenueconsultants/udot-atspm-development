import { ToolType } from '@/features/charts/common/types'
import type { EChartsOption, SeriesOption } from 'echarts'
import transformTimeSpaceHistoricData from './timeSpaceHistoric.transformer'
import type {
  RawTimeSpaceDiagramResponse,
  RawTimeSpaceHistoricData,
} from '../shared/types'

let originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext

function buildHistoricLocation(
  phaseType: 'Primary' | 'Opposing',
  overrides: Partial<RawTimeSpaceHistoricData> = {}
): RawTimeSpaceHistoricData {
  return {
    start: '2026-04-07T08:00:00Z',
    end: '2026-04-07T09:00:00Z',
    locationIdentifier:
      phaseType === 'Primary' ? 'primary-location' : 'opposing-location',
    locationDescription: `${phaseType} location`,
    phaseNumber: phaseType === 'Primary' ? 2 : 6,
    phaseNumberSort: phaseType === 'Primary' ? '2' : '6',
    distanceToNextLocation: 100,
    distanceToPreviousLocation: 0,
    speed: 35,
    approachId: phaseType === 'Primary' ? 1 : 2,
    approachDescription: phaseType === 'Primary' ? 'NBT ph2' : 'SBT ph6',
    phaseType,
    calculatedDistanceToNext: 100,
    calculatedDistanceToPrevious: 0,
    isIgnoredLocation: false,
    greenTimeEvents: [],
    laneByLaneCountDetectors: [
      {
        distanceToStopBar: 40,
        detectorOn: new Date('2026-04-07T08:10:00Z'),
        detectorOff: new Date('2026-04-07T08:10:05Z'),
      },
    ],
    advanceCountDetectors: [
      {
        distanceToStopBar: 60,
        detectorOn: new Date('2026-04-07T08:15:00Z'),
        detectorOff: new Date('2026-04-07T08:15:04Z'),
      },
    ],
    stopBarPresenceDetectors: [
      {
        distanceToStopBar: 0,
        detectorOn: new Date('2026-04-07T08:20:00Z'),
        detectorOff: new Date('2026-04-07T08:20:06Z'),
      },
    ],
    cycleAllEvents: null,
    pedestrianIntervals: [],
    percentArrivalOnGreen: 50,
    tmcForPhase: {
      leftTurnEvents: [],
      rightTurnEvents: [],
    },
    order: phaseType === 'Primary' ? 1 : 2,
    cycleLength: null,
    isPhaseOverLap: false,
    tspNumberCheckins: 0,
    tspNumberCheckouts: 0,
    tspNumberEarlyGreens: 0,
    tspNumberExtendedGreens: 0,
    tspEvents: [],
    priorityAndPreemptionEvents: [],
    srmEntityTracks: [],
    ...overrides,
  }
}

function renderStopBarPresenceNode(
  location: RawTimeSpaceHistoricData,
  { dataIndex = 0 }: { dataIndex?: number } = {}
) {
  const response: RawTimeSpaceDiagramResponse = {
    type: ToolType.TimeSpaceHistoric,
    data: [
      {
        isSuccess: true,
        error: null,
        result: location,
      },
      {
        isSuccess: true,
        error: null,
        result: buildHistoricLocation('Opposing', {
          locationIdentifier: 'secondary-location',
          stopBarPresenceDetectors: [],
        }),
      },
    ],
  }

  const result = transformTimeSpaceHistoricData(response)
  const chart = result.data.chart as EChartsOption
  const series = (Array.isArray(chart.series) ? chart.series : []).find(
    (entry) =>
      String((entry as SeriesOption).id).startsWith(`SBP ${location.locationIdentifier}`)
  ) as
    | (SeriesOption & {
        data?: unknown[]
        renderItem?: (
          params: {
            dataIndex: number
          },
          api: {
            coord: (value: unknown[]) => [number, number]
            value: (index: number, dataIndex?: number) => unknown
          }
        ) => unknown
      })
    | undefined

  const dataPoints = Array.isArray(series?.data) ? (series.data as unknown[][]) : []

  return series?.renderItem?.(
    { dataIndex },
    {
      coord: (value) => [
        typeof value[0] === 'number'
          ? value[0]
          : Date.parse(String(value[0] ?? '')),
        Number(value[1] ?? 0),
      ],
      value: (index, renderDataIndex) =>
        dataPoints[renderDataIndex ?? dataIndex]?.[index],
    }
  )
}

describe('transformTimeSpaceHistoricData detection series interaction', () => {
  beforeAll(() => {
    originalCanvasGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null)
  })

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalCanvasGetContext
  })

  it('marks detection series as non-interactable', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary'),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing'),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    const laneByLane = series.find((entry) =>
      String(entry.name).startsWith('Lane by Lane Count ')
    )
    const advanceCount = series.find((entry) =>
      String(entry.name).startsWith('Advance Count ')
    )
    const stopBarPresence = series.find((entry) =>
      String(entry.name).startsWith('Stop Bar Presence ')
    )

    expect(laneByLane?.silent).toBe(true)
    expect(laneByLane?.tooltip).toMatchObject({ show: false })
    expect(advanceCount?.silent).toBe(true)
    expect(advanceCount?.tooltip).toMatchObject({ show: false })
    expect(stopBarPresence?.silent).toBe(true)
    expect(stopBarPresence?.tooltip).toMatchObject({ show: false })
  })

  it('marks distance label cards as non-interactable', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary'),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing'),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    const distanceLabels = series.find(
      (entry) => String(entry.name) === 'Labels distance'
    )

    expect(distanceLabels?.silent).toBe(true)
    expect(distanceLabels?.tooltip).toMatchObject({ show: false })
  })

  it('marks turn series as non-interactable', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary', {
            tmcForPhase: {
              leftTurnEvents: [{ start: '2026-04-07T08:25:00Z' }] as never[],
              rightTurnEvents: [{ start: '2026-04-07T08:26:00Z' }] as never[],
            },
          }),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing'),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    const leftTurn = series.find((entry) =>
      String(entry.name).startsWith('Left Turn ')
    )
    const rightTurn = series.find((entry) =>
      String(entry.name).startsWith('Right Turn ')
    )

    expect(leftTurn?.silent).toBe(true)
    expect(leftTurn?.tooltip).toMatchObject({ show: false })
    expect(rightTurn?.silent).toBe(true)
    expect(rightTurn?.tooltip).toMatchObject({ show: false })
  })

  it('does not synthesize TSP series when no TSP events are present', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary'),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing'),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    expect(
      series.some((entry) => String(entry.name) === 'TSP Request (112-115)')
    ).toBe(false)
    expect(
      series.some((entry) => String(entry.name) === 'TSP Service (118-119)')
    ).toBe(false)
  })

  it('renders SRM intersection changes as dotted connector segments', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary', {
            locationIdentifier: 'location-1',
            distanceToNextLocation: 2200,
            srmEntityTracks: [
              {
                entityId: 'bus-42',
                points: [
                  {
                    time: '2026-04-07T08:00:00Z',
                    timestampMs: Date.parse('2026-04-07T08:00:00Z'),
                    distance: 0,
                    intersectionId: 'location-1',
                  },
                  {
                    time: '2026-04-07T08:01:00Z',
                    timestampMs: Date.parse('2026-04-07T08:01:00Z'),
                    distance: 10,
                    intersectionId: 'location-1',
                  },
                  {
                    time: '2026-04-07T08:02:00Z',
                    timestampMs: Date.parse('2026-04-07T08:02:00Z'),
                    distance: 20,
                    intersectionId: 'location-2',
                  },
                  {
                    time: '2026-04-07T08:03:00Z',
                    timestampMs: Date.parse('2026-04-07T08:03:00Z'),
                    distance: 30,
                    intersectionId: 'location-2',
                  },
                ],
              },
            ],
          }),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing', {
            locationIdentifier: 'opposing-location',
            distanceToNextLocation: 2200,
          }),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    const continuousSeries = series.filter(
      (entry) => String(entry.name) === 'SRM Entity Continuous NBT ph2'
    )
    const firstContinuousSeries = continuousSeries.find((entry) =>
      String(entry.id).includes('segment-0')
    )
    const secondContinuousSeries = continuousSeries.find((entry) =>
      String(entry.id).includes('segment-1')
    )
    const gapSeries = series.find(
      (entry) => String(entry.name) === 'SRM Entity Gap NBT ph2'
    )

    expect(continuousSeries).toHaveLength(2)
    expect(gapSeries?.lineStyle).toMatchObject({ type: 'dotted' })
    expect(gapSeries?.data).toEqual([
      (firstContinuousSeries?.data as unknown[][])?.[1],
      (secondContinuousSeries?.data as unknown[][])?.[0],
    ])
    expect(chart.legend).toMatchObject({
      selected: {
        'SRM Entity Continuous NBT ph2': true,
        'SRM Entity Gap NBT ph2': true,
      },
    })
  })

  it('does not render SRM gaps just because matching entities appear on adjacent rows', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary', {
            locationIdentifier: 'location-1',
            distanceToNextLocation: 2200,
            srmEntityTracks: [
              {
                entityId: 'bus-42',
                points: [
                  {
                    time: '2026-04-07T08:00:00Z',
                    timestampMs: Date.parse('2026-04-07T08:00:00Z'),
                    distance: 0,
                    intersectionId: 'location-1',
                  },
                  {
                    time: '2026-04-07T08:01:00Z',
                    timestampMs: Date.parse('2026-04-07T08:01:00Z'),
                    distance: 10,
                    intersectionId: 'location-1',
                  },
                ],
              },
            ],
          }),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary', {
            locationIdentifier: 'location-2',
            distanceToNextLocation: 2200,
            order: 2,
            srmEntityTracks: [
              {
                entityId: 'bus-42',
                points: [
                  {
                    time: '2026-04-07T08:02:00Z',
                    timestampMs: Date.parse('2026-04-07T08:02:00Z'),
                    distance: 0,
                    intersectionId: 'location-2',
                  },
                  {
                    time: '2026-04-07T08:03:00Z',
                    timestampMs: Date.parse('2026-04-07T08:03:00Z'),
                    distance: 20,
                    intersectionId: 'location-2',
                  },
                ],
              },
            ],
          }),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing', {
            locationIdentifier: 'opposing-location',
            distanceToNextLocation: 2200,
          }),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    expect(
      series.filter(
        (entry) => String(entry.name) === 'SRM Entity Continuous NBT ph2'
      )
    ).toHaveLength(2)
    expect(
      series.some((entry) => String(entry.name) === 'SRM Entity Gap NBT ph2')
    ).toBe(false)
  })

  it('renders legacy SRM points without intersection ids as one solid track', () => {
    const response: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Primary', {
            locationIdentifier: 'location-1',
            distanceToNextLocation: 2200,
            srmEntityTracks: [
              {
                entityId: 'bus-42',
                points: [
                  {
                    time: '2026-04-07T08:00:00Z',
                    timestampMs: Date.parse('2026-04-07T08:00:00Z'),
                    distance: 0,
                  },
                  {
                    time: '2026-04-07T08:01:00Z',
                    timestampMs: Date.parse('2026-04-07T08:01:00Z'),
                    distance: 10,
                  },
                ],
              },
            ],
          }),
        },
        {
          isSuccess: true,
          error: null,
          result: buildHistoricLocation('Opposing', {
            locationIdentifier: 'opposing-location',
            distanceToNextLocation: 2200,
          }),
        },
      ],
    }

    const result = transformTimeSpaceHistoricData(response)
    const chart = result.data.chart as EChartsOption
    const series = Array.isArray(chart.series)
      ? (chart.series as SeriesOption[])
      : []

    const continuousSeries = series.filter(
      (entry) => String(entry.name) === 'SRM Entity Continuous NBT ph2'
    )

    expect(continuousSeries).toHaveLength(1)
    expect(continuousSeries[0]?.data).toHaveLength(2)
    expect(
      series.some((entry) => String(entry.name) === 'SRM Entity Gap NBT ph2')
    ).toBe(false)
  })

  it('renders stop-bar-presence continuations in striped grey', () => {
    const node = renderStopBarPresenceNode(
      buildHistoricLocation('Primary', {
        end: '2026-04-07T08:01:00Z',
        stopBarPresenceDetectors: [
          {
            distanceToStopBar: 0,
            detectorOn: new Date('2026-04-07T08:00:10Z'),
            detectorOff: new Date('2026-04-07T08:00:20Z'),
          },
        ],
      })
    ) as {
      children?: Array<{
        style?: { fill?: unknown }
      }>
    }

    expect(node?.children).toHaveLength(3)
    expect(node.children?.[0]?.style?.fill).toBe('#eef1f5')
    expect(node.children?.[1]?.style?.fill).toBe('darkblue')
    expect(node.children?.[2]?.style?.fill).toBe('#eef1f5')
  })
})
