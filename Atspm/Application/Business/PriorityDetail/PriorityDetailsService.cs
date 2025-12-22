#region license
// Copyright 2025 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimingAndActuation/TimingAndActuationsForPhaseService.cs
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
using Utah.Udot.Atspm.Business.TimingAndActuation;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.NetStandardToolkit.Extensions;

namespace Utah.Udot.Atspm.Business.PriorityDetails
{
    public class PriorityDetailsService
    {

        public PriorityDetailsResult GetChartData(
            PriorityDetailsOptions options,
            PhaseDetail phaseDetail,
            List<IndianaEvent> controllerEventLogs,
            bool usePermissivePhase)
        {
            var phaseCustomEvents = new Dictionary<string, List<DataPointForInt>>();

            var indianaPhaseEvents = controllerEventLogs.Where(c => c.EventCode == phaseDetail.PhaseNumber
                                                                        && c.Timestamp >= options.Start
                                                                        && c.Timestamp <= options.End).ToList();

            var priorityAndPreemptionPhaseEvents = controllerEventLogs.Where(e => e.EventCode == 112 && e.EventParam == phaseDetail.Approach.PriorityAndPreemptionPhaseNumber).ToList();

            indianaPhaseEvents.AddRange(priorityAndPreemptionPhaseEvents);

            var priorityAndPreemptionEvents = GetDetectionEvents(phaseDetail.Approach, options, controllerEventLogs, DetectionTypes.PP);

            if (options.PhaseEventCodesList != null)
            {
                phaseCustomEvents = GetPhaseCustomEvents(phaseDetail.Approach.Location.LocationIdentifier, phaseDetail.PhaseNumber, options, controllerEventLogs);
            }

            var cycleAllEvents = GetCycleEvents(phaseDetail, controllerEventLogs, options);
            var phaseNumberSort = GetPhaseSort(phaseDetail);

            var numberCheckins = indianaPhaseEvents.Where(row => row.EventCode == 112).Count();
            var numberCheckouts = indianaPhaseEvents.Where(row => row.EventCode == 115).Count();
            var numberEarlyGreens = indianaPhaseEvents.Where(row => row.EventCode == 113).Count();
            var numberExtendedGreens = indianaPhaseEvents.Where(row => row.EventCode == 114).Count();

            var timingAndActuationsForPhaseData = new PriorityDetailsResult(
                phaseDetail.Approach.Id,
                phaseDetail.Approach.Location.LocationIdentifier,
                options.Start,
                options.End,
                phaseDetail.PhaseNumber,
                phaseDetail.UseOverlap,
                phaseNumberSort,
                usePermissivePhase ? "Permissive" : "Protected",
                numberCheckins,
                numberCheckouts,
                numberEarlyGreens,
                numberExtendedGreens,
                indianaPhaseEvents,
                cycleAllEvents,
                priorityAndPreemptionEvents,
                phaseCustomEvents
                );
            return timingAndActuationsForPhaseData;
        }

        private string GetPhaseSort(PhaseDetail phaseDetail)
        {
            return phaseDetail.IsPermissivePhase ?  // Check if the 'PhaseType' property of 'options' is true
                phaseDetail.Approach.IsPermissivePhaseOverlap ?  // If true, check if the 'IsPermissivePhaseOverlap' property of 'approach' is true
                    $"zOverlap - {phaseDetail.Approach.PermissivePhaseNumber.Value.ToString("D2")}-1"  // If true, concatenate "zOverlap - " with 'PermissivePhaseNumber' formatted as a two-digit string
                    : $"Phase - {phaseDetail.Approach.PermissivePhaseNumber.Value.ToString("D2")}-1" // If false, concatenate "Phase - " with 'PermissivePhaseNumber' formatted as a two-digit string
                :  // If 'PhaseType' is false
                phaseDetail.Approach.IsProtectedPhaseOverlap ?  // Check if the 'IsProtectedPhaseOverlap' property of 'approach' is true
                    $"zOverlap - {phaseDetail.Approach.ProtectedPhaseNumber.ToString("D2")}-2"  // If true, concatenate "zOverlap - " with 'ProtectedPhaseNumber' formatted as a two-digit string
                    : $"Phase - {phaseDetail.Approach.ProtectedPhaseNumber.ToString("D2")}-2";  // If false, concatenate "Phase = " with 'ProtectedPhaseNumber' formatted as a two-digit string
        }

        public List<CycleEventsDto> GetCycleEvents(
            PhaseDetail phaseDetail,
            List<IndianaEvent> controllerEventLogs,
            PriorityDetailsOptions options)
        {

            List<short> cycleEventCodes = GetCycleCodes(phaseDetail.UseOverlap);
            var overlapLabel = phaseDetail.UseOverlap == true ? "Overlap" : "";
            string keyLabel = $"Cycles Intervals {phaseDetail.PhaseNumber} {overlapLabel}";
            var events = new List<CycleEventsDto>();
            if (controllerEventLogs.Any())
            {
                var tempEvents = controllerEventLogs.Where(c => cycleEventCodes.Contains(c.EventCode) && c.EventParam == phaseDetail.PhaseNumber)
                    .Select(e => new CycleEventsDto(e.Timestamp, (int)e.EventCode)).ToList();
                events.AddRange(tempEvents.Where(e => e.Start >= options.Start
                                                        && e.Start <= options.End));
                var firstEvent = tempEvents.Where(e => e.Start < options.Start).OrderByDescending(e => e.Start).FirstOrDefault();
                if (firstEvent != null)
                {
                    firstEvent.Start = options.Start;
                    events.Insert(0, firstEvent);
                }
            }
            return events;
        }

        public List<short> GetCycleCodes(bool getOverlapCodes)
        {
            var phaseEventCodesForCycles = new List<short>
            {
                1,
                3,
                8,
                9,
                11
            };
            if (getOverlapCodes)
            {
                phaseEventCodesForCycles = new List<short>
                {
                    61,
                    62,
                    63,
                    64,
                    65
                };
            }

            return phaseEventCodesForCycles;
        }


        public Dictionary<string, List<DataPointForInt>> GetPhaseCustomEvents(
            string locationIdentifier,
            int phaseNumber,
            PriorityDetailsOptions options,
            List<IndianaEvent> controllerEventLogs)
        {
            var phaseCustomEvents = new Dictionary<string, List<DataPointForInt>>();
            if (options.PhaseEventCodesList != null && options.PhaseEventCodesList.Any())
            {
                foreach (var phaseEventCode in options.PhaseEventCodesList)
                {

                    var phaseEvents = controllerEventLogs.Where(c => c.EventCode == phaseEventCode
                                                                        && c.Timestamp >= options.Start
                                                                        && c.Timestamp <= options.End).ToList();
                    if (phaseEvents.Count > 0)
                    {
                        phaseCustomEvents.Add(
                            "Phase Events: " + phaseEventCode, phaseEvents.Select(s => new DataPointForInt(s.Timestamp, (int)s.EventCode)).ToList());
                    }
                }
            }
            return phaseCustomEvents;
        }

        public List<DetectorEventDto> GetDetectionEvents(
            Approach approach,
            PriorityDetailsOptions options,
            List<IndianaEvent> controllerEventLogs,
            DetectionTypes detectionType
            )
        {
            var DetEvents = new List<DetectorEventDto>();
            var localSortedDetectors = approach.Detectors
                .OrderByDescending(d => d.MovementType.GetDisplayAttribute()?.Order)
                .ThenByDescending(l => l.LaneNumber).ToList();
            var detectorActivationCodes = new List<short> { 81, 82 };
            foreach (var detector in localSortedDetectors)
            {
                if (detector.DetectionTypes.Any(d => d.Id == detectionType))
                {
                    var filteredEvents = controllerEventLogs.Where(c => detectorActivationCodes.Contains(c.EventCode)
                                                                        && c.EventParam == detector.DetectorChannel
                                                                        && c.Timestamp >= options.Start
                                                                        && c.Timestamp <= options.End).ToList();
                    var laneNumber = "";
                    if (detector.LaneNumber != null)
                    {
                        laneNumber = detector.LaneNumber.Value.ToString();
                    }
                    var distanceFromStopBarLable = detector.DistanceFromStopBar.HasValue ? $"({detector.DistanceFromStopBar} ft)" : "";
                    var lableName = $"{detectionType.GetDisplayAttribute()?.Name} {distanceFromStopBarLable}, {detector.MovementType} {laneNumber}, ch {detector.DetectorChannel}";

                    if (filteredEvents.Count > 0)
                    {
                        var detectorEvents = new List<DetectorEventBase>();
                        for (var i = 0; i < filteredEvents.Count; i++)
                        {
                            if (i == 0 && filteredEvents[i].EventCode == 81)
                            {
                                detectorEvents.Add(new DetectorEventBase(null, filteredEvents[i].Timestamp));
                            }
                            else if (i + 1 == filteredEvents.Count && filteredEvents[i].EventCode == 81)
                            {
                                detectorEvents.Add(new DetectorEventBase(null, filteredEvents[i].Timestamp));
                            }
                            else if (i + 1 == filteredEvents.Count && filteredEvents[i].EventCode == 82)
                            {
                                detectorEvents.Add(new DetectorEventBase(filteredEvents[i].Timestamp, null));
                            }
                            else if (filteredEvents[i].EventCode == 82 && filteredEvents[i + 1].EventCode == 81)
                            {
                                detectorEvents.Add(new DetectorEventBase(filteredEvents[i].Timestamp, filteredEvents[i + 1].Timestamp));
                                i++;
                            }
                            else if (filteredEvents[i].EventCode == 81 && filteredEvents[i + 1].EventCode == 81)
                            {
                                detectorEvents.Add(new DetectorEventBase(null, filteredEvents[i + 1].Timestamp));
                            }
                            else if (filteredEvents[i].EventCode == 82 && filteredEvents[i + 1].EventCode == 82)
                            {
                                detectorEvents.Add(new DetectorEventBase(filteredEvents[i + 1].Timestamp, null));
                            }
                        }
                        DetEvents.Add(new DetectorEventDto(lableName, detectorEvents));
                    }

                    else if (filteredEvents.Count == 0)
                    {
                        var e = new DetectorEventBase(options.Start.AddSeconds(-10), options.Start.AddSeconds(-9));

                        var list = new List<DetectorEventBase>
                        {
                            e
                        };
                        DetEvents.Add(new DetectorEventDto(lableName, list));
                    }
                }
            }
            return DetEvents;
        }
    }
}

