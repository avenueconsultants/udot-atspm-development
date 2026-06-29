#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.LinkPivot/LinkPivotPcdService.cs
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
using Utah.Udot.Atspm.Business.PurdueCoordinationDiagram;
using Utah.Udot.Atspm.Extensions;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Utah.Udot.Atspm.Repositories.EventLogRepositories;
using Utah.Udot.Atspm.TempExtensions;

namespace Utah.Udot.Atspm.Business.LinkPivot
{
    public class LinkPivotPcdService
    {
        private readonly ILocationRepository locationRepository;
        private readonly LocationPhaseService locationPhaseService;
        private readonly IIndianaEventLogRepository controllerEventLogRepository;
        private readonly PurdueCoordinationDiagramService purdueCoordinationDiagramService;

        public LinkPivotPcdService(ILocationRepository locationRepository, IIndianaEventLogRepository controllerEventLogRepository, LocationPhaseService locationPhaseService, PurdueCoordinationDiagramService purdueCoordinationDiagramService)
        {
            this.locationRepository = locationRepository;
            this.controllerEventLogRepository = controllerEventLogRepository;
            this.locationPhaseService = locationPhaseService;
            this.purdueCoordinationDiagramService = purdueCoordinationDiagramService;
        }

        public async Task<LinkPivotPcdResult> GetData(LinkPivotPcdOptions options)
        {
            var result = new LinkPivotPcdResult();
            var startDate = options.StartDate.ToDateTime(options.StartTime);
            var endDate = options.EndDate.ToDateTime(options.EndTime);
            var upstreamLocation = locationRepository.GetLatestVersionOfLocation(options.LocationIdentifier);
            var downstreamLocation = locationRepository.GetLatestVersionOfLocation(options.DownstreamLocationIdentifier);

            var upApproachToAnalyze = GetApproachToAnalyze(upstreamLocation, options.UpstreamApproachDirection);
            var downApproachToAnalyze = GetApproachToAnalyze(downstreamLocation, options.DownstreamApproachDirection);

            if (upApproachToAnalyze != null)
                await GeneratePcdAsync(result, upApproachToAnalyze, options.Delta, startDate, endDate, true);
            else
                AddPcdFailure(result, ReportErrorFactory.Create("ApproachNotFound", "Upstream approach not found", nameof(LinkPivotPcdService), location: upstreamLocation, locationIdentifier: options.LocationIdentifier, direction: options.UpstreamApproachDirection));
            if (downApproachToAnalyze != null)
                await GeneratePcdAsync(result, downApproachToAnalyze, options.Delta, startDate, endDate, false);
            else
                AddPcdFailure(result, ReportErrorFactory.Create("ApproachNotFound", "Downstream approach not found", nameof(LinkPivotPcdService), location: downstreamLocation, locationIdentifier: options.DownstreamLocationIdentifier, direction: options.DownstreamApproachDirection));

            result.ExistingTotalPAOG = (int)(Math.Round(result.ExistingTotalAOG / result.ExistingVolume, 2) * 100);
            result.PredictedTotalPAOG = (int)(Math.Round(result.PredictedTotalAOG / result.PredictedVolume, 2) * 100);

            return result;
        }

        private Approach GetApproachToAnalyze(Location location, string direction)
        {
            if (location == null)
            {
                return null;
            }

            Approach approachToAnalyze = null;
            var approaches = location.Approaches.Where(a => a.DirectionType.Description == direction).ToList();
            foreach (var approach in approaches)
                if (approach.GetDetectorsForMetricType(6).Count > 0)
                    approachToAnalyze = approach;
            return approachToAnalyze;
        }

        private async Task GeneratePcdAsync(LinkPivotPcdResult result, Approach approach, int delta, DateTime startDate, DateTime endDate, bool upstream)
        {
            try
            {
                var chartName = string.Empty;
                //find the upstream approach
                if (!string.IsNullOrEmpty(approach.DirectionType.Description))
                {
                    var logs = controllerEventLogRepository.GetEventsBetweenDates(approach.Location.LocationIdentifier, startDate, endDate).ToList();
                    var plans = logs.GetPlanEvents(startDate, endDate).ToList();
                    var lp = await locationPhaseService.GetLocationPhaseDataWithApproach(approach, startDate, endDate, 15, 13, logs, plans, true, null, 90);
                    var pcdOptions = new PurdueCoordinationDiagramOptions()
                    {
                        BinSize = 15,
                        GetVolume = true,
                        ShowPlanStatistics = true,
                        Start = startDate,
                        End = endDate,
                        LocationIdentifier = approach.Location.LocationIdentifier
                    };

                    result.pcdExisting.Add(ReportResult<PurdueCoordinationDiagramResult>.Success(purdueCoordinationDiagramService.GetChartData(pcdOptions, approach, lp)));

                    result.ExistingTotalAOG += lp.TotalArrivalOnGreen;
                    result.ExistingVolume += lp.TotalVolume;

                    locationPhaseService.LinkPivotAddSeconds(lp, upstream ? delta * -1 : delta);

                    pcdOptions.GetVolume = false;
                    result.pcdPredicted.Add(ReportResult<PurdueCoordinationDiagramResult>.Success(purdueCoordinationDiagramService.GetChartData(pcdOptions, approach, lp)));

                    result.PredictedTotalAOG += lp.TotalArrivalOnGreen;
                    result.PredictedVolume += lp.TotalVolume;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                AddPcdFailure(result, ReportErrorFactory.FromException(ex, nameof(LinkPivotPcdService), approach: approach, direction: approach?.DirectionType?.Description));
            }
        }

        private static void AddPcdFailure(LinkPivotPcdResult result, ReportError error)
        {
            var failure = ReportResult<PurdueCoordinationDiagramResult>.Failure(error);
            result.pcdExisting.Add(failure);
            result.pcdPredicted.Add(ReportResult<PurdueCoordinationDiagramResult>.Failure(error));
        }
    }
}
