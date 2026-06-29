#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/PurdueCoordinationDiagramReportService.cs
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

using Utah.Udot.Atspm.Business.PurdueCoordinationDiagram;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Purdue coordination diagram report service
    /// </summary>
    public class PurdueCoordinationDiagramReportService : ReportServiceBase<PurdueCoordinationDiagramOptions, IEnumerable<ReportResult<PurdueCoordinationDiagramResult>>>
    {
        private readonly PurdueCoordinationDiagramService perdueCoordinationDiagramService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly LocationPhaseService LocationPhaseService;
        private readonly ILocationRepository LocationRepository;
        private readonly PhaseService phaseService;

        /// <inheritdoc/>
        public PurdueCoordinationDiagramReportService(
            PurdueCoordinationDiagramService perdueCoordinationDiagramService,
            IIndianaEventLogRepository controllerEventLogRepository,
            LocationPhaseService LocationPhaseService,
            ILocationRepository LocationRepository,
            PhaseService phaseService)
        {
            this.perdueCoordinationDiagramService = perdueCoordinationDiagramService;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.LocationPhaseService = LocationPhaseService;
            this.LocationRepository = LocationRepository;
            this.phaseService = phaseService;
        }

        /// <inheritdoc/>
        public override async Task<IEnumerable<ReportResult<PurdueCoordinationDiagramResult>>> ExecuteAsync(PurdueCoordinationDiagramOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var Location = LocationRepository.GetLatestVersionOfLocation(parameter.LocationIdentifier, parameter.Start);
            if (Location == null)
            {
                //return BadRequest("Location not found");
                return ReportErrorFactory.Create("LocationNotFound", "Location not found", nameof(PurdueCoordinationDiagramReportService), locationIdentifier: parameter.LocationIdentifier).ToFailureReportResults<PurdueCoordinationDiagramResult>();
            }
            var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(Location.LocationIdentifier, parameter.Start.AddHours(-12), parameter.End.AddHours(12)).ToList();
            if (controllerEventLogs.IsNullOrEmpty())
            {
                //return Ok("No Controller Event Logs found for Location");
                return ReportErrorFactory.Create("NoControllerEventLogs", "No Controller Event Logs found for Location", nameof(PurdueCoordinationDiagramReportService), location: Location).ToFailureReportResults<PurdueCoordinationDiagramResult>();
            }

            var planEvents = controllerEventLogs.GetPlanEvents(
            parameter.Start.AddHours(-12),
                parameter.End.AddHours(12)).ToList();
            var phaseDetails = phaseService.GetPhases(Location);
            var tasks = new List<Task<ReportResult<PurdueCoordinationDiagramResult>>>();
            foreach (var phase in phaseDetails)
            {
                tasks.Add(GetChartDataForApproach(parameter, phase, controllerEventLogs, planEvents)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(PurdueCoordinationDiagramReportService), phase: phase, sortOrder: phase.PhaseNumber)));
            }

            var results = await Task.WhenAll(tasks);

            var finalResultcheck = results
                .Where(result => result != null)
                .OrderBy(r => r.Result?.PhaseNumber ?? r.Error?.SortOrder ?? int.MaxValue)
                .ToList();

            //if (finalResultcheck.IsNullOrEmpty())
            //{
            //    return Ok("No chart data found");
            //}
            //return Ok(finalResultcheck);

            return finalResultcheck;
        }

        private async Task<PurdueCoordinationDiagramResult> GetChartDataForApproach(
            PurdueCoordinationDiagramOptions options,
            PhaseDetail phaseDetail,
            IReadOnlyList<IndianaEvent> controllerEventLogs,
            IReadOnlyList<IndianaEvent> planEvents)
        {
            var LocationPhase = await LocationPhaseService.GetLocationPhaseData(
                phaseDetail,
                options.Start,
                options.End,
                options.BinSize,
                null,
                controllerEventLogs.ToList(),
                planEvents.ToList(),
                options.GetVolume);
            if (LocationPhase == null)
            {
                return null;
            }
            PurdueCoordinationDiagramResult viewModel = perdueCoordinationDiagramService.GetChartData(options, phaseDetail.Approach, LocationPhase);
            viewModel.LocationDescription = phaseDetail.Approach.Location.LocationDescription();
            viewModel.ApproachDescription = phaseDetail.Approach.Description;
            return viewModel;
        }
    }
}
