import { ChartType } from '@/features/charts/common/types'
import { ApacheEChartsProps } from '@/features/charts/components/apacheEChart'
import { useTimeSpaceHandler } from '@/features/charts/timeSpaceDiagram/shared/handlers/timeSpace.handler'
import { useChartsStore } from '@/stores/charts'
import {
  connect,
  DatasetComponentOption,
  DataZoomComponentOption,
  ECharts,
  EChartsOption,
  init,
  SeriesOption,
} from 'echarts'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function TimeSpaceEChart(prop: ApacheEChartsProps) {
  const {
    id,
    option,
    chartType,
    style,
    settings,
    loading,
    theme,
    hideInteractionMessage,
    resetKey,
  } = prop

  const chartRef = useRef<HTMLDivElement>(null)
  const { activeChart, setActiveChart, syncZoom } = useChartsStore()
  const [isHovered, setIsHovered] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const chartInstance = useRef<ECharts | null>(null)
  useTimeSpaceHandler(chartInstance.current)

  const isActive = activeChart === id || hideInteractionMessage

  const initChart = useCallback(() => {
    if (chartRef.current !== null) {
      chartInstance.current = init(chartRef.current, theme, {
        useDirtyRect: true,
      })

      if (syncZoom || chartType === ChartType.TimingAndActuation) {
        chartInstance.current.group = 'group1'
        connect('group1')
      }

      if (option?.dataZoom === undefined) return

      // Set initial options with zooming disabled
      const disabledZoomOption: EChartsOption = {
        ...option,
        dataZoom: (option.dataZoom as DataZoomComponentOption[])?.map(
          (zoom) => ({
            ...zoom,
            disabled: true,
            zoomLock: true,
          })
        ),
        series: (option.series as SeriesOption[])?.map((series) => ({
          ...series,
          silent: true,
        })),
      }

      chartInstance.current.setOption(disabledZoomOption)
    }
  }, [option, theme, chartType, syncZoom])

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
    if (resetKey) initChart()
  }, [initChart, resetKey])

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

  const handleActivate = () => {
    if (!isActive) {
      setActiveChart(id)
      if (chartInstance.current) {
        chartInstance.current.setOption({
          ...option,
          dataZoom: (option.dataZoom as DatasetComponentOption[])?.map(
            (zoom) => ({
              ...zoom,
              disabled: false,
              zoomLock: false,
            })
          ),
          series: (option.series as SeriesOption[])?.map((series) => ({
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
              top: option?.grid?.top || 0,
              left: option?.grid?.left || 0,
              right: option?.grid?.right || 0,
              bottom: option?.grid?.bottom || 0,
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
                top: option?.grid?.top || 0,
                left: option?.grid?.left || 0,
                right: option?.grid?.right || 0,
                bottom: option?.grid?.bottom || 0,
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
