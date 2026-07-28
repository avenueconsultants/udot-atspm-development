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
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
  LegendComponentOption,
  SeriesOption,
} from 'echarts'
import { graphic } from 'echarts'

type ProfileValueKey = keyof Pick<
  TimeOfDayProfilePointDto,
  'averageVolume' | 'smoothedVolume' | 'rollingHourVph'
>

export interface TimeOfDaySchedulePlanDetails {
  plan: string
  description: string
}

export interface TimeOfDayScheduleRow {
  id: string
  startMinutes: number
  endMinutes: number
  start: string
  end: string
  durationMinutes: number
  recommended: TimeOfDaySchedulePlanDetails | null
  current: TimeOfDaySchedulePlanDetails | null
  comparison: 'Same' | 'Different' | 'Missing'
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
  markerSymbol?: 'circle' | 'rect'
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

const isPercentPeakEvent = (peak: TimeOfDayPeakEventDto) =>
  normalizeToken(peak.series) === 'crosstrafficpercent' ||
  peak.valueUnits?.toLowerCase().includes('percent') === true

const getSharedVolumeAxisMax = (result: TimeOfDayResult) => {
  let maximumVolume = 0
  const includeVolume = (value?: number | null) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      maximumVolume = Math.max(maximumVolume, value)
    }
  }
  const includeProfile = (
    profile: TimeOfDayProfileDto | null | undefined,
    valueKeys: ProfileValueKey[]
  ) => {
    profile?.points?.forEach((point) => {
      valueKeys.forEach((valueKey) => includeVolume(point[valueKey]))
    })
  }

  includeProfile(result.planProfile?.corridorProfile, [
    'averageVolume',
    'smoothedVolume',
  ])
  result.planProfile?.directionalProfiles?.forEach((profile) =>
    includeProfile(profile, ['averageVolume'])
  )
  result.planProfile?.peaks?.forEach((peak) => {
    if (!isPercentPeakEvent(peak)) includeVolume(peak.value)
  })

  includeProfile(result.splitPressure?.primaryProfile, ['averageVolume'])
  includeProfile(result.splitPressure?.crossStreetProfile, ['averageVolume'])
  result.splitPressure?.periodPeaks?.forEach((peak) => {
    if (!isPercentPeakEvent(peak)) includeVolume(peak.value)
  })
  result.splitPressure?.crossTrafficLocations?.forEach((location) =>
    includeVolume(location.totalVehiclesPerHour)
  )
  result.splitPressure?.movementPressures?.forEach((movement) =>
    includeVolume(movement.volume)
  )
  includeVolume(result.splitPressure?.primaryPeakVolume)
  includeVolume(result.splitPressure?.crossStreetPeakVolume)

  if (maximumVolume === 0) return undefined

  return Math.ceil((maximumVolume * 1.1) / 1000) * 1000
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

const getPlanDifferenceMarkAreas = (
  result: TimeOfDayResult
): Array<[Record<string, unknown>, Record<string, unknown>]> => {
  if (
    !result.recommendation?.recommendedSchedule?.length ||
    !result.planComparison?.commonCurrentSchedule?.length
  ) {
    return []
  }

  return buildScheduleRows(result)
    .filter((row) => row.comparison !== 'Same')
    .map((row) => [
      {
        name: 'Existing and proposed plans differ',
        xAxis: row.startMinutes,
        itemStyle: { color: 'rgba(245, 158, 11, 0.12)' },
      },
      { xAxis: row.endMinutes },
    ])
}

const getPlanMarkAreas = (result: TimeOfDayResult) => [
  ...buildPlanMarkAreas(
    result.recommendation?.recommendedSchedule,
    'Recommended',
    getPlanColorContext(result, result.recommendation?.recommendedSchedule)
  ),
  ...getPlanDifferenceMarkAreas(result),
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
    symbol: peak.markerSymbol ?? 'circle',
    itemStyle: {
      color: peak.badgeColor,
      opacity: 0.82,
    },
  })),
  symbol: peaks[0]?.markerSymbol ?? 'circle',
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

const createTimeOfDayTitle = ({
  title,
  dateRange,
  info,
}: {
  title: string
  dateRange?: string
  info?: string
}) => {
  const titleTops = [0]

  if (dateRange) {
    titleTops.push(32)
  }

  if (info) {
    titleTops.push(dateRange ? 58 : 32)
  }

  return createTitle({ title, dateRange, info }).map((titleOption, index) => ({
    ...titleOption,
    left: 0,
    top: titleTops[index],
    textAlign: 'left' as const,
  }))
}

const buildBaseOption = ({
  result,
  title,
  series,
  yAxis,
  top = 190,
  right,
  legendData,
  legendConfig,
  showLegend = true,
  dateRange = '',
  info,
}: {
  result: TimeOfDayResult
  title: string
  series: SeriesOption[]
  yAxis: EChartsOption['yAxis']
  right?: number
  legendData?: LegendComponentOption['data']
  legendConfig?: Partial<LegendComponentOption>
  top?: number
  showLegend?: boolean
  dateRange?: string
  info?: string
}): EChartsOption => {
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis]
  const scheduleYAxisIndex = yAxes.length
  const scheduleSeries = buildScheduleOverlaySeries(
    result,
    1,
    scheduleYAxisIndex
  )
  const hasScheduleRails = scheduleSeries.length > 0
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
      xAxisIndex: hasScheduleRails ? [0, 1] : 0,
      start: 0,
      end: 100,
      left: grid.left,
      right: grid.right,
      bottom: 24,
      height: 26,
    },
    {
      type: 'inside',
      xAxisIndex: hasScheduleRails ? [0, 1] : 0,
      start: 0,
      end: 100,
    },
  ])
  const xAxis = {
    type: 'value' as const,
    min: 0,
    max: 1440,
    interval: 60,
    name: 'Time of Day',
    nameLocation: 'middle' as const,
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
  }
  const scheduleNotice = getScheduleOverlayNotice(result)

  return {
    title: createTimeOfDayTitle({ title, dateRange, info }),
    color: [
      chartColors.raw,
      chartColors.smooth,
      chartColors.primary,
      chartColors.cross,
      chartColors.percent,
    ],
    grid: hasScheduleRails
      ? [
          grid,
          {
            left: 90,
            right,
            top: 108,
            height: 52,
            borderColor: '#d0d5dd',
            borderWidth: 1,
          },
        ]
      : grid,
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
    graphic: scheduleNotice
      ? {
          type: 'text',
          left: 90,
          top: 87,
          silent: true,
          style: {
            text: scheduleNotice,
            fill: '#9a6700',
            fontSize: 11,
            fontWeight: 600,
          },
        }
      : undefined,
    xAxis: hasScheduleRails
      ? [
          xAxis,
          {
            type: 'value',
            gridIndex: 1,
            min: 0,
            max: 1440,
            axisLabel: { show: false },
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
          },
        ]
      : xAxis,
    yAxis: hasScheduleRails
      ? [
          ...yAxes,
          {
            type: 'category',
            gridIndex: 1,
            data: ['Existing', 'Proposed'],
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
              color: '#475467',
              fontSize: 11,
              fontWeight: 600,
            },
          },
        ]
      : yAxis,
    dataZoom,
    series: [...series, ...scheduleSeries],
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
  const sharedVolumeAxisMax = getSharedVolumeAxisMax(result)
  const yAxis = createYAxis(Boolean(plans?.length), {
    name: 'Volume (vph)',
    nameGap: 60,
    max: sharedVolumeAxisMax,
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
    result,
    title: 'Corridor Plan Recommendation',
    dateRange: titleDateRange,
    info: titleInfo,
    series,
    legendData: getPlanProfileLegendData(directionalSeriesNames),
    right: 250,
    yAxis,
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
      (peak) => !isPercentPeakEvent(peak)
    ) ?? []
  const percentPeaks =
    splitPressure?.periodPeaks?.filter(isPercentPeakEvent) ?? []
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
  const sharedVolumeAxisMax = getSharedVolumeAxisMax(result)
  const yAxis = createYAxis(
    Boolean(plans?.length),
    {
      name: 'Volume (vph)',
      nameGap: 60,
      max: sharedVolumeAxisMax,
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
    result,
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
      createLegendItem(
        'AM Cross Traffic Locations',
        'circle',
        chartColors.amSignalPeak
      ),
      createLegendItem(
        'Midday Cross Traffic Locations',
        'circle',
        chartColors.middaySignalPeak
      ),
      createLegendItem(
        'PM Cross Traffic Locations',
        'circle',
        chartColors.pmSignalPeak
      ),
      createLegendItem(
        'AM Movement Pressure',
        'rect',
        chartColors.amSignalPeak
      ),
      createLegendItem(
        'PM Movement Pressure',
        'rect',
        chartColors.pmSignalPeak
      ),
    ],
    legendConfig: {
      selected: {
        'AM Movement Pressure': false,
        'PM Movement Pressure': false,
      },
    },
    yAxis,
  })
}

interface TimeOfDayScheduleEntry {
  plan: Plan
  interval: { start: number; end: number }
}

const getScheduleEntries = (
  plans: Plan[] | null | undefined
): TimeOfDayScheduleEntry[] => {
  const entries: TimeOfDayScheduleEntry[] = []

  plans?.forEach((plan) => {
    const interval = getPlanIntervalMinutes(plan)
    if (interval) entries.push({ plan, interval })
  })

  return entries
}

const getSchedulePlanDetails = (
  entry?: TimeOfDayScheduleEntry
): TimeOfDaySchedulePlanDetails | null =>
  entry
    ? {
        plan: formatPlanNumber(entry.plan.planNumber),
        description: entry.plan.planDescription ?? '-',
      }
    : null

const formatScheduleBoundary = (minutes: number) =>
  minutes === 1440 ? '00:00' : minutesToTimeLabel(minutes)

export const buildScheduleRows = (
  result: TimeOfDayResult
): TimeOfDayScheduleRow[] => {
  const recommendedEntries = getScheduleEntries(
    result.recommendation?.recommendedSchedule
  )
  const currentEntries = getScheduleEntries(
    result.planComparison?.commonCurrentSchedule
  )
  const boundaries = [
    ...new Set(
      [...recommendedEntries, ...currentEntries].flatMap(({ interval }) => [
        interval.start,
        interval.end,
      ])
    ),
  ].sort((left, right) => left - right)

  return boundaries.slice(0, -1).flatMap((start, index) => {
    const end = boundaries[index + 1]
    const recommendedEntry = recommendedEntries.find(
      ({ interval }) => interval.start <= start && interval.end >= end
    )
    const currentEntry = currentEntries.find(
      ({ interval }) => interval.start <= start && interval.end >= end
    )
    if (!recommendedEntry && !currentEntry) return []

    const recommended = getSchedulePlanDetails(recommendedEntry)
    const current = getSchedulePlanDetails(currentEntry)
    const comparison =
      recommended && current
        ? recommended.plan === current.plan
          ? 'Same'
          : 'Different'
        : 'Missing'

    return [
      {
        id: `${start}-${end}`,
        startMinutes: start,
        endMinutes: end,
        start: formatScheduleBoundary(start),
        end: formatScheduleBoundary(end),
        durationMinutes: end - start,
        recommended,
        current,
        comparison,
      },
    ]
  })
}

type ScheduleTimelineDatum = [number, number, number, string, string, string]

const schedulePlanColors = [
  '#607d8b',
  '#ef6c00',
  '#2e7d32',
  '#1565c0',
  '#6a1b9a',
  '#c62828',
]

const withColorOpacity = (color: string, opacity: number) => {
  const hex = color.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

const renderSchedulePlanBlock = (
  params: CustomSeriesRenderItemParams,
  api: CustomSeriesRenderItemAPI
): CustomSeriesRenderItemReturn => {
  const start = api.coord([api.value(0), api.value(2)])
  const end = api.coord([api.value(1), api.value(2)])
  const laneSize = api.size?.([0, 1])
  const height =
    (Array.isArray(laneSize) ? Number(laneSize[1]) : Number(laneSize ?? 0)) *
    0.58
  const coordSys = params.coordSys as unknown as {
    x: number
    y: number
    width: number
    height: number
  }
  const rectShape = graphic.clipRectByRect(
    {
      x: start[0],
      y: start[1] - height / 2,
      width: end[0] - start[0],
      height,
    },
    {
      x: coordSys.x,
      y: coordSys.y,
      width: coordSys.width,
      height: coordSys.height,
    }
  )
  if (!rectShape) return

  const width = Math.max(0, end[0] - start[0])
  const color = String(api.value(4))
  const rectElement = {
    type: 'rect' as const,
    shape: rectShape,
    style: {
      fill: withColorOpacity(color, 0.6),
      stroke: color,
      lineWidth: 1.25,
    },
  }

  if (width < 32) return rectElement

  return {
    type: 'group',
    children: [
      rectElement,
      {
        type: 'text',
        style: {
          x: (start[0] + end[0]) / 2,
          y: start[1],
          text: String(api.value(3)),
          fill: color,
          fontSize: 11,
          fontWeight: 700,
          align: 'center',
          verticalAlign: 'middle',
          width: Math.max(0, width - 8),
          overflow: 'truncate',
        },
      },
    ],
  }
}

const getSchedulePlanColorMap = (entries: TimeOfDayScheduleEntry[]) => {
  const colorMap = new Map<string, string>()

  entries.forEach(({ plan }) => {
    const planName = formatPlanNumber(plan.planNumber)
    if (colorMap.has(planName)) return

    const colorIndex = colorMap.size % schedulePlanColors.length
    colorMap.set(planName, schedulePlanColors[colorIndex])
  })

  return colorMap
}

const getScheduleTimelineData = (
  entries: TimeOfDayScheduleEntry[],
  lane: number,
  colorMap: Map<string, string>
): ScheduleTimelineDatum[] =>
  entries.map(({ plan, interval }) => {
    const planName = formatPlanNumber(plan.planNumber)

    return [
      interval.start,
      interval.end,
      lane,
      planName,
      colorMap.get(planName) ?? schedulePlanColors[0],
      plan.planDescription ?? '-',
    ]
  })

const getScheduleOverlayColorMap = (
  result: TimeOfDayResult,
  existingEntries: TimeOfDayScheduleEntry[],
  proposedEntries: TimeOfDayScheduleEntry[]
) => {
  const colorMap = new Map<string, string>()
  const planColorContext = getPlanColorContext(
    result,
    result.recommendation?.recommendedSchedule
  )

  proposedEntries.forEach(({ plan }, index) => {
    const planName = formatPlanNumber(plan.planNumber)
    if (colorMap.has(planName)) return

    const planColor = getTimeOfDayPlanBackgroundColor(
      plan,
      planColorContext,
      index
    )
    colorMap.set(
      planName,
      planColor === chartColors.defaultPlanBackground
        ? schedulePlanColors[0]
        : planColor
    )
  })

  existingEntries.forEach(({ plan }) => {
    const planName = formatPlanNumber(plan.planNumber)
    if (colorMap.has(planName)) return

    const colorIndex = colorMap.size % schedulePlanColors.length
    colorMap.set(planName, schedulePlanColors[colorIndex])
  })

  return colorMap
}

const getScheduleOverlayNotice = (result: TimeOfDayResult) => {
  const exceptionLocations = [
    ...new Set(
      result.planComparison?.exceptionLocationIdentifiers?.filter(Boolean) ?? []
    ),
  ]
  if (!exceptionLocations.length) return undefined

  const resultLocations =
    result.locationIdentifiers?.filter(Boolean) ?? []
  const selectedLocations = resultLocations.length
    ? resultLocations
    : result.locations
        ?.map((location) => location.locationIdentifier)
        .filter((identifier): identifier is string => Boolean(identifier)) ?? []
  const exceptionSet = new Set(exceptionLocations)
  const commonLocations = selectedLocations.filter(
    (location) => !exceptionSet.has(location)
  )
  const coverage = selectedLocations.length
    ? `${commonLocations.length} of ${selectedLocations.length} locations${
        commonLocations.length ? ` (${commonLocations.join(', ')})` : ''
      }`
    : 'the selected locations'

  return `Existing rail shows the common schedule for ${coverage}; different schedules: ${exceptionLocations.join(
    ', '
  )}.`
}

const buildScheduleOverlaySeries = (
  result: TimeOfDayResult,
  xAxisIndex: number,
  yAxisIndex: number
): SeriesOption[] => {
  const existingEntries = getScheduleEntries(
    result.planComparison?.commonCurrentSchedule
  )
  const proposedEntries = getScheduleEntries(
    result.recommendation?.recommendedSchedule
  )
  if (!existingEntries.length && !proposedEntries.length) return []

  const colorMap = getScheduleOverlayColorMap(
    result,
    existingEntries,
    proposedEntries
  )
  const buildRailSeries = (
    name: string,
    entries: TimeOfDayScheduleEntry[],
    lane: number
  ): SeriesOption => ({
    name,
    type: 'custom',
    renderItem: renderSchedulePlanBlock,
    xAxisIndex,
    yAxisIndex,
    encode: { x: [0, 1], y: 2, tooltip: [3, 5] },
    dimensions: ['Start', 'End', 'Lane', 'Plan', 'Color', 'Description'],
    data: getScheduleTimelineData(entries, lane, colorMap),
    z: 30,
  })

  return [
    ...(existingEntries.length
      ? [buildRailSeries('Existing schedule rail', existingEntries, 0)]
      : []),
    ...(proposedEntries.length
      ? [buildRailSeries('Proposed schedule rail', proposedEntries, 1)]
      : []),
  ]
}

export const buildScheduleComparisonOption = (
  result: TimeOfDayResult
): EChartsOption => {
  const existingEntries = getScheduleEntries(
    result.planComparison?.commonCurrentSchedule
  )
  const proposedEntries = getScheduleEntries(
    result.recommendation?.recommendedSchedule
  )
  const colorMap = getSchedulePlanColorMap([
    ...existingEntries,
    ...proposedEntries,
  ])
  const differenceWindows = buildScheduleRows(result).filter(
    (row) => row.comparison !== 'Same'
  )

  return {
    animation: false,
    grid: { left: 100, right: 30, top: 24, bottom: 54 },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'value',
      min: 0,
      max: 1440,
      interval: 120,
      axisLabel: { formatter: (value: number) => minutesToTimeLabel(value) },
      splitLine: { show: true, lineStyle: { color: '#e5e7eb' } },
    },
    yAxis: {
      type: 'category',
      data: ['Existing', 'Proposed'],
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Different plan windows',
        type: 'line',
        data: [],
        silent: true,
        lineStyle: { opacity: 0 },
        markArea: {
          silent: true,
          label: { show: false },
          itemStyle: { color: 'rgba(245, 158, 11, 0.12)' },
          data: differenceWindows.map((row) => [
            { xAxis: row.startMinutes },
            { xAxis: row.endMinutes },
          ]),
        },
      },
      {
        name: 'Existing schedule',
        type: 'custom',
        renderItem: renderSchedulePlanBlock,
        encode: { x: [0, 1], y: 2, tooltip: [3, 5] },
        dimensions: ['Start', 'End', 'Lane', 'Plan', 'Color', 'Description'],
        data: getScheduleTimelineData(existingEntries, 0, colorMap),
        z: 3,
      },
      {
        name: 'Proposed schedule',
        type: 'custom',
        renderItem: renderSchedulePlanBlock,
        encode: { x: [0, 1], y: 2, tooltip: [3, 5] },
        dimensions: ['Start', 'End', 'Lane', 'Plan', 'Color', 'Description'],
        data: getScheduleTimelineData(proposedEntries, 1, colorMap),
        z: 3,
      },
    ],
  }
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

const movementOrder: Record<string, number> = {
  left: 0,
  thru: 1,
  through: 1,
  straight: 1,
  right: 2,
}

const getMovementName = (movement: TimeOfDayMovementPressureDto) =>
  movement.movementLabel ?? movement.movement ?? ''

const compareMovementPressures = (
  left: TimeOfDayMovementPressureDto,
  right: TimeOfDayMovementPressureDto,
  locationNumberMap?: TimeOfDayLocationNumberMap
) => {
  if (locationNumberMap) {
    const leftLocationNumber = getLocationNumber(
      locationNumberMap,
      left.locationIdentifier
    )
    const rightLocationNumber = getLocationNumber(
      locationNumberMap,
      right.locationIdentifier
    )
    const locationNumberComparison =
      (leftLocationNumber ?? Number.MAX_SAFE_INTEGER) -
      (rightLocationNumber ?? Number.MAX_SAFE_INTEGER)
    if (locationNumberComparison !== 0) return locationNumberComparison
  }

  const locationComparison = (left.locationIdentifier ?? '').localeCompare(
    right.locationIdentifier ?? '',
    undefined,
    { numeric: true, sensitivity: 'base' }
  )
  if (locationComparison !== 0) return locationComparison

  const leftMovement = normalizeToken(getMovementName(left))
  const rightMovement = normalizeToken(getMovementName(right))
  const movementOrderComparison =
    (movementOrder[leftMovement] ?? Number.MAX_SAFE_INTEGER) -
    (movementOrder[rightMovement] ?? Number.MAX_SAFE_INTEGER)

  return (
    movementOrderComparison ||
    leftMovement.localeCompare(rightMovement, undefined, {
      sensitivity: 'base',
    })
  )
}

export const getMovementPressures = (
  movements: TimeOfDayMovementPressureDto[] | null | undefined,
  period: string,
  locationNumberMap?: TimeOfDayLocationNumberMap
) =>
  [
    ...(movements?.filter(
      (movement) => movement.period?.toLowerCase() === period.toLowerCase()
    ) ?? []),
  ].sort((left, right) =>
    compareMovementPressures(left, right, locationNumberMap)
  )

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

  const addPeak = (
    peak: TimeOfDayPeakEventDto,
    markerSymbol: 'circle' | 'rect' = 'circle'
  ) => {
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
      markerSymbol,
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
      period,
      locationNumberMap
    ).forEach((movement) => {
      addPeak(
        {
          period,
          locationIdentifier: movement.locationIdentifier ?? undefined,
          timeOfDay: movement.peakTime ?? undefined,
          minutes:
            getPlanBoundaryMinutes(movement.peakTime ?? undefined) ?? undefined,
          value: movement.volume,
          valueUnits: 'vph',
        },
        'rect'
      )
    })
  })

  return locationPeaks
}

const buildSplitPressureLocationPeakSeries = (
  result: TimeOfDayResult,
  locationNumberMap: TimeOfDayLocationNumberMap
): SeriesOption[] => {
  const locationPeaks = buildSplitPressureLocationPeakEvents(
    result,
    locationNumberMap
  )

  return ['AM', 'Midday', 'PM'].flatMap((period) => {
    const periodPeaks = locationPeaks.filter((peak) =>
      peakPeriodMatches(peak, period)
    )
    const crossTrafficPeaks = periodPeaks.filter(
      (peak) => peak.markerSymbol !== 'rect'
    )
    const movementPressurePeaks = periodPeaks.filter(
      (peak) => peak.markerSymbol === 'rect'
    )

    return [
      ...(crossTrafficPeaks.length
        ? [
            buildNumberedSignalPeakSeries(
              crossTrafficPeaks,
              `${period} Cross Traffic Locations`,
              getTimeOfDayPeriodBadgeColor(period)
            ),
          ]
        : []),
      ...(movementPressurePeaks.length
        ? [
            buildNumberedSignalPeakSeries(
              movementPressurePeaks,
              `${period} Movement Pressure`,
              getTimeOfDayPeriodBadgeColor(period)
            ),
          ]
        : []),
    ]
  })
}

const getUnnumberedSplitPressurePeakEvents = (
  peaks: TimeOfDayPeakEventDto[],
  locationNumberMap: TimeOfDayLocationNumberMap
) =>
  peaks.filter(
    (peak) => !getLocationNumber(locationNumberMap, peak.locationIdentifier)
  )
