import { SearchLocation as Location } from '@/api/config'

// Local form state: dates, selected location, and controls are converted to generated API options at submission.
export interface LeftTurnGapReportFormState {
  location: Location | null
  startDateTime: Date
  endDateTime: Date
  cyclesWithPedCalls: number
  cyclesWithGapOuts: number
  leftTurnVolume: number
  finalGapAnalysisReport: boolean
  vehiclesPercentageAcceptableGaps: number
  acceptableSplitFailPercentage: number
  splitFailAnalysis: boolean
  pedestrianCallAnalysis: boolean
  conflictingVolumesAnalysis: boolean
  timeOptions: string
  startHour: number
  endHour: number
  startMinute: number
  endMinute: number
  getAMPMPeakHour: boolean
  get24HourPeriod: boolean
  getAMPMPeakPeriod: boolean
  approachIds: number[]
  selectedDays: number[]
}
