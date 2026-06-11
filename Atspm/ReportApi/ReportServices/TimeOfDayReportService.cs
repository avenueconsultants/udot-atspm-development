#region license
// Copyright 2026 Utah Departement of Transportation
// for ReportApi - Utah.Udot.Atspm.ReportApi.ReportServices/TimeOfDayReportService.cs
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

using Utah.Udot.Atspm.Business.TimeOfDay;
using Utah.Udot.Atspm.Data.Enums;

namespace Utah.Udot.Atspm.ReportApi.ReportServices
{
    public class TimeOfDayReportService : ReportServiceBase<TimeOfDayOptions, TimeOfDayResult>
    {
        private const int PlanLookbackDays = 7;

        private readonly ILocationRepository locationRepository;
        private readonly IIndianaEventLogRepository eventLogRepository;
        private readonly IDetectorEventCountAggregationRepository detectorEventCountAggregationRepository;
        private readonly ISignalPlanAggregationRepository signalPlanAggregationRepository;
        private readonly TimeOfDayService timeOfDayService;

        public TimeOfDayReportService(
            ILocationRepository locationRepository,
            IIndianaEventLogRepository eventLogRepository,
            IDetectorEventCountAggregationRepository detectorEventCountAggregationRepository,
            ISignalPlanAggregationRepository signalPlanAggregationRepository,
            TimeOfDayService timeOfDayService)
        {
            this.locationRepository = locationRepository;
            this.eventLogRepository = eventLogRepository;
            this.detectorEventCountAggregationRepository = detectorEventCountAggregationRepository;
            this.signalPlanAggregationRepository = signalPlanAggregationRepository;
            this.timeOfDayService = timeOfDayService;
        }

        public override Task<TimeOfDayResult> ExecuteAsync(
            TimeOfDayOptions parameter,
            IProgress<int> progress = null,
            CancellationToken cancelToken = default)
        {
            if (parameter == null)
            {
                throw new ArgumentNullException(nameof(parameter));
            }

            Validate(parameter);

            var warnings = new List<TimeOfDayWarningDto>();
            var locationIdentifiers = parameter.LocationIdentifiers
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var selectedDates = parameter.SelectedDates
                .Distinct()
                .OrderBy(d => d)
                .ToList();

            if (selectedDates.Count != parameter.SelectedDates.Count)
            {
                warnings.Add(new TimeOfDayWarningDto
                {
                    Code = "DuplicateSelectedDates",
                    Message = "Duplicate selected dates were normalized to distinct local calendar dates."
                });
            }

            var firstDate = selectedDates[0].ToDateTime(TimeOnly.MinValue);
            var locations = LoadLocations(locationIdentifiers, firstDate);

            var locationData = locations
                .Select(location => LoadLocationData(parameter, location, selectedDates, warnings))
                .ToList();

            return Task.FromResult(timeOfDayService.GetChartData(
                parameter,
                locationIdentifiers,
                selectedDates,
                locationData,
                warnings));
        }

        private static void Validate(TimeOfDayOptions parameter)
        {
            if (parameter.LocationIdentifiers == null || parameter.LocationIdentifiers.All(string.IsNullOrWhiteSpace))
            {
                throw new ArgumentException("At least one location identifier is required.");
            }

            if (parameter.SelectedDates == null || parameter.SelectedDates.Count == 0)
            {
                throw new ArgumentException("At least one selected date is required.");
            }

            if (parameter.BinSizeMinutes != 15)
            {
                throw new ArgumentException("Time Of Day only supports a 15-minute bin size.");
            }

            if (parameter.LaneCapacityVehiclesPerHour <= 0)
            {
                throw new ArgumentException("Lane capacity must be greater than zero.");
            }
        }

        private IReadOnlyList<Location> LoadLocations(IReadOnlyList<string> locationIdentifiers, DateTime firstDate)
        {
            var locations = new List<Location>();
            foreach (var locationIdentifier in locationIdentifiers)
            {
                var location = locationRepository.GetLatestVersionOfLocation(locationIdentifier, firstDate);
                if (location == null)
                {
                    throw new NullReferenceException($"Location {locationIdentifier} not found");
                }

                locations.Add(location);
            }

            return locations;
        }

        private TimeOfDayLocationReportData LoadLocationData(
            TimeOfDayOptions options,
            Location location,
            IReadOnlyList<DateOnly> selectedDates,
            List<TimeOfDayWarningDto> warnings)
        {
            var data = new TimeOfDayLocationReportData
            {
                Location = location,
                LocationDescription = BuildLocationDescription(location)
            };

            foreach (var selectedDate in selectedDates)
            {
                var start = selectedDate.ToDateTime(TimeOnly.MinValue);
                var end = start.AddDays(1);

                if (options.DataSource == TimeOfDayDataSource.Aggregated)
                {
                    data.DetectorEventCountAggregations.AddRange(
                        detectorEventCountAggregationRepository.GetAggregationsBetweenDates(location.LocationIdentifier, start, end));
                    data.SignalPlanAggregations.AddRange(
                        signalPlanAggregationRepository.GetAggregationsBetweenDates(location.LocationIdentifier, start, end));
                }
                else
                {
                    var controllerEventLogs = eventLogRepository.GetEventsBetweenDates(location.LocationIdentifier, start.AddHours(-1), end.AddHours(1)).ToList();
                    data.IndianaEvents.AddRange(controllerEventLogs
                        .Where(e => e.EventCode == (short)IndianaEnumerations.VehicleDetectorOn));
                    data.IndianaPlanEvents.AddRange(controllerEventLogs
                        .Where(e => e.EventCode == (short)IndianaEnumerations.CoordPatternChange));
                }
            }

            return data;
        }

        private static string BuildLocationDescription(Location location)
        {
            return $"#{location.LocationIdentifier} - {location.PrimaryName} & {location.SecondaryName}";
        }
    }
}
