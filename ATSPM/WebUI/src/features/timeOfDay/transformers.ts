import { createLegend } from '@/features/charts/common/transformers'
import {
  DashedLineSeriesSymbol,
  SolidLineSeriesSymbol,
} from '@/features/charts/utils'
import type {
  Plan,
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
  TimeOfDayPeakEventDto,
  TimeOfDayProfileDto,
  TimeOfDayProfilePointDto,
  TimeOfDayResult,
} from '@/api/reports'
import type {
  EChartsOption,
  LegendComponentOption,
  SeriesOption,
} from 'echarts'

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

export type TimeOfDayNumberedPeakEvent = TimeOfDayPeakEventDto & {
  badgeNumber: number
  badgeColor: string
}

const chartColors = {
  raw: '#455a64',
  smooth: '#1565c0',
  primary: '#1565c0',
  cross: '#c62828',
  percent: '#6a1b9a',
  amPeak: '#ef6c00',
  pmPeak: '#c62828',
  amSignalPeak: '#ef6c00',
  pmSignalPeak: '#1565c0',
  volumePeak: '#ef6c00',
  splitReview: '#f9a825',
  shoulderReview: '#c62828',
  recommendedBand: 'rgba(46, 125, 50, 0.08)',
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

export const formatPlanNumber = (planNumber?: string | null) => {
  if (!planNumber) return '-'

  const normalized = planNumber.trim()
  if (!normalized) return '-'

  return normalized === '254' || normalized.toLowerCase() === 'free'
    ? 'FREE'
    : normalized
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
        name: `${label} ${formatPlanNumber(plan.planNumber)}`.trim(),
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
]

const buildPeakScatterSeries = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined,
  name: string,
  color: string,
  yAxisIndex = 0,
  symbolSize = 9
): SeriesOption => ({
  name,
  type: 'scatter',
  yAxisIndex,
  data:
    peaks?.map((peak) => [
      peak.minutes ?? 0,
      peak.value ?? 0,
      peak.label ?? peak.locationIdentifier ?? peak.period ?? name,
    ]) ?? [],
  symbolSize,
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

const buildNumberedSignalPeakSeries = (
  peaks: TimeOfDayNumberedPeakEvent[],
  name: string,
  color: string
): SeriesOption => ({
  name,
  type: 'scatter',
  data: peaks.map((peak) => ({
    name: String(peak.badgeNumber),
    value: [
      peak.minutes ?? 0,
      peak.value ?? 0,
      peak.label ?? peak.locationIdentifier ?? peak.period ?? name,
    ],
    itemStyle: { color: peak.badgeColor },
  })),
  symbol: 'circle',
  symbolSize: 20,
  label: {
    show: true,
    formatter: '{b}',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
  },
  itemStyle: {
    borderWidth: 0,
    color,
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
  legendData,
  legendConfig,
  showLegend = true,
}: {
  title: string
  series: SeriesOption[]
  yAxis: EChartsOption['yAxis']
  right?: number
  legendData?: LegendComponentOption['data']
  legendConfig?: Partial<LegendComponentOption>
  showLegend?: boolean
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
  legend: createLegend({
    data: legendData,
    orient: 'horizontal',
    show: showLegend,
    top: 34,
    type: 'scroll',
    ...legendConfig,
  }),
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

const normalizeToken = (value?: string | null) =>
  value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''

const getProfileDisplayName = (
  profile: TimeOfDayProfileDto,
  fallback: string
) => profile.label ?? profile.direction ?? profile.movementLabel ?? fallback

const formatDirectionProfileName = (
  profile: TimeOfDayProfileDto,
  index: number
) => {
  const name = getProfileDisplayName(profile, `Direction ${index + 1}`)

  return normalizeToken(name).includes('totalprofile')
    ? name
    : `${name} total profile`
}

const formatDirectionList = (directions?: string[] | null) =>
  directions?.filter(Boolean).join(', ') ?? ''

const formatRepresentativeSeriesName = (
  directions: string[] | null | undefined,
  role: string,
  fallback: string
) => {
  const directionList = formatDirectionList(directions)

  return directionList
    ? `Representative ${directionList} ${role}`
    : `Representative ${fallback}`
}

const peakPeriodMatches = (peak: TimeOfDayPeakEventDto, period: string) =>
  normalizeToken(peak.period).startsWith(normalizeToken(period))

const isSignalPeak = (peak: TimeOfDayPeakEventDto) =>
  normalizeToken(peak.series) === 'location' || Boolean(peak.locationIdentifier)

const isCorridorPeak = (peak: TimeOfDayPeakEventDto) =>
  !isSignalPeak(peak) &&
  (normalizeToken(peak.series).includes('corridor') ||
    normalizeToken(peak.label).includes('corridor'))

const getCorridorPeakEvents = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined,
  period: 'AM' | 'PM'
) =>
  peaks?.filter(
    (peak) => isCorridorPeak(peak) && peakPeriodMatches(peak, period)
  ) ?? []

const getSignalPeakEvents = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined
) => peaks?.filter(isSignalPeak) ?? []

const getSignalPeakBadgeColor = (peak: TimeOfDayPeakEventDto) => {
  if (peakPeriodMatches(peak, 'AM')) return chartColors.amSignalPeak
  if (peakPeriodMatches(peak, 'PM')) return chartColors.pmSignalPeak

  return (peak.minutes ?? 0) < 12 * 60
    ? chartColors.amSignalPeak
    : chartColors.pmSignalPeak
}

const getNumberedSignalPeakEvents = (
  peaks: TimeOfDayPeakEventDto[] | null | undefined
): TimeOfDayNumberedPeakEvent[] =>
  getSignalPeakEvents(peaks).map((peak, index) => ({
    ...peak,
    badgeNumber: index + 1,
    badgeColor: getSignalPeakBadgeColor(peak),
  }))

const getPlanProfileLegendData = (
  directionalSeriesNames: string[]
): LegendComponentOption['data'] => [
  { name: 'Median Raw Volume', icon: SolidLineSeriesSymbol },
  { name: 'Smoothed For Breakpoints', icon: SolidLineSeriesSymbol },
  ...directionalSeriesNames.map((name) => ({
    name,
    icon: DashedLineSeriesSymbol,
  })),
  { name: 'AM Corridor Peak', icon: 'circle' },
  { name: 'PM Corridor Peak', icon: 'circle' },
  { name: 'AM Signal Peaks', icon: 'circle' },
  { name: 'PM Signal Peaks', icon: 'circle' },
]

const formatPercentThresholdName = (value: number, label: string) =>
  `${formatNumber(value, 1)}% ${label}`

const getThresholdPercent = (
  thresholds: Record<string, number> | null | undefined,
  candidates: string[],
  fallback: number
) => {
  const normalizedCandidates = candidates.map(normalizeToken)
  const entry = Object.entries(thresholds ?? {}).find(([name]) =>
    normalizedCandidates.includes(normalizeToken(name))
  )

  return entry?.[1] ?? fallback
}

const buildPercentThresholdSeries = (
  name: string,
  value: number,
  color: string
): SeriesOption => ({
  name,
  type: 'line',
  yAxisIndex: 1,
  data: [
    [0, value],
    [1440, value],
  ],
  showSymbol: false,
  symbol: 'none',
  silent: true,
  lineStyle: {
    width: 1.5,
    type: 'dashed',
    color,
  },
  itemStyle: { color },
  tooltip: {
    valueFormatter: (tooltipValue) =>
      typeof tooltipValue === 'number'
        ? `${formatNumber(tooltipValue, 1)}%`
        : String(tooltipValue),
  },
})

export const buildPlanProfileOption = (
  result: TimeOfDayResult
): EChartsOption => {
  const corridorProfile = result.planProfile?.corridorProfile
  const directionalProfiles = result.planProfile?.directionalProfiles ?? []

  const directionalSeriesNames = directionalProfiles.map((profile, index) =>
    formatDirectionProfileName(profile, index)
  )
  const directionalSeries = directionalProfiles.map((profile, index) =>
    buildProfileLineSeries({
      profile,
      name: directionalSeriesNames[index],
      valueKey: 'averageVolume',
      color: directionalColors[index % directionalColors.length],
      lineStyle: { width: 1.5, opacity: 0.75, type: 'dashed' },
    })
  )

  const amCorridorPeaks = getCorridorPeakEvents(result.planProfile?.peaks, 'AM')
  const pmCorridorPeaks = getCorridorPeakEvents(result.planProfile?.peaks, 'PM')
  const amSignalPeaks = getLocationPeakEvents(result.planProfile?.peaks, 'AM')
  const pmSignalPeaks = getLocationPeakEvents(result.planProfile?.peaks, 'PM')

  const amPeakSeries = buildPeakScatterSeries(
    amCorridorPeaks,
    'AM Corridor Peak',
    chartColors.amPeak,
    0,
    11
  )
  const pmPeakSeries = buildPeakScatterSeries(
    pmCorridorPeaks,
    'PM Corridor Peak',
    chartColors.pmPeak,
    0,
    11
  )
  const amSignalPeakSeries = buildNumberedSignalPeakSeries(
    amSignalPeaks,
    'AM Signal Peaks',
    chartColors.amSignalPeak
  )
  const pmSignalPeakSeries = buildNumberedSignalPeakSeries(
    pmSignalPeaks,
    'PM Signal Peaks',
    chartColors.pmSignalPeak
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
      amPeakSeries,
      pmPeakSeries,
      amSignalPeakSeries,
      pmSignalPeakSeries,
    ],
    result
  )

  return buildBaseOption({
    title: 'Corridor Plan Recommendation',
    series,
    legendData: getPlanProfileLegendData(directionalSeriesNames),
    legendConfig: {
      bottom: 72,
      orient: 'vertical',
      right: 0,
      top: 72,
      type: 'scroll',
    },
    right: 250,
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

  const splitReviewPercent = getThresholdPercent(
    splitPressure?.thresholdPercentByName,
    ['SplitReview', '35% split review', 'split review'],
    35
  )
  const shoulderReviewPercent = getThresholdPercent(
    splitPressure?.thresholdPercentByName,
    ['ShoulderReview', '45% shoulder review', 'shoulder review'],
    45
  )
  const splitReviewName = formatPercentThresholdName(
    splitReviewPercent,
    'split review'
  )
  const shoulderReviewName = formatPercentThresholdName(
    shoulderReviewPercent,
    'shoulder review'
  )
  const primarySeriesName = formatRepresentativeSeriesName(
    splitPressure?.primaryDirections,
    'primary',
    'primary street'
  )
  const crossSeriesName = formatRepresentativeSeriesName(
    splitPressure?.crossDirections,
    'cross street',
    'cross street'
  )

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
        name: primarySeriesName,
        valueKey: 'averageVolume',
        color: chartColors.primary,
        lineStyle: { width: 2.5 },
      }),
      buildProfileLineSeries({
        profile: splitPressure?.crossStreetProfile,
        name: crossSeriesName,
        valueKey: 'averageVolume',
        color: chartColors.cross,
        lineStyle: { width: 2.5 },
      }),
      {
        name: 'Cross-traffic percent',
        type: 'line',
        yAxisIndex: 1,
        data: crossTrafficPercentData,
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 2.5,
          type: 'dashed',
          color: chartColors.percent,
        },
        itemStyle: { color: chartColors.percent },
        tooltip: {
          valueFormatter: (tooltipValue) =>
            typeof tooltipValue === 'number'
              ? `${formatNumber(tooltipValue, 1)}%`
              : String(tooltipValue),
        },
      },
      buildPercentThresholdSeries(
        splitReviewName,
        splitReviewPercent,
        chartColors.splitReview
      ),
      buildPercentThresholdSeries(
        shoulderReviewName,
        shoulderReviewPercent,
        chartColors.shoulderReview
      ),
      buildPeakScatterSeries(
        volumePeaks,
        'Volume Peaks',
        chartColors.volumePeak
      ),
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
    legendData: [
      primarySeriesName,
      crossSeriesName,
      'Cross-traffic percent',
      splitReviewName,
      shoulderReviewName,
    ],
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
      plan: formatPlanNumber(plan.planNumber),
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
      plan: formatPlanNumber(plan.planNumber),
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
) => {
  const locationPeaks = getNumberedSignalPeakEvents(peaks)
  const periodPeaks = locationPeaks.filter((peak) =>
    peakPeriodMatches(peak, period)
  )

  if (periodPeaks.length > 0) {
    return periodPeaks
  }

  return locationPeaks.filter((peak) => {
    if (peak.period || peak.minutes === undefined) return false

    if (period.toLowerCase() === 'am') return peak.minutes < 12 * 60
    if (period.toLowerCase() === 'pm') return peak.minutes >= 12 * 60

    return true
  })
}

export const getCrossTrafficLocations = (
  locations: TimeOfDayCrossTrafficLocationDto[] | null | undefined,
  period: string
) =>
  [
    ...(locations?.filter(
      (location) => location.period?.toLowerCase() === period.toLowerCase()
    ) ?? []),
  ].sort(
    (left, right) =>
      (right.totalVehiclesPerHour ?? 0) - (left.totalVehiclesPerHour ?? 0)
  )

export const getMovementPressures = (
  movements: TimeOfDayMovementPressureDto[] | null | undefined,
  period: string
) =>
  [
    ...(movements?.filter(
      (movement) => movement.period?.toLowerCase() === period.toLowerCase()
    ) ?? []),
  ].sort((left, right) => (right.volume ?? 0) - (left.volume ?? 0))
