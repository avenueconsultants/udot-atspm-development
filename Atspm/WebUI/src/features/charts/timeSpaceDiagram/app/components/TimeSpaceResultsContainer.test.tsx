import { render, screen } from '@testing-library/react'
import { ToolType } from '@/features/charts/common/types'
import type { RawLinkPivotForTsdData } from '@/features/tools/link-pivot/types'
import type {
  RawTimeSpaceAverageData,
  RawTimeSpaceDiagramResponse,
  RawTimeSpaceHistoricData,
  TimeSpaceAverageOptions,
  TimeSpaceDiagramPhaseResult,
  TimeSpaceHistoricOptions,
} from '../../shared/types'
import TimeSpaceResultsContainer from './TimeSpaceResultsContainer'

jest.mock('nanoid', () => ({
  nanoid: () => 'test-entry-id',
}))

jest.mock('@/features/charts/api', () => ({
  transformTimeSpaceData: (response: RawTimeSpaceDiagramResponse) => ({
    type: response.type,
    data: {
      chart: {
        displayProps: {
          height: 500,
        },
      },
    },
  }),
}))

jest.mock('@/features/charts/timeSpaceDiagram/api/getTimeSpaceSrmData', () => ({
  useTimeSpaceSrmData: () => ({
    mutateAsync: jest.fn(),
    isLoading: false,
  }),
}))

jest.mock(
  '@/features/charts/timeSpaceDiagram/shared/components/GpxUploader/GpxUploadAccordion',
  () => ({
    GpxUploadAccordion: () => <div>GPX Upload</div>,
  })
)

jest.mock(
  '@/features/charts/timeSpaceDiagram/shared/components/SrmUploader/SrmUploadAccordion',
  () => ({
    SrmUploadAccordion: () => <div>SRM Upload</div>,
  })
)

jest.mock(
  '@/features/charts/timeSpaceDiagram/shared/components/TimeSpaceEChart',
  () => ({
    __esModule: true,
    default: ({ isVisible }: { isVisible: boolean }) => (
      <div data-testid="time-space-chart">{String(isVisible)}</div>
    ),
  })
)

jest.mock(
  '@/features/tools/link-pivot/components/LinkPivotAdjustmentTable',
  () => ({
    __esModule: true,
    default: ({ cycleLength }: { cycleLength: number | null }) => (
      <div>Adjustments cycle length: {String(cycleLength)}</div>
    ),
  })
)

jest.mock(
  '@/features/tools/link-pivot/components/LinkPivotApproachLinkComponent',
  () => ({
    LinkPivotApproachLinkComponent: () => <div>Link Pivot Approaches</div>,
  })
)

jest.mock('@/features/tools/link-pivot/linkPivotPcdTimeWindow', () => ({
  getLinkPivotPcdTimeWindowFromTimeSpaceOptions: () => null,
}))

function buildHistoricDatum(): RawTimeSpaceHistoricData {
  return {
    start: '2026-04-23T08:00:00Z',
    end: '2026-04-23T08:20:00Z',
    locationIdentifier: '6192',
    locationDescription: '6192 description',
    phaseNumber: 2,
    phaseNumberSort: '2',
    distanceToNextLocation: 100,
    distanceToPreviousLocation: 0,
    speed: 35,
    approachId: 1,
    approachDescription: 'Primary approach',
    phaseType: 'Primary',
    calculatedDistanceToNext: 100,
    calculatedDistanceToPrevious: 0,
    isIgnoredLocation: false,
    greenTimeEvents: [],
    laneByLaneCountDetectors: [],
    advanceCountDetectors: [],
    stopBarPresenceDetectors: [],
    cycleAllEvents: null,
    pedestrianIntervals: [],
    percentArrivalOnGreen: 50,
    tmcForPhase: {
      leftTurnEvents: [],
      rightTurnEvents: [],
    },
    order: 1,
    cycleLength: 120,
    isPhaseOverLap: false,
    tspNumberCheckins: 0,
    tspNumberCheckouts: 0,
    tspNumberEarlyGreens: 0,
    tspNumberExtendedGreens: 0,
    tspEvents: [],
    priorityAndPreemptionEvents: [],
    srmEntityTracks: [],
  }
}

function buildAverageDatum(): RawTimeSpaceAverageData {
  return {
    start: '2026-04-23T08:00:00Z',
    end: '2026-04-23T08:20:00Z',
    locationIdentifier: '6192',
    locationDescription: '6192 description',
    phaseNumber: 2,
    phaseNumberSort: '2',
    distanceToNextLocation: 100,
    distanceToPreviousLocation: 0,
    speed: 35,
    approachId: 1,
    approachDescription: 'Primary approach',
    phaseType: 'Primary',
    calculatedDistanceToNext: 100,
    calculatedDistanceToPrevious: 0,
    isIgnoredLocation: false,
    order: 1,
    offset: 0,
    cycleLength: 120,
    programmedSplit: 60,
    coordinatedPhases: true,
    greenTimeEvents: [],
    cycleAllEvents: null,
  }
}

function buildLinkPivotTsdData(): RawLinkPivotForTsdData[] {
  return [
    {
      direction: 'Primary',
      data: {
        adjustments: [],
        approachLinks: [],
        totalAogDownstreamBefore: 0,
        totalPaogDownstreamBefore: 0,
        totalAogDownstreamPredicted: 0,
        totalPaogDownstreamPredicted: 0,
        totalAogUpstreamBefore: 0,
        totalPaogUpstreamBefore: 0,
        totalAogUpstreamPredicted: 0,
        totalPaogUpstreamPredicted: 0,
        totalAogBefore: 0,
        totalPaogBefore: 0,
        totalAogPredicted: 0,
        totalPaogPredicted: 0,
        totalChartExisting: 0,
        totalChartPositiveChange: 0,
        totalChartNegativeChange: 0,
        totalChartRemaining: 0,
        totalUpstreamChartExisting: 0,
        totalUpstreamChartPositiveChange: 0,
        totalUpstreamChartNegativeChange: 0,
        totalUpstreamChartRemaining: 0,
        totalDownstreamChartExisting: 0,
        totalDownstreamChartPositiveChange: 0,
        totalDownstreamChartNegativeChange: 0,
        totalDownstreamChartRemaining: 0,
      },
    },
  ]
}

const historicOptions: TimeSpaceHistoricOptions = {
  routeId: '17',
  speedLimit: null,
  start: new Date('2026-04-23T08:00:00Z'),
  end: new Date('2026-04-23T08:20:00Z'),
  chartType: '',
  extendStartStopSearch: 2,
  showAllLanesInfo: true,
  locationIdentifier: '6192',
}

describe('TimeSpaceResultsContainer link-pivot tabs', () => {
  it('shows the link-pivot tab for historic runs even before link-pivot data arrives', () => {
    const timeSpaceData: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceHistoric,
      data: [
        {
          error: null,
          isSuccess: true,
          result: buildHistoricDatum(),
        },
      ],
    }
    render(
      <TimeSpaceResultsContainer
        timeSpaceData={timeSpaceData}
        linkPivotTsdData={[]}
        timeSpaceOptions={historicOptions}
      />
    )

    expect(
      screen.getByRole('tab', { name: 'Time Space Chart' })
    ).not.toBeNull()
    expect(screen.getByRole('tab', { name: 'Link Pivot' })).not.toBeNull()
  })

  it('does not show link-pivot tabs for average runs', () => {
    const timeSpaceData: RawTimeSpaceDiagramResponse = {
      type: ToolType.TimeSpaceAverage,
      data: [
        {
          error: null,
          isSuccess: true,
          result: buildAverageDatum(),
        },
      ],
    }
    const timeSpaceOptions: TimeSpaceAverageOptions = {
      routeId: '17',
      speedLimit: null,
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      startTime: '16:00',
      endTime: '16:20',
      daysOfWeek: [1, 2, 3, 4, 5],
      sequence: [],
      coordinatedPhases: [],
    }

    render(
      <TimeSpaceResultsContainer
        timeSpaceData={timeSpaceData}
        linkPivotTsdData={buildLinkPivotTsdData()}
        timeSpaceOptions={timeSpaceOptions}
      />
    )

    expect(screen.queryByRole('tab', { name: 'Link Pivot' })).toBeNull()
  })
})

describe('TimeSpaceResultsContainer Adjustments cycle length', () => {
  const renderWithFirstSignal = (
    firstSignal: TimeSpaceDiagramPhaseResult<RawTimeSpaceHistoricData>
  ) =>
    render(
      <TimeSpaceResultsContainer
        timeSpaceData={{
          type: ToolType.TimeSpaceHistoric,
          data: [
            firstSignal,
            {
              error: null,
              isSuccess: true,
              result: { ...buildHistoricDatum(), cycleLength: 150 },
            },
          ],
        }}
        linkPivotTsdData={buildLinkPivotTsdData()}
        timeSpaceOptions={historicOptions}
      />
    )

  it.each([
    [
      'failed while building its row',
      {
        error: 'Error building time-space data for location 6192',
        isSuccess: false,
        result: { ...buildHistoricDatum(), cycleLength: null },
      },
    ],
    [
      'has no cycle length programmed',
      {
        error: null,
        isSuccess: true,
        result: { ...buildHistoricDatum(), cycleLength: null },
      },
    ],
    [
      'reports a zero cycle length',
      {
        error: null,
        isSuccess: true,
        result: { ...buildHistoricDatum(), cycleLength: 0 },
      },
    ],
    [
      'failed without a row',
      { error: 'Speed is not configured', isSuccess: false, result: null },
    ],
  ])(
    'uses the next signal with a cycle length when the first signal %s',
    (_, firstSignal) => {
      renderWithFirstSignal(firstSignal)

      expect(screen.getByText('Adjustments cycle length: 150')).not.toBeNull()
    }
  )

  it('uses the first signal when it has a cycle length', () => {
    renderWithFirstSignal({
      error: null,
      isSuccess: true,
      result: { ...buildHistoricDatum(), cycleLength: 120 },
    })

    expect(screen.getByText('Adjustments cycle length: 120')).not.toBeNull()
  })
})
