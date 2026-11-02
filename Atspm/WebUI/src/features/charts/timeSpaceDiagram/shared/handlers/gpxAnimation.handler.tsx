import { ECharts, SeriesOption } from 'echarts'
import { useCallback, useMemo } from 'react'
import type { GpxChartTrack } from '../gpxRoutePlacement'
import { TIME_SPACE_CYCLE_LABEL_SERIES_Z } from '../transformers/timeSpaceTransformerBase'
import { TIME_SPACE_GPX_TRACKS_LEGEND_NAME } from '../types'

const GPX_OVERLAY_SERIES_ID_PREFIX = 'gpx-'
// Above the signal bars and their duration labels, so the drive stays visible.
const GPX_OVERLAY_SERIES_Z = TIME_SPACE_CYCLE_LABEL_SERIES_Z + 1

function isSeriesOption(
  value: SeriesOption | null | undefined
): value is SeriesOption {
  return Boolean(value && typeof value === 'object')
}

function isGpxOverlaySeries(
  series: SeriesOption | null | undefined
): boolean {
  if (!isSeriesOption(series) || typeof series.id !== 'string') {
    return false
  }

  return series.id.startsWith(GPX_OVERLAY_SERIES_ID_PREFIX)
}

function getCurrentChartSeries(chart: ECharts): SeriesOption[] {
  const option = chart.getOption()
  const rawSeries = Array.isArray(option?.series)
    ? option.series
    : option?.series
      ? [option.series]
      : []

  return rawSeries.filter(isSeriesOption)
}

export function mergeChartSeriesWithGpxOverlays(
  currentSeries: Array<SeriesOption | null | undefined>,
  overlaySeries: SeriesOption[]
) {
  const baseSeries = currentSeries.filter(
    (series): series is SeriesOption => !isGpxOverlaySeries(series)
  )

  return [...baseSeries, ...overlaySeries]
}

export const useGpxAnimationHandler = (
  chart: ECharts | null,
  tracks: GpxChartTrack[]
) => {
  const processedSeries = useMemo<SeriesOption[]>(
    () =>
      tracks
        .filter((track) => track.data.length > 0)
        .map((track) => ({
          id: `${GPX_OVERLAY_SERIES_ID_PREFIX}${track.id}`,
          name: TIME_SPACE_GPX_TRACKS_LEGEND_NAME,
          type: 'line',
          data: track.data,
          color: 'black',
          symbol: 'none',
          silent: true,
          z: GPX_OVERLAY_SERIES_Z,
          lineStyle: {
            width: 3,
            color: 'black',
            type: 'dotted',
          },
          clip: true,
        })),
    [tracks]
  )

  const play = useCallback(() => {
    if (!chart) return

    const nextSeries = mergeChartSeriesWithGpxOverlays(
      getCurrentChartSeries(chart),
      processedSeries
    )

    chart.setOption(
      {
        series: nextSeries,
      },
      { replaceMerge: ['series'] }
    )
  }, [chart, processedSeries])

  return { play }
}
