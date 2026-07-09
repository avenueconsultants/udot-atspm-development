import type { TimeOfDayPeakEventDto, TimeOfDayResult } from '@/api/reports'
import type { EChartsOption, SeriesOption } from 'echarts'
import {
  buildPlanProfileOption,
  buildSplitPressureOption,
  getLocationPeakEvents,
} from './transformers'

const getSeries = (option: EChartsOption) => option.series as SeriesOption[]

const getLegendData = (option: EChartsOption) => {
  const legend = Array.isArray(option.legend) ? option.legend[0] : option.legend

  return (legend as { data?: Array<string | { name?: string; icon?: string }> }).data
}

const getLegend = (option: EChartsOption) =>
  Array.isArray(option.legend) ? option.legend[0] : option.legend

const getLegendShow = (option: EChartsOption) =>
  (getLegend(option) as { show?: boolean }).show

describe('timeOfDay transformers', () => {
  it('builds Data-Importer-style plan profile legend entries and signal peak fallback lists', () => {
    const peaks: TimeOfDayPeakEventDto[] = [
      {
        series: 'Corridor',
        period: 'AM',
        minutes: 480,
        value: 1200,
        label: 'AM Corridor Peak',
      },
      {
        series: 'Corridor',
        period: 'PM',
        minutes: 1020,
        value: 1400,
        label: 'PM Corridor Peak',
      },
      {
        series: 'Location',
        locationIdentifier: '1001',
        locationDescription: 'Main St',
        minutes: 510,
        value: 425,
      },
      {
        series: 'Location',
        locationIdentifier: '1002',
        locationDescription: 'State St',
        minutes: 960,
        value: 525,
      },
    ]
    const result: TimeOfDayResult = {
      recommendation: {
        recommendedSchedule: [
          {
            planNumber: '254',
            start: '2026-01-01T23:30:00',
            end: '2026-01-02T05:00:00',
          },
        ],
      },
      planProfile: {
        corridorProfile: {
          points: [
            { minutes: 480, averageVolume: 900, smoothedVolume: 850 },
            { minutes: 1020, averageVolume: 1000, smoothedVolume: 950 },
          ],
        },
        directionalProfiles: [
          {
            direction: 'Eastbound',
            points: [{ minutes: 480, averageVolume: 450 }],
          },
        ],
        peaks,
      },
    }

    const option = buildPlanProfileOption(result)
    const series = getSeries(option)

    expect(getLegendData(option)).toEqual([
      expect.objectContaining({ name: 'Median Raw Volume' }),
      expect.objectContaining({ name: 'Smoothed For Breakpoints' }),
      expect.objectContaining({ name: 'Eastbound total profile' }),
      expect.objectContaining({ name: 'AM Corridor Peak', icon: 'circle' }),
      expect.objectContaining({ name: 'PM Corridor Peak', icon: 'circle' }),
      expect.objectContaining({ name: 'AM Signal Peaks', icon: 'circle' }),
      expect.objectContaining({ name: 'PM Signal Peaks', icon: 'circle' }),
    ])
    expect(getLegendShow(option)).toBe(true)
    expect(getLegend(option)).toEqual(
      expect.objectContaining({
        orient: 'vertical',
        right: 0,
        top: 72,
        type: 'scroll',
      })
    )
    expect(series.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'AM Corridor Peak',
        'PM Corridor Peak',
        'AM Signal Peaks',
        'PM Signal Peaks',
      ])
    )
    expect(
      (series.find((entry) => entry.name === 'AM Signal Peaks') as SeriesOption)
        .data
    ).toEqual([
      expect.objectContaining({
        itemStyle: { color: '#ef6c00' },
        name: '1',
      }),
    ])
    expect(
      (series.find((entry) => entry.name === 'PM Signal Peaks') as SeriesOption)
        .data
    ).toEqual([
      expect.objectContaining({
        itemStyle: { color: '#1565c0' },
        name: '2',
      }),
    ])
    expect(getLocationPeakEvents(peaks, 'AM')).toEqual([
      expect.objectContaining({
        badgeColor: '#ef6c00',
        locationIdentifier: '1001',
        badgeNumber: 1,
      }),
    ])
    expect(getLocationPeakEvents(peaks, 'PM')).toEqual([
      expect.objectContaining({
        badgeColor: '#1565c0',
        locationIdentifier: '1002',
        badgeNumber: 2,
      }),
    ])
    expect((series[0] as SeriesOption & { markArea?: { data?: unknown[] } }).markArea?.data).toEqual([
      [
        expect.objectContaining({ name: 'Recommended FREE' }),
        expect.any(Object),
      ],
    ])
  })

  it('builds Data-Importer-style split pressure legend and threshold series', () => {
    const result: TimeOfDayResult = {
      splitPressure: {
        primaryDirections: ['Eastbound', 'Westbound'],
        crossDirections: ['Northbound', 'Southbound'],
        primaryProfile: {
          points: [{ minutes: 480, averageVolume: 900 }],
        },
        crossStreetProfile: {
          points: [{ minutes: 480, averageVolume: 300 }],
        },
        crossTrafficShare: [
          { minutes: 480, crossTrafficPercent: 35, primaryVolume: 900 },
        ],
        thresholdPercentByName: {
          SplitReview: 35,
          ShoulderReview: 45,
        },
      },
    }

    const option = buildSplitPressureOption(result)
    const series = getSeries(option)

    expect(getLegendData(option)).toEqual([
      'Representative Eastbound, Westbound primary',
      'Representative Northbound, Southbound cross street',
      'Cross-traffic percent',
      '35% split review',
      '45% shoulder review',
    ])
    expect(series.map((entry) => entry.name)).toEqual(
      expect.arrayContaining([
        'Representative Eastbound, Westbound primary',
        'Representative Northbound, Southbound cross street',
        'Cross-traffic percent',
        '35% split review',
        '45% shoulder review',
      ])
    )
  })
})