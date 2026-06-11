#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeOfDay/TimeOfDayThresholdOptions.cs
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
namespace Utah.Udot.Atspm.Business.TimeOfDay
{
    public class TimeOfDayThresholdOptions
    {
        public string ConfigurationName { get; set; } = "Default";
        public string AlgorithmVersion { get; set; } = "tod-v1";
        public double AmEntryPctOfPeak { get; set; } = 0.55;
        public double AmExitPctOfPeak { get; set; } = 0.40;
        public double PmEntryPctOfPeak { get; set; } = 0.55;
        public double PmExitPctOfPeak { get; set; } = 0.40;
        public double FreeEntryPctOfDailyPeak { get; set; } = 0.25;
        public double FreeEntryPctOfDynamicRange { get; set; } = 0.20;
        public int EntrySustainedBins { get; set; } = 2;
        public int FreeSustainedBins { get; set; } = 3;
        public string FreeFallbackTime { get; set; } = "22:00";
        public string MaxAmEndTime { get; set; } = "11:00";
        public string MaxPmEndTime { get; set; } = "19:00";
        public double SplitReviewThresholdPercent { get; set; } = 35;
        public double ShoulderReviewThresholdPercent { get; set; } = 45;
    }
}
