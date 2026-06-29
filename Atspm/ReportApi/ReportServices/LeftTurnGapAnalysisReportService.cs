#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/LeftTurnGapAnalysisReportService.cs
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

using Utah.Udot.Atspm.Business.LeftTurnGapAnalysis;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Left turn gap analysis report service
    /// </summary>
    public class LeftTurnGapAnalysisReportService : ReportServiceBase<LeftTurnGapAnalysisOptions, IEnumerable<ReportResult<LeftTurnGapAnalysisResult>>>
    {
        private readonly LeftTurnGapAnalysisService leftTurnGapAnalysisService;
        private readonly IApproachRepository approachRepository;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly ILocationRepository LocationRepository;

        /// <inheritdoc/>
        public LeftTurnGapAnalysisReportService(
            LeftTurnGapAnalysisService leftTurnGapAnalysisService,
            IApproachRepository approachRepository,
            IIndianaEventLogRepository controllerEventLogRepository,
            ILocationRepository LocationRepository)
        {
            this.leftTurnGapAnalysisService = leftTurnGapAnalysisService;
            this.approachRepository = approachRepository;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.LocationRepository = LocationRepository;
        }

        /// <inheritdoc/>
        public override async Task<IEnumerable<ReportResult<LeftTurnGapAnalysisResult>>> ExecuteAsync(LeftTurnGapAnalysisOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var Location = LocationRepository.GetLatestVersionOfLocation(parameter.LocationIdentifier, parameter.Start);
            if (Location == null)
            {
                //return BadRequest("Location not found");
                return ReportErrorFactory.Create("LocationNotFound", "Location not found", nameof(LeftTurnGapAnalysisReportService), locationIdentifier: parameter.LocationIdentifier).ToFailureReportResults<LeftTurnGapAnalysisResult>();
            }
            var eventCodes = new List<int> { 1, 10, 81 };
            var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(
                Location.LocationIdentifier,
                parameter.Start,
                parameter.End)
                .ToList();

            if (controllerEventLogs.IsNullOrEmpty())
            {
                //return Ok("No Controller Event Logs found for Location");
                return ReportErrorFactory.Create("NoControllerEventLogs", "No Controller Event Logs found for Location", nameof(LeftTurnGapAnalysisReportService), location: Location).ToFailureReportResults<LeftTurnGapAnalysisResult>();
            }

            var tasks = new List<Task<ReportResult<LeftTurnGapAnalysisResult>>>();
            var leftTurnGapData = new List<LeftTurnGapAnalysisResult>();
            //Get phase + check for opposing phase before creating chart
            var ebPhase = Location.Approaches.FirstOrDefault(x => x.ProtectedPhaseNumber == 6);
            if (ebPhase != null && Location.Approaches.Any(x => x.ProtectedPhaseNumber == 2))
            {
                var leftTurnApproach = Location.Approaches.First(x => x.ProtectedPhaseNumber == 2);
                tasks.Add(leftTurnGapAnalysisService.GetAnalysisForPhase(
                    ebPhase,
                    controllerEventLogs,
                    parameter,
                    leftTurnApproach)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LeftTurnGapAnalysisReportService), approach: leftTurnApproach, sortOrder: leftTurnApproach.ProtectedPhaseNumber)));
            }

            var nbPhase = Location.Approaches.FirstOrDefault(x => x.ProtectedPhaseNumber == 8);
            if (nbPhase != null && Location.Approaches.Any(x => x.ProtectedPhaseNumber == 4))
            {

                var leftTurnApproach = Location.Approaches.First(x => x.ProtectedPhaseNumber == 4);
                tasks.Add(leftTurnGapAnalysisService.GetAnalysisForPhase(
                    nbPhase,
                    controllerEventLogs,
                    parameter,
                    leftTurnApproach)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LeftTurnGapAnalysisReportService), approach: leftTurnApproach, sortOrder: leftTurnApproach.ProtectedPhaseNumber)));
            }

            var wbPhase = Location.Approaches.FirstOrDefault(x => x.ProtectedPhaseNumber == 2);
            if (wbPhase != null && Location.Approaches.Any(x => x.ProtectedPhaseNumber == 6))
            {

                var leftTurnApproach = Location.Approaches.First(x => x.ProtectedPhaseNumber == 6);
                tasks.Add(leftTurnGapAnalysisService.GetAnalysisForPhase(
                    wbPhase,
                    controllerEventLogs,
                    parameter,
                    leftTurnApproach)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LeftTurnGapAnalysisReportService), approach: leftTurnApproach, sortOrder: leftTurnApproach.ProtectedPhaseNumber)));
            }

            var sbPhase = Location.Approaches.FirstOrDefault(x => x.ProtectedPhaseNumber == 4);
            if (sbPhase != null && Location.Approaches.Any(x => x.ProtectedPhaseNumber == 8))
            {
                var leftTurnApproach = Location.Approaches.First(x => x.ProtectedPhaseNumber == 8);
                tasks.Add(leftTurnGapAnalysisService.GetAnalysisForPhase(
                    sbPhase,
                    controllerEventLogs,
                    parameter,
                    leftTurnApproach)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LeftTurnGapAnalysisReportService), approach: leftTurnApproach, sortOrder: leftTurnApproach.ProtectedPhaseNumber)));
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
    }
}
