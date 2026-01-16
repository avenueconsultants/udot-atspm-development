#region license
// Copyright 2025 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Configuration/WatchdogConfiguration.cs
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

namespace Utah.Udot.Atspm.Infrastructure.Configuration
{
    public class WatchdogConfiguration
    {
        public DateTime PmScanDate { get; set; } = DateTime.Today.AddDays(-1);
        public DateTime AmScanDate { get; set; } = DateTime.Today;
        public DateTime RampMainlineLastRunStartScanDate { get; set; } = DateTime.Today.AddDays(-1);
        public DateTime RampMainlineLastRunEndScanDate { get; set; } = DateTime.Today;
        public int AmStartHour { get; set; } = 1;
        public int AmEndHour { get; set; } = 5;
        public int PmPeakStartHour { get; set; } = 18;
        public int PmPeakEndHour { get; set; } = 17;
        public int RampDetectorStartHour { get; set; } = 7;
        public int RampDetectorEndHour { get; set; } = 8;
        public int RampMainLineLastRunStartHour { get; set; } = 15;
        public int RampMainLineLastRunEndHour { get; set; } = 7;
        public int RampMainlineStartHour { get; set; } = 15;
        public int RampMainlineEndHour { get; set; } = 19;
        public int RampStuckQueueStartHour { get; set; } = 1;
        public int RampStuckQueueEndHour { get; set; } = 4;
        public bool WeekdayOnly { get; set; } = true;
        public int ConsecutiveCount { get; set; } = 3;
        public int MinPhaseTerminations { get; set; } = 50;
        public double PercentThreshold { get; set; } = .9;
        public int MinimumRecords { get; set; } = 500;
        public int LowHitThreshold { get; set; } = 50;
        public int LowHitRampThreshold { get; set; } = 10;
        public int MaximumPedestrianEvents { get; set; } = 200;
        public int RampMissedEventsThreshold { get; set; } = 3;

        public bool EmailAllErrors { get; set; }
        public bool OnlyRampEmail { get; set; } = false;
        public string DefaultEmailAddress { get; set; }



        public DateTime AmAnalysisStart => AmScanDate.Date + new TimeSpan(AmStartHour, 0, 0);
        public DateTime AmAnalysisEnd => AmScanDate.Date + new TimeSpan(AmEndHour, 0, 0);
        public DateTime PmAnalysisStart => PmScanDate.Date + new TimeSpan(PmPeakStartHour, 0, 0);
        public DateTime PmAnalysisEnd => PmScanDate.Date + new TimeSpan(PmPeakEndHour, 0, 0);
        public DateTime RampDetectorStart => PmScanDate.Date + new TimeSpan(RampDetectorStartHour, 0, 0);
        public DateTime RampDetectorEnd => PmScanDate.Date + new TimeSpan(RampStuckQueueStartHour, 0, 0);
        public DateTime RampMainLineLastRunStart => RampMainlineLastRunStartScanDate.Date + new TimeSpan(RampMainLineLastRunStartHour, 0, 0);
        public DateTime RampMainLineLastRunEnd => RampMainlineLastRunEndScanDate.Date + new TimeSpan(RampMainLineLastRunEndHour, 0, 0);

        public string Sort { get; set; }
    }
}
