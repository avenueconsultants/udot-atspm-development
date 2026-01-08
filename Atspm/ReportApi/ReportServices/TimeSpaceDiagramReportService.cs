#region license
// Copyright 2025 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/TimeSpaceDiagramReportService.cs
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

using Microsoft.EntityFrameworkCore;
using Utah.Udot.Atspm.Business.PriorityDetails;
using Utah.Udot.Atspm.Business.TimeSpaceDiagram;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    /// <summary>
    /// Time space diagram report service
    /// </summary>
    public class TimeSpaceDiagramReportService : ReportServiceBase<TimeSpaceDiagramOptions, IEnumerable<TimeSpaceDiagramResultForPhase>>
    {
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly ILocationRepository LocationRepository;
        private readonly TimeSpaceDiagramForPhaseService timeSpaceDiagramReportService;
        private readonly PhaseService phaseService;
        private readonly IRouteLocationsRepository routeLocationsRepository;
        private readonly IRouteRepository routeRepository;
        private readonly PriorityDetailsReportService priorityDetailsReportService;

        public TimeSpaceDiagramReportService(IIndianaEventLogRepository controllerEventLogRepository,
            ILocationRepository locationRepository,
            TimeSpaceDiagramForPhaseService timeSpaceDiagramReportService,
            PhaseService phaseService,
            IRouteLocationsRepository routeLocationsRepository,
            IRouteRepository routeRepository,
            PriorityDetailsReportService priorityDetailsReportService)
        {
            this.controllerEventLogRepository = controllerEventLogRepository;
            LocationRepository = locationRepository;
            this.timeSpaceDiagramReportService = timeSpaceDiagramReportService;
            this.phaseService = phaseService;
            this.routeLocationsRepository = routeLocationsRepository;
            this.routeRepository = routeRepository;
            this.priorityDetailsReportService = priorityDetailsReportService;
        }

        /// <inheritdoc/>
        public override async Task<IEnumerable<TimeSpaceDiagramResultForPhase>> ExecuteAsync(TimeSpaceDiagramOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var routeLocations = GetLocationsFromRouteId(parameter.RouteId);
            var routeName = GetRouteNameFromId(parameter.RouteId);
            if (routeLocations.Count == 0)
            {
                throw new Exception($"No locations present for route");
            }

            var eventCodes = new List<short>() { 82, 81 };
            var tasks = new List<Task<TimeSpaceDiagramResultForPhase>>();
            routeLocations.Sort((r1, r2) => r1.Order - r2.Order);

            //Throw exception when no distance is found
            foreach (var routeLocation in routeLocations)
            {
                if (routeLocation.NextLocationDistance == null && routeLocation.PreviousLocationDistance == null)
                {
                    throw new Exception($"Distance not configured for route: {routeName}");
                }
            }

            var (controllerEventLogsList, primaryPhaseDetails, opposingPhaseDetails, programmedCycleLength) = ProcessRouteLocations(routeLocations, parameter);

            for (int i = 0; i < routeLocations.Count; i++)
            {
                var nextLocationDistance = i == routeLocations.Count - 1 ? 0 : routeLocations[i].NextLocationDistance.Distance;
                var previousLocationDistance = i == 0 ? 0 : routeLocations[i].PreviousLocationDistance.Distance;

                tasks.Add(GetChartDataForPhase(parameter,
                    controllerEventLogsList[i],
                    primaryPhaseDetails[i],
                    programmedCycleLength[i],
                    eventCodes,
                    nextLocationDistance,
                    previousLocationDistance,
                    isFirstElement: i == 0,
                    isLastElement: i == routeLocations.Count - 1,
                    "Primary",
                    i
                ));
            }

            for (int i = routeLocations.Count - 1, j = 0; i >= 0; i--, j++)
            {
                var nextLocationDistance = i == 0 ? 0 : routeLocations[i].PreviousLocationDistance.Distance;
                var previousLocationDistance = i == routeLocations.Count - 1 ? 0 : routeLocations[i].NextLocationDistance.Distance;

                tasks.Add(GetChartDataForPhase(parameter,
                    controllerEventLogsList[i],
                    opposingPhaseDetails[i],
                    programmedCycleLength[i],
                    eventCodes,
                    nextLocationDistance,
                    previousLocationDistance,
                    isFirstElement: i == routeLocations.Count - 1,
                    isLastElement: i == 0,
                    "Opposing",
                    j
                ));
            }

            var results = await Task.WhenAll(tasks);
            return results;
        }

        private string GetRouteNameFromId(int routeId)
        {
            var routeName = routeRepository.GetList().Where(r => r.Id == routeId)?.FirstOrDefault()?.Name;
            return routeName != null ? routeName : "";
        }

        private (List<List<IndianaEvent>> controllerEventLogsList,
           List<PhaseDetail> primaryPhaseDetails,
           List<PhaseDetail> opposingPhaseDetails,
           List<int> ProgrammedCycleLength)
           ProcessRouteLocations(IEnumerable<RouteLocation> routeLocations, TimeSpaceDiagramOptions parameter)
        {
            var controllerEventLogsList = new List<List<IndianaEvent>>();
            var primaryPhaseDetails = new List<PhaseDetail>();
            var opposingPhaseDetails = new List<PhaseDetail>();
            var programmedCycleLength = new List<int>();

            foreach (var routeLocation in routeLocations)
            {
                var location = LocationRepository.GetLatestVersionOfLocation(routeLocation.LocationIdentifier, parameter.Start);
                int currentProgrammedCycleLength = 0;

                if (location == null)
                {
                    throw new Exception("Issue fetching location from route");
                }

                var primaryPhaseDetail = phaseService.GetPhases(location).Find(p => p.Approach.ProtectedPhaseNumber == routeLocation.PrimaryPhase && p.Approach.DirectionType == routeLocation.PrimaryDirection);
                var opposingPhaseDetail = phaseService.GetPhases(location).Find(p => p.Approach.ProtectedPhaseNumber == routeLocation.OpposingPhase && p.Approach.DirectionType == routeLocation.OpposingDirection);

                if (primaryPhaseDetail == null || opposingPhaseDetail == null)
                {
                    throw new Exception("Error grabbing phase details");
                }

                if (parameter.SpeedLimit == null && primaryPhaseDetail.Approach.Mph == null)
                {
                    throw new Exception($"Speed not configured in route for all phases");
                }

                if (parameter.SpeedLimit == null && opposingPhaseDetail.Approach.Mph == null)
                {
                    throw new Exception($"Speed not configured in route for all phases");
                }

                var controllerEventLogs = controllerEventLogRepository.GetEventsBetweenDates(location.LocationIdentifier, parameter.Start.AddHours(-12), parameter.End.AddHours(12)).ToList();

                if (controllerEventLogs.IsNullOrEmpty())
                {
                    throw new Exception($"No Controller Event Logs found for Location {location.LocationIdentifier}");
                }

                if (currentProgrammedCycleLength == 0)
                {
                    var programmedCycleForPlan = controllerEventLogs.GetEventsByEventCodes(parameter.Start.AddHours(-12), parameter.End.AddHours(12), new List<short>() { 132 });
                    currentProgrammedCycleLength = GetEventOverlappingTime(parameter.Start, programmedCycleForPlan, "CycleLength").FirstOrDefault().EventParam;
                }

                controllerEventLogsList.Add(controllerEventLogs);
                primaryPhaseDetails.Add(primaryPhaseDetail);
                opposingPhaseDetails.Add(opposingPhaseDetail);
                programmedCycleLength.Add(currentProgrammedCycleLength);

            }

            return (controllerEventLogsList, primaryPhaseDetails, opposingPhaseDetails, programmedCycleLength);
        }

        private async Task<TimeSpaceDiagramResultForPhase> GetChartDataForPhase(
            TimeSpaceDiagramOptions parameter,
            List<IndianaEvent> currentControllerEventLogs,
            PhaseDetail currentPhase,
            int programmedCycleLength,
            List<short> eventCodes,
            double distanceToNextLocation,
            double distanceToPreviousLocation,
            bool isFirstElement,
            bool isLastElement,
            string phaseType,
            int order)
        {
            PriorityDetailsOptions priorityDetailsOptions = new PriorityDetailsOptions
            {
                Start = parameter.Start,
                End = parameter.End,
            };
            PriorityDetailsResult priorityDetails = await priorityDetailsReportService.GetChartDataForPhase(
                priorityDetailsOptions,
                currentControllerEventLogs,
                currentPhase,
                currentPhase.IsPermissivePhase);

            eventCodes.AddRange(timeSpaceDiagramReportService.GetCycleCodes(currentPhase.UseOverlap));
            var approachEvents = currentControllerEventLogs.GetEventsByEventCodes(
                parameter.Start.AddMinutes(-15),
                parameter.End.AddMinutes(15),
                eventCodes).ToList();
            var viewModel = timeSpaceDiagramReportService.GetChartDataForPhase(parameter,
                currentPhase,
                approachEvents,
                programmedCycleLength,
                distanceToNextLocation,
                distanceToPreviousLocation,
                isFirstElement,
                isLastElement,
                priorityDetails);
            viewModel.LocationDescription = currentPhase.Approach.Location.LocationDescription();
            viewModel.ApproachDescription = currentPhase.Approach.Description;
            viewModel.PhaseType = phaseType;
            viewModel.Order = order;
            return viewModel;
        }

        //HACK: this needs to be moved into the repository
        private List<RouteLocation> GetLocationsFromRouteId(int routeId)
        {
            var routeLocations = routeLocationsRepository.GetList()
                .Include(x => x.NextLocationDistance)
                .Include(x => x.PreviousLocationDistance)
                .Where(l => l.RouteId == routeId).ToList();
            return routeLocations ?? new List<RouteLocation>();
        }

        private List<IndianaEvent> GetEventOverlappingTime(DateTime start, IReadOnlyList<IndianaEvent> programmedCycleForPlan, string eventType)
        {
            var planEvent = programmedCycleForPlan.Where(e => e.Timestamp == start).ToList();


            if (planEvent.Count == 0)
            {
                var planEventInTimeSpan = programmedCycleForPlan.Where(e => e.Timestamp < start)
                    ?.GroupBy(log => log.EventCode)
                    ?.Select(group => group.OrderByDescending(e => e.Timestamp).FirstOrDefault())
                    .ToList();

                if (planEventInTimeSpan != null && planEventInTimeSpan.Count != 0)
                    planEvent = planEventInTimeSpan;
            }

            return planEvent.ToList();
        }
    }
}
