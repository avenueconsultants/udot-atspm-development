import { getPriorityDetailsReportData } from '@/api/reports'
import { ChartType } from '@/features/charts/common/types'
import transformPriorityDetailsData from '@/features/charts/prioritySummary/priorityDetails.transformer'
import {
  adjustPlanPositions,
  handleGreenTimeUtilizationDataZoom,
} from '@/features/charts/utils'
import { useChartsStore } from '@/stores/charts'
import { dateToTimestamp } from '@/utils/dateTime'
import type {
  DataZoomComponentOption,
  DatasetComponentOption,
  ECharts,
  EChartsOption,
  SeriesOption,
  SetOptionOpts,
} from 'echarts'
import { connect, init } from 'echarts'
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
  resetKey?: boolean
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

  // Drilldown override (local option swap)
  const [overrideOption, setOverrideOption] = useState<EChartsOption | null>(
    null
  )
  const effectiveOption = overrideOption ?? option

  const isActive = activeChart === id || hideInteractionMessage

  const initChart = useCallback(() => {
    if (chartRef.current === null) return

    chartInstance.current = init(chartRef.current, theme, {
      useDirtyRect: true,
    })

    if (syncZoom || chartType === ChartType.TimingAndActuation) {
      chartInstance.current.group = 'group1'
      connect('group1')
    }

    // --- Click: Priority Summary -> fetch Priority Details + swap chart ---
    chartInstance.current.off('click')
    chartInstance.current.on('click', async (p: any) => {
      if (!isActive) return

      const isPrioritySummary =
        chartType === ChartType.PrioritySummary &&
        p?.seriesType === 'bar' &&
        typeof p?.seriesName === 'string' &&
        (p.seriesName.includes('TSP Request') ||
          p.seriesName.includes('TSP Service')) &&
        !p.seriesName.startsWith('__') // ignore hidden offset bar

      // if already drilled down, clicking anything else toggles back
      if (!isPrioritySummary && overrideOption) {
        setOverrideOption(null)
        return
      }

      if (!isPrioritySummary) return

      const d = p?.data
      if (!Array.isArray(d)) return

      // IMPORTANT:
      // This expects Priority Summary bar data payload to include drilldown metadata.
      //
      // Request bar:
      //   [checkIn, durSec, tsp, checkOut, locationIdentifier, windowStart, windowEnd, binSize?]
      // Service duration bar:
      //   [checkIn, durSec, tsp, serviceStart, serviceEnd, startOffset, checkOut, locationIdentifier, windowStart, windowEnd, binSize?]
      //
      const seriesIsRequest = p.seriesName.includes('TSP Request')

      const locationIdentifier = seriesIsRequest
        ? (d[4] as string)
        : (d[7] as string)
      const start = seriesIsRequest ? (d[5] as string) : (d[8] as string)
      const end = seriesIsRequest ? (d[6] as string) : (d[9] as string)

      if (!locationIdentifier || !start || !end) return

      try {
        chartInstance.current?.showLoading()

        const detailsResponse = await getPriorityDetailsReportData({
          locationIdentifier,
          start: dateToTimestamp(start),
          end: dateToTimestamp(end),
        })

        console.log('Priority Details drilldown response:', detailsResponse)

        const transformed = transformPriorityDetailsData(detailsResponse)
        const nextOption = transformed?.data?.charts?.[0]?.chart

        console.log('Priority Details drilldown option:', nextOption)

        if (nextOption) setOverrideOption(nextOption)
      } catch (err) {
        console.error('Priority Details drilldown failed:', err)
      } finally {
        chartInstance.current?.hideLoading()
      }
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
    if (!chartInstance.current) return

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
  }, [effectiveOption, settings, theme, isActive, yAxisMaxStore])

  useEffect(() => {
    if (!chartInstance.current) return
    loading
      ? chartInstance.current.showLoading()
      : chartInstance.current.hideLoading()
  }, [loading])

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      setIsScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => setIsScrolling(false), 700)
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  useEffect(() => {
    const handleSaveAsImage = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>
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
        currentChart.group = originalGroup
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
              top: (effectiveOption as any)?.grid?.top || 0,
              left: (effectiveOption as any)?.grid?.left || 0,
              right: (effectiveOption as any)?.grid?.right || 0,
              bottom: (effectiveOption as any)?.grid?.bottom || 0,
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
                top: (effectiveOption as any)?.grid?.top || 0,
                left: (effectiveOption as any)?.grid?.left || 0,
                right: (effectiveOption as any)?.grid?.right || 0,
                bottom: (effectiveOption as any)?.grid?.bottom || 0,
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
