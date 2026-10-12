#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/IncidentReconstructionReportService.cs
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

using Utah.Udot.Atspm.Business.IncidentReconstruction;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Incident reconstruction report service
    /// </summary>
    public class IncidentReconstructionReportService : ReportServiceBase<IncidentReconstructionOptions, IncidentReconstructionResult>
    {
        /// <summary>
        /// How far before the window start to look for the signal state in effect at the start.
        /// </summary>
        public static readonly TimeSpan Lookback = TimeSpan.FromMinutes(15);

        private readonly IncidentReconstructionService incidentReconstructionService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly ILocationRepository locationRepository;
        private readonly PhaseService phaseService;

        /// <inheritdoc/>
        public IncidentReconstructionReportService(
            IncidentReconstructionService incidentReconstructionService,
            IIndianaEventLogRepository controllerEventLogRepository,
            ILocationRepository locationRepository,
            PhaseService phaseService)
        {
            this.incidentReconstructionService = incidentReconstructionService;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.locationRepository = locationRepository;
            this.phaseService = phaseService;
        }

        /// <inheritdoc/>
        public override async Task<IncidentReconstructionResult> ExecuteAsync(IncidentReconstructionOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var location = locationRepository.GetLatestVersionOfLocation(parameter.LocationIdentifier, parameter.Start);

            if (location == null)
            {
                return await Task.FromException<IncidentReconstructionResult>(new NullReferenceException("Location not found"));
            }

            var lookbackStart = parameter.Start - Lookback;
            var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(location.LocationIdentifier, lookbackStart, parameter.End).ToList();

            if (controllerEventLogs.IsNullOrEmpty())
            {
                return await Task.FromException<IncidentReconstructionResult>(new NullReferenceException("No high-resolution data for this location in this window"));
            }

            var phaseDetails = phaseService.GetPhases(location);

            return incidentReconstructionService.GetReport(location, phaseDetails, controllerEventLogs, parameter, lookbackStart);
        }
    }
}
