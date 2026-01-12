#region license
// Copyright 2025 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.ATSPM.Infrastructure.Services.WatchDogServices/WatchDogLogService.cs
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

using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Business.Watchdog;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.TempExtensions;

namespace Utah.Udot.ATSPM.Infrastructure.Services.WatchDogServices
{
    public partial class WatchDogLogService
    {
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly AnalysisPhaseCollectionService analysisPhaseCollectionService;
        private readonly PhaseService phaseService;
        private readonly ILogger<WatchDogLogService> logger;

        public WatchDogLogService(IIndianaEventLogRepository controllerEventLogRepository,
            AnalysisPhaseCollectionService analysisPhaseCollectionService,
            PhaseService phaseService,
            ILogger<WatchDogLogService> logger)
        {
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.analysisPhaseCollectionService = analysisPhaseCollectionService;
            this.phaseService = phaseService;
            this.logger = logger;
        }

        public async Task<List<WatchDogLogEvent>> GetWatchDogIssues(
            WatchdogLoggingOptions options,
            List<Location> locations,
            CancellationToken cancellationToken)
        {
            if (locations.IsNullOrEmpty())
            {
                return new List<WatchDogLogEvent>();
            }
            else
            {
                var errors = new ConcurrentBag<WatchDogLogEvent>();

                foreach (var Location in locations)//.Where(s => s.LocationIdentifier == "7115"))
                {
                    if (cancellationToken.IsCancellationRequested)
                    {
                        return errors.ToList();
                    }
                    var locationEvents = controllerEventLogRepository.GetEventsBetweenDates(
                        Location.LocationIdentifier,
                        options.AnalysisStart,
                        options.AnalysisEnd.AddHours(12)).ToList();
                    var recordsError = await CheckLocationRecordCount(options.ScanDate, Location, options, locationEvents);
                    if (recordsError != null)
                    {
                        errors.Add(recordsError);
                        continue;
                    }
                    var tasks = new List<Task>();
                    tasks.Add(CheckLocationForPhaseErrors(Location, options, locationEvents, errors));
                    tasks.Add(CheckDetectors(Location, options, locationEvents, errors));
                    //CheckApplicationEvents(locations, options);
                    await Task.WhenAll(tasks);
                }
                return errors.ToList();
            }
        }

        private async Task CheckDetectors(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors)
        {
            var detectorEventCodes = new List<short> { 82, 81 };
            CheckForUnconfiguredDetectors(location, options, locationEvents, errors, detectorEventCodes);
            CheckForLowDetectorHits(location, options, locationEvents, errors, detectorEventCodes);
            CheckRampMeteringDetectors(location, options, locationEvents, errors);
            //Check for low Ramp hits
            CheckForLowRampDetectorHits(location, options, locationEvents, errors, detectorEventCodes);
        }

        private void CheckRampMeteringDetectors(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors)
        {
            int rampMeterMeasureId = 37;
            if (location.LocationTypeId == ((short)LocationTypes.RM))
            {
                CheckMainlineDetections(location, options, locationEvents, errors);
                CheckStuckQueueDetections(location, options, locationEvents, errors);
            }
        }

        private void CheckDetections(
            Location location,
            WatchdogLoggingOptions options,
            List<IndianaEvent> locationEvents,
            ConcurrentBag<WatchDogLogEvent> errors,
            IEnumerable<short> eventCodes,
            WatchDogIssueTypes issueType,
            WatchDogComponentTypes componentType,
            string issueDescription,
            int startHour,
            int endHour,
            bool checkMissing)
        {
            try
            {
                var (start, end) = CalculateStartAndEndTime(options, startHour, endHour);

                var currentVolume = locationEvents.Where(e => e.Timestamp >= start && e.Timestamp <= end && eventCodes.Contains(e.EventCode));
                var rampDetectors = location.GetDetectorsForLocation()
                    .Where(d => d.DetectionTypes.Any(dt => dt.Id == DetectionTypes.IQ || dt.Id == DetectionTypes.EQ));

                bool hasIQ = rampDetectors.Any(d => d.DetectionTypes.Any(dt => dt.Id == DetectionTypes.IQ));
                bool hasEQ = rampDetectors.Any(d => d.DetectionTypes.Any(dt => dt.Id == DetectionTypes.EQ));

                var additionalInfo = GetAdditionalInfo(hasIQ, hasEQ);

                if ((checkMissing && !currentVolume.Any()) || (!checkMissing && currentVolume.Any()))
                {
                    var error = new WatchDogLogEvent(
                        location.Id,
                        location.LocationIdentifier,
                        options.ScanDate,
                        componentType,
                        location.Id,
                        issueType,
                        $"{issueDescription} {currentVolume.Count().ToString().ToLowerInvariant()}{additionalInfo}",
                        null);

                    if (!errors.Contains(error))
                        errors.Add(error);
                }
            }
            catch (Exception ex)
            {
                logger.LogError($"{issueType} {location.Id} {ex.Message}");
            }
        }

        private (DateTime start, DateTime end) CalculateStartAndEndTime(WatchdogLoggingOptions options, int startHour, int endHour)
        {
            var scanDate = options.ScanDate;
            var start = scanDate.Date.AddHours(startHour);
            var end = scanDate.Date.AddHours(endHour);

            return (start, end);
        }

        private string GetAdditionalInfo(bool hasIQ, bool hasEQ)
        {
            var additionalInfo = "";
            if (hasIQ)
                additionalInfo += " Intermediate Queue";
            if (hasEQ)
                additionalInfo += (string.IsNullOrEmpty(additionalInfo) ? "" : ",") + " Excessive Queue";

            return additionalInfo;
        }

        private async Task CheckLocationForPhaseErrors(
            Location Location,
            WatchdogLoggingOptions options,
            List<IndianaEvent> LocationEvents,
            ConcurrentBag<WatchDogLogEvent> errors)
        {
            var planEvents = LocationEvents.GetPlanEvents(
            options.AnalysisStart,
            options.AnalysisEnd).ToList();
            //Do we want to use the ped events extension here?
            var pedEvents = LocationEvents.Where(e =>
                new List<short>
                {
                    21,
                    23
                }.Contains(e.EventCode)
                && e.Timestamp >= options.AnalysisStart
                && e.Timestamp <= options.AnalysisEnd).ToList();

            var cycleEvents = LocationEvents.Where(e =>
                new List<short>
                {
                    1,
                    8,
                    11
                }.Contains(e.EventCode)
                && e.Timestamp >= options.AnalysisStart
                && e.Timestamp <= options.AnalysisEnd).ToList();

            var splitsEventCodes = new List<short>();
            for (short i = 130; i <= 149; i++)
                splitsEventCodes.Add(i);
            var splitsEvents = LocationEvents.Where(e =>
                splitsEventCodes.Contains(e.EventCode)
                && e.Timestamp >= options.AnalysisStart
                && e.Timestamp <= options.AnalysisEnd).ToList();

            var terminationEvents = LocationEvents.Where(e =>
            new List<short>
            {
                4,
                5,
                6,
                7
            }.Contains(e.EventCode)
            && e.Timestamp >= options.AnalysisStart
            && e.Timestamp <= options.AnalysisEnd).ToList();

            LocationEvents = null;

            CheckForUnconfiguredApproaches(Location, options, errors, cycleEvents);

            AnalysisPhaseCollectionData analysisPhaseCollection = null;
            try
            {
                analysisPhaseCollection = analysisPhaseCollectionService.GetAnalysisPhaseCollectionData(
                    Location.LocationIdentifier,
                    options.AnalysisStart,
                    options.AnalysisEnd,
                    planEvents,
                    cycleEvents,
                    splitsEvents,
                    pedEvents,
                    terminationEvents,
                    Location,
                    options.ConsecutiveCount);

            }
            catch (Exception e)
            {
                logger.LogError($"Unable to get analysis phase for Location {Location.LocationIdentifier}");
            }

            if (analysisPhaseCollection != null)
            {
                foreach (var phase in analysisPhaseCollection.AnalysisPhases)
                //Parallel.ForEach(APcollection.Cycles, options,phase =>
                {
                    var taskList = new List<Task>();
                    var approach = Location.Approaches.Where(a => a.ProtectedPhaseNumber == phase.PhaseNumber).FirstOrDefault();
                    if (approach != null)
                    {
                        try
                        {
                            taskList.Add(CheckForMaxOut(phase, approach, options, errors));
                        }
                        catch (Exception e)
                        {
                            logger.LogError($"{phase.locationIdentifier} {phase.PhaseNumber} - Max Out Error {e.Message}");
                        }

                        try
                        {

                            taskList.Add(CheckForForceOff(phase, approach, options, errors));
                        }
                        catch (Exception e)
                        {
                            logger.LogError($"{phase.locationIdentifier} {phase.PhaseNumber} - Force Off Error {e.Message}");
                        }

                        try
                        {
                            taskList.Add(CheckForStuckPed(phase, approach, options, errors));
                        }
                        catch (Exception e)
                        {
                            logger.LogError($"{phase.locationIdentifier} {phase.PhaseNumber} - Stuck Ped Error {e.Message}");
                        }
                    }
                    await Task.WhenAll(taskList);
                }
            }
        }

        ////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////
        ///////////////////// WATCH DOG ERRORS /////////////////////
        ////////////////////////////////////////////////////////////
        ////////////////////////////////////////////////////////////

        //WatchDogIssueType RecordCount - 1
        private async Task<WatchDogLogEvent> CheckLocationRecordCount(DateTime dateToCheck, Location Location, WatchdogLoggingOptions options, List<IndianaEvent> LocationEvents)
        {
            if (LocationEvents.Count > options.MinimumRecords)
            {
                logger.LogDebug($"Location {Location.LocationIdentifier} has {LocationEvents.Count} records");
                return null;
            }
            else
            {
                logger.LogDebug($"Location {Location.LocationIdentifier} Does Not Have Sufficient records");
                return new WatchDogLogEvent(
                    Location.Id,
                    Location.LocationIdentifier,
                    options.ScanDate,
                    WatchDogComponentTypes.Location,
                    Location.Id,
                    WatchDogIssueTypes.RecordCount,
                    "Missing Records - IP: " + string.Join(",", Location.Devices.Select(d => d.Ipaddress.ToString()).ToList()),
                    null
                );
            }
        }

        //WatchDogIssueType LowDetectorHits - 2
        private void CheckForLowDetectorHits(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors, List<short> detectorEventCodes)
        {
            var detectors = location.GetDetectorsForLocationThatSupportMetric(6);
            //Parallel.ForEach(detectors, options, detector =>
            foreach (var detector in detectors)
                try
                {
                    if (detector.DetectionTypes != null && detector.DetectionTypes.Any(d => d.Id == DetectionTypes.AC))
                    {
                        var channel = detector.DetectorChannel;
                        var direction = detector.Approach.DirectionType.Description;
                        var start = new DateTime();
                        var end = new DateTime();

                        var currentVolume = locationEvents.Where(e => e.EventParam == detector.DetectorChannel && detectorEventCodes.Contains(e.EventCode) && e.Timestamp >= options.AnalysisStart
                && e.Timestamp <= options.AnalysisEnd).Count();
                        //Compare collected hits to low hit threshold, 
                        if (currentVolume < Convert.ToInt32(options.LowHitThreshold))
                        {
                            var message = $"CH: {channel} - Count: {currentVolume.ToString().ToLowerInvariant()}";

                            AddDetectorError(
                                location,
                                options,
                                detector,
                                WatchDogIssueTypes.LowDetectorHits,
                                message,
                                errors);
                        }

                    }
                }
                catch (Exception ex)
                {
                    logger.LogError($"CheckForLowDetectorHits {detector.Id} {ex.Message}");
                }
        }

        //WatchDogIssueType StuckPed - 3
        private async Task CheckForStuckPed(AnalysisPhaseData phase, Approach approach, WatchdogLoggingOptions options, ConcurrentBag<WatchDogLogEvent> errors)
        {
            if (phase.PedestrianEvents.Count > options.MaximumPedestrianEvents)
            {
                var message = $"{phase.PedestrianEvents.Count} Pedestrian Activations";

                logger.LogDebug($"Location {approach.Location.LocationIdentifier} {phase.PedestrianEvents.Count} Pedestrian Activations");

                AddApproachError(
                    approach.Location,
                    options,
                    approach.Id,
                    WatchDogIssueTypes.StuckPed,
                    message,
                    phase.PhaseNumber,
                    errors);
            }
        }

        //WatchDogIssueType ForceOffThreshold - 4
        private async Task CheckForForceOff(AnalysisPhaseData phase, Approach approach, WatchdogLoggingOptions options, ConcurrentBag<WatchDogLogEvent> errors)
        {
            if (phase.PercentForceOffs > options.PercentThreshold && phase.TerminationEvents.Count(t => t.EventCode != 7) > options.MinPhaseTerminations)
            {
                var message = $"Force Offs {Math.Round(phase.PercentForceOffs * 100, 1)}%";

                logger.LogDebug($"Location {approach.Location.LocationIdentifier} Has ForceOff Errors");

                AddApproachError(
                    approach.Location,
                    options,
                    approach.Id,
                    WatchDogIssueTypes.ForceOffThreshold,
                    message,
                    phase.PhaseNumber,
                    errors);
            }

        }

        //WatchDogIssueType MaxOutThreshold - 5
        private async Task CheckForMaxOut(AnalysisPhaseData phase, Approach approach, WatchdogLoggingOptions options, ConcurrentBag<WatchDogLogEvent> errors)
        {
            if (phase.PercentMaxOuts > options.PercentThreshold && phase.TotalPhaseTerminations > options.MinPhaseTerminations)
            {
                var message = $"Max Outs {Math.Round(phase.PercentMaxOuts * 100, 1)}%";

                logger.LogDebug($"Location {approach.Location.LocationIdentifier} Has MaxOut Errors");

                AddApproachError(
                    approach.Location,
                    options,
                    approach.Id,
                    WatchDogIssueTypes.MaxOutThreshold,
                    message,
                    phase.PhaseNumber,
                    errors);
            }

        }

        //WatchDogIssueType UnconfiguredApproach - 6
        private void CheckForUnconfiguredApproaches(Location Location, WatchdogLoggingOptions options, ConcurrentBag<WatchDogLogEvent> errors, List<IndianaEvent> cycleEvents)
        {
            var phasesInUse = cycleEvents.Where(d => d.EventCode == 1 && d.Timestamp >= options.AnalysisStart
                && d.Timestamp <= options.AnalysisEnd).Select(d => d.EventParam).Distinct();
            foreach (var phaseNumber in phasesInUse)
            {
                var phase = phaseService.GetPhases(Location).Find(p => p.PhaseNumber == phaseNumber);
                if (phase == null)
                {
                    logger.LogDebug($"Location {Location.LocationIdentifier} {phaseNumber} Not Configured");

                    AddApproachError(
                        Location,
                        options,
                        -1,
                        WatchDogIssueTypes.UnconfiguredApproach,
                        "No corresponding approach configured",
                        phaseNumber,
                        errors);
                }
            }
        }

        //WatchDogIssueType UnconfiguredDetector - 7
        private static void CheckForUnconfiguredDetectors(Location Location, WatchdogLoggingOptions options, List<IndianaEvent> LocationEvents, ConcurrentBag<WatchDogLogEvent> errors, List<short> detectorEventCodes)
        {
            var detectorChannelsFromEvents = LocationEvents.Where(e => detectorEventCodes.Contains(e.EventCode) && e.Timestamp >= options.AnalysisStart
                && e.Timestamp <= options.AnalysisEnd).Select(e => e.EventParam).Distinct().ToList();
            var detectorChannelsFromDetectors = Location.GetDetectorsForLocation().Select(d => d.DetectorChannel).Distinct().ToList();
            foreach (var channel in detectorChannelsFromEvents)
            {
                if (!detectorChannelsFromDetectors.Contains(channel))
                {
                    AddDetectorError(
                        Location,
                        options,
                        detector: null,
                        WatchDogIssueTypes.UnconfiguredDetector,
                        $"Unconfigured detector channel-{channel}",
                        errors);
                }
            }
        }

        //WatchDogIssueType MissingMainlineData - 8
        private void CheckMainlineDetections(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors)
        {
            var mainlineEventCodes = new List<short> { 1371, 1372, 1373 };
            CheckDetections(
                location,
                options,
                locationEvents,
                errors,
                mainlineEventCodes,
                WatchDogIssueTypes.MissingMainlineData,
                WatchDogComponentTypes.Location,
                "Missing Mainline Data",
                options.RampMainlineStartHour,
                options.RampMainlineEndHour,
                checkMissing: true);
        }

        //WatchDogIssueType StuckQueueDetection - 9
        private void CheckStuckQueueDetections(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors)
        {
            var eventCodes = Enumerable.Range(1171, 31).Where(i => i % 2 != 0).Select(i => (short)i).ToList();
            CheckDetections(
                location,
                options,
                locationEvents,
                errors,
                eventCodes,
                WatchDogIssueTypes.StuckQueueDetection,
                WatchDogComponentTypes.Detector,
                "Stuck Queue Detections",
                options.RampStuckQueueStartHour,
                options.RampStuckQueueEndHour,
                checkMissing: false);
        }

        //WatchDogIssueType LowRampDetectorHits - 10
        private void CheckForLowRampDetectorHits(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors, List<short> detectorEventCodes)
        {
            if (location.LocationTypeId != 2)
            {
                return;
            }
            var detectors = location.GetDetectorsForLocation();
            var detectionTypeValidIds = new List<int> { 8, 9, 10, 11 };

            var result = detectors
                .Where(d => d.DetectionTypes.Any(i => detectionTypeValidIds.Contains((int)i.Id)));

            foreach (var detector in detectors)
                try
                {
                    var channel = detector.DetectorChannel;
                    var currentVolume = locationEvents.Where(e => e.EventParam == detector.DetectorChannel &&
                        detectorEventCodes.Contains(e.EventCode) &&
                        e.Timestamp >= options.RampStart &&
                        e.Timestamp <= options.RampEnd
                        ).Count();
                    //Compare collected hits to low hit ramp threshold, 
                    if (currentVolume < Convert.ToInt32(options.LowHitRampThreshold))
                    {
                        AddDetectorError(
                            location,
                            options,
                            detector,
                            WatchDogIssueTypes.LowRampDetectorHits,
                            $"CH: {channel} - Count: {currentVolume.ToString().ToLowerInvariant()}",
                            errors);
                    }

                }
                catch (Exception ex)
                {
                    logger.LogError($"CheckForLowRampDetectorHits {detector.Id} {ex.Message}");
                }
        }

        //WatchDogIssueType RampMissedDetectorHits - 11
        private void CheckRampMissedDetectorHits(Location location, WatchdogLoggingOptions options, List<IndianaEvent> locationEvents, ConcurrentBag<WatchDogLogEvent> errors)
        {
            if (location.LocationTypeId != 2)
                return;

            var detectors = location.GetDetectorsForLocation();
            var validDetectionTypeIds = new HashSet<int> { 8, 9, 10, 11 };
            var validEventCodes = new HashSet<short> { 1371, 1372, 1373 };
            var bucketSizeSeconds = 20;
            int wiggleSeconds = 9;

            // 1️⃣ Determine ramp window
            DateTime now = DateTime.Now;
            DateTime rampStart = options.RampMainLineLastRun ?? now.AddHours(-24);
            DateTime rampEnd = now;

            // Ensure max 24-hour window
            if ((rampEnd - rampStart).TotalHours > 24)
                rampEnd = rampStart.AddHours(24);

            //Go from the rampStart
            options.ScanDate = rampStart;

            // 2️⃣ Define 3-hour periods
            var periodDefinitions = new List<(TimeSpan Start, TimeSpan End, string Label)>
            {
                (TimeSpan.FromHours(0), TimeSpan.FromHours(3), "12am-3am"),
                (TimeSpan.FromHours(3), TimeSpan.FromHours(6), "3am-6am"),
                (TimeSpan.FromHours(6), TimeSpan.FromHours(9), "6am-9am"),
                (TimeSpan.FromHours(9), TimeSpan.FromHours(12), "9am-12pm"),
                (TimeSpan.FromHours(12), TimeSpan.FromHours(15), "12pm-3pm"),
                (TimeSpan.FromHours(15), TimeSpan.FromHours(18), "3pm-6pm"),
                (TimeSpan.FromHours(18), TimeSpan.FromHours(21), "6pm-9pm"),
                (TimeSpan.FromHours(21), TimeSpan.FromHours(24), "9pm-12am")
            };

            foreach (var detector in detectors.Where(d => d.DetectionTypes.Any(dt => validDetectionTypeIds.Contains((int)dt.Id))))
            {
                try
                {
                    var channel = detector.DetectorChannel;

                    // Pull timestamps for this detector in ramp window
                    var timestamps = locationEvents
                        .Where(e => e.EventParam == channel && validEventCodes.Contains(e.EventCode) &&
                                    e.Timestamp >= rampStart && e.Timestamp <= rampEnd)
                        .Select(e => e.Timestamp)
                        .ToList();

                    if (!timestamps.Any())
                    {
                        AddDetectorError(location, options, detector, WatchDogIssueTypes.RampMissedDetectorHits,
                            $"CH: {channel} - No events received in entire ramp window", errors);
                        continue;
                    }

                    // 3️⃣ Process each 3-hour period, clipped to ramp window
                    var periods = new List<(DateTime Start, DateTime End, string Label)>();
                    foreach (var (startTs, endTs, label) in periodDefinitions)
                    {
                        DateTime periodStart = rampStart.Date + startTs;
                        DateTime periodEnd = rampStart.Date + endTs;

                        // Skip periods outside ramp window
                        if (periodEnd <= rampStart || periodStart >= rampEnd)
                            continue;

                        // Clip periods to ramp window
                        periodStart = periodStart < rampStart ? rampStart : periodStart;
                        periodEnd = periodEnd > rampEnd ? rampEnd : periodEnd;

                        periods.Add((periodStart, periodEnd, label));
                    }

                    foreach (var (periodStart, periodEnd, label) in periods)
                    {
                        var periodTimestamps = timestamps
                            .Where(ts => ts >= periodStart && ts < periodEnd)
                            .ToList();

                        if (!periodTimestamps.Any())
                        {
                            AddDetectorError(location, options, detector, WatchDogIssueTypes.RampMissedDetectorHits,
                                $"CH: {channel} - No events in period {label}", errors);
                            continue;
                        }

                        int totalBuckets = (int)Math.Ceiling((periodEnd - periodStart).TotalSeconds / bucketSizeSeconds);
                        var bucketsWithHits = new HashSet<int>();

                        foreach (var ts in periodTimestamps)
                        {
                            int bucketIndex = (int)((ts - periodStart).TotalSeconds / bucketSizeSeconds);
                            bucketsWithHits.Add(bucketIndex);

                            // Previous bucket if within wiggle
                            if (bucketIndex > 0 && (ts - periodStart).TotalSeconds % bucketSizeSeconds <= wiggleSeconds)
                                bucketsWithHits.Add(bucketIndex - 1);

                            // Next bucket if within wiggle
                            if (bucketIndex < totalBuckets - 1 && (bucketSizeSeconds - (ts - periodStart).TotalSeconds % bucketSizeSeconds) <= wiggleSeconds)
                                bucketsWithHits.Add(bucketIndex + 1);
                        }

                        int missedBuckets = totalBuckets - bucketsWithHits.Count;
                        if (missedBuckets > options.RampMissedEventsThreshold)
                        {
                            AddDetectorError(location, options, detector, WatchDogIssueTypes.RampMissedDetectorHits,
                                $"CH: {channel} - Period {label} missed {missedBuckets} intervals", errors);
                        }
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError($"CheckRampMissedDetectorHits {detector.Id} {ex.Message}");
                }
            }
        }





        ///////////////////////////////////////////////////////////
        /////////////////////// HELPER ////////////////////////////
        ///////////////////////////////////////////////////////////
        private static void AddDetectorError(Location location, WatchdogLoggingOptions options, Detector detector, WatchDogIssueTypes issueType, string message, ConcurrentBag<WatchDogLogEvent> errors)
        {
            var error = new WatchDogLogEvent(
                location.Id,
                location.LocationIdentifier,
                options.ScanDate,
                WatchDogComponentTypes.Detector,
                detector?.Id ?? -1,
                issueType,
                message,
                null);

            if (!errors.Contains(error))
                errors.Add(error);
        }

        private static void AddApproachError(Location location, WatchdogLoggingOptions options, int approachId, WatchDogIssueTypes issueType, string message, int? phaseNumber = null, ConcurrentBag<WatchDogLogEvent> errors)
        {
            var error = new WatchDogLogEvent(
                location.Id,
                location.LocationIdentifier,
                options.ScanDate,
                WatchDogComponentTypes.Approach,
                approachId,
                issueType,
                message,
                phaseNumber);

            if (!errors.Contains(error))
                errors.Add(error);
        }
    }
}