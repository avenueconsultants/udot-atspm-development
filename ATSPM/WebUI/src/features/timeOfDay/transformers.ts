import type {
  Plan,
  TimeOfDayCrossTrafficLocationDto,
  TimeOfDayMovementPressureDto,
  TimeOfDayPeakEventDto,
  TimeOfDayProfileDto,
  TimeOfDayProfilePointDto,
  TimeOfDayResult,
} from '@/api/reports'
import {
  createDataZoom,
  createGrid,
  createInfoString,
  createLegend,
  createTitle,
  createYAxis,
} from '@/features/charts/common/transformers'
import {
  DashedLineSeriesSymbol,
  SolidLineSeriesSymbol,
} from '@/features/charts/utils'
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

interface TimeOfDayPlanLabelPoint {
  value: [number, number, string]
  label: {
    backgroundColor: string
    color: string
  }
}

interface TimeOfDayPlanColorContext {
  amPeakMinutes: number | null
  middayMinutes: number | null
  pmPeakMinutes: number | null
  amPlanIndex: number | null
  middayPlanIndex: number | null
  pmPlanIndex: number | null
}

export type TimeOfDayNumberedPeakEvent = TimeOfDayPeakEventDto & {
  badgeNumber: number
  badgeColor: string
}

export type TimeOfDayLocationNumberMap = Record<string, number>

const chartColors = {
  raw: '#455a64',
  smooth: '#1565c0',
  primary: '#1565c0',
  cross: '#c62828',
  percent: '#6a1b9a',
  amPeak: '#ef6c00',
  pmPeak: '#c62828',
  amSignalPeak: '#ef6c00',
  middaySignalPeak: '#2e7d32',
  pmSignalPeak: '#1565c0',
  amPlanBackground: '#ef6c00',
  middayPlanBackground: '#2e7d32',
  pmPlanBackground: '#1565c0',
  defaultPlanBackground: '#f0f0f0',
  volumePeak: '#ef6c00',
  splitReview: '#f9a825',
  shoulderReview: '#c62828',
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

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'long',
  day: '2-digit',
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

const formatSelectedDateRange = (selectedDates?: string[] | null) => {
  const validDates =
    selectedDates
      ?.map((selectedDate) => {
        const date = new Date(
          selectedDate.includes('T') ? selectedDate : `${selectedDate}T00:00:00`
        )
        return Number.isNaN(date.getTime()) ? null : date
      })
      .filter((date): date is Date => date !== null)
      .sort((left, right) => left.getTime() - right.getTime()) ?? []

  if (!validDates.length) return ''

  const firstDate = dateFormatter.format(validDates[0])
  const lastDate = dateFormatter.format(validDates[validDates.length - 1])

  return firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`
}

const formatPeakMeasurement = (
  value?: number | null,
  units?: string | null,
  maximumFractionDigits = 0
) => {
  if (value === undefined || value === null) return ''

  const normalizedUnits = units?.toLowerCase()
  if (normalizedUnits?.includes('percent') || units === '%') {
    return `${formatNumber(value, maximumFractionDigits)}%`
  }

  return [formatNumber(value, maximumFractionDigits), units]
    .filter(Boolean)
    .join(' ')
}

const formatPeakInfoValue = (
  time?: string | null,
  value?: number | null,
  units?: string | null,
  maximumFractionDigits = 0
) =>
  [time, formatPeakMeasurement(value, units, maximumFractionDigits)]
    .filter(Boolean)
    .join(' - ')

const formatPeakInfo = (items: Array<[string, string]>) => {
  const populatedItems = items.filter(([, value]) => Boolean(value))

  return populatedItems.length ? createInfoString(...populatedItems) : undefined
}

export const minutesToTimeLabel = (minutes: number) => {
  const clampedMinutes = Math.max(0, Math.min(1440, Math.round(minutes)))
  if (clampedMinutes === 1440) return '24:00'

  const hours = Math.floor(clampedMinutes / 60)
  const remainingMinutes = clampedMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(remainingMinutes).padStart(
    2,
    '0'
  )}`
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

const normalizeToken = (value?: string | null) =>
  value?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''

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

  return (
    endDate.toDateString() !== startDate.toDateString() && endDate > startDate
  )
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

const planIntervalContainsMinutes = (
  plan: Plan,
  minutes: number | null | undefined
) => {
  if (minutes === undefined || minutes === null) return false

  const interval = getPlanIntervalMinutes(plan)
  if (!interval) return false

  return minutes >= interval.start && minutes < interval.end
}

const getPlanIndexForMinutes = (
  plans: Plan[] | null | undefined,
  minutes: number | null
) => {
  if (minutes === null) return null

  const index = plans?.findIndex((plan) =>
    planIntervalContainsMinutes(plan, minutes)
  )

  return index === undefined || index < 0 ? null : index
}

const getFallbackPlanIndex = (
  plans: Plan[] | null | undefined,
  period: 'am' | 'midday' | 'pm'
) => {
  const planCount = plans?.length ?? 0
  if (planCount === 0) return null

  if (planCount >= 4) {
    if (period === 'am') return 1
    if (period === 'midday') return 2
    return 3
  }

  if (planCount === 3) {
    if (period === 'am') return 0
    if (period === 'midday') return 1
    return 2
  }

  return null
}

const getPlanColorContext = (
  result: TimeOfDayResult,
  plans: Plan[] | null | undefined = result.recommendation?.recommendedSchedule
): TimeOfDayPlanColorContext => {
  const amPeakMinutes =
    getPlanBoundaryMinutes(result.recommendation?.amPeakTime ?? undefined) ??
    null
  const middayMinutes =
    getPlanBoundaryMinutes(
      result.recommendation?.middayValleyTime ?? undefined
    ) ?? null
  const pmPeakMinutes =
    getPlanBoundaryMinutes(result.recommendation?.pmPeakTime ?? undefined) ??
    null

  return {
    amPeakMinutes,
    middayMinutes,
    pmPeakMinutes,
    amPlanIndex:
      getPlanIndexForMinutes(plans, amPeakMinutes) ??
      getFallbackPlanIndex(plans, 'am'),
    middayPlanIndex:
      getPlanIndexForMinutes(plans, middayMinutes) ??
      getFallbackPlanIndex(plans, 'midday'),
    pmPlanIndex:
      getPlanIndexForMinutes(plans, pmPeakMinutes) ??
      getFallbackPlanIndex(plans, 'pm'),
  }
}

export const getTimeOfDayPlanBackgroundColor = (
  plan: Plan,
  context?: TimeOfDayPlanColorContext,
  planIndex?: number
) => {
  if (
    planIndex === context?.amPlanIndex ||
    planIntervalContainsMinutes(plan, context?.amPeakMinutes)
  ) {
    return chartColors.amPlanBackground
  }

  if (
    planIndex === context?.middayPlanIndex ||
    planIntervalContainsMinutes(plan, context?.middayMinutes)
  ) {
    return chartColors.middayPlanBackground
  }

  if (
    planIndex === context?.pmPlanIndex ||
    planIntervalContainsMinutes(plan, context?.pmPeakMinutes)
  ) {
    return chartColors.pmPlanBackground
  }

  const normalizedDescription = normalizeToken(plan.planDescription)

  if (normalizedDescription.includes('ampeak')) {
    return chartColors.amPlanBackground
  }

  if (normalizedDescription.includes('midday')) {
    return chartColors.middayPlanBackground
  }

  if (normalizedDescription.includes('pmpeak')) {
    return chartColors.pmPlanBackground
  }

  return chartColors.defaultPlanBackground
}

const buildPlanMarkAreas = (
  plans: Plan[] | null | undefined,
  label: string,
  context?: TimeOfDayPlanColorContext
) => {
  const markAreas: Array<[Record<string, unknown>, Record<string, unknown>]> =
    []

  plans?.forEach((plan, index) => {
    const interval = getPlanIntervalMinutes(plan)
    if (!interval) return

    const color = getTimeOfDayPlanBackgroundColor(plan, context, index)

    markAreas.push([
      {
        name: `${label} ${formatPlanNumber(plan.planNumber)}`.trim(),
        xAxis: interval.start,
        itemStyle: {
          color,
          opacity: color === chartColors.defaultPlanBackground ? 0.35 : 0.14,
        },
      },
      { xAxis: interval.end },
    ])
  })

  return markAreas
}

const getPlanMarkAreas = (result: TimeOfDayResult) => [
  ...buildPlanMarkAreas(
    result.recommendation?.recommendedSchedule,
    'Recommended',
    getPlanColorContext(result, result.recommendation?.recommendedSchedule)
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
  color: string,
  yAxisIndex = 0
): SeriesOption => ({
  name,
  type: 'scatter',
  yAxisIndex,
  z: 20,
  data: peaks.map((peak) => ({
    name: String(peak.badgeNumber),
    value: [
      peak.minutes ?? 0,
      peak.value ?? 0,
      peak.label ?? peak.locationIdentifier ?? peak.period ?? name,
    ],
    itemStyle: {
      color: peak.badgeColor,
      opacity: 0.82,
    },
  })),
  symbol: 'circle',
  symbolSize: 18,
  label: {
    show: true,
    formatter: '{b}',
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 600,
  },
  itemStyle: {
    borderWidth: 0,
    color,
    opacity: 0.82,
  },
  tooltip: {
    valueFormatter: (value) =>
      typeof value === 'number' ? numberFormatter.format(value) : String(value),
  },
})
const formatPlanLabel = (plan: Plan) => {
  const planNumber = formatPlanNumber(plan.planNumber)
  const planName = planNumber === 'FREE' ? 'Free' : `Plan ${planNumber}`
  const planDescription = plan.planDescription?.trim()
  const normalizedPlanName = planName.toLowerCase()
  const normalizedPlanNumber = planNumber.toLowerCase()
  const normalizedPlanDescription = planDescription?.toLowerCase()

  return planDescription &&
    normalizedPlanDescription !== normalizedPlanName &&
    normalizedPlanDescription !== normalizedPlanNumber
    ? `{plan|${planName}}\n{info|${planDescription}}`
    : `{plan|${planName}}`
}

const buildPlanLabelSeries = (
  plans: Plan[] | null | undefined,
  yAxisIndex: number,
  context?: TimeOfDayPlanColorContext
): SeriesOption | null => {
  const data =
    plans
      ?.map((plan, index) => {
        const interval = getPlanIntervalMinutes(plan)
        if (!interval) return null

        const backgroundColor = getTimeOfDayPlanBackgroundColor(
          plan,
          context,
          index
        )

        return {
          value: [
            (interval.start + interval.end) / 2,
            1,
            formatPlanLabel(plan),
          ] as [number, number, string],
          label: {
            backgroundColor,
            color:
              backgroundColor === chartColors.defaultPlanBackground
                ? '#000000'
                : '#ffffff',
          },
        }
      })
      .filter((point): point is TimeOfDayPlanLabelPoint => point !== null) ?? []

  if (!data.length) return null

  return {
    name: 'Plans',
    type: 'scatter',
    symbol: 'roundRect',
    symbolSize: 3,
    yAxisIndex,
    color: '#808080',
    data,
    silent: true,
    tooltip: {
      show: false,
    },
    labelLayout: {
      y: 122,
      moveOverlap: 'shiftX',
      hideOverlap: plans ? plans.length > 10 : false,
      draggable: true,
    },
    labelLine: {
      show: true,
      lineStyle: {
        color: '#808080',
      },
    },
    label: {
      show: true,
      position: 'top',
      distance: 8,
      padding: 5,
      borderRadius: 5,
      minMargin: 10,
      align: 'left',
      backgroundColor: '#f0f0f0',
      formatter: (params) =>
        Array.isArray(params.value) ? String(params.value[2]) : '',
      rich: {
        plan: {
          fontSize: 9,
          fontWeight: 'bold',
          align: 'left',
        },
        info: {
          fontSize: 9,
          align: 'left',
        },
      },
    },
  }
}
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
  top = 160,
  right,
  legendData,
  legendConfig,
  showLegend = true,
  plans,
  planColorContext,
  dateRange = '',
  info,
}: {
  title: string
  series: SeriesOption[]
  yAxis: EChartsOption['yAxis']
  right?: number
  legendData?: LegendComponentOption['data']
  legendConfig?: Partial<LegendComponentOption>
  top?: number
  showLegend?: boolean
  plans?: Plan[] | null
  planColorContext?: TimeOfDayPlanColorContext
  dateRange?: string
  info?: string
}): EChartsOption => {
  const grid = createGrid({
    left: 90,
    right,
    top,
    bottom: 110,
    borderColor: '#d0d5dd',
    borderWidth: 1,
  })
  const dataZoom = createDataZoom([
    {
      type: 'slider',
      start: 0,
      end: 100,
      left: grid.left,
      right: grid.right,
      bottom: 24,
      height: 26,
    },
    {
      type: 'inside',
      start: 0,
      end: 100,
    },
  ])
  const yAxisCount = Array.isArray(yAxis) ? yAxis.length : 1
  const planLabelSeries = buildPlanLabelSeries(
    plans,
    yAxisCount - 1,
    planColorContext
  )

  return {
    title: {
      ...createTitle({ title, dateRange, info }),
      left: 0,
      textAlign: 'left',
    },
    color: [
      chartColors.raw,
      chartColors.smooth,
      chartColors.primary,
      chartColors.cross,
      chartColors.percent,
    ],
    grid,
    legend: createLegend({
      data: legendData,
      orient: 'vertical',
      show: showLegend,
      right: 0,
      top,
      type: 'scroll',
      backgroundColor: '#f0f0f0',
      borderRadius: 5,
      padding: [10, 12],
      ...legendConfig,
    }),
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value) =>
        typeof value === 'number'
          ? numberFormatter.format(value)
          : String(value),
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
    dataZoom,
    series: planLabelSeries ? [...series, planLabelSeries] : series,
  }
}

export const getTimeOfDayPeriodBadgeColor = (period?: string | null) => {
  const normalizedPeriod = normalizeToken(period)

  if (normalizedPeriod.startsWith('am')) return chartColors.amSignalPeak
  if (normalizedPeriod.startsWith('midday')) return chartColors.middaySignalPeak
  if (normalizedPeriod.startsWith('pm')) return chartColors.pmSignalPeak

  return chartColors.pmSignalPeak
}

export const getLocationNumber = (
  locationNumberMap: TimeOfDayLocationNumberMap,
  locationIdentifier?: string | null
) => locationNumberMap[normalizeToken(locationIdentifier)]

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

const createLegendItem = (name: string, icon: string, color: string) => ({
  name,
  icon,
  itemStyle: { color },
})

const getPlanProfileLegendData = (
  directionalSeriesNames: string[]
): LegendComponentOption['data'] => [
  createLegendItem('Median Raw Volume', SolidLineSeriesSymbol, chartColors.raw),
  createLegendItem(
    'Smoothed For Breakpoints',
    SolidLineSeriesSymbol,
    chartColors.smooth
  ),
  ...directionalSeriesNames.map((name, index) =>
    createLegendItem(
      name,
      DashedLineSeriesSymbol,
      directionalColors[index % directionalColors.length]
    )
  ),
  createLegendItem('AM Corridor Peak', 'circle', chartColors.amPeak),
  createLegendItem('PM Corridor Peak', 'circle', chartColors.pmPeak),
  createLegendItem('AM Signal Peaks', 'circle', chartColors.amSignalPeak),
  createLegendItem('PM Signal Peaks', 'circle', chartColors.pmSignalPeak),
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

  const plans = result.recommendation?.recommendedSchedule
  const yAxis = createYAxis(Boolean(plans?.length), {
    name: 'Volume (vph)',
    nameGap: 60,
    splitLine: {
      lineStyle: { color: '#e3e8ee' },
    },
  })

  const titleDateRange = formatSelectedDateRange(result.selectedDates)
  const titleInfo = formatPeakInfo([
    [
      'AM Corridor Peak:',
      formatPeakInfoValue(
        result.recommendation?.amPeakTime ?? amCorridorPeaks[0]?.timeOfDay,
        amCorridorPeaks[0]?.value,
        amCorridorPeaks[0]?.valueUnits ?? 'vph'
      ),
    ],
    [
      'PM Corridor Peak:',
      formatPeakInfoValue(
        result.recommendation?.pmPeakTime ?? pmCorridorPeaks[0]?.timeOfDay,
        pmCorridorPeaks[0]?.value,
        pmCorridorPeaks[0]?.valueUnits ?? 'vph'
      ),
    ],
  ])

  return buildBaseOption({
    title: 'Corridor Plan Recommendation',
    dateRange: titleDateRange,
    info: titleInfo,
    series,
    legendData: getPlanProfileLegendData(directionalSeriesNames),
    right: 250,
    yAxis,
    plans,
    planColorContext: getPlanColorContext(
      result,
      result.recommendation?.recommendedSchedule
    ),
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
  const locationNumberMap = buildSplitPressureLocationNumberMap(result)
  const locationPeakSeries = buildSplitPressureLocationPeakSeries(
    result,
    locationNumberMap
  )
  const unnumberedVolumePeaks = getUnnumberedSplitPressurePeakEvents(
    volumePeaks,
    locationNumberMap
  )
  const unnumberedPercentPeaks = getUnnumberedSplitPressurePeakEvents(
    percentPeaks,
    locationNumberMap
  )

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
      ...locationPeakSeries,
      ...(unnumberedVolumePeaks.length
        ? [
            buildPeakScatterSeries(
              unnumberedVolumePeaks,
              'Volume Peaks',
              chartColors.volumePeak
            ),
          ]
        : []),
      ...(unnumberedPercentPeaks.length
        ? [
            buildPeakScatterSeries(
              unnumberedPercentPeaks,
              'Cross Traffic Percent Peaks',
              chartColors.percent,
              1
            ),
          ]
        : []),
    ],
    result
  )

  const plans = result.recommendation?.recommendedSchedule
  const yAxis = createYAxis(
    Boolean(plans?.length),
    {
      name: 'Volume (vph)',
      nameGap: 60,
      splitLine: {
        lineStyle: { color: '#e3e8ee' },
      },
    },
    {
      name: 'Cross Traffic (%)',
      nameGap: 48,
      min: 0,
      max: (value) => Math.max(100, Math.ceil(value.max / 10) * 10),
      position: 'right',
      axisLabel: {
        formatter: '{value}%',
      },
      axisLine: { show: false },
    }
  )

  const titleDateRange = formatSelectedDateRange(result.selectedDates)
  const titleInfo = formatPeakInfo([
    [
      'Primary Peak:',
      formatPeakInfoValue(
        splitPressure?.primaryPeakTime,
        splitPressure?.primaryPeakVolume,
        'vph'
      ),
    ],
    [
      'Cross Peak:',
      formatPeakInfoValue(
        splitPressure?.crossStreetPeakTime,
        splitPressure?.crossStreetPeakVolume,
        'vph'
      ),
    ],
    [
      'Peak Cross Traffic:',
      formatPeakInfoValue(
        splitPressure?.peakCrossTrafficPercentTime,
        splitPressure?.peakCrossTrafficPercent,
        '%',
        1
      ),
    ],
  ])

  return buildBaseOption({
    title: 'Corridor Split Pressure',
    dateRange: titleDateRange,
    info: titleInfo,
    series,
    right: 410,
    legendData: [
      createLegendItem(
        primarySeriesName,
        SolidLineSeriesSymbol,
        chartColors.primary
      ),
      createLegendItem(
        crossSeriesName,
        SolidLineSeriesSymbol,
        chartColors.cross
      ),
      createLegendItem(
        'Cross-traffic percent',
        DashedLineSeriesSymbol,
        chartColors.percent
      ),
      createLegendItem(
        splitReviewName,
        DashedLineSeriesSymbol,
        chartColors.splitReview
      ),
      createLegendItem(
        shoulderReviewName,
        DashedLineSeriesSymbol,
        chartColors.shoulderReview
      ),
      createLegendItem('AM Location Peaks', 'circle', chartColors.amSignalPeak),
      createLegendItem(
        'Midday Location Peaks',
        'circle',
        chartColors.middaySignalPeak
      ),
      createLegendItem('PM Location Peaks', 'circle', chartColors.pmSignalPeak),
    ],
    yAxis,
    plans,
    planColorContext: getPlanColorContext(
      result,
      result.recommendation?.recommendedSchedule
    ),
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

const splitPressureLocationPeriods = ['AM', 'Midday', 'PM']
const splitPressureMovementPeriods = ['AM', 'PM']

const addLocationNumber = (
  locationNumberMap: TimeOfDayLocationNumberMap,
  locationIdentifier?: string | null
) => {
  const key = normalizeToken(locationIdentifier)
  if (!key || locationNumberMap[key]) return

  locationNumberMap[key] = Object.keys(locationNumberMap).length + 1
}

export const buildSplitPressureLocationNumberMap = (
  result: TimeOfDayResult
): TimeOfDayLocationNumberMap => {
  const locationNumberMap: TimeOfDayLocationNumberMap = {}

  splitPressureLocationPeriods.forEach((period) => {
    getCrossTrafficLocations(
      result.splitPressure?.crossTrafficLocations,
      period
    ).forEach((location) => {
      addLocationNumber(locationNumberMap, location.locationIdentifier)
    })
  })

  splitPressureMovementPeriods.forEach((period) => {
    getMovementPressures(
      result.splitPressure?.movementPressures,
      period
    ).forEach((movement) => {
      addLocationNumber(locationNumberMap, movement.locationIdentifier)
    })
  })

  result.splitPressure?.periodPeaks?.forEach((peak) => {
    addLocationNumber(locationNumberMap, peak.locationIdentifier)
  })

  return locationNumberMap
}

const buildSplitPressureLocationPeakEvents = (
  result: TimeOfDayResult,
  locationNumberMap: TimeOfDayLocationNumberMap
): TimeOfDayNumberedPeakEvent[] => {
  const locationPeaks: TimeOfDayNumberedPeakEvent[] = []
  const seen = new Set<string>()

  const addPeak = (peak: TimeOfDayPeakEventDto) => {
    const badgeNumber = getLocationNumber(
      locationNumberMap,
      peak.locationIdentifier
    )
    if (
      !badgeNumber ||
      peak.minutes === undefined ||
      peak.value === undefined
    ) {
      return
    }

    const key = [
      normalizeToken(peak.period),
      normalizeToken(peak.locationIdentifier),
      peak.minutes,
      peak.value,
    ].join('|')
    if (seen.has(key)) return
    seen.add(key)

    locationPeaks.push({
      ...peak,
      badgeNumber,
      badgeColor: getTimeOfDayPeriodBadgeColor(peak.period),
    })
  }

  splitPressureLocationPeriods.forEach((period) => {
    getCrossTrafficLocations(
      result.splitPressure?.crossTrafficLocations,
      period
    ).forEach((location) => {
      addPeak({
        period,
        locationIdentifier: location.locationIdentifier ?? undefined,
        locationDescription: location.locationDescription ?? undefined,
        timeOfDay: location.peakTime ?? undefined,
        minutes:
          location.minutes ??
          getPlanBoundaryMinutes(location.peakTime ?? undefined) ??
          undefined,
        value: location.totalVehiclesPerHour,
        valueUnits: 'vph',
      })
    })
  })

  splitPressureMovementPeriods.forEach((period) => {
    getMovementPressures(
      result.splitPressure?.movementPressures,
      period
    ).forEach((movement) => {
      addPeak({
        period,
        locationIdentifier: movement.locationIdentifier ?? undefined,
        timeOfDay: movement.peakTime ?? undefined,
        minutes:
          getPlanBoundaryMinutes(movement.peakTime ?? undefined) ?? undefined,
        value: movement.volume,
        valueUnits: 'vph',
      })
    })
  })

  return locationPeaks
}

const buildSplitPressureLocationPeakSeries = (
  result: TimeOfDayResult,
  locationNumberMap: TimeOfDayLocationNumberMap
): SeriesOption[] =>
  [
    { period: 'AM', name: 'AM Location Peaks' },
    { period: 'Midday', name: 'Midday Location Peaks' },
    { period: 'PM', name: 'PM Location Peaks' },
  ].flatMap(({ period, name }) => {
    const periodPeaks = buildSplitPressureLocationPeakEvents(
      result,
      locationNumberMap
    ).filter((peak) => peakPeriodMatches(peak, period))

    return periodPeaks.length
      ? [
          buildNumberedSignalPeakSeries(
            periodPeaks,
            name,
            getTimeOfDayPeriodBadgeColor(period)
          ),
        ]
      : []
  })

const getUnnumberedSplitPressurePeakEvents = (
  peaks: TimeOfDayPeakEventDto[],
  locationNumberMap: TimeOfDayLocationNumberMap
) =>
  peaks.filter(
    (peak) => !getLocationNumber(locationNumberMap, peak.locationIdentifier)
  )
