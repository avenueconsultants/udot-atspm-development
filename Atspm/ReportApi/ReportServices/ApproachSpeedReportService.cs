#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/ApproachSpeedReportService.cs
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

using Utah.Udot.Atspm.Business.ApproachSpeed;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Approach speed report service
    /// </summary>
    public class ApproachSpeedReportService : ReportServiceBase<ApproachSpeedOptions, IEnumerable<ReportResult<ApproachSpeedResult>>>
    {
        private readonly ApproachSpeedService approachSpeedService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly IApproachRepository approachRepository;
        private readonly ISpeedEventLogRepository speedEventRepository;
        private readonly ILocationRepository LocationRepository;
        private readonly PhaseService phaseService;
        private readonly ILogger<ApproachSpeedReportService> logger;

        /// <inheritdoc/>
        public ApproachSpeedReportService(
            ApproachSpeedService approachSpeedService,
            IIndianaEventLogRepository controllerEventLogRepository,
            IApproachRepository approachRepository,
            ISpeedEventLogRepository speedEventRepository,
            ILocationRepository LocationRepository,
            PhaseService phaseService,
            ILogger<ApproachSpeedReportService> logger)
        {
            this.approachSpeedService = approachSpeedService;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.approachRepository = approachRepository;
            this.speedEventRepository = speedEventRepository;
            this.LocationRepository = LocationRepository;
            this.phaseService = phaseService;
            this.logger = logger;
        }

        /// <inheritdoc/>
        public override async Task<IEnumerable<ReportResult<ApproachSpeedResult>>> ExecuteAsync(ApproachSpeedOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var Location = LocationRepository.GetLatestVersionOfLocation(parameter.LocationIdentifier, parameter.Start);
            if (Location == null)
            {
                return ReportErrorFactory.Create("LocationNotFound", "Location not found", nameof(ApproachSpeedReportService), locationIdentifier: parameter.LocationIdentifier).ToFailureReportResults<ApproachSpeedResult>();
            }

            var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(Location.LocationIdentifier, parameter.Start.AddHours(-12), parameter.End.AddHours(12)).ToList();

            if (controllerEventLogs.IsNullOrEmpty())
            {
                //return Ok("No data found");
                return ReportErrorFactory.Create("NoControllerEventLogs", "No Controller Event Logs found for this signal on this date", nameof(ApproachSpeedReportService), location: Location).ToFailureReportResults<ApproachSpeedResult>();
            }

            var planEvents = controllerEventLogs.GetPlanEvents(parameter.Start.AddHours(-12), parameter.End.AddHours(12)).ToList();

            var phaseDetails = phaseService.GetPhases(Location);
            var tasks = new List<Task<ReportResult<ApproachSpeedResult>>>();

            foreach (var phaseDetail in phaseDetails)
            {
                tasks.Add(GetChartDataByApproach(parameter, controllerEventLogs, planEvents, phaseDetail, Location.LocationDescription())
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(ApproachSpeedReportService), phase: phaseDetail, sortOrder: phaseDetail.PhaseNumber)));
            }
            var results = await Task.WhenAll(tasks);
            var finalResultcheck = results
                .Where(result => result != null)
                .OrderBy(r => r.Result?.PhaseNumber ?? r.Error?.SortOrder ?? int.MaxValue)
                .ToList();

            //if (finalResultcheck.IsNullOrEmpty())
            //{
            //    return Ok("No data found");
            //}

            //return Ok(finalResultcheck);

            return finalResultcheck;
        }

        private async Task<ApproachSpeedResult> GetChartDataByApproach(
            ApproachSpeedOptions options,
            List<IndianaEvent> controllerEventLogs,
            List<IndianaEvent> planEvents,
            PhaseDetail phaseDetail,
            string LocationDescription)
        {
            var detectors = phaseDetail.Approach.GetDetectorsForMetricType(options.MetricTypeId);
            Detector detector;
            if (detectors.IsNullOrEmpty())
            {
                return null;
            }
            else
            {
                detector = detectors.First();
            }
            var speedEvents = speedEventRepository.GetSpeedEventsByDetector(phaseDetail.Approach.Location.LocationIdentifier,
                detector,
                options.Start,
                options.End,
                detector.MinSpeedFilter ?? 5).ToList();
            if (speedEvents.IsNullOrEmpty())
            {
                return null;
            }
            var cycleEvents = controllerEventLogs.GetCycleEventsWithTimeExtension(
                phaseDetail.PhaseNumber,
                phaseDetail.UseOverlap,
                options.Start,
                options.End);
            ApproachSpeedResult viewModel = approachSpeedService.GetChartData(
                options,
                cycleEvents.ToList(),
                planEvents,
                speedEvents,
                detector,
                logger);
            viewModel.LocationDescription = LocationDescription;
            viewModel.ApproachDescription = phaseDetail.Approach.Description;
            return viewModel;
        }
    }
}
