#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/LinkPivotReportService.cs
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

using Utah.Udot.Atspm.Business.LinkPivot;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    public class LinkPivotReportService : ReportServiceBase<LinkPivotOptions, ReportResult<LinkPivotResult>>
    {
        private readonly ILocationRepository locationRepository;
        private readonly IRouteLocationsRepository routeLocationsRepository;
        private readonly LinkPivotService linkPivotService;
        private readonly LinkPivotPcdService linkPivotPcdService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;

        public LinkPivotReportService(ILocationRepository locationRepository,
            IRouteLocationsRepository routeLocationsRepository,
            LinkPivotService linkPivotService,
            LinkPivotPcdService linkPivotPcdService,
            IIndianaEventLogRepository controllerEventLogRepository)
        {
            this.locationRepository = locationRepository;
            this.routeLocationsRepository = routeLocationsRepository;
            this.linkPivotService = linkPivotService;
            this.linkPivotPcdService = linkPivotPcdService;
            this.controllerEventLogRepository = controllerEventLogRepository;
        }

        public override async Task<ReportResult<LinkPivotResult>> ExecuteAsync(LinkPivotOptions parameter, IProgress<int> progress = null, CancellationToken cancelToken = default)
        {
            var routeLocations = GetLocationsFromRouteId(parameter.RouteId);
            if (routeLocations == null || routeLocations.Count == 0)
            {
                return ReportResult<LinkPivotResult>.Failure(ReportErrorFactory.Create("NoRouteLocations", "No Route Locations configured for route", nameof(LinkPivotReportService)));
            }
            return await Task.Run(() => linkPivotService.GetData(parameter, routeLocations, new LinkPivotRequestCache()))
                .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LinkPivotReportService)));
        }

        public async Task<IEnumerable<ReportResult<LinkPivotForTsd>>> GetLinkPivotForTSD(TimeSpaceDiagramOptions options)
        {
            var routeLocations = GetLocationsFromRouteId(options.RouteId);
            if (routeLocations == null || routeLocations.Count == 0)
            {
                return ReportErrorFactory.Create("NoRouteLocations", "No Route Locations configured for route", nameof(LinkPivotReportService)).ToFailureReportResults<LinkPivotForTsd>();
            }
            var cache = new LinkPivotRequestCache();
            var cycleLength = GetModeCycleLength(TransformOptions(options), routeLocations, cache, out var cycleLengthError);
            if (cycleLengthError != null)
            {
                return [ReportResult<LinkPivotForTsd>.Failure(cycleLengthError)];
            }

            var primaryOptions = TransformOptions(options);
            primaryOptions.CycleLength = cycleLength;

            var opposingOptions = TransformOptions(options);
            opposingOptions.CycleLength = cycleLength;
            opposingOptions.Direction = "Upstream";
            opposingOptions.BiasDirection = "Upstream";

            var results = await Task.WhenAll(
                GetLinkPivotForTsdResult("Primary", primaryOptions, routeLocations, cache)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LinkPivotReportService))),
                GetLinkPivotForTsdResult("Opposing", opposingOptions, routeLocations, cache)
                    .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LinkPivotReportService))));

            return results;
        }

        private LinkPivotOptions TransformOptions(TimeSpaceDiagramOptions options)
        {
            var linkPivotOptions = new LinkPivotOptions()
            {
                RouteId = options.RouteId,
                StartDate = DateOnly.FromDateTime(options.Start),
                StartTime = TimeOnly.FromDateTime(options.Start),
                EndDate = DateOnly.FromDateTime(options.End),
                EndTime = TimeOnly.FromDateTime(options.End),
                Direction = "Downstream",
                BiasDirection = "Downstream",
                Bias = 0,
                DaysOfWeek = [(int)options.Start.DayOfWeek],
            };

            return linkPivotOptions;
        }

        public async Task<ReportResult<LinkPivotPcdResult>> GetPcdData(LinkPivotPcdOptions options)
        {
            return await Task.Run(() => linkPivotPcdService.GetData(options))
                .ToReportResultAsync(ex => ReportErrorFactory.FromException(ex, nameof(LinkPivotReportService), locationIdentifier: options.LocationIdentifier));
        }

        private async Task<LinkPivotForTsd> GetLinkPivotForTsdResult(string name, LinkPivotOptions options, List<RouteLocation> routeLocations, LinkPivotRequestCache cache)
        {
            var result = await Task.Run(() => linkPivotService.GetData(options, routeLocations, cache));
            return new LinkPivotForTsd(name, result);
        }

        public List<Location> FillSignals(int routeId)
        {
            var routeLocations = GetLocationsFromRouteId(routeId);

            List<Location> locations = new List<Location>();
            foreach (var routeSignal in routeLocations)
            {
                var location = locationRepository.GetLatestVersionOfLocation(routeSignal.LocationIdentifier);
                locations.Add(location);
            }
            return locations;
        }


        private List<RouteLocation> GetLocationsFromRouteId(int routeId)
        {
            var routeLocations = routeLocationsRepository.GetList().Where(l => l.RouteId == routeId).ToList();
            return routeLocations ?? new List<RouteLocation>();
        }

        private int GetModeCycleLength(LinkPivotOptions options, List<RouteLocation> routeLocations, LinkPivotRequestCache cache, out ReportError error)
        {
            error = null;
            List<int> cycleLengths = new List<int>();
            var locationIdentifiers = routeLocations.Select(i => i.LocationIdentifier).ToList();
            foreach (var locationIdentifier in locationIdentifiers)
            {
                var start = options.StartDate.ToDateTime(options.StartTime).AddHours(-12);
                var end = options.EndDate.ToDateTime(options.EndTime).AddHours(12);
                var controllerEventLogs = GetEventsBetweenDates(locationIdentifier, start, end, cache);

                if (controllerEventLogs.IsNullOrEmpty())
                {
                    error = ReportErrorFactory.Create("NoControllerEventLogs", $"No Controller Event Logs found for Location {locationIdentifier}", nameof(LinkPivotReportService), locationIdentifier: locationIdentifier);
                    return 0;
                }
                var programmedCycleForPlan = controllerEventLogs
                    .GetEventsByEventCodes(start, end, new List<short>() { 132 });
                var cycleLength = GetEventOverlappingTime(options.StartDate.ToDateTime(options.StartTime), programmedCycleForPlan, "CycleLength").FirstOrDefault();
                if (cycleLength != null)
                    cycleLengths.Add(cycleLength.EventParam);

            }
            int mode = cycleLengths.Any()
                ? cycleLengths
                    .GroupBy(x => x)
                    .OrderByDescending(g => g.Count())
                    .First().Key
                : 90;
            return mode;
        }

        private IReadOnlyList<IndianaEvent> GetEventsBetweenDates(
            string locationIdentifier,
            DateTime start,
            DateTime end,
            LinkPivotRequestCache cache)
        {
            return cache?.GetEvents(
                locationIdentifier,
                start,
                end,
                controllerEventLogRepository.GetEventsBetweenDates)
                ?? controllerEventLogRepository.GetEventsBetweenDates(locationIdentifier, start, end);
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
