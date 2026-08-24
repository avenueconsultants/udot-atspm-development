// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getTools.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import {
  CycleEventsDto,
  DataPointWithDetectorCheckBase,
  TmcEventDto as GeneratedTmcEventDto,
  getTimeSpaceDiagramAverageReportData,
  getTimeSpaceDiagramReportData,
  IndianaEvent,
  TimeSpaceDetectorEventDto,
  TimeSpaceDiagramAverageResult,
  TimeSpaceDiagramResultForPhase,
} from '@/api/reports'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { dateToTimestamp } from '@/utils/dateTime'
import { useQuery } from '@tanstack/react-query'
import { ToolOptions, ToolType } from '../common/types'
import {
  NormalizedTmcEvent,
  RawTimeSpaceAverageData,
  RawTimeSpaceDiagramResponse,
  RawTimeSpaceHistoricData,
  TimeSpaceDetectorEvent,
  TimeSpaceDetectorEventWithDistanceDTO,
  TimeSpaceResponseData,
} from '../timeSpaceDiagram/shared/types'
import { Cycle, PedestrianInterval } from '../timingAndActuation/types'

type QueryFnType = typeof getTools

type BaseOptions = {
  config?: QueryConfig<QueryFnType>
}

type UseToolsOptions = BaseOptions & {
  toolType: ToolType.TimeSpaceHistoric | ToolType.TimeSpaceAverage
  toolOptions: ToolOptions
}

type StringBooleanMap = Record<string, boolean | string | Date>

export const mapStringBooleansToBoolean = (obj: ToolOptions) => {
  return Object.entries(obj).reduce<StringBooleanMap>((acc, [key, value]) => {
    // Check if the value is exactly "true" or "false" (case-insensitive)
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        acc[key] = true
      } else if (value.toLowerCase() === 'false') {
        acc[key] = false
      } else {
        // If it's a string but not "true" or "false", keep it unchanged
        acc[key] = value
      }
    } else {
      // If the value is not a string, keep it unchanged
      acc[key] = value
    }
    return acc
  }, {})
}

function toCycles(events: CycleEventsDto[] | null | undefined): Cycle[] {
  return (events ?? []).map((e) => ({
    start: e.start ?? '',
    value: e.value ?? 0,
  }))
}

function toPedestrianIntervals(
  events: CycleEventsDto[] | null | undefined
): PedestrianInterval[] {
  return toCycles(events)
}

function toDetectorEvents(
  events: DataPointWithDetectorCheckBase[] | null | undefined
): TimeSpaceDetectorEvent[] {
  return (events ?? []).map((e) => ({
    initialX: e.initialX ?? '',
    isDetectorOn: e.isDetectorOn,
  }))
}

function toDetectorEventsWithDistance(
  events: TimeSpaceDetectorEventDto[] | null | undefined
): TimeSpaceDetectorEventWithDistanceDTO[] {
  return (events ?? []).map((e) => ({
    distanceToStopBar: e.distanceToStopBar ?? 0,
    detectorOn: e.detectorOn ?? null,
    detectorOff: e.detectorOff ?? null,
  }))
}

function toTmcEvents(
  events: GeneratedTmcEventDto[] | null | undefined
): NormalizedTmcEvent[] {
  return (events ?? []).map((e) => ({
    start: e.start ?? '',
    value: e.value ?? 0,
  }))
}

function toIndianaEvents(
  events: IndianaEvent[] | null | undefined
): RawTimeSpaceHistoricData['tspEvents'] {
  return (events ?? []).map((e) => ({
    locationIdentifier: e.locationIdentifier ?? '',
    timestamp: e.timestamp ?? '',
    eventCode: e.eventCode ?? 0,
    eventParam: e.eventParam ?? 0,
  }))
}

function toSrmEntityTracks(
  tracks: TimeSpaceDiagramResultForPhase['srmEntityTracks']
): RawTimeSpaceHistoricData['srmEntityTracks'] {
  if (tracks == null) return null
  return tracks.map((t) => ({
    entityId: t.entityId ?? '',
    points: (t.points ?? []).map((p) => ({
      time: p.time ?? '',
      distance: p.distance ?? 0,
      timestampMs: p.timestampMs ?? 0,
      intersectionId: p.intersectionId ?? undefined,
    })),
    startingIntersection: t.startingIntersection ?? undefined,
    headingDirection: t.headingDirection ?? undefined,
  }))
}

function toRawTimeSpaceHistoricData(
  r: TimeSpaceDiagramResultForPhase
): RawTimeSpaceHistoricData {
  return {
    locationIdentifier: r.locationIdentifier ?? '',
    locationDescription: r.locationDescription ?? '',
    start: r.start ?? '',
    end: r.end ?? '',
    phaseNumber: r.phaseNumber ?? 0,
    phaseNumberSort: '',
    distanceToNextLocation: r.distanceToNextLocation ?? 0,
    distanceToPreviousLocation: r.distanceToPreviousLocation ?? 0,
    speed: r.speed ?? 0,
    approachId: r.approachId ?? 0,
    approachDescription: r.approachDescription ?? '',
    phaseType: r.phaseType === 'Opposing' ? 'Opposing' : 'Primary',
    calculatedDistanceToNext: 0,
    calculatedDistanceToPrevious: 0,
    isIgnoredLocation: false,
    offsetLengthChangeEvents: r.offsetLengthChangeEvents ?? null,
    greenTimeEvents: toDetectorEvents(r.greenTimeEvents),
    laneByLaneCountDetectors: toDetectorEventsWithDistance(
      r.laneByLaneCountDetectors
    ),
    advanceCountDetectors: toDetectorEventsWithDistance(
      r.advanceCountDetectors
    ),
    stopBarPresenceDetectors: toDetectorEventsWithDistance(
      r.stopBarPresenceDetectors
    ),
    cycleAllEvents:
      r.cycleAllEvents != null ? toCycles(r.cycleAllEvents) : null,
    pedestrianIntervals: toPedestrianIntervals(r.pedestrianIntervals),
    percentArrivalOnGreen: r.percentArrivalOnGreen ?? null,
    tmcForPhase: {
      leftTurnEvents: toTmcEvents(r.tmcForPhase?.leftTurnEvents),
      rightTurnEvents: toTmcEvents(r.tmcForPhase?.rightTurnEvents),
    },
    order: r.order ?? 0,
    cycleLength: r.cycleLength ?? null,
    isPhaseOverLap: r.isPhaseOverLap ?? false,
    tspNumberCheckins: r.tspNumberCheckins ?? 0,
    tspNumberCheckouts: r.tspNumberCheckouts ?? 0,
    tspNumberEarlyGreens: r.tspNumberEarlyGreens ?? 0,
    tspNumberExtendedGreens: r.tspNumberExtendedGreens ?? 0,
    tspEvents: toIndianaEvents(r.tspEvents),
    priorityAndPreemptionEvents: r.priorityAndPreemptionEvents ?? null,
    srmEntityTracks: toSrmEntityTracks(r.srmEntityTracks),
  }
}

function toRawTimeSpaceAverageData(
  r: TimeSpaceDiagramAverageResult
): RawTimeSpaceAverageData {
  return {
    locationIdentifier: r.locationIdentifier ?? '',
    locationDescription: r.locationDescription ?? '',
    start: r.start ?? '',
    end: r.end ?? '',
    phaseNumber: r.phaseNumber ?? 0,
    phaseNumberSort: '',
    distanceToNextLocation: r.distanceToNextLocation ?? 0,
    distanceToPreviousLocation: r.distanceToPreviousLocation ?? 0,
    speed: r.speed ?? 0,
    approachId: r.approachId ?? 0,
    approachDescription: r.approachDescription ?? '',
    phaseType: r.phaseType === 'Opposing' ? 'Opposing' : 'Primary',
    calculatedDistanceToNext: 0,
    calculatedDistanceToPrevious: 0,
    isIgnoredLocation: false,
    offsetLengthChangeEvents: null,
    order: r.order ?? 0,
    offset: r.offset ?? null,
    cycleLength: r.cycleLength ?? null,
    programmedSplit: r.programmedSplit ?? 0,
    coordinatedPhases: r.coordinatedPhases ?? false,
    greenTimeEvents: toDetectorEvents(r.greenTimeEvents),
    cycleAllEvents:
      r.cycleAllEvents != null ? toCycles(r.cycleAllEvents) : null,
  }
}

export const getTools = async (
  type: ToolType.TimeSpaceHistoric | ToolType.TimeSpaceAverage,
  options: ToolOptions
): Promise<RawTimeSpaceDiagramResponse> => {
  const transformedOptions = mapStringBooleansToBoolean(options)

  const routeId =
    typeof transformedOptions.routeId === 'string' &&
    transformedOptions.routeId !== ''
      ? Number(transformedOptions.routeId)
      : undefined

  let response: TimeSpaceResponseData

  if (type === ToolType.TimeSpaceHistoric) {
    transformedOptions.start = dateToTimestamp(transformedOptions.start as Date)
    transformedOptions.end = dateToTimestamp(transformedOptions.end as Date)

    const results = await getTimeSpaceDiagramReportData({
      ...transformedOptions,
      routeId,
    })
    response = results.map((r) => ({
      error: r.error ?? null,
      result: r.result ? toRawTimeSpaceHistoricData(r.result) : null,
      isSuccess: r.isSuccess ?? false,
    }))
  } else {
    const results = await getTimeSpaceDiagramAverageReportData({
      ...transformedOptions,
      routeId,
    })
    response = results.map((r) => ({
      error: r.error ?? null,
      result: r.result ? toRawTimeSpaceAverageData(r.result) : null,
      isSuccess: r.isSuccess ?? false,
    }))
  }

  return {
    type,
    data: response,
  }
}

export const useTimeSpaceCall = ({
  toolType,
  toolOptions,
  config,
}: UseToolsOptions) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    enabled: false,
    queryKey: ['tools', toolType, toolOptions],
    queryFn: () => getTools(toolType, toolOptions),
  })
}
