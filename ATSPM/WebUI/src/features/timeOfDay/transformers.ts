import type {
  Plan,
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
  TimeOfDayPeakEventDto,
  TimeOfDayProfileDto,
  TimeOfDayProfilePointDto,
  TimeOfDayResult,
} from '@/api/reports'
import type { EChartsOption, SeriesOption } from 'echarts'

type ProfileValueKey = keyof Pick<
  TimeOfDayProfilePointDto,
  'averageVolume' | 'smoothedVolume' | 'rollingHourVph'
>

export interface TimeOfDayScheduleRow {
  id: string
  scheduleType: string
  locations: string
  plan: string
  description: string
  start: string
  end: string
  durationMinutes: number | null
}

const chartColors = {
  raw: '#455a64',
  smooth: '#1565c0',
  primary: '#1565c0',
  cross: '#c62828',
  percent: '#6a1b9a',
  peak: '#ef6c00',
  recommendedBand: 'rgba(46, 125, 50, 0.08)',
  currentBand: 'rgba(25, 118, 210, 0.06)',
}

const directionalColors = [
  '#00897b',
  '#7b1fa2',
  '#f57c00',
  '#5d4037',
  '#3949ab',
  '#546e7a',
  '#2e7d32',
  '#ad1457',
]

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

export const formatNumber = (
  value?: number | null,
  maximumFractionDigits = 0
) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value)
}

export const minutesToTimeLabel = (minutes: number) => {
  const clampedMinutes = Math.max(0, Math.min(1440, Math.round(minutes)))
  if (clampedMinutes === 1440) return '24:00'

  const hours = Math.floor(clampedMinutes / 60)
  const remainingMinutes = clampedMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(
    remainingMinutes
  ).padStart(2, '0')}`
}

export const formatPlanTime = (value?: string) => {
  if (!value) return '-'

  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return minutesToTimeLabel(date.getHours() * 60 + date.getMinutes())
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})/)
  return timeMatch ? timeMatch[0].padStart(5, '0') : value
}

const getProfilePoints = (profile?: TimeOfDayProfileDto) =>
  profile?.points?.filter((point) => point.minutes !== undefined) ?? []

export const hasProfileData = (profile?: TimeOfDayProfileDto) =>
  getProfilePoints(profile).length > 0

export const hasPlanProfileData = (result: TimeOfDayResult) =>
  hasProfileData(result.planProfile?.corridorProfile)

export const hasSplitPressureData = (result: TimeOfDayResult) => {
  const splitPressure = result.splitPressure

  return Boolean(
    hasProfileData(splitPressure?.primaryProfile) ||
      hasProfileData(splitPressure?.crossStreetProfile) ||
      splitPressure?.crossTrafficShare?.length
  )
}

const getProfileSeriesData = (
  profile: TimeOfDayProfileDto | undefined,
  valueKey: ProfileValueKey
) =>
  getProfilePoints(profile)
    .map((point) => {
      const value = point[valueKey]
      if (value === undefined || value === null) return null

      return [point.minutes ?? 0, value]
    })
    .filter((point): point is number[] => point !== null)

const buildProfileLineSeries = ({
  profile,
  name,
  valueKey,
  color,
  yAxisIndex = 0,
  lineStyle,
}: {
  profile?: TimeOfDayProfileDto
  name: string
  valueKey: ProfileValueKey
  color: string
  yAxisIndex?: number
  lineStyle?: Record<string, unknown>
}): SeriesOption => ({
  name,
  type: 'line',
  data: getProfileSeriesData(profile, valueKey),
  showSymbol: false,
  smooth: true,
  yAxisIndex,
  lineStyle: {
    width: 2,
    color,
    ...lineStyle,
  },
  itemStyle: { color },
})

const getPlanBoundaryMinutes = (value?: string) => {
  if (!value) return null

  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.getHours() * 60 + date.getMinutes()
  }

  const timeMatch = value.match(/(\d{1,2}):(\d{2})/)
  if (!timeMatch) return null

  return Number(timeMatch[1]) * 60 + Number(timeMatch[2])
}

const crossesMidnight = (start?: string, end?: string) => {
  if (!start || !end) return false

  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false
  }

  return endDate.toDateString() !== startDate.toDateString() && endDate > startDate
}

const getPlanIntervalMinutes = (plan: Plan) => {
  const start = getPlanBoundaryMinutes(plan.start)
  const end = getPlanBoundaryMinutes(plan.end)
  if (start === null || end === null) return null

  let adjustedEnd = end
  if (crossesMidnight(plan.start, plan.end) || adjustedEnd <= start) {
    adjustedEnd += 1440
  }

  const clampedStart = Math.max(0, Math.min(1440, start))
  const clampedEnd = Math.max(0, Math.min(1440, adjustedEnd))
  if (clampedEnd <= clampedStart) return null

  return {
    start: clampedStart,
    end: clampedEnd,
  }
}

const buildPlanMarkAreas = (
  plans: Plan[] | null | undefined,
  color: string,
  label: string
) => {
  const markAreas: Array<[Record<string, unknown>, Record<string, unknown>]> =
    []

  plans?.forEach((plan) => {
    const interval = getPlanIntervalMinutes(plan)
    if (!interval) return

    markAreas.push([
      {
        name: `${label} ${plan.planNumber ?? ''}`.trim(),
        xAxis: interval.start,
        itemStyle: { color },
      },
      { xAxis: interval.end },
    ])
  })

  return markAreas
}

const getPlanMarkAreas = (result: TimeOfDayResult) => [
  ...buildPlanMarkAreas(
    result.recommendation?.recommendedSchedule,
    chartColors.recommendedBand,
    'Recommended'
  ),
  ...buildPlanMarkAreas(
    result.planComparison?.commonCurrentSchedule,
    chartColors.currentBand,
    'Current'
  ),
]

const buildPeakScatterSeries = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined,
  name: string,
  color: string,
  yAxisIndex = 0
): SeriesOption => ({
  name,
  type: 'scatter',
  yAxisIndex,
  data:
    peaks?.map((peak) => [
      peak.minutes ?? 0,
      peak.value ?? 0,
      peak.label ?? peak.period ?? name,
    ]) ?? [],
  symbolSize: 9,
  itemStyle: {
    color,
    borderColor: '#ffffff',
    borderWidth: 1,
  },
  tooltip: {
    valueFormatter: (value) =>
      typeof value === 'number' ? numberFormatter.format(value) : String(value),
  },
})

const withPlanMarkAreas = (
  series: SeriesOption[],
  result: TimeOfDayResult
): SeriesOption[] => {
  const markAreaData = getPlanMarkAreas(result)
  if (!series.length || !markAreaData.length) return series

  return [
    {
      ...series[0],
      markArea: {
        silent: true,
        label: { show: false },
        data: markAreaData,
      },
    },
    ...series.slice(1),
  ]
}

const buildBaseOption = ({
  title,
  series,
  yAxis,
  right = 45,
}: {
  title: string
  series: SeriesOption[]
  yAxis: EChartsOption['yAxis']
  right?: number
}): EChartsOption => ({
  title: [
    {
      text: title,
      left: 'center',
      top: 4,
      textStyle: {
        fontSize: 16,
        fontWeight: 600,
      },
    },
  ],
  color: [
    chartColors.raw,
    chartColors.smooth,
    chartColors.primary,
    chartColors.cross,
    chartColors.percent,
  ],
  grid: {
    left: 72,
    right,
    top: 72,
    bottom: 72,
  },
  legend: {
    top: 34,
    type: 'scroll',
  },
  tooltip: {
    trigger: 'axis',
    valueFormatter: (value) =>
      typeof value === 'number' ? numberFormatter.format(value) : String(value),
  },
  xAxis: {
    type: 'value',
    min: 0,
    max: 1440,
    interval: 60,
    name: 'Time of Day',
    nameLocation: 'middle',
    nameGap: 42,
    axisLabel: {
      formatter: (value: number) => minutesToTimeLabel(value),
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: '#d6dee6',
      },
    },
    minorTick: {
      show: true,
      splitNumber: 4,
    },
    minorSplitLine: {
      show: true,
      lineStyle: {
        color: '#edf1f5',
      },
    },
  },
  yAxis,
  dataZoom: [
    {
      type: 'inside',
      start: 0,
      end: 100,
    },
    {
      type: 'slider',
      start: 0,
      end: 100,
      height: 18,
      bottom: 18,
    },
  ],
  series,
})

export const buildPlanProfileOption = (
  result: TimeOfDayResult
): EChartsOption => {
  const corridorProfile = result.planProfile?.corridorProfile
  const directionalProfiles = result.planProfile?.directionalProfiles ?? []

  const directionalSeries = directionalProfiles.map((profile, index) =>
    buildProfileLineSeries({
      profile,
      name: profile.label ?? profile.direction ?? `Direction ${index + 1}`,
      valueKey: 'averageVolume',
      color: directionalColors[index % directionalColors.length],
      lineStyle: { width: 1.5, opacity: 0.75, type: 'dashed' },
    })
  )

  const peakSeries = buildPeakScatterSeries(
    result.planProfile?.peaks,
    'Peak Events',
    chartColors.peak
  )

  const series = withPlanMarkAreas(
    [
      buildProfileLineSeries({
        profile: corridorProfile,
        name: 'Median Raw Volume',
        valueKey: 'averageVolume',
        color: chartColors.raw,
        lineStyle: { width: 1.5, opacity: 0.85 },
      }),
      buildProfileLineSeries({
        profile: corridorProfile,
        name: 'Smoothed For Breakpoints',
        valueKey: 'smoothedVolume',
        color: chartColors.smooth,
        lineStyle: { width: 3 },
      }),
      ...directionalSeries,
      peakSeries,
    ],
    result
  )

  return buildBaseOption({
    title: 'Corridor Plan Recommendation',
    series,
    yAxis: {
      type: 'value',
      name: 'Volume (vph)',
      splitLine: {
        lineStyle: { color: '#e3e8ee' },
      },
    },
  })
}

export const buildSplitPressureOption = (
  result: TimeOfDayResult
): EChartsOption => {
  const splitPressure = result.splitPressure
  const crossTrafficPercentData =
    splitPressure?.crossTrafficShare
      ?.map((point) => {
        if (
          point.minutes === undefined ||
          point.crossTrafficPercent === undefined ||
          point.crossTrafficPercent === null
        ) {
          return null
        }

        return [point.minutes, point.crossTrafficPercent]
      })
      .filter((point): point is number[] => point !== null) ?? []

  const thresholdLines = Object.entries(
    splitPressure?.thresholdPercentByName ?? {}
  ).map(([name, value]) => ({
    name,
    yAxis: value,
    label: {
      formatter: `${name} ${percentFormatter.format(value)}%`,
    },
  }))

  const volumePeaks =
    splitPressure?.periodPeaks?.filter(
      (peak) =>
        peak.series !== 'CrossTrafficPercent' &&
        !peak.valueUnits?.toLowerCase().includes('percent')
    ) ?? []
  const percentPeaks =
    splitPressure?.periodPeaks?.filter(
      (peak) =>
        peak.series === 'CrossTrafficPercent' ||
        peak.valueUnits?.toLowerCase().includes('percent')
    ) ?? []

  const series = withPlanMarkAreas(
    [
      buildProfileLineSeries({
        profile: splitPressure?.primaryProfile,
        name: 'Primary Street',
        valueKey: 'averageVolume',
        color: chartColors.primary,
        lineStyle: { width: 2.5 },
      }),
      buildProfileLineSeries({
        profile: splitPressure?.crossStreetProfile,
        name: 'Cross Street',
        valueKey: 'averageVolume',
        color: chartColors.cross,
        lineStyle: { width: 2.5 },
      }),
      {
        name: 'Cross Traffic Percent',
        type: 'line',
        yAxisIndex: 1,
        data: crossTrafficPercentData,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2.5,
          color: chartColors.percent,
        },
        itemStyle: { color: chartColors.percent },
        markLine: thresholdLines.length
          ? {
              symbol: 'none',
              data: thresholdLines,
              lineStyle: {
                type: 'dashed',
                color: '#6a1b9a',
              },
            }
          : undefined,
      },
      buildPeakScatterSeries(volumePeaks, 'Volume Peaks', chartColors.peak),
      buildPeakScatterSeries(
        percentPeaks,
        'Cross Traffic Percent Peaks',
        chartColors.percent,
        1
      ),
    ],
    result
  )

  return buildBaseOption({
    title: 'Corridor Split Pressure',
    series,
    right: 82,
    yAxis: [
      {
        type: 'value',
        name: 'Volume (vph)',
        splitLine: {
          lineStyle: { color: '#e3e8ee' },
        },
      },
      {
        type: 'value',
        name: 'Cross Traffic (%)',
        min: 0,
        max: (value) => Math.max(100, Math.ceil(value.max / 10) * 10),
        axisLabel: {
          formatter: '{value}%',
        },
      },
    ],
  })
}

const getDurationMinutes = (plan: Plan) => {
  const interval = getPlanIntervalMinutes(plan)
  if (!interval) return null

  return Math.round(interval.end - interval.start)
}

export const buildScheduleRows = (
  result: TimeOfDayResult
): TimeOfDayScheduleRow[] => {
  const rows: TimeOfDayScheduleRow[] = []

  result.recommendation?.recommendedSchedule?.forEach((plan, index) => {
    rows.push({
      id: `recommended-${index}`,
      scheduleType: 'Recommended',
      locations: 'Selected corridor',
      plan: plan.planNumber ?? '-',
      description: plan.planDescription ?? '-',
      start: formatPlanTime(plan.start),
      end: formatPlanTime(plan.end),
      durationMinutes: getDurationMinutes(plan),
    })
  })

  result.planComparison?.commonCurrentSchedule?.forEach((plan, index) => {
    rows.push({
      id: `current-${index}`,
      scheduleType: 'Current common',
      locations: 'Selected corridor',
      plan: plan.planNumber ?? '-',
      description: plan.planDescription ?? '-',
      start: formatPlanTime(plan.start),
      end: formatPlanTime(plan.end),
      durationMinutes: getDurationMinutes(plan),
    })
  })

  return rows
}

export const getLocationPeakEvents = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined,
  period: string
) =>
  peaks?.filter(
    (peak) =>
      peak.series === 'Location' &&
      peak.period?.toLowerCase() === period.toLowerCase()
  ) ?? []

export const getCrossTrafficLocations = (
  locations: TimeOfDayCrossTrafficLocationDto[] | null | undefined,
  period: string
) =>
  locations?.filter(
    (location) => location.period?.toLowerCase() === period.toLowerCase()
  ) ?? []

export const getMovementPressures = (
  movements: TimeOfDayMovementPressureDto[] | null | undefined,
  period: string
) =>
  movements?.filter(
    (movement) => movement.period?.toLowerCase() === period.toLowerCase()
  ) ?? []
