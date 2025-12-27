import { ChartType } from '@/features/charts/common/types'
import {
  adjustPlanPositions,
  handleGreenTimeUtilizationDataZoom,
} from '@/features/charts/utils'
import { useChartsStore } from '@/stores/charts'
import type {
  DataZoomComponentOption,
  DatasetComponentOption,
  ECharts,
  EChartsOption,
  SeriesOption,
  SetOptionOpts,
} from 'echarts'
import { connect, graphic, init } from 'echarts'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ApacheEChartsProps {
  id: string
  option: EChartsOption
  chartType?: ChartType
  style?: CSSProperties
  settings?: SetOptionOpts
  loading?: boolean
  theme?: 'light' | 'dark'
  hideInteractionMessage?: boolean
}

export default function ApacheEChart({
  id,
  option,
  chartType,
  style,
  settings,
  loading,
  theme,
  hideInteractionMessage = false,
}: ApacheEChartsProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const { activeChart, setActiveChart, syncZoom, yAxisMaxStore } =
    useChartsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const chartInstance = useRef<ECharts | null>(null)

  // HARD-CODED drilldown swap (local override)
  const [overrideOption, setOverrideOption] = useState<EChartsOption | null>(
    null
  )
  const effectiveOption = overrideOption ?? option

  const isActive = activeChart === id || hideInteractionMessage

  const buildFakePhaseOption = (clicked: any): EChartsOption => {
    const checkIn = clicked?.checkIn ?? clicked?.value?.[0]
    const checkOut = clicked?.checkOut
    const serviceStart = clicked?.serviceStart
    const serviceEnd = clicked?.serviceEnd
    const tsp = clicked?.tsp ?? clicked?.tspNumber ?? '—'

    const inMs = Date.parse(checkIn)
    const outMs = Number.isFinite(Date.parse(checkOut))
      ? Date.parse(checkOut)
      : inMs + 30_000

    const startMs = inMs - 120_000
    const endMs = outMs + 120_000

    const startIso = new Date(startMs).toISOString()
    const endIso = new Date(endMs).toISOString()

    // 8 phases only
    const categories = ['8', '7', '6', '5', '4', '3', '2', '1']

    // fake repeating G/Y/R per phase (offset each phase a bit)
    const greenSec = 12
    const yellowSec = 3
    const redSec = 15
    const cycleSec = greenSec + yellowSec + redSec

    type Seg = { value: [string, string, string, 'G' | 'Y' | 'R'] }
    const segs: Seg[] = []

    const push = (phase: number, a: number, b: number, c: 'G' | 'Y' | 'R') => {
      const s = Math.max(a, startMs)
      const e = Math.min(b, endMs)
      if (e <= s) return
      segs.push({
        value: [
          new Date(s).toISOString(),
          new Date(e).toISOString(),
          `${phase}`,
          c,
        ],
      })
    }

    for (let phase = 1; phase <= 8; phase++) {
      const offsetSec = (phase * 2) % cycleSec
      let t = startMs - offsetSec * 1000

      while (t < endMs) {
        const g0 = t
        const g1 = t + greenSec * 1000
        const y0 = g1
        const y1 = y0 + yellowSec * 1000
        const r0 = y1
        const r1 = r0 + redSec * 1000

        push(phase, g0, g1, 'G')
        push(phase, y0, y1, 'Y')
        push(phase, r0, r1, 'R')

        t += cycleSec * 1000
      }
    }

    const colorOf = (c: 'G' | 'Y' | 'R') =>
      c === 'G' ? '#2e7d32' : c === 'Y' ? '#f9a825' : '#c62828'

    const phaseSeries: SeriesOption = {
      name: 'Phase Indications (fake)',
      type: 'custom',
      data: segs,
      renderItem: (params: any, api: any) => {
        const x0 = api.value(0)
        const x1 = api.value(1)
        const phase = api.value(2) as string
        const c = api.value(3) as 'G' | 'Y' | 'R'

        const p0 = api.coord([x0, phase])
        const p1 = api.coord([x1, phase])

        const band = api.size([0, 1])[1]
        const h = Math.max(2, band * 0.7)
        const y = p0[1] - h / 2

        const rect = {
          x: Math.min(p0[0], p1[0]),
          y,
          width: Math.max(1, Math.abs(p1[0] - p0[0])),
          height: h,
        }

        const clipped = graphic.clipRectByRect(rect, {
          x: params.coordSys.x,
          y: params.coordSys.y,
          width: params.coordSys.width,
          height: params.coordSys.height,
        })
        if (!clipped) return null

        return {
          type: 'rect',
          shape: clipped,
          style: api.style({ fill: colorOf(c), opacity: 0.95 }),
        }
      },
      tooltip: {
        formatter: (p: any) => {
          const v = p?.value ?? p?.data?.value
          if (!v) return ''
          const [a, b, ph, cc] = v
          const label = cc === 'G' ? 'Green' : cc === 'Y' ? 'Yellow' : 'Red'
          return `<b>Phase ${ph}</b><br/>${label}<br/>${a} → ${b}`
        },
      },
      encode: { x: [0, 1], y: 2 },
      z: 1,
    }

    const lines = [checkIn, checkOut, serviceStart, serviceEnd].filter(Boolean)

    const eventLineSeries: SeriesOption = {
      name: 'Event Lines',
      type: 'line',
      data: [],
      silent: true,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      markLine: {
        symbol: 'none',
        silent: true,
        lineStyle: {
          type: 'dashed',
          width: 1,
          color: '#000000',
          opacity: 0.35,
        },
        data: lines.map((t) => ({ xAxis: t })),
      },
      z: 2,
    }

    const tspPointSeries: SeriesOption = {
      name: `TSP #${tsp} (selected)`,
      type: 'scatter',
      data: lines.map((t) => [t, '8', `TSP #${tsp}<br/>${t}`]), // place on top row visually
      symbolSize: 9,
      itemStyle: { color: '#000000' },
      tooltip: {
        formatter: (p: any) => (p?.data?.[2] ? p.data[2] : ''),
      },
      z: 3,
    }

    return {
      title: {
        text: 'TSP Events with all Phase Indications (FAKE)',
        subtext: `TSP #${tsp} — click background to go back`,
        left: 10,
        top: 6,
      },
      grid: { top: 70, left: 65, right: 30, bottom: 70 },
      xAxis: {
        type: 'time',
        min: startIso,
        max: endIso,
        name: 'Time',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'category',
        name: 'Phase',
        data: categories,
        splitLine: { show: true },
      },
      dataZoom: [
        { type: 'slider', height: 22, bottom: 20 },
        { type: 'inside' },
      ],
      legend: { show: true, top: 40, left: 10 },
      tooltip: { trigger: 'item' },
      series: [phaseSeries, eventLineSeries, tspPointSeries],
    }
  }

  const initChart = useCallback(() => {
    if (chartRef.current !== null) {
      chartInstance.current = init(chartRef.current, theme, {
        useDirtyRect: true,
      })

      if (syncZoom || chartType === ChartType.TimingAndActuation) {
        chartInstance.current.group = 'group1'
        connect('group1')
      }

      // --- HARD-CODE click -> drilldown swap ---
      chartInstance.current.off('click')
      chartInstance.current.on('click', (p: any) => {
        if (!isActive) return

        const isPriorityBar =
          p?.seriesType === 'custom' &&
          (p?.seriesName?.includes('TSP Request') ||
            p?.seriesName?.includes('TSP Service'))

        // if already in drilldown, clicking anywhere toggles back
        if (!isPriorityBar && overrideOption) {
          setOverrideOption(null)
          return
        }

        if (!isPriorityBar) return

        // Use the clicked data payload from your custom series
        const clickedData = p?.data
        if (!clickedData) return

        setOverrideOption(buildFakePhaseOption(clickedData))
      })

      if (effectiveOption?.dataZoom === undefined) return

      // Set initial options with zooming disabled
      const disabledZoomOption: EChartsOption = {
        ...effectiveOption,
        dataZoom: (effectiveOption.dataZoom as DataZoomComponentOption[])?.map(
          (zoom) => ({
            ...zoom,
            disabled: true,
            zoomLock: true,
          })
        ),
        series: (effectiveOption.series as SeriesOption[])?.map((series) => ({
          ...series,
          silent: true,
        })),
      }

      chartInstance.current.setOption(disabledZoomOption, settings)

      if (chartType === ChartType.GreenTimeUtilization) {
        chartInstance.current.on('datazoom', () =>
          handleGreenTimeUtilizationDataZoom(chartInstance.current!)
        )
      } else {
        chartInstance.current.on('datazoom', () =>
          adjustPlanPositions(chartInstance.current!)
        )
      }
    }
  }, [
    effectiveOption,
    settings,
    theme,
    chartType,
    syncZoom,
    isActive,
    overrideOption,
  ])

  useEffect(() => {
    initChart()

    const resizeChart = () => {
      chartInstance.current?.resize()
    }
    window.addEventListener('resize', resizeChart)

    return () => {
      chartInstance.current?.dispose()
      window.removeEventListener('resize', resizeChart)
    }
  }, [theme, chartType, initChart, syncZoom])

  useEffect(() => {
    if (chartInstance.current) {
      const adjustedDataZoom = (
        effectiveOption.dataZoom as DataZoomComponentOption[]
      )?.map((zoom) => ({
        ...zoom,
        endValue: yAxisMaxStore !== undefined ? yAxisMaxStore : zoom.endValue,
        disabled: !isActive,
        zoomLock: !isActive,
      }))

      const updatedOption: EChartsOption = {
        ...effectiveOption,
        dataZoom: adjustedDataZoom,
        series: (effectiveOption.series as SeriesOption[])?.map((series) => ({
          ...series,
          silent: !isActive,
        })),
      }

      chartInstance.current.setOption(updatedOption, settings)
    }
  }, [effectiveOption, settings, theme, isActive, yAxisMaxStore])

  useEffect(() => {
    if (chartInstance.current) {
      loading
        ? chartInstance.current.showLoading()
        : chartInstance.current.hideLoading()
    }
  }, [loading])

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
      }, 700)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  useEffect(() => {
    const handleSaveAsImage = (event: Event) => {
      const customEvent = event as CustomEvent<{
        text: string
      }>
      const clickedChart = customEvent.detail.text
      const currentChart = chartInstance.current
      if (!clickedChart || !currentChart) return

      const chartOptions = currentChart.getOption() as EChartsOption
      if (chartOptions.title[0].text !== clickedChart) return

      const originalGroup = currentChart.group
      currentChart.group = ''

      const imageURL = currentChart.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff',
      })
      const link = document.createElement('a')
      link.href = imageURL
      link.download = `${clickedChart}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setTimeout(() => {
        if (clickedChart) {
          currentChart.group = originalGroup
        }
      }, 100)
    }

    window.addEventListener('saveChartImage', handleSaveAsImage)

    return () => {
      window.removeEventListener('saveChartImage', handleSaveAsImage)
    }
  }, [])

  const handleActivate = () => {
    if (!isActive) {
      setActiveChart(id)
      if (chartInstance.current) {
        chartInstance.current.setOption({
          ...effectiveOption,
          dataZoom: (effectiveOption.dataZoom as DatasetComponentOption[])?.map(
            (zoom) => ({
              ...zoom,
              disabled: false,
              zoomLock: false,
            })
          ),
          series: (effectiveOption.series as SeriesOption[])?.map((series) => ({
            ...series,
            silent: false,
          })),
        })
      }
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style,
      }}
      role="presentation"
      aria-hidden="true"
      onClick={handleActivate}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        id={id}
        ref={chartRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
      {!hideInteractionMessage && (
        <>
          <div
            style={{
              position: 'absolute',
              top: effectiveOption?.grid?.top || 0,
              left: effectiveOption?.grid?.left || 0,
              right: effectiveOption?.grid?.right || 0,
              bottom: effectiveOption?.grid?.bottom || 0,
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              visibility:
                !isActive && isHovered && isScrolling ? 'visible' : 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: '24px',
              zIndex: 1,
              textShadow: '0 0 2px black',
            }}
          >
            Click to enable zoom
          </div>
          {isActive && (
            <div
              style={{
                display: isActive ? 'block' : 'none',
                position: 'absolute',
                top: effectiveOption?.grid?.top || 0,
                left: effectiveOption?.grid?.left || 0,
                right: effectiveOption?.grid?.right || 0,
                bottom: effectiveOption?.grid?.bottom || 0,
                zIndex: 1,
                pointerEvents: 'none',
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
