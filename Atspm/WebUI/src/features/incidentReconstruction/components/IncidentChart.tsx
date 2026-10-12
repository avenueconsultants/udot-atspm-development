// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - IncidentChart.tsx
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
import {
  CHART_FONTS,
  CalloutPosition,
  CalloutPositions,
  MeasureText,
  ZOOM_HEIGHT,
  Zoom,
  chartGeometry,
  layoutCallouts,
  titleHeight,
  zoomedWindow,
} from '@/features/incidentReconstruction/chartLayout'
import {
  CANDIDATE_SERIES_ID,
  LABELED_SERIES_ID,
  buildChartOption,
} from '@/features/incidentReconstruction/chartOption'
import { EventRow } from '@/features/incidentReconstruction/eventRows'
import { normalizeAdjustment } from '@/features/incidentReconstruction/latencyAdjustment'
import { TimelineBand } from '@/features/incidentReconstruction/types'
import { SignalNames } from '@/features/incidentReconstruction/urlCodecs'
import { formatClock } from '@/features/incidentReconstruction/wallClock'
import type { ECharts } from 'echarts'
import { init } from 'echarts'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'

export interface IncidentChartHandle {
  /** The chart as a PNG data URL at twice screen resolution, without the zoom slider. */
  getImage(): Promise<string | null>
}

const PIXEL_RATIO = 2
/** White space around the saved picture, so the title does not touch the edge. */
const IMAGE_MARGIN = 16

/** Cuts the chart picture off at the given height and sets it on a white margin. */
function cropChart(
  dataUrl: string,
  chartWidth: number,
  chartHeight: number
): Promise<string> {
  const width = chartWidth + IMAGE_MARGIN * 2
  const height = chartHeight + IMAGE_MARGIN * 2
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * PIXEL_RATIO
      canvas.height = height * PIXEL_RATIO
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('The chart picture could not be drawn.'))
        return
      }
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(
        image,
        0,
        0,
        chartWidth * PIXEL_RATIO,
        chartHeight * PIXEL_RATIO,
        IMAGE_MARGIN * PIXEL_RATIO,
        IMAGE_MARGIN * PIXEL_RATIO,
        chartWidth * PIXEL_RATIO,
        chartHeight * PIXEL_RATIO
      )
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () =>
      reject(new Error('The chart picture could not be read.'))
    image.src = dataUrl
  })
}

interface IncidentChartProps {
  title: string
  subtitle: string
  /** The signals on the chart, in order. */
  bands: TimelineBand[]
  names: SignalNames
  labeled: EventRow[]
  /** Events that can be picked. Empty unless Pick on chart is on. */
  candidates: EventRow[]
  start: number
  end: number
  adjustmentSeconds: number
  zoom: Zoom
  onZoomChange(zoom: Zoom): void
  /** Clicking an event while Pick on chart is on. */
  onPick(key: string): void
  /** The chart's save button. */
  onSaveImage(): void
}

/** Widths are kept only once the fonts have loaded. */
function createCanvasMeasure(fontsReady: boolean): MeasureText {
  const context =
    typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d')
  const cache = new Map<string, number>()

  return (text, font) => {
    if (!context) return text.length * 7
    const key = `${font}|${text}`
    let width = cache.get(key)
    if (width === undefined) {
      context.font = font
      width = context.measureText(text).width
      if (fontsReady) cache.set(key, width)
    }
    return width
  }
}

const IncidentChart = forwardRef<IncidentChartHandle, IncidentChartProps>(
  function IncidentChart(
    {
      title,
      subtitle,
      bands,
      names,
      labeled,
      candidates,
      start,
      end,
      adjustmentSeconds,
      zoom,
      onZoomChange,
      onPick,
      onSaveImage,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<ECharts | null>(null)
    const [width, setWidth] = useState(0)
    // Callouts the user dragged. Kept while the page is open.
    const [calloutPositions, setCalloutPositions] = useState<CalloutPositions>(
      {}
    )
    const handleCalloutMove = useCallback(
      (key: string, position: CalloutPosition | null) =>
        setCalloutPositions((current) => {
          const next = { ...current }
          if (position) next[key] = position
          else delete next[key]
          return next
        }),
      []
    )
    // A label taken off forgets where it was dragged, so labeling the event
    // again puts it back in the stack.
    useEffect(() => {
      const keys = new Set(labeled.map((row) => row.event.key))
      setCalloutPositions((current) => {
        const stale = Object.keys(current).filter((key) => !keys.has(key))
        if (stale.length === 0) return current
        const next = { ...current }
        for (const key of stale) delete next[key]
        return next
      })
    }, [labeled])
    // Canvas text does not wait for web fonts, and both this layout and
    // ECharts keep the widths they first measure. Measuring before Roboto
    // loads wraps callout text early, so the chart waits for its fonts.
    const [fontsReady, setFontsReady] = useState(false)
    useEffect(() => {
      let live = true
      const fonts = typeof document === 'undefined' ? null : document.fonts
      Promise.all(Object.values(CHART_FONTS).map((font) => fonts?.load(font)))
        .catch(() => undefined)
        .finally(() => {
          if (live) setFontsReady(true)
        })
      return () => {
        live = false
      }
    }, [])
    const measure = useMemo(() => createCanvasMeasure(fontsReady), [fontsReady])
    const visible = useMemo(
      () => zoomedWindow(start, end, zoom),
      [start, end, zoom]
    )

    // The handlers change every render; the chart's listeners read the latest.
    const handlers = useRef({
      onZoomChange,
      onPick,
      onSaveImage,
      labeled,
      candidates,
    })
    handlers.current = {
      onZoomChange,
      onPick,
      onSaveImage,
      labeled,
      candidates,
    }
    const handleSaveImage = useCallback(
      () => handlers.current.onSaveImage(),
      []
    )

    const bandKeys = useMemo(
      () => new Set(bands.map((band) => band.key)),
      [bands]
    )
    const callouts = useMemo(
      () =>
        labeled
          .filter((row) => bandKeys.has(row.event.bandKey))
          .map((row) => ({
            row,
            time: formatClock(row.time),
            text: row.label.trim(),
          })),
      [labeled, bandKeys]
    )
    // Moved callouts leave the stack. The highest one sets the room above
    // the bands when it sits above the stack.
    const moved = useMemo(
      () => new Set(Object.keys(calloutPositions)),
      [calloutPositions]
    )
    const highestRise = Math.max(
      0,
      ...callouts.map(({ row }) => calloutPositions[row.event.key]?.rise ?? 0)
    )
    // Room for every callout in the whole window, so zooming does not change
    // the chart's height.
    const fullLevels = useMemo(
      () => layoutCallouts(callouts, start, end, width, measure, moved).levels,
      [callouts, start, end, width, measure, moved]
    )
    const layout = useMemo(() => {
      const inView = layoutCallouts(
        callouts.filter(
          ({ row }) => row.time >= visible.start && row.time <= visible.end
        ),
        visible.start,
        visible.end,
        width,
        measure,
        moved
      )
      return { ...inView, levels: Math.max(inView.levels, fullLevels) }
    }, [callouts, visible, width, measure, moved, fullLevels])
    const adjusted = normalizeAdjustment(adjustmentSeconds) !== 0
    const geometry = useMemo(
      () =>
        chartGeometry(
          layout.levels,
          bands.length,
          titleHeight(adjusted),
          highestRise
        ),
      [layout.levels, bands.length, adjusted, highestRise]
    )

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const chart = init(container)
      chartRef.current = chart
      // The slider reports start and end; zooming on the chart reports a batch.
      chart.on('datazoom', (params) => {
        const event = params as Partial<{ start: number; end: number }> & {
          batch?: Partial<{ start: number; end: number }>[]
        }
        const range = event.batch?.[0] ?? event
        if (range.start !== undefined && range.end !== undefined) {
          handlers.current.onZoomChange({ from: range.start, to: range.end })
        }
      })
      chart.on('click', (params) => {
        const { seriesId, data } = params as {
          seriesId?: string
          data?: number[]
        }
        const rows =
          seriesId === CANDIDATE_SERIES_ID
            ? handlers.current.candidates
            : seriesId === LABELED_SERIES_ID
              ? handlers.current.labeled
              : null
        const row = rows && data ? rows[data[2]] : undefined
        if (row) handlers.current.onPick(row.event.key)
      })
      const observer = new ResizeObserver((entries) =>
        setWidth(Math.round(entries[0].contentRect.width))
      )
      observer.observe(container)

      return () => {
        observer.disconnect()
        chart.dispose()
        chartRef.current = null
      }
    }, [])

    useEffect(() => {
      const chart = chartRef.current
      if (!chart || width === 0 || !fontsReady) return

      chart.resize()
      // Merged rather than replaced, so a drag on the zoom slider is not cut
      // off. Series and graphics are replaced so removed ones go away.
      chart.setOption(
        buildChartOption({
          title,
          subtitle,
          bands,
          names,
          labeled,
          candidates,
          start,
          end,
          adjustmentSeconds,
          zoom,
          layout,
          calloutPositions,
          onCalloutMove: handleCalloutMove,
          onSaveImage: handleSaveImage,
          geometry,
          chartWidth: width,
          measure,
        }),
        { replaceMerge: ['series', 'graphic'] }
      )
    }, [
      title,
      subtitle,
      bands,
      names,
      labeled,
      candidates,
      start,
      end,
      adjustmentSeconds,
      zoom,
      layout,
      calloutPositions,
      handleCalloutMove,
      handleSaveImage,
      geometry,
      width,
      measure,
      fontsReady,
    ])

    useImperativeHandle(
      ref,
      () => ({
        getImage: async () => {
          const chart = chartRef.current
          if (!chart) return null
          const dataUrl = chart.getDataURL({
            type: 'png',
            pixelRatio: PIXEL_RATIO,
            backgroundColor: '#fff',
            excludeComponents: ['dataZoom', 'toolbox'],
          })
          return cropChart(
            dataUrl,
            chart.getWidth(),
            chart.getHeight() - ZOOM_HEIGHT
          )
        },
      }),
      []
    )

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: geometry.height }}
      />
    )
  }
)

export default IncidentChart
