#region license
// Copyright 2026 Utah Departement of Transportation
// for ApplicationTests - Utah.Udot.Atspm.ApplicationTests.Business.IncidentReconstruction/IncidentReconstructionServiceTests.cs
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

using System;
using System.Collections.Generic;
using System.Linq;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Business.IncidentReconstruction;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Xunit;

namespace Utah.Udot.Atspm.ApplicationTests.Business.IncidentReconstruction
{
    public class IncidentReconstructionServiceTests
    {
        private static readonly DateTime Start = new(2026, 4, 14, 17, 42, 0);
        private static readonly DateTime End = Start.AddMinutes(1);

        [Fact]
        public void GetReport_LastChangeBeforeStart_KeepsItsRealTimestamp()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[]
            {
                Event(Start.AddSeconds(-40), 11, 2),
                Event(Start.AddMilliseconds(-9700), 1, 2),
                Event(Start.AddSeconds(20), 8, 2),
            };

            var band = Run(location, events).Bands.Single(b => b.Key == "phase-2");

            Assert.Equal(2, band.Changes.Count);
            Assert.Equal(Start.AddMilliseconds(-9700), band.Changes[0].Timestamp);
            Assert.Equal(SignalIndication.Green, band.Changes[0].Indication);
            Assert.Equal(SignalIndication.Yellow, band.Changes[1].Indication);
        }

        [Fact]
        public void GetReport_NoChangeInLookback_HasNoStartingChange()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[] { Event(Start.AddSeconds(10), 1, 2) };

            var band = Run(location, events).Bands.Single(b => b.Key == "phase-2");

            var change = Assert.Single(band.Changes);
            Assert.Equal(Start.AddSeconds(10), change.Timestamp);
        }

        [Fact]
        public void GetReport_ChangesAfterEnd_AreLeftOut()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[] { Event(Start.AddSeconds(10), 1, 2), Event(End.AddSeconds(1), 8, 2) };

            var band = Run(location, events).Bands.Single(b => b.Key == "phase-2");

            Assert.Single(band.Changes);
        }

        [Fact]
        public void GetReport_EndYellowAndBeginRedClearanceAtSameTenth_CollapseIntoOneRedClearance()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[]
            {
                Event(Start.AddSeconds(5), 8, 2),
                Event(Start.AddSeconds(9), 9, 2),
                Event(Start.AddSeconds(9), 10, 2),
                Event(Start.AddSeconds(11), 11, 2),
            };

            var band = Run(location, events).Bands.Single(b => b.Key == "phase-2");

            Assert.Equal(
                new[] { SignalIndication.Yellow, SignalIndication.RedClearance, SignalIndication.Red },
                band.Changes.Select(c => c.Indication));
            Assert.Equal(9, band.Changes[1].EventCode);
        }

        [Fact]
        public void GetReport_OverlapApproach_GetsOverlapBandWithOverlapChanges()
        {
            var approach = MakeApproach(DirectionTypes.EB, 1);
            approach.IsProtectedPhaseOverlap = true;
            var location = MakeLocation(approach);
            var events = new[]
            {
                Event(Start.AddSeconds(1), 61, 1),
                Event(Start.AddSeconds(5), 63, 1),
                Event(Start.AddSeconds(6), 1, 1),
            };

            var result = Run(location, events);

            var overlap = result.Bands.Single(b => b.Key == "overlap-1");
            Assert.True(overlap.IsOverlap);
            Assert.Equal(new[] { SignalIndication.Green, SignalIndication.Yellow }, overlap.Changes.Select(c => c.Indication));
            // Phase 1 is not configured; its own green makes a separate band.
            Assert.False(result.Bands.Single(b => b.Key == "phase-1").IsConfigured);
        }

        [Fact]
        public void GetReport_ConfiguredPushButtons_AddPedestrianBandUnderItsPhase()
        {
            var approach = MakeApproach(DirectionTypes.NB, 2);
            approach.PedestrianDetectors = "2";
            var location = MakeLocation(approach);

            var band = Run(location, new[] { Event(Start.AddSeconds(1), 82, 5) }).Bands.Single(b => b.Key == "ped-2");

            Assert.Equal(IncidentBandKind.Pedestrian, band.Kind);
            Assert.Equal("phase-2", band.VehicleBandKey);
            Assert.Equal("Pedestrian Phase 2 – NB", band.Label);
            Assert.Empty(band.Changes);
        }

        [Fact]
        public void GetReport_NoPedestrianPhaseNumber_AddsPedestrianBandOnlyWhereWalkEventsExist()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.SB, 1), MakeApproach(DirectionTypes.NB, 2));
            var events = new[]
            {
                Event(Start.AddMinutes(-3), 23, 2),
                Event(Start.AddSeconds(4), 21, 2),
                Event(Start.AddSeconds(11), 22, 2),
            };

            var result = Run(location, events);

            Assert.DoesNotContain(result.Bands, b => b.Key == "ped-1");
            var ped = result.Bands.Single(b => b.Key == "ped-2");
            Assert.Equal(
                new[] { SignalIndication.DontWalk, SignalIndication.Walk, SignalIndication.FlashingDontWalk },
                ped.Changes.Select(c => c.Indication));
        }

        [Fact]
        public void GetReport_PedestrianOverlap_UsesOverlapWalkCodes()
        {
            var approach = MakeApproach(DirectionTypes.NB, 2);
            approach.PedestrianPhaseNumber = 3;
            approach.IsPedestrianPhaseOverlap = true;
            var location = MakeLocation(approach);
            var events = new[] { Event(Start.AddSeconds(1), 67, 3), Event(Start.AddSeconds(2), 21, 3) };

            var result = Run(location, events);

            var ped = result.Bands.Single(b => b.Key == "ped-overlap-3");
            Assert.Equal("phase-2", ped.VehicleBandKey);
            Assert.Equal(SignalIndication.Walk, Assert.Single(ped.Changes).Indication);
            Assert.Equal(67, ped.Changes[0].EventCode);
        }

        [Fact]
        public void GetReport_PedestrianEvents_LandOnPedestrianBand_VehicleEventsOnVehicleBand()
        {
            var approach = MakeApproach(DirectionTypes.NB, 2);
            approach.PedestrianDetectors = "2,10";
            var location = MakeLocation(approach);
            var events = new[]
            {
                Event(Start.AddSeconds(1), 45, 2),
                Event(Start.AddSeconds(2), 43, 2),
                Event(Start.AddSeconds(3), 90, 10),
                Event(Start.AddSeconds(4), 90, 11),
            };

            var placed = Run(location, events).Events;

            Assert.Equal("ped-2", placed[0].BandKey);
            Assert.Equal("phase-2", placed[1].BandKey);
            Assert.Equal("ped-2", placed[2].BandKey);
            Assert.Equal("Push button 10", placed[2].ParameterDescription);
            Assert.Equal(IncidentReconstructionService.LocationBandKey, placed[3].BandKey);
            Assert.Equal("Push button 11 (not in configuration)", placed[3].ParameterDescription);
        }

        [Fact]
        public void GetReport_PedestrianEventWithoutPedestrianBand_FallsBackToVehicleBand()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.SB, 1));

            var placed = Assert.Single(Run(location, new[] { Event(Start.AddSeconds(1), 48, 1) }).Events);

            Assert.Equal("phase-1", placed.BandKey);
        }

        [Fact]
        public void GetReport_DetectorEvent_IsPlacedOnItsApproachPhaseAndDescribed()
        {
            var detector = new Detector
            {
                DetectorChannel = 13,
                LaneNumber = 2,
                MovementType = MovementTypes.T,
                DateAdded = new DateTime(2020, 1, 1),
                DetectionTypes = new List<DetectionType> { new() { Id = DetectionTypes.SBP } }
            };
            var location = MakeLocation(MakeApproach(DirectionTypes.EB, 4, detector), MakeApproach(DirectionTypes.NB, 2));

            var placed = Assert.Single(Run(location, new[] { Event(Start.AddSeconds(3), 82, 13) }).Events);

            Assert.Equal("phase-4", placed.BandKey);
            Assert.Null(placed.PermissiveBandKey);
            Assert.Equal("DetectorChannel", placed.ParamType);
            Assert.Equal("Detector 13 · EB Thru · Stop Bar Presence · Lane 2", placed.ParameterDescription);
        }

        [Fact]
        public void GetReport_DetectorChannelMissingFromConfiguration_GoesToLocationWide()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));

            var placed = Assert.Single(Run(location, new[] { Event(Start.AddSeconds(3), 82, 17) }).Events);

            Assert.Equal(IncidentReconstructionService.LocationBandKey, placed.BandKey);
            Assert.Equal("Detector channel 17 (not in configuration)", placed.ParameterDescription);
        }

        [Fact]
        public void GetReport_DetectorOnProtectedPermissiveApproach_ReturnsPermissiveBandKey()
        {
            var detector = new Detector { DetectorChannel = 5, MovementType = MovementTypes.L, DateAdded = new DateTime(2020, 1, 1) };
            var leftTurn = MakeApproach(DirectionTypes.SB, 1, detector);
            leftTurn.PermissivePhaseNumber = 6;
            var location = MakeLocation(leftTurn, MakeApproach(DirectionTypes.SB, 6));

            var result = Run(location, new[] { Event(Start.AddSeconds(3), 82, 5) });

            var placed = Assert.Single(result.Events);
            Assert.Equal("phase-1", placed.BandKey);
            Assert.Equal("phase-6", placed.PermissiveBandKey);
            Assert.Equal("Phase 6 – SB Left (permissive), SB", result.Bands.Single(b => b.Key == "phase-6").Label);
        }

        [Fact]
        public void GetReport_DetectorChannelReused_PrefersDetectorActiveInWindow()
        {
            var retired = new Detector { DetectorChannel = 7, DateAdded = new DateTime(2015, 1, 1), DateDisabled = new DateTime(2020, 1, 1) };
            var current = new Detector { DetectorChannel = 7, DateAdded = new DateTime(2020, 1, 1) };
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2, retired), MakeApproach(DirectionTypes.EB, 4, current));

            var placed = Assert.Single(Run(location, new[] { Event(Start.AddSeconds(3), 82, 7) }).Events);

            Assert.Equal("phase-4", placed.BandKey);
        }

        [Fact]
        public void GetReport_PhaseNotInConfiguration_GetsUnconfiguredBand()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));

            var result = Run(location, new[] { Event(Start.AddSeconds(3), 4, 9) });

            var band = result.Bands.Single(b => b.Key == "phase-9");
            Assert.False(band.IsConfigured);
            Assert.Equal("Phase 9 (not in configuration)", band.Label);
            Assert.Equal("phase-9", Assert.Single(result.Events).BandKey);
        }

        [Fact]
        public void GetReport_EventNames_ComeFromDisplayNamesWithFallback()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[] { Event(Start.AddSeconds(1), 82, 1), Event(Start.AddSeconds(2), 999, 3), Event(Start.AddSeconds(3), 102, 1) };

            var placed = Run(location, events).Events;

            Assert.Equal("Vehicle Detector On", placed[0].EventName);
            Assert.Equal("Event 999", placed[1].EventName);
            Assert.Equal("None", placed[1].ParamType);
            Assert.Equal("Parameter 3", placed[1].ParameterDescription);
            Assert.Equal(IncidentReconstructionService.LocationBandKey, placed[1].BandKey);
            Assert.Equal("Preempt 1", placed[2].ParameterDescription);
        }

        [Fact]
        public void GetReport_LookbackAcrossMidnight_KeepsPreviousDayChange()
        {
            var start = new DateTime(2026, 4, 15, 0, 0, 5);
            var options = Options(start, start.AddMinutes(1));
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[] { Event(new DateTime(2026, 4, 14, 23, 59, 50), 11, 2), Event(start.AddSeconds(30), 1, 2) };

            var band = Run(location, events, options).Bands.Single(b => b.Key == "phase-2");

            Assert.Equal(new DateTime(2026, 4, 14, 23, 59, 50), band.Changes[0].Timestamp);
            Assert.Equal(SignalIndication.Red, band.Changes[0].Indication);
        }

        [Fact]
        public void GetReport_Timestamps_AreRoundedToTheTenth()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[]
            {
                Event(Start.AddTicks(-1), 43, 2),
                Event(Start.AddMilliseconds(10300).AddTicks(-1), 1, 2),
            };

            var result = Run(location, events);

            Assert.Equal(new[] { Start, Start.AddMilliseconds(10300) }, result.Events.Select(e => e.Timestamp));
            Assert.Equal(Start.AddMilliseconds(10300), result.Bands.Single(b => b.Key == "phase-2").Changes[0].Timestamp);
        }

        [Fact]
        public void GetReport_EventsInWindow_AreSortedAndKeepLogOrderForTies()
        {
            var location = MakeLocation(MakeApproach(DirectionTypes.NB, 2));
            var events = new[]
            {
                Event(Start.AddSeconds(5), 82, 1),
                Event(Start.AddSeconds(2), 10, 2),
                Event(Start.AddSeconds(2), 9, 2),
                Event(Start.AddMinutes(-1), 82, 1),
            };

            var placed = Run(location, events).Events;

            Assert.Equal(new short[] { 10, 9, 82 }, placed.Select(e => e.EventCode));
        }

        [Fact]
        public void GetReport_Bands_AreOrderedPhaseThenItsPedestrianBandThenOverlapsThenLocationWide()
        {
            var phase4 = MakeApproach(DirectionTypes.EB, 4);
            var phase2 = MakeApproach(DirectionTypes.NB, 2);
            phase2.PedestrianDetectors = "2";
            var overlap = MakeApproach(DirectionTypes.WB, 1);
            overlap.IsProtectedPhaseOverlap = true;
            var location = MakeLocation(phase4, overlap, phase2);

            var result = Run(location, Array.Empty<IndianaEvent>());

            Assert.Equal(new[] { "phase-2", "ped-2", "phase-4", "overlap-1", "location" }, result.Bands.Select(b => b.Key));
            Assert.Equal("#7115 - Redwood Road & 7000 South", result.LocationDescription);
            Assert.Equal(Start.AddMinutes(-15), result.LookbackStart);
        }

        private static IncidentReconstructionResult Run(Location location, IEnumerable<IndianaEvent> events, IncidentReconstructionOptions options = null)
        {
            options ??= Options(Start, End);
            return new IncidentReconstructionService().GetReport(
                location,
                new PhaseService().GetPhases(location),
                events.ToList(),
                options,
                options.Start.AddMinutes(-15));
        }

        private static IncidentReconstructionOptions Options(DateTime start, DateTime end) =>
            new() { LocationIdentifier = "7115", Start = start, End = end };

        private static IndianaEvent Event(DateTime timestamp, short code, short param) =>
            new() { LocationIdentifier = "7115", Timestamp = timestamp, EventCode = code, EventParam = param };

        private static Approach MakeApproach(DirectionTypes direction, int phase, params Detector[] detectors) =>
            new()
            {
                DirectionTypeId = direction,
                DirectionType = new DirectionType { Id = direction, Abbreviation = direction.ToString() },
                ProtectedPhaseNumber = phase,
                Detectors = detectors.ToList()
            };

        private static Location MakeLocation(params Approach[] approaches)
        {
            var location = new Location { LocationIdentifier = "7115", PrimaryName = "Redwood Road", SecondaryName = "7000 South" };
            foreach (var approach in approaches)
            {
                approach.Location = location;
                location.Approaches.Add(approach);
            }
            return location;
        }
    }
}
