import { supportsStepChartToggle } from '@/features/charts/common/chartFeatureFlags'
import { ChartType } from '@/features/charts/common/types'
import {
  adjustPlanPositions,
  handleGreenTimeUtilizationDataZoom,
} from '@/features/charts/utils'
import { useChartsStore } from '@/stores/charts'
import type {
  DataZoomComponentOption,
  ECharts,
  EChartsOption,
  SeriesOption,
  SetOptionOpts,
} from 'echarts'
import { connect, init } from 'echarts'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type LineStep = boolean | 'start' | 'middle' | 'end'

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

function asArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? value : [value]
}

function getPrimaryTitleText(option: EChartsOption) {
  const title = Array.isArray(option.title) ? option.title[0] : option.title
  return (title as { text?: string } | undefined)?.text
}

function getPrimaryGrid(option: EChartsOption) {
  const grid = Array.isArray(option.grid) ? option.grid[0] : option.grid
  return (
    (grid as
      | {
          top?: string | number
          left?: string | number
          right?: string | number
          bottom?: string | number
        }
      | undefined) ?? {}
  )
}

function applyStepChartPreference(
  option: EChartsOption,
  chartType: ChartType | undefined,
  useStepCharts: boolean
) {
  if (!supportsStepChartToggle(chartType)) return option

  const series = option.series
  const seriesList = asArray(series)
  if (!seriesList) return option

  return {
    ...option,
    series: seriesList.map((seriesOption) => {
      if (seriesOption.type !== 'line') return seriesOption
      const seriesStep = (seriesOption as SeriesOption & { step?: LineStep })
        .step

      return {
        ...seriesOption,
        step: useStepCharts ? seriesStep ?? 'end' : false,
      } as SeriesOption
    }),
  }
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
  const {
    activeChart,
    setActiveChart,
    syncZoom,
    useStepCharts,
    yAxisMaxStore,
  } = useChartsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const chartInstance = useRef<ECharts | null>(null)

  const isActive = activeChart === id || hideInteractionMessage
  const effectiveOption = useMemo(
    () => applyStepChartPreference(option, chartType, useStepCharts),
    [option, chartType, useStepCharts]
  )

  const initChart = useCallback(() => {
    if (chartRef.current !== null) {
      chartInstance.current = init(chartRef.current, theme, {
        useDirtyRect: true,
      })

      if (syncZoom || chartType === ChartType.TimingAndActuation) {
        chartInstance.current.group = 'group1'
        connect('group1')
      }

      if (effectiveOption?.dataZoom === undefined) return

      // Set initial options with zooming disabled
      const disabledZoomOption: EChartsOption = {
        ...effectiveOption,
        dataZoom: asArray(
          effectiveOption.dataZoom as
            | DataZoomComponentOption
            | DataZoomComponentOption[]
            | undefined
        )?.map((zoom) => ({
            ...zoom,
            disabled: true,
            zoomLock: true,
          })),
        series: asArray(
          effectiveOption.series as SeriesOption | SeriesOption[] | undefined
        )?.map((series) => ({
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
  }, [effectiveOption, settings, theme, chartType, syncZoom])

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
      const adjustedDataZoom = asArray(
        effectiveOption.dataZoom as
          | DataZoomComponentOption
          | DataZoomComponentOption[]
          | undefined
      )?.map((zoom) => ({
        ...zoom,
        endValue: yAxisMaxStore != null ? yAxisMaxStore : zoom.endValue,
        disabled: !isActive,
        zoomLock: !isActive,
      }))

      // Use adjusted dataZoom in the chart options
      const updatedOption: EChartsOption = {
        ...effectiveOption,
        dataZoom: adjustedDataZoom,
        series: asArray(
          effectiveOption.series as SeriesOption | SeriesOption[] | undefined
        )?.map((series) => ({
          ...series,
          silent: !isActive,
        })),
      }

      // Apply the updated option to the chart
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
      if (getPrimaryTitleText(chartOptions) !== clickedChart) return

      // Temporarily remove grouping to prevent all charts from saving
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
      document.body.removeChild(link) // Clean up

      // Restore the group after saving
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
          dataZoom: asArray(
            effectiveOption.dataZoom as
              | DataZoomComponentOption
              | DataZoomComponentOption[]
              | undefined
          )?.map((zoom) => ({
              ...zoom,
              disabled: false,
              zoomLock: false,
            })),
          series: asArray(
            effectiveOption.series as SeriesOption | SeriesOption[] | undefined
          )?.map((series) => ({
            ...series,
            silent: false,
          })),
        })
      }
    }
  }

  const grid = getPrimaryGrid(effectiveOption)

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
              top: grid.top || 0,
              left: grid.left || 0,
              right: grid.right || 0,
              bottom: grid.bottom || 0,
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
                top: grid.top || 0,
                left: grid.left || 0,
                right: grid.right || 0,
                bottom: grid.bottom || 0,
                // outline: '2px solid #0060df80',
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
