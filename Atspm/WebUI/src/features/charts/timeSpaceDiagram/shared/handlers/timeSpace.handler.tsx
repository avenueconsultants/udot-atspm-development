import { dateToTimestamp } from '@/utils/dateTime'
import { ECharts, EChartsOption, SeriesOption } from 'echarts'
import { useEffect, useRef } from 'react'

const HIT_TOLERANCE = 6
const STEP_MS = 1000

function getOffsetData(
  offsetX: number,
  series: SeriesOption
): [number, number, number, number][] {
  return (series?.data as any[]).map((d) => {
    return [d[0], d[1] as number, d[2] as number, offsetX / 1000]
  })
}

function getData(
  offsetX: number,
  series: SeriesOption
): [string, number, number][] {
  return (series?.data as any[]).map((d) => {
    const time = new Date(d[0]).getTime()
    const offset = time + offsetX
    const newTime = dateToTimestamp(new Date(offset))
    return [newTime, d[1], d[2]]
  })
}

function getBandData(
  offsetX: number,
  series: SeriesOption
): [string, number][] {
  if (!series.data || (series.data as any[]).length === 0) {
    return []
  }
  return (series?.data as any[]).map((d) => {
    const time = new Date(d[0]).getTime()
    const offset = time + offsetX
    const newTime = dateToTimestamp(new Date(offset))
    return [newTime, d[1]]
  })
}

function getLLCData(
  offsetX: number,
  series: SeriesOption
): ([string, number] | null)[] {
  return (series?.data as any[]).map((d) => {
    if (d === null) return null
    const time = new Date(d[0]).getTime()
    const offset = time + offsetX
    const newTime = dateToTimestamp(new Date(offset))
    return [newTime, d[1] as number]
  })
}

function getSeriesKeyFromId(id: string) {
  // Remove the leading category ("Cycles" / "Green Bands")
  return id.replace(/^(Cycles|Green Bands|LLC|AC|SBP|Offset)\s+/, '')
}

const getAllSeries = (chart: ECharts) => {
  const options = chart.getOption() as EChartsOption

  if (options === null || !options.series) {
    return {
      base: [],
      bands: [],
      llc: [],
      ac: [],
      sbp: [],
      offset: [],
    }
  }
  const series = options.series as SeriesOption[]

  return {
    base: series.filter((s) => s.id?.toString().includes('Cycles')),
    bands: series.filter((s) => s.id?.toString().includes('Green Bands')),
    llc: series.filter((s) => s.id?.toString().includes('LLC')),
    ac: series.filter((s) => s.id?.toString().includes('AC')),
    sbp: series.filter((s) => s.id?.toString().includes('SBP')),
    offset: series.filter((s) => s.id?.toString().includes('Offset')),
  }
}

const findClosestLine = (
  chart: any,
  baseSeries: SeriesOption[],
  mouseY: number
) => {
  let closest: { id: string; distance: number } | null = null

  for (const series of baseSeries) {
    const yValue = series.data?.[0]?.[1]
    if (yValue == null) continue

    const [, yPixel] = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
      0,
      yValue,
    ])

    const distance = Math.abs(mouseY - yPixel)

    if (distance < HIT_TOLERANCE && (!closest || distance < closest.distance)) {
      closest = { id: series.id as string, distance }
    }
  }

  return closest
}

const updateLinkedSeries = (
  chart: any,
  offset: number,
  base: SeriesOption,
  bands: SeriesOption[],
  llc: SeriesOption[],
  ac: SeriesOption[],
  sbp: SeriesOption[],
  off: SeriesOption[]
) => {
  const key = getSeriesKeyFromId(base.id as string)

  const band = bands.find(
    (s) => typeof s.id === 'string' && getSeriesKeyFromId(s.id) === key
  )

  const llcSeries = llc.find(
    (s) => typeof s.id === 'string' && getSeriesKeyFromId(s.id) === key
  )

  const acSeries = ac.find(
    (s) => typeof s.id === 'string' && getSeriesKeyFromId(s.id) === key
  )

  const sbpSeries = sbp.find(
    (s) => typeof s.id === 'string' && getSeriesKeyFromId(s.id) === key
  )

  const offsetSeries = off.find(
    (s) => typeof s.id === 'string' && getSeriesKeyFromId(s.id) === key
  )

  const roundedOffset = Math.round(offset)

  chart.setOption(
    {
      series: [
        { id: base.id, data: getData(roundedOffset, base) },
        band && { id: band.id, data: getBandData(roundedOffset, band) },
        llcSeries && {
          id: llcSeries.id,
          data: getLLCData(roundedOffset, llcSeries),
        },
        acSeries && {
          id: acSeries.id,
          data: getLLCData(roundedOffset, acSeries),
        },
        sbpSeries && {
          id: sbpSeries.id,
          data: getBandData(roundedOffset, sbpSeries),
        },
        offsetSeries && {
          id: offsetSeries.id,
          data: getOffsetData(roundedOffset, offsetSeries),
        },
      ].filter(Boolean),
    },
    false,
    false
  )
}

export const useTimeSpaceHandler = (chart: ECharts | null) => {
  // interaction state
  const draggingRef = useRef(false)
  const draggingLineIdRef = useRef<string | null>(null)
  const lastXRef = useRef<number | null>(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    if (chart === null) return

    const zr = chart.getZr()

    const { base, bands, llc, ac, sbp, offset } = getAllSeries(chart)
    if (!base.length) return

    const onMouseDown = (e: any) => {
      const [xData] = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
        e.offsetX,
        e.offsetY,
      ])

      const closest = findClosestLine(chart, base, e.offsetY)
      if (!closest) return

      draggingRef.current = true
      draggingLineIdRef.current = closest.id
      lastXRef.current = xData
    }

    const onMouseMove = (e: any) => {
      if (
        !draggingRef.current ||
        !draggingLineIdRef.current ||
        lastXRef.current == null
      )
        return

      const [xData] = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
        e.offsetX,
        e.offsetY,
      ])

      const dx = xData - lastXRef.current
      lastXRef.current = xData

      const snappedDx = Math.round(dx / 1000) * 1000
      offsetRef.current += snappedDx
      offsetRef.current = Math.round(offsetRef.current / STEP_MS) * STEP_MS

      const baseSeries = base.find((s) => s.id === draggingLineIdRef.current)
      if (!baseSeries) return

      updateLinkedSeries(
        chart,
        offsetRef.current,
        baseSeries,
        bands,
        llc,
        ac,
        sbp,
        offset
      )
    }

    const onMouseUp = () => {
      draggingRef.current = false
      draggingLineIdRef.current = null
      lastXRef.current = null
    }

    zr.on('mousedown', onMouseDown)
    zr.on('mousemove', onMouseMove)
    zr.on('mouseup', onMouseUp)

    return () => {
      zr.off('mousedown', onMouseDown)
      zr.off('mousemove', onMouseMove)
      zr.off('mouseup', onMouseUp)
    }
  }, [chart])
}
