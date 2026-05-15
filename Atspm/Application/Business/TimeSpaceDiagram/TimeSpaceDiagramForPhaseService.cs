#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeSpaceDiagram/TimeSpaceDiagramForPhaseService.cs
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
// http://www.apache.org/licenses/LICENSE-2.
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#endregion

using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Business.PriorityDetails;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using GreenToGreenCycle = Utah.Udot.Atspm.Business.Common.GreenToGreenCycle;

namespace Utah.Udot.Atspm.Business.TimeSpaceDiagram
{
    public class TimeSpaceDiagramForPhaseService
    {
        private sealed class TimeSpaceCycleBuildResult
        {
            public List<GreenToGreenCycle> GreenToGreenCycles { get; set; } = new List<GreenToGreenCycle>();
            public List<CycleEventsDto> CycleEvents { get; set; } = new List<CycleEventsDto>();
        }

        //private static readonly double FeetPerMile = 5280;
        //private static readonly double SecondsInHour = 3600;
        private readonly CycleService _cycleService;
        private readonly Dictionary<int, short> phaseToProgramPhases = new Dictionary<int, short>()
        {
            { 1, 134 },
            { 2, 135 },
            { 3, 136 },
            { 4, 137 },
            { 5, 138 },
            { 6, 139 },
            { 7, 140 },
            { 8, 141},
        };
        public TimeSpaceDiagramForPhaseService(CycleService cycleService)
        {
            _cycleService = cycleService;
        }

        public TimeSpaceDiagramResultForPhase GetChartDataForPhase(
           TimeSpaceDiagramOptions options,
           PhaseDetail phaseDetail,
           List<IndianaEvent> controllerEventLogs,
           int? programmedCycleLength,
           List<IndianaEvent> programmedSplits,
           double distanceToNextLocation,
           double distanceToPreviousLocation,
           bool isFirstElement,
           bool isLastElement,
           PriorityDetailsResult priorityDetailsResult
           )
        {
            var speedLimit = options.SpeedLimit ?? phaseDetail.Approach.Mph ?? 0;

            if (speedLimit == 0)
            {
                throw new Exception($"Speed not configured in route for all phases");
            }

            int? programmedSplit = null;

            if (programmedSplits != null &&
                phaseToProgramPhases.TryGetValue(phaseDetail.PhaseNumber, out var expectedEventCode))
            {
                programmedSplit = programmedSplits
                    .Where(s => s.EventCode == expectedEventCode)
                    .Select(s => (int?)s.EventParam)
                    .FirstOrDefault();
            }

            var greenTimeEventsResult = new List<DataPointWithDetectorCheckBase>();
            var countEventsTimeSpaceResult = new List<TimeSpaceDetectorEventDto>();
            var stopBarPresenceEventsTimeSpaceResult = new List<TimeSpaceDetectorEventDto>();
            var advanceCountEventsTimeSpaceResult = new List<TimeSpaceDetectorEventDto>();
            var cycleData = BuildCycleData(phaseDetail, controllerEventLogs, options, programmedSplit);
            var cycleAllEvents = cycleData.CycleEvents;
            var resultCycles = cycleData.GreenToGreenCycles;
            var greenTimeCycleEvents = GetActualGreenCycleEvents(resultCycles, phaseDetail.UseOverlap);
            var pedIntervals = TimeSpaceService.GetPedestrianIntervals(phaseDetail.Approach, controllerEventLogs, options);


            if (isFirstElement)
            {
                greenTimeEventsResult = TimeSpaceService.GetGreenTimeEvents(greenTimeCycleEvents, speedLimit);

                countEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.LLC);
                //countEventsTimeSpaceResult = CalculateTimeSpaceResult(countEvents, options);

                stopBarPresenceEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.SBP);
                stopBarPresenceEventsTimeSpaceResult = CleanUpStopBarEvents(stopBarPresenceEventsTimeSpaceResult, options, resultCycles, phaseDetail.Approach);
                //stopBarPresenceEventsTimeSpaceResult = CalculateTimeSpaceResultForStopBar(stopBarPresenceEvents, options, resultCycles);
            }
            else if (isLastElement)
            {
                advanceCountEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.AC);
                //advanceCountEventsTimeSpaceResult = CalculateTimeSpaceResultForAdvanceCount(advanceCountEvents, options, distanceToPreviousLocation);
            }
            else
            {
                greenTimeEventsResult = TimeSpaceService.GetGreenTimeEvents(greenTimeCycleEvents, speedLimit);

                countEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.LLC);
                //countEventsTimeSpaceResult = CalculateTimeSpaceResult(countEvents, options);

                stopBarPresenceEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.SBP);
                stopBarPresenceEventsTimeSpaceResult = CleanUpStopBarEvents(stopBarPresenceEventsTimeSpaceResult, options, resultCycles, phaseDetail.Approach);

                //stopBarPresenceEventsTimeSpaceResult = CalculateTimeSpaceResultForStopBar(stopBarPresenceEvents, options, resultCycles);

                advanceCountEventsTimeSpaceResult = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.AC);
                //advanceCountEventsTimeSpaceResult = CalculateTimeSpaceResultForAdvanceCount(advanceCountEvents, options, distanceToPreviousLocation);
            }

            var phaseNumberSort = TimeSpaceService.GetPhaseSort(phaseDetail);
            var timeSpaceDiagramResult = new TimeSpaceDiagramResultForPhase(
                phaseDetail.Approach.Id,
                phaseDetail.Approach.Location.LocationIdentifier,
                options.Start,
                options.End,
                phaseDetail.PhaseNumber,
                phaseDetail.Approach.DirectionType.Abbreviation,
                distanceToNextLocation,
                distanceToPreviousLocation,
                speedLimit,
                programmedCycleLength,
                programmedSplit,
                cycleAllEvents,
                pedIntervals,
                countEventsTimeSpaceResult,
                advanceCountEventsTimeSpaceResult,
                stopBarPresenceEventsTimeSpaceResult,
                greenTimeEventsResult,
                priorityDetailsResult.IsPhaseOverLap,
                priorityDetailsResult.NumberCheckins,
                priorityDetailsResult.NumberCheckouts,
                priorityDetailsResult.NumberEarlyGreens,
                priorityDetailsResult.NumberExtendedGreens,
                priorityDetailsResult.TspEvents,
                priorityDetailsResult.PriorityAndPreemptionEvents
                );
            return timeSpaceDiagramResult;
        }

        private List<TimeSpaceDetectorEventDto> CleanUpStopBarEvents(
            List<TimeSpaceDetectorEventDto> stopBarPresenceEvents,
            TimeSpaceDiagramOptions options,
            List<GreenToGreenCycle> cycles,
            Approach approach)
        {
            List<TimeSpaceDetectorEventDto> results = new List<TimeSpaceDetectorEventDto>();

            if (stopBarPresenceEvents == null || stopBarPresenceEvents.Count < 1)
            {
                return results;
            }

            foreach (var detectorEvent in stopBarPresenceEvents)
            {
                if (detectorEvent.DetectorOn == null || detectorEvent.DetectorOff == null)
                {
                    continue;
                }
                DateTime currentDetectorOn = detectorEvent.DetectorOn.Value;
                DateTime currentDetectorOff = detectorEvent.DetectorOff.Value;

                //Only add events that exist over the green time
                var cycle = cycles.FirstOrDefault(c =>
                    currentDetectorOn >= c.StartTime &&
                    currentDetectorOn <= c.YellowEvent);

                if (cycle == null)
                {
                    continue;
                }

                if (currentDetectorOff > cycle.YellowEvent)
                {
                    detectorEvent.DetectorOff = cycle.YellowEvent;
                }

                results.Add(detectorEvent);
            }

            return results.OrderBy(r => r.DetectorOn).ToList();
        }

        //private List<TimeSpaceEventBase> CalculateTimeSpaceResultForStopBar(
        //    List<TimeSpaceDetectorEventDto> stopBarPresenceEvents,
        //    TimeSpaceDiagramOptions options,
        //    double distanceToNextLocation,
        //    List<GreenToGreenCycle> cycles)
        //{
        //    List<TimeSpaceEventBase> results = new List<TimeSpaceEventBase>();

        //    if (stopBarPresenceEvents == null || stopBarPresenceEvents.Count < 1)
        //    {
        //        return results;
        //    }

        //    foreach (var detectorEvent in stopBarPresenceEvents)
        //    {
        //        if (detectorEvent.DetectorOn == null || detectorEvent.DetectorOff == null)
        //        {
        //            continue;
        //        }
        //        double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;
        //        DateTime currentDetectorOn = detectorEvent.DetectorOn.Value;
        //        DateTime currentDetectorOff = detectorEvent.DetectorOff.Value;

        //        //Only add events that exist over the green time
        //        GreenToGreenCycle isEventOnGreenTime = cycles.Find(c => currentDetectorOn >= c.StartTime && currentDetectorOn <= c.YellowEvent);
        //        if (isEventOnGreenTime == null)
        //        {
        //            continue;
        //        }

        //        //If overlaps with yellow event, we want the result off to use yellow time
        //        GreenToGreenCycle overlappingYellowEvent = cycles.Find(e => currentDetectorOn <= e.YellowEvent && currentDetectorOff > e.YellowEvent);

        //        TimeSpaceService.GetArrivalTime(
        //            distanceToNextLocation,
        //            speedLimit,
        //            currentDetectorOn,
        //            out _,
        //            out DateTime arrivalTimeOn);

        //        TimeSpaceEventBase resultOn = new TimeSpaceEventBase(
        //            currentDetectorOn,
        //            arrivalTimeOn,
        //            true);

        //        results.Add(resultOn);

        //        TimeSpaceService.GetArrivalTime(
        //            distanceToNextLocation,
        //            speedLimit,
        //            overlappingYellowEvent == null ? currentDetectorOff : overlappingYellowEvent.YellowEvent,
        //            out _,
        //            out DateTime arrivalTimeOff);
        //        TimeSpaceEventBase resultOff = new TimeSpaceEventBase(
        //            overlappingYellowEvent == null ? currentDetectorOff : overlappingYellowEvent.YellowEvent,
        //            arrivalTimeOff,
        //            false);
        //        results.Add(resultOff);
        //    }

        //    return results;
        //}

        //private List<DataPointWithDetectorCheckBase> CalculateTimeSpaceResultForStopBar(
        //    List<TimeSpaceDetectorEventDto> stopBarPresenceEvents,
        //    TimeSpaceDiagramOptions options,
        //    List<GreenToGreenCycle> cycles)
        //{
        //    List<DataPointWithDetectorCheckBase> results = new List<DataPointWithDetectorCheckBase>();

        //    if (stopBarPresenceEvents == null || stopBarPresenceEvents.Count < 1)
        //    {
        //        return results;
        //    }

        //    foreach (var detectorEvent in stopBarPresenceEvents)
        //    {
        //        if (detectorEvent.DetectorOn == null || detectorEvent.DetectorOff == null)
        //        {
        //            continue;
        //        }
        //        double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;
        //        DateTime currentDetectorOn = detectorEvent.DetectorOn.Value;
        //        DateTime currentDetectorOff = detectorEvent.DetectorOff.Value;

        //        //Only add events that exist over the green time
        //        GreenToGreenCycle isEventOnGreenTime = cycles.Find(c => currentDetectorOn >= c.StartTime && currentDetectorOn <= c.YellowEvent);
        //        if (isEventOnGreenTime == null)
        //        {
        //            continue;
        //        }

        //        //If overlaps with yellow event, we want the result off to use yellow time
        //        GreenToGreenCycle overlappingYellowEvent = cycles.Find(e => currentDetectorOn <= e.YellowEvent && currentDetectorOff > e.YellowEvent);

        //        DataPointWithDetectorCheckBase resultOn = new DataPointWithDetectorCheckBase(
        //            currentDetectorOn,
        //            true);

        //        results.Add(resultOn);

        //        DataPointWithDetectorCheckBase resultOff = new DataPointWithDetectorCheckBase(
        //            overlappingYellowEvent == null ? currentDetectorOff : overlappingYellowEvent.YellowEvent,
        //            false);
        //        results.Add(resultOff);
        //    }

        //    return results;
        //}

        //private List<TimeSpaceEventBase> GetGreenTimeEvents(PhaseDetail phaseDetail,
        //    List<CycleEventsDto> cycleEvents,
        //    TimeSpaceDiagramOptions options,
        //    double distanceToNextLocation,
        //    int speedLimit)
        //{
        //    List<int> cycleGreenStartEndCodes = new List<int>() { 1, 8 };
        //    var events = new List<CycleEventsDto>();
        //    var greenTimeEvents = new List<TimeSpaceEventBase>();
        //    var tempEvents = cycleEvents.Where(c => cycleGreenStartEndCodes.Contains(c.Value)).ToList();

        //    foreach (var gEvent in tempEvents)
        //    {
        //        double speed = options.SpeedLimit ?? speedLimit;
        //        DateTime start = gEvent.Start;
        //        TimeSpaceService.GetArrivalTime(distanceToNextLocation, speedLimit, start, out _, out DateTime arrivalTime);
        //        TimeSpaceEventBase resultOn = new TimeSpaceEventBase(
        //            start,
        //            arrivalTime,
        //            gEvent.Value == 1 ? true : false);
        //        greenTimeEvents.Add(resultOn);
        //    }
        //    return greenTimeEvents;
        //}

        //private List<TimeSpaceEventBase> CalculateTimeSpaceResult(
        //    List<TimeSpaceDetectorEventDto> events,
        //    TimeSpaceDiagramOptions options,
        //    double distanceToNextLocation)
        //{
        //    List<TimeSpaceEventBase> results = new List<TimeSpaceEventBase>();

        //    if (events == null || events.Count < 1)
        //    {
        //        return results;
        //    }

        //    foreach (var detectorEvent in events)
        //    {
        //        if (detectorEvent.DetectorOn == null)
        //        {
        //            continue;
        //        }
        //        double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;
        //        DateTime currentDetectorOn = detectorEvent.DetectorOn.Value;
        //        TimeSpaceService.GetArrivalTime(distanceToNextLocation, speedLimit, detectorEvent.DetectorOn.Value, out _, out DateTime arrivalTimeOn);

        //        TimeSpaceEventBase resultOn = new TimeSpaceEventBase(
        //            currentDetectorOn,
        //            arrivalTimeOn,
        //            null);

        //        results.Add(resultOn);
        //    }

        //    return results;
        //}

        //private List<DataPointWithDetectorCheckBase> CalculateTimeSpaceResult(
        //    List<TimeSpaceDetectorEventDto> events,
        //    TimeSpaceDiagramOptions options)
        //{
        //    List<DataPointWithDetectorCheckBase> results = new List<DataPointWithDetectorCheckBase>();

        //    if (events == null || events.Count < 1)
        //    {
        //        return results;
        //    }

        //    foreach (var detectorEvent in events)
        //    {
        //        if (detectorEvent.DetectorOn == null)
        //        {
        //            continue;
        //        }
        //        double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;
        //        DateTime currentDetectorOn = detectorEvent.DetectorOn.Value;

        //        DataPointWithDetectorCheckBase resultOn = new DataPointWithDetectorCheckBase(
        //            currentDetectorOn,
        //            null);

        //        results.Add(resultOn);
        //    }
        //private List<TimeSpaceEventBase> GetGreenTimeEvents(PhaseDetail phaseDetail,
        //    List<CycleEventsDto> cycleEvents,
        //    TimeSpaceDiagramOptions options,
        //    double distanceToNextLocation,
        //    int speedLimit)
        //{
        //    List<int> cycleGreenStartEndCodes = new List<int>() { 1, 8 };
        //    var events = new List<CycleEventsDto>();
        //    var greenTimeEvents = new List<TimeSpaceEventBase>();
        //    var tempEvents = cycleEvents.Where(c => cycleGreenStartEndCodes.Contains(c.Value)).ToList();

        //    foreach (var gEvent in tempEvents)
        //    {
        //        double speed = options.SpeedLimit ?? speedLimit;
        //        DateTime start = gEvent.Start;
        //        TimeSpaceService.GetArrivalTime(distanceToNextLocation, speedLimit, start, out _, out DateTime arrivalTime);
        //        TimeSpaceEventBase resultOn = new TimeSpaceEventBase(
        //            start,
        //            arrivalTime,
        //            gEvent.Value == 1 ? true : false);
        //        greenTimeEvents.Add(resultOn);
        //    }
        //    return greenTimeEvents;
        //}

        //private static double GetSpeedInFeetPerSecond(double speedLimit)
        //{
        //    return speedLimit * FeetPerMile / SecondsInHour;
        //}

        //    private List<TimeSpaceEventBase> CalculateTimeSpaceResultForAdvanceCount(
        //        List<TimeSpaceDetectorEventDto> events,
        //        TimeSpaceDiagramOptions options,
        //        double distanceToNextLocation
        //        )
        //    {
        //        List<TimeSpaceEventBase> results = new List<TimeSpaceEventBase>();

        //        if (events == null || events.Count < 1)
        //        {
        //            return results;
        //        }


        //        foreach (var detectorEvent in events)
        //        {
        //            if (detectorEvent.DetectorOn == null)
        //            {
        //                continue;
        //            }
        //            double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;

        //            TimeSpaceService.GetArrivalTime(detectorEvent.DistanceToStopBar, speedLimit, detectorEvent.DetectorOn.Value, out double speedInFeetPerSecond, out DateTime arrivalTime);

        //            results.Add(new TimeSpaceEventBase(arrivalTime.AddSeconds(-distanceToNextLocation / speedInFeetPerSecond), arrivalTime, null));
        //        }

        //        return results;
        //    }

        //    private List<DataPointWithDetectorCheckBase> CalculateTimeSpaceResultForAdvanceCount(
        //        List<TimeSpaceDetectorEventDto> events,
        //        TimeSpaceDiagramOptions options
        //)
        //    {
        //        List<DataPointWithDetectorCheckBase> results = new List<DataPointWithDetectorCheckBase>();

        //        if (events == null || events.Count < 1)
        //        {
        //            return results;
        //        }


        //        foreach (var detectorEvent in events)
        //        {
        //            if (detectorEvent.DetectorOn == null)
        //            {
        //                continue;
        //            }
        //            double speedLimit = options.SpeedLimit ?? detectorEvent.SpeedLimit;

        //            TimeSpaceService.GetArrivalTime(detectorEvent.DistanceToStopBar, speedLimit, detectorEvent.DetectorOn.Value, out double speedInFeetPerSecond, out DateTime arrivalTime);

        //            results.Add(new TimeSpaceEventBase(arrivalTime.AddSeconds(-distanceToNextLocation / speedInFeetPerSecond), arrivalTime, null));
        //        }

        //        return results;
        //    }

        //private static void GetArrivalTime(double distanceToDetector, double speedLimit, DateTime InitialTime, out double speedInFeetPerSecond, out DateTime arrivalTime)
        //{
        //    DateTime currentDetectorOn = InitialTime;

        //    speedInFeetPerSecond = GetSpeedInFeetPerSecond(speedLimit);
        //    double timeToTravel = distanceToDetector / speedInFeetPerSecond;

        //    arrivalTime = currentDetectorOn.AddSeconds(timeToTravel);
        //}

        public List<short> GetCycleCodes(bool getOverlapCodes)
        {
            var phaseEventCodesForCycles = new List<short>
            {
                1,
                8,
                9
            };
            if (getOverlapCodes)
            {
                phaseEventCodesForCycles = new List<short>
                {
                    61,
                    63,
                    64
                };
            }

            return phaseEventCodesForCycles;
        }

        public List<CycleEventsDto> GetCycleEvents(
            PhaseDetail phaseDetail,
            List<IndianaEvent> controllerEventLogs,
            TimeSpaceDiagramOptions options,
            int? programmedSplit,
            out List<GreenToGreenCycle> cycles)
        {
            var cycleData = BuildCycleData(phaseDetail, controllerEventLogs, options, programmedSplit);
            cycles = cycleData.GreenToGreenCycles;
            return cycleData.CycleEvents;
        }

        private TimeSpaceCycleBuildResult BuildCycleData(
            PhaseDetail phaseDetail,
            List<IndianaEvent> controllerEventLogs,
            TimeSpaceDiagramOptions options,
            int? programmedSplit)
        {
            var greenCode = phaseDetail.UseOverlap ? (short)61 : (short)1;
            var earlyGreenCode = phaseDetail.UseOverlap ? 62 : 3;
            var yellowCode = phaseDetail.UseOverlap ? (short)63 : (short)8;
            var redCode = phaseDetail.UseOverlap ? (short)64 : (short)9;
            var redEndCode = phaseDetail.UseOverlap ? (short)65 : (short)11;
            var cycleEventCodes = new List<short> { greenCode, yellowCode, redCode };
            var result = new TimeSpaceCycleBuildResult();
            var events = new List<CycleEventsDto>();

            if (controllerEventLogs == null || !controllerEventLogs.Any())
            {
                return result;
            }

            var distinctTimeStamps = new HashSet<string>();
            var tempEvents = controllerEventLogs.Aggregate(new List<IndianaEvent>(), (matchingEvents, c) =>
            {
                if (cycleEventCodes.Contains(c.EventCode) && c.EventParam == phaseDetail.PhaseNumber)
                {
                    if (!distinctTimeStamps.Contains(c.ToString()))
                    {
                        matchingEvents.Add(c);
                        distinctTimeStamps.Add(c.ToString());
                    }
                }
                return matchingEvents;
            });
            tempEvents = tempEvents.OrderBy(e => e.Timestamp).ToList();
            result.GreenToGreenCycles = _cycleService.GetGreenToGreenCycles(options.Start.AddMinutes(-2), options.End.AddMinutes(2), tempEvents).ToList();

            for (int i = 0; i < result.GreenToGreenCycles.Count; i++)
            {
                var cycle = result.GreenToGreenCycles[i];
                var redClearanceEnd = GetRedClearanceEnd(
                    controllerEventLogs,
                    phaseDetail.PhaseNumber,
                    redEndCode,
                    cycle.RedEvent,
                    cycle.EndTime);

                AddGreenCycleEvents(
                    events,
                    cycle,
                    programmedSplit,
                    redClearanceEnd,
                    earlyGreenCode,
                    greenCode);

                events.Add(new CycleEventsDto(cycle.YellowEvent, yellowCode));
                events.Add(new CycleEventsDto(cycle.RedEvent, redCode));

                if (redClearanceEnd.HasValue)
                {
                    events.Add(new CycleEventsDto(redClearanceEnd.Value, redEndCode));
                }
            }

            result.CycleEvents = events.OrderBy(e => e.Start).ToList();
            return result;
        }

        private static List<CycleEventsDto> GetActualGreenCycleEvents(List<GreenToGreenCycle> cycles, bool useOverlap)
        {
            var greenCode = useOverlap ? 61 : 1;
            var yellowCode = useOverlap ? 63 : 8;
            var events = new List<CycleEventsDto>();

            foreach (var cycle in cycles)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, greenCode));
                events.Add(new CycleEventsDto(cycle.YellowEvent, yellowCode));
            }

            return events;
        }

        private static void AddGreenCycleEvents(
            List<CycleEventsDto> events,
            GreenToGreenCycle cycle,
            int? programmedSplit,
            DateTime? redClearanceEnd,
            int earlyGreenCode,
            int programmedGreenCode)
        {
            if (!programmedSplit.HasValue || !redClearanceEnd.HasValue)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, programmedGreenCode));
                return;
            }

            var yellowClearanceSeconds = (cycle.RedEvent - cycle.YellowEvent).TotalSeconds;
            var redClearanceSeconds = (redClearanceEnd.Value - cycle.RedEvent).TotalSeconds;

            if (yellowClearanceSeconds < 0 || redClearanceSeconds < 0)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, programmedGreenCode));
                return;
            }

            var programmedGreenSeconds = programmedSplit.Value - yellowClearanceSeconds - redClearanceSeconds;

            if (programmedGreenSeconds <= 0)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, earlyGreenCode));
                return;
            }

            var programmedGreenStart = cycle.YellowEvent.AddSeconds(-programmedGreenSeconds);

            if (programmedGreenStart <= cycle.StartTime)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, programmedGreenCode));
                return;
            }

            if (programmedGreenStart >= cycle.YellowEvent)
            {
                events.Add(new CycleEventsDto(cycle.StartTime, earlyGreenCode));
                return;
            }

            events.Add(new CycleEventsDto(cycle.StartTime, earlyGreenCode));
            events.Add(new CycleEventsDto(programmedGreenStart, programmedGreenCode));
        }

        private static DateTime? GetRedClearanceEnd(
            IEnumerable<IndianaEvent> controllerEventLogs,
            int phaseNumber,
            short redEndCode,
            DateTime redEvent,
            DateTime nextGreenEvent)
        {
            return controllerEventLogs
                .Where(e => e.EventCode == redEndCode
                            && e.EventParam == phaseNumber
                            && e.Timestamp > redEvent
                            && e.Timestamp < nextGreenEvent)
                .OrderBy(e => e.Timestamp)
                .Select(e => (DateTime?)e.Timestamp)
                .FirstOrDefault();
        }

        //private string GetPhaseSort(PhaseDetail phaseDetail)
        //{
        //    return phaseDetail.IsPermissivePhase ?  // Check if the 'GetPermissivePhase' property of 'options' is true
        //        phaseDetail.Approach.IsPermissivePhaseOverlap ?  // If true, check if the 'IsPermissivePhaseOverlap' property of 'approach' is true
        //            "zOverlap - " + phaseDetail.Approach.PermissivePhaseNumber.Value.ToString("D2")  // If true, concatenate "zOverlap - " with 'PermissivePhaseNumber' formatted as a two-digit string
        //            : "Phase - " + phaseDetail.Approach.PermissivePhaseNumber.Value.ToString("D2")  // If false, concatenate "Phase - " with 'PermissivePhaseNumber' formatted as a two-digit string
        //        :  // If 'GetPermissivePhase' is false
        //        phaseDetail.Approach.IsProtectedPhaseOverlap ?  // Check if the 'IsProtectedPhaseOverlap' property of 'approach' is true
        //            "zOverlap - " + phaseDetail.Approach.ProtectedPhaseNumber.ToString("D2")  // If true, concatenate "zOverlap - " with 'ProtectedPhaseNumber' formatted as a two-digit string
        //            : "Phase = " + phaseDetail.Approach.ProtectedPhaseNumber.ToString("D2");  // If false, concatenate "Phase = " with 'ProtectedPhaseNumber' formatted as a two-digit string
        //}

        public List<TimeSpaceDetectorEventDto> GetDetectionEvents(
            Approach approach,
            TimeSpaceDiagramOptions options,
            List<IndianaEvent> controllerEventLogs,
            DetectionTypes detectionType
            )
        {
            var DetEvents = new List<TimeSpaceDetectorEventDto>();
            var localSortedDetectors = approach.Detectors.Where(d => d.DetectionTypes.Any(d => d.Id == detectionType));
            //  82 is on, 81 is off
            var detectorActivationCodes = new List<short> { 81, 82 };
            foreach (var detector in localSortedDetectors)
            {
                if (detector.DetectionTypes.Any(d => d.Id == detectionType))
                {
                    var extendStartStopLine = options.ExtendStartStopSearch * 60.0;
                    var filteredEvents = controllerEventLogs.Where(c => detectorActivationCodes.Contains(c.EventCode)
                                                                        && c.EventParam == detector.DetectorChannel
                                                                        && c.Timestamp >= options.Start
                                                                        && c.Timestamp <= options.End).ToList();
                    if (filteredEvents.Count > 0)
                    {
                        var detectorEvents = new List<TimeSpaceDetectorEventDto>();
                        for (var i = 0; i < filteredEvents.Count; i++)
                        {
                            if (i == 0 && filteredEvents[i].EventCode == 81)
                            {
                                detectorEvents.Add(new TimeSpaceDetectorEventDto(filteredEvents[i].Timestamp,
                                   filteredEvents[i].Timestamp,
                                   //approach.Mph ?? 0,
                                   detector.DistanceFromStopBar ?? 0));
                            }
                            else if (i + 1 == filteredEvents.Count && filteredEvents[i].EventCode != 81)
                            {
                                detectorEvents.Add(new TimeSpaceDetectorEventDto(filteredEvents[i].Timestamp,
                                    filteredEvents[i].Timestamp,
                                    //approach.Mph ?? 0,
                                    detector.DistanceFromStopBar ?? 0));
                            }
                            else if (filteredEvents[i].EventCode == 82 && filteredEvents[i + 1].EventCode == 81)
                            {
                                detectorEvents.Add(new TimeSpaceDetectorEventDto(filteredEvents[i].Timestamp,
                                    filteredEvents[i + 1].Timestamp,
                                    //approach.Mph ?? 0,
                                    detector.DistanceFromStopBar ?? 0));
                            }
                        }
                        DetEvents.AddRange(detectorEvents);
                    }
                }
            }
            return DetEvents;
        }
    }
}

