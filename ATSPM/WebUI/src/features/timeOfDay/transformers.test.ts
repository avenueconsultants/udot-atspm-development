import type { TimeOfDayResult } from '@/api/reports'

import {
  buildPlanProfileOption,
  buildScheduleComparisonOption,
  buildScheduleRows,
  buildSplitPressureOption,
  getMovementPressures,
} from './transformers'

const result = {
  selectedDates: [],
} as TimeOfDayResult

describe('time-of-day chart titles', () => {
  test('includes the plan recommendation title', () => {
    const option = buildPlanProfileOption(result)

    expect(Array.isArray(option.title)).toBe(true)
    expect(option.title).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Corridor Plan Recommendation',
          left: 0,
          textAlign: 'left',
        }),
      ])
    )
  })

  test('includes the split pressure title', () => {
    const option = buildSplitPressureOption(result)

    expect(Array.isArray(option.title)).toBe(true)
    expect(option.title).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Corridor Split Pressure',
          left: 0,
          textAlign: 'left',
        }),
      ])
    )
  })

  test('uses compact spacing for the title, date, and info rows', () => {
    const option = buildPlanProfileOption({
      selectedDates: ['2026-04-14', '2026-04-16'],
      recommendation: { amPeakTime: '08:30' },
    } as TimeOfDayResult)
    const titles = option.title as Array<{
      top?: number | string
    }>

    expect(titles.map((title) => title.top)).toEqual([0, 32, 58])
  })

  test('uses one padded volume-axis maximum for both analysis charts', () => {
    const sharedResult = {
      selectedDates: [],
      planProfile: {
        corridorProfile: {
          points: [
            { minutes: 480, averageVolume: 3300, smoothedVolume: 3200 },
          ],
        },
        peaks: [
          {
            period: 'PM',
            series: 'Location',
            locationIdentifier: '7192',
            minutes: 1020,
            value: 5200,
            valueUnits: 'vph',
          },
        ],
      },
      splitPressure: {
        primaryProfile: {
          points: [{ minutes: 1020, averageVolume: 4700 }],
        },
        movementPressures: [
          {
            period: 'PM',
            locationIdentifier: '7191',
            peakTime: '17:00',
            volume: 5100,
          },
        ],
        periodPeaks: [
          {
            period: 'PM',
            series: 'CrossTrafficPercent',
            minutes: 1020,
            value: 10000,
            valueUnits: 'percent',
          },
        ],
      },
    } as TimeOfDayResult
    const getVolumeAxisMax = (option: ReturnType<typeof buildPlanProfileOption>) =>
      (option.yAxis as Array<{ max?: number }>)[0].max

    expect(getVolumeAxisMax(buildPlanProfileOption(sharedResult))).toBe(6000)
    expect(getVolumeAxisMax(buildSplitPressureOption(sharedResult))).toBe(6000)
  })

  test('uses square chart markers for movement pressure', () => {
    const option = buildSplitPressureOption({
      selectedDates: [],
      splitPressure: {
        crossTrafficLocations: [
          {
            period: 'AM',
            locationIdentifier: 'cross-traffic',
            minutes: 480,
            totalVehiclesPerHour: 100,
          },
        ],
        movementPressures: [
          {
            period: 'AM',
            locationIdentifier: 'movement-pressure',
            movementLabel: 'Left',
            peakTime: '09:00',
            volume: 200,
          },
        ],
      },
    } as TimeOfDayResult)
    const series = option.series as Array<{
      name?: string
      data?: Array<{ name?: string; symbol?: string }>
    }>
    const amCrossTraffic = series.find(
      (seriesOption) => seriesOption.name === 'AM Cross Traffic Locations'
    )
    const amMovementPressure = series.find(
      (seriesOption) => seriesOption.name === 'AM Movement Pressure'
    )
    const legend = option.legend as {
      data?: Array<{ name?: string }>
      selected?: Record<string, boolean>
    }

    expect(amCrossTraffic?.data).toEqual([
      expect.objectContaining({ name: '1', symbol: 'circle' }),
    ])
    expect(amMovementPressure?.data).toEqual([
      expect.objectContaining({ name: '2', symbol: 'rect' }),
    ])
    expect(legend.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'AM Cross Traffic Locations' }),
        expect.objectContaining({ name: 'AM Movement Pressure' }),
      ])
    )
    expect(legend.selected).toMatchObject({
      'AM Movement Pressure': false,
      'PM Movement Pressure': false,
    })
  })

  test('groups movement pressure by numbered location, then direction', () => {
    const movements = getMovementPressures(
      [
        {
          period: 'AM',
          locationIdentifier: 'Location 2',
          movementLabel: 'Right',
          volume: 500,
        },
        {
          period: 'AM',
          locationIdentifier: 'Location 1',
          movementLabel: 'Thru',
          volume: 400,
        },
        {
          period: 'AM',
          locationIdentifier: 'Location 2',
          movementLabel: 'Left',
          volume: 100,
        },
        {
          period: 'AM',
          locationIdentifier: 'Location 1',
          movementLabel: 'Right',
          volume: 300,
        },
        {
          period: 'AM',
          locationIdentifier: 'Location 1',
          movementLabel: 'Left',
          volume: 200,
        },
      ],
      'AM',
      { location1: 2, location2: 1 }
    )

    expect(
      movements.map((movement) => [
        movement.locationIdentifier,
        movement.movementLabel,
      ])
    ).toEqual([
      ['Location 2', 'Left'],
      ['Location 2', 'Right'],
      ['Location 1', 'Left'],
      ['Location 1', 'Thru'],
      ['Location 1', 'Right'],
    ])
  })

  test.each([
    ['plan recommendation', buildPlanProfileOption],
    ['split pressure', buildSplitPressureOption],
  ])(
    'overlays synchronized existing and proposed schedule rails on the %s chart',
    (_, buildOption) => {
      const option = buildOption({
        locationIdentifiers: ['7192', '7191', '7190'],
        recommendation: {
          recommendedSchedule: [
            {
              planNumber: 'Free',
              planDescription: 'Free',
              start: '2026-01-01T00:00:00',
              end: '2026-01-01T07:00:00',
            },
            {
              planNumber: '1',
              planDescription: 'Plan 1',
              start: '2026-01-01T07:00:00',
              end: '2026-01-01T09:00:00',
            },
          ],
        },
        planComparison: {
          commonCurrentSchedule: [
            {
              planNumber: 'Free',
              planDescription: 'Free',
              start: '2026-01-01T00:00:00',
              end: '2026-01-01T06:00:00',
            },
            {
              planNumber: '7',
              planDescription: 'Plan 7',
              start: '2026-01-01T06:00:00',
              end: '2026-01-01T09:00:00',
            },
          ],
          exceptionLocationIdentifiers: ['7191', '7190'],
        },
      } as TimeOfDayResult)
      const series = option.series as Array<{
        name?: string
        data?: unknown[][]
        markArea?: {
          data?: Array<
            [{ name?: string; xAxis?: number }, { xAxis?: number }]
          >
        }
      }>
      const existingRail = series.find(
        (seriesOption) => seriesOption.name === 'Existing schedule rail'
      )
      const proposedRail = series.find(
        (seriesOption) => seriesOption.name === 'Proposed schedule rail'
      )
      const scheduleContextSeries = series.find(
        (seriesOption) => seriesOption.markArea?.data?.length
      )
      const graphic = option.graphic as {
        style?: { text?: string }
      }
      const dataZoom = option.dataZoom as Array<{
        xAxisIndex?: number | number[]
      }>

      expect(Array.isArray(option.grid)).toBe(true)
      expect(option.grid).toHaveLength(2)
      expect(dataZoom.map((zoom) => zoom.xAxisIndex)).toEqual([
        [0, 1],
        [0, 1],
      ])
      expect(existingRail?.data?.map((datum) => datum.slice(0, 4))).toEqual([
        [0, 360, 0, 'FREE'],
        [360, 540, 0, '7'],
      ])
      expect(proposedRail?.data?.map((datum) => datum.slice(0, 4))).toEqual([
        [0, 420, 1, 'FREE'],
        [420, 540, 1, '1'],
      ])
      expect(scheduleContextSeries?.markArea?.data).toEqual(
        expect.arrayContaining([
          [
            expect.objectContaining({
              name: 'Existing and proposed plans differ',
              xAxis: 360,
            }),
            { xAxis: 420 },
          ],
          [
            expect.objectContaining({
              name: 'Existing and proposed plans differ',
              xAxis: 420,
            }),
            { xAxis: 540 },
          ],
        ])
      )
      expect(graphic.style?.text).toContain(
        'common schedule for 1 of 3 locations (7192)'
      )
    }
  )

  test('aligns recommended and current plans by shared time windows', () => {
    const rows = buildScheduleRows({
      recommendation: {
        recommendedSchedule: [
          {
            planNumber: 'Free',
            planDescription: 'Free',
            start: '2026-01-01T00:00:00',
            end: '2026-01-01T07:00:00',
          },
          {
            planNumber: '1',
            planDescription: 'Plan 1',
            start: '2026-01-01T07:00:00',
            end: '2026-01-01T09:00:00',
          },
        ],
      },
      planComparison: {
        commonCurrentSchedule: [
          {
            planNumber: 'Free',
            planDescription: 'Free',
            start: '2026-01-01T00:00:00',
            end: '2026-01-01T06:00:00',
          },
          {
            planNumber: '7',
            planDescription: 'Plan 7',
            start: '2026-01-01T06:00:00',
            end: '2026-01-01T09:00:00',
          },
        ],
      },
    } as TimeOfDayResult)

    expect(rows).toEqual([
      expect.objectContaining({
        start: '00:00',
        end: '06:00',
        durationMinutes: 360,
        recommended: { plan: 'FREE', description: 'Free' },
        current: { plan: 'FREE', description: 'Free' },
        comparison: 'Same',
      }),
      expect.objectContaining({
        start: '06:00',
        end: '07:00',
        durationMinutes: 60,
        recommended: { plan: 'FREE', description: 'Free' },
        current: { plan: '7', description: 'Plan 7' },
        comparison: 'Different',
      }),
      expect.objectContaining({
        start: '07:00',
        end: '09:00',
        durationMinutes: 120,
        recommended: { plan: '1', description: 'Plan 1' },
        current: { plan: '7', description: 'Plan 7' },
        comparison: 'Different',
      }),
    ])
  })

  test('builds a two-lane schedule timeline with highlighted differences', () => {
    const option = buildScheduleComparisonOption({
      recommendation: {
        recommendedSchedule: [
          {
            planNumber: 'Free',
            planDescription: 'Free',
            start: '2026-01-01T00:00:00',
            end: '2026-01-01T07:00:00',
          },
          {
            planNumber: '1',
            planDescription: 'Plan 1',
            start: '2026-01-01T07:00:00',
            end: '2026-01-01T09:00:00',
          },
        ],
      },
      planComparison: {
        commonCurrentSchedule: [
          {
            planNumber: 'Free',
            planDescription: 'Free',
            start: '2026-01-01T00:00:00',
            end: '2026-01-01T06:00:00',
          },
          {
            planNumber: '7',
            planDescription: 'Plan 7',
            start: '2026-01-01T06:00:00',
            end: '2026-01-01T09:00:00',
          },
        ],
      },
    } as TimeOfDayResult)
    const series = option.series as Array<{
      name?: string
      data?: unknown[][]
      markLine?: { data?: Array<{ xAxis?: number }> }
      markArea?: {
        data?: Array<[{ xAxis?: number }, { xAxis?: number }]>
      }
    }>
    const existingSchedule = series.find(
      (seriesOption) => seriesOption.name === 'Existing schedule'
    )
    const proposedSchedule = series.find(
      (seriesOption) => seriesOption.name === 'Proposed schedule'
    )
    const differenceWindows = series.find(
      (seriesOption) => seriesOption.name === 'Different plan windows'
    )

    expect(existingSchedule?.data?.map((datum) => datum.slice(0, 4))).toEqual([
      [0, 360, 0, 'FREE'],
      [360, 540, 0, '7'],
    ])
    expect(proposedSchedule?.data?.map((datum) => datum.slice(0, 4))).toEqual([
      [0, 420, 1, 'FREE'],
      [420, 540, 1, '1'],
    ])
    expect(
      series.some(
        (seriesOption) =>
          seriesOption.name === 'Existing changes' ||
          seriesOption.name === 'Proposed changes'
      )
    ).toBe(false)
    expect(differenceWindows?.markArea?.data).toEqual([
      [{ xAxis: 360 }, { xAxis: 420 }],
      [{ xAxis: 420 }, { xAxis: 540 }],
    ])
  })
})
