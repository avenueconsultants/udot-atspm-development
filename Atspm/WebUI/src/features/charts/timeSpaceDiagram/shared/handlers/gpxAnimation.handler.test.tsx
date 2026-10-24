import { act, renderHook } from '@testing-library/react'
import type { ECharts, EChartsOption, SeriesOption } from 'echarts'
import type { GpxChartTrack } from '../gpxRoutePlacement'
import {
  mergeChartSeriesWithGpxOverlays,
  useGpxAnimationHandler,
} from './gpxAnimation.handler'

class MockChart {
  option: EChartsOption

  constructor(option: EChartsOption) {
    this.option = cloneOption(option)
  }

  getOption() {
    return this.option
  }

  setOption(nextOption: EChartsOption) {
    this.option = {
      ...this.option,
      ...nextOption,
      series: Array.isArray(nextOption.series)
        ? cloneSeries(nextOption.series as Array<SeriesOption | null | undefined>)
        : this.option.series,
    }
  }
}

function cloneSeries(series: Array<SeriesOption | null | undefined>) {
  return JSON.parse(JSON.stringify(series)) as EChartsOption['series']
}

function cloneOption(option: EChartsOption) {
  return JSON.parse(JSON.stringify(option)) as EChartsOption
}

function buildChartOption(): EChartsOption {
  return {
    series: [
      {
        id: 'Cycles EB',
        name: 'Cycles EB',
        type: 'line',
        data: [['2025-02-17T13:00:00', 0]],
      },
      {
        id: 'Location axis',
        name: 'Location axis',
        type: 'custom',
        data: [],
      },
      {
        id: 'gpx-stale',
        name: 'GPX stale',
        type: 'line',
        data: [['2025-02-17T13:00:00', 10]],
      },
    ],
  }
}

function buildTracks(): GpxChartTrack[] {
  return [
    {
      id: 'upload-1',
      data: [
        [Date.UTC(2025, 1, 17, 20, 6), 0],
        [Date.UTC(2025, 1, 17, 20, 7), null],
        [Date.UTC(2025, 1, 17, 20, 8), 35],
      ],
      message: null,
    },
    {
      id: 'upload-2',
      data: [],
      message:
        "No part of this drive during the chart's time follows this route.",
    },
  ]
}

function getSeriesIds(chart: MockChart) {
  return (Array.isArray(chart.option.series) ? chart.option.series : [])
    .map((series) => (typeof series?.id === 'string' ? series.id : ''))
    .filter(Boolean)
}

function getSeriesById(chart: MockChart, id: string) {
  return (Array.isArray(chart.option.series) ? chart.option.series : []).find(
    (series) => series?.id === id
  )
}

describe('gpxAnimation handler', () => {
  it('replaces only GPX overlay series and preserves the base diagram series', () => {
    const merged = mergeChartSeriesWithGpxOverlays(
      [
        { id: 'Cycles EB', type: 'line', data: [] },
        { id: 'gpx-stale', type: 'line', data: [] },
        { id: 'SRM 5600 Primary', type: 'line', data: [] },
        { id: 'Location axis', type: 'custom', data: [] },
      ],
      [{ id: 'gpx-upload-1', type: 'line', data: [] }]
    )

    expect(merged.map((series) => series.id)).toEqual([
      'Cycles EB',
      'SRM 5600 Primary',
      'Location axis',
      'gpx-upload-1',
    ])
  })

  it('draws placed tracks over the time-space series and removes stale overlays when cleared', () => {
    const chart = new MockChart(buildChartOption())
    const { result, rerender } = renderHook(
      ({ tracks }) =>
        useGpxAnimationHandler(chart as unknown as ECharts, tracks),
      {
        initialProps: {
          tracks: buildTracks(),
        },
      }
    )

    act(() => {
      result.current.play()
    })

    expect(getSeriesIds(chart)).toEqual([
      'Cycles EB',
      'Location axis',
      'gpx-upload-1',
    ])
    expect(getSeriesById(chart, 'gpx-upload-1')?.name).toBe('GPX Tracks')
    expect(
      (
        getSeriesById(chart, 'gpx-upload-1') as SeriesOption & {
          lineStyle?: { type?: string }
        }
      )?.lineStyle?.type
    ).toBe('dotted')
    // The gap where the drive left the route stays a gap.
    expect(getSeriesById(chart, 'gpx-upload-1')?.data).toEqual(
      buildTracks()[0].data
    )

    rerender({ tracks: [] })

    act(() => {
      result.current.play()
    })

    expect(getSeriesIds(chart)).toEqual(['Cycles EB', 'Location axis'])
  })
})
