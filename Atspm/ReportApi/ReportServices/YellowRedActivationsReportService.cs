#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/YellowRedActivationsReportService.cs
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

using Utah.Udot.Atspm.Business.YellowRedActivations;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Yellow and red activations report service
    /// </summary>
    public class YellowRedActivationsReportService : ReportServiceBase<YellowRedActivationsOptions, IEnumerable<ReportResult<YellowRedActivationsResult>>>
    {
        private readonly YellowRedActivationsService yellowRedActivationsService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly ILocationRepository LocationRepository;
        private readonly PhaseService phaseService;

        /// <inheritdoc/>
        public YellowRedActivationsReportService(
            YellowRedActivationsService yellowRedActivationsService,
            IIndianaEventLogRepository controllerEventLogRepository,
            ILocationRepository LocationRepository,
            PhaseService phaseService)
        {
            this.yellowRedActivationsService = yellowRedActivationsService;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.LocationRepository = LocationRepository;
            this.phaseService = phaseService;
        }

        /// <inheritdoc/>
        public override async Task<IEnumerable<ReportResult<YellowRedActivationsResult>>> ExecuteAsync(YellowRedActivationsOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var Location = LocationRepository.GetLatestVersionOfLocation(parameter.LocationIdentifier, parameter.Start);

            if (Location == null)
            {
                //return BadRequest("Location not found");
                return ReportErrorFactory.Create("LocationNotFound", "Location not found", nameof(YellowRedActivationsReportService), locationIdentifier: parameter.LocationIdentifier).ToFailureReportResults<YellowRedActivationsResult>();
            }

            var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(Location.LocationIdentifier, parameter.Start.AddHours(-12), parameter.End.AddHours(12)).ToList();

            if (controllerEventLogs.IsNullOrEmpty())
            {
                //return Ok("No Controller Event Logs found for Location");
                return ReportErrorFactory.Create("NoControllerEventLogs", "No Controller Event Logs found for Location", nameof(YellowRedActivationsReportService), location: Location).ToFailureReportResults<YellowRedActivationsResult>();
            }

            var planEvents = controllerEventLogs.GetPlanEvents(
            parameter.Start.AddHours(-12),
                parameter.End.AddHours(12)).ToList();
            var phaseDetails = phaseService.GetPhases(Location);
            var tasks = new List<Task<ReportResult<YellowRedActivationsResult>>>();
            foreach (var phaseDetail in phaseDetails)
            {
                tasks.Add(GetChartDataForApproach(parameter, phaseDetail, controllerEventLogs, planEvents, Location.LocationDescription())
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(YellowRedActivationsReportService), phase: phaseDetail, sortOrder: phaseDetail.PhaseNumber)));
            }

            var results = await Task.WhenAll(tasks);

            // Only send back data where detector events exists
            var finalResultcheck = results
                .Where(result => result != null)
                .OrderBy(r => r.Result?.PhaseType ?? r.Error?.PhaseType)
                .ThenBy(r => r.Result?.ProtectedPhaseNumber ?? r.Error?.PhaseNumber ?? int.MaxValue)
                .ThenBy(r => r.Result?.IsPermissivePhase ?? false)
                .ToList();

            //if (finalResultcheck.IsNullOrEmpty())
            //{
            //    return Ok("No chart data found");
            //}
            //return Ok(finalResultcheck);

            return finalResultcheck;
        }

        private async Task<YellowRedActivationsResult> GetChartDataForApproach(
            YellowRedActivationsOptions options,
            PhaseDetail phaseDetail,
            List<IndianaEvent> controllerEventLogs,
            List<IndianaEvent> planEvents,
            string LocationDescription)
        {
            var cycleEvents = controllerEventLogs.GetEventsByEventCodes(
                options.Start.AddSeconds(-900),
                options.End.AddSeconds(900),
                GetYellowRedActivationsCycleEventCodes(phaseDetail.UseOverlap),
                phaseDetail.PhaseNumber)
                .OrderBy(e => e.Timestamp)
            .ToList();
            var detectorEvents = controllerEventLogs.GetDetectorEvents(
                options.MetricTypeId,
                phaseDetail.Approach,
                options.Start,
                options.End,
                true,
                false);

            var viewModel = yellowRedActivationsService.GetChartData(
                options,
                phaseDetail,
                cycleEvents,
                detectorEvents,
                planEvents);
            viewModel.LocationDescription = LocationDescription;
            viewModel.ApproachDescription = phaseDetail.GetApproachDescription();
            return viewModel;
        }

        private List<short> GetYellowRedActivationsCycleEventCodes(bool useOverlap)
        {
            return useOverlap
                ? new List<short>
                {
                    62,
                    63,
                    64,
                    65
                }
                : new List<short>
                {
                    1,
                    8,
                    9,
                    11
                };
        }
    }
}
