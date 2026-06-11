#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Models.MeasureOptions/TimeOfDayOptions.cs
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

namespace Utah.Udot.Atspm.Data.Models.MeasureOptions
{
    public class TimeOfDayOptions
    {
        public List<string> LocationIdentifiers { get; set; } = new();
        public List<DateOnly> SelectedDates { get; set; } = new();
        public int BinSizeMinutes { get; set; } = 15;
        public TimeOfDayDataSource DataSource { get; set; } = TimeOfDayDataSource.IndianaEvents;
        public List<string> AllDayPrimaryDirections { get; set; } = new();
        public List<string> AmPrimaryDirections { get; set; } = new();
        public List<string> PmPrimaryDirections { get; set; } = new();
        public double LaneCapacityVehiclesPerHour { get; set; } = 800;
        public Dictionary<string, double> DirectionLaneCounts { get; set; } = new();
    }

    public enum TimeOfDayDataSource
    {
        IndianaEvents,
        Aggregated
    }
}
