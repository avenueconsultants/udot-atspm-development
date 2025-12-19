#region license
// Copyright 2025 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.ArrivalOnRed/ArrivalOnRedService.cs
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

using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.Business.PrioritySummary
{
    public class PrioritySummaryService
    {

        //private readonly PlanService planService;

        public PrioritySummaryService() // PlanService planService)
        {
            //this.planService = planService;
        }

        public PrioritySummaryResult GetChartData(
            PrioritySummaryOptions options,
            //IReadOnlyList<IndianaEvent> planEvents,
            IReadOnlyList<IndianaEvent> events)
        {
            var checkInEvents = events.Where(row => row.EventCode == 112).Count();
            var checkOutEvents = events.Where(row => row.EventCode == 115).Count();
            var earlyGreensEvents = events.Where(row => row.EventCode == 113).Count();
            var extendedGreenEvents = events.Where(row => row.EventCode == 114).Count();

            var orderedEvents = events
                .OrderBy(e => e.Timestamp)
                .ToList();

            var durations = new List<TimeSpan>();
            DateTime? lastCheckIn = null;

            foreach (var e in orderedEvents)
            {
                if (e.EventCode == 112)
                {
                    // Always keep the most recent check-in
                    lastCheckIn = e.Timestamp;
                }
                else if (e.EventCode == 115 && lastCheckIn.HasValue)
                {
                    durations.Add(e.Timestamp - lastCheckIn.Value);
                    lastCheckIn = null; // reset so we don’t reuse the same 112
                }
            }

            var averageDuration = durations.Any()
                ? TimeSpan.FromTicks((long)durations.Average(d => d.Ticks))
                : TimeSpan.Zero;

            return new PrioritySummaryResult(
                "Priority Summary Service",
                options.LocationIdentifier,
                options.Start,
                options.End,
                averageDuration,
                checkInEvents,
                checkOutEvents,
                earlyGreensEvents,
                extendedGreenEvents,
                events.ToList()
                );
        }
    }
}