#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.IncidentReconstruction/IncidentReconstructionService.cs
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

using System.ComponentModel.DataAnnotations;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.TempExtensions;
using Utah.Udot.NetStandardToolkit.Extensions;

namespace Utah.Udot.Atspm.Business.IncidentReconstruction
{
    /// <summary>
    /// Builds the incident reconstruction timeline: one band per phase, overlap and pedestrian signal,
    /// a location-wide band, and every controller event in the window placed on its band.
    /// </summary>
    public class IncidentReconstructionService
    {
        public const string LocationBandKey = "location";

        private static readonly Dictionary<short, SignalIndication> PhaseChangeCodes = new()
        {
            { 1, SignalIndication.Green },
            { 8, SignalIndication.Yellow },
            { 9, SignalIndication.RedClearance },
            { 10, SignalIndication.RedClearance },
            { 11, SignalIndication.Red },
        };

        private static readonly Dictionary<short, SignalIndication> OverlapChangeCodes = new()
        {
            { 61, SignalIndication.Green },
            { 62, SignalIndication.Green },
            { 63, SignalIndication.Yellow },
            { 64, SignalIndication.RedClearance },
            { 65, SignalIndication.Red },
        };

        private static readonly Dictionary<short, SignalIndication> PedestrianPhaseChangeCodes = new()
        {
            { 21, SignalIndication.Walk },
            { 22, SignalIndication.FlashingDontWalk },
            { 23, SignalIndication.DontWalk },
        };

        private static readonly Dictionary<short, SignalIndication> PedestrianOverlapChangeCodes = new()
        {
            { 67, SignalIndication.Walk },
            { 68, SignalIndication.FlashingDontWalk },
            { 69, SignalIndication.DontWalk },
        };

        // Phase-numbered events that belong to the phase's pedestrian signal rather than its vehicle signal.
        private static readonly HashSet<short> PedestrianPhaseEventCodes = new() { 21, 22, 23, 24, 25, 26, 45, 48, 49 };

        // Overlap-numbered events that belong to the overlap's pedestrian signal.
        private static readonly HashSet<short> PedestrianOverlapEventCodes = new() { 67, 68, 69, 70 };

        private static readonly Dictionary<short, (string Name, IndianaEventParamType ParamType)> EventCatalog = BuildEventCatalog();

        /// <summary>
        /// Builds the timeline.
        /// </summary>
        /// <param name="location">Location configuration in effect on the incident date.</param>
        /// <param name="phases">Phases from <see cref="PhaseService.GetPhases(Location)"/>.</param>
        /// <param name="events">Controller events from <paramref name="lookbackStart"/> to the window end.</param>
        /// <param name="options">The window.</param>
        /// <param name="lookbackStart">How far back <paramref name="events"/> reaches, for the starting signal state.</param>
        public IncidentReconstructionResult GetReport(
            Location location,
            IReadOnlyList<PhaseDetail> phases,
            IReadOnlyList<IndianaEvent> events,
            IncidentReconstructionOptions options,
            DateTime lookbackStart)
        {
            // Controllers log tenths of a second; the decoder leaves floating-point residue such as 17:28:42.2999999.
            var orderedEvents = events
                .Select(e => new IndianaEvent
                {
                    LocationIdentifier = e.LocationIdentifier,
                    Timestamp = RoundToTenth(e.Timestamp),
                    EventCode = e.EventCode,
                    EventParam = e.EventParam
                })
                .OrderBy(e => e.Timestamp)
                .ToList();
            var windowEvents = orderedEvents.Where(e => e.Timestamp >= options.Start && e.Timestamp <= options.End).ToList();

            var bands = new BandSet();
            AddConfiguredVehicleBands(bands, phases);
            AddConfiguredPedestrianBands(bands, location, orderedEvents);
            AddUnconfiguredBands(bands, orderedEvents, windowEvents);

            foreach (var band in bands.All)
            {
                band.Changes = GetChanges(band, orderedEvents, options);
            }

            var detectors = (location.Approaches ?? Enumerable.Empty<Approach>())
                .SelectMany(a => (a.Detectors ?? Enumerable.Empty<Detector>()).Select(d => (Detector: d, Approach: a)))
                .ToList();

            var result = new IncidentReconstructionResult(location.LocationIdentifier, options.Start, options.End)
            {
                LocationDescription = location.LocationDescription(),
                LookbackStart = lookbackStart,
                Bands = bands.Ordered(),
                Events = windowEvents.Select(e => ToIncidentEvent(e, location, detectors, bands, options)).ToList(),
                Approaches = (location.Approaches ?? Enumerable.Empty<Approach>())
                    .Select(a => ToIncidentApproach(a, bands, options))
                    .ToList()
            };
            return result;
        }

        private static IncidentApproach ToIncidentApproach(Approach approach, BandSet bands, IncidentReconstructionOptions options)
        {
            var pedPhase = approach.PedestrianPhaseNumber ?? approach.ProtectedPhaseNumber;
            return new IncidentApproach
            {
                Description = approach.Description,
                Direction = approach.DirectionTypeId.ToString(),
                ProtectedBandKey = approach.ProtectedPhaseNumber > 0
                    ? KeyInReport(bands, VehicleBandKey(approach.IsProtectedPhaseOverlap, approach.ProtectedPhaseNumber))
                    : null,
                PermissiveBandKey = approach.PermissivePhaseNumber > 0
                    ? KeyInReport(bands, VehicleBandKey(approach.IsPermissivePhaseOverlap, approach.PermissivePhaseNumber.Value))
                    : null,
                PedestrianBandKey = pedPhase > 0
                    ? KeyInReport(bands, PedestrianBandKey(approach.IsPedestrianPhaseOverlap, pedPhase))
                    : null,
                SignalHeadType = approach.GetSignalHeadType().ToString(),
                Detectors = (approach.Detectors ?? Enumerable.Empty<Detector>())
                    .Where(d => InServiceDuring(d, options))
                    .OrderBy(d => d.DetectorChannel)
                    .Select(d => new IncidentDetector
                    {
                        Channel = d.DetectorChannel,
                        LaneNumber = d.LaneNumber,
                        MovementType = d.MovementType.ToString(),
                        LaneType = d.LaneType.ToString(),
                        DistanceFromStopBar = d.DistanceFromStopBar,
                        DetectionTypes = (d.DetectionTypes ?? Enumerable.Empty<DetectionType>())
                            .Select(t => t.Id)
                            .Where(t => t != DetectionTypes.NA)
                            .Distinct()
                            .OrderBy(t => t)
                            .Select(t => t.ToString())
                            .ToList(),
                        LatencyCorrection = d.LatencyCorrection
                    })
                    .ToList()
            };
        }

        private static string KeyInReport(BandSet bands, string key) => bands.Contains(key) ? key : null;

        private static bool InServiceDuring(Detector detector, IncidentReconstructionOptions options) =>
            detector.DateAdded <= options.End && (detector.DateDisabled == null || detector.DateDisabled > options.Start);

        private static void AddConfiguredVehicleBands(BandSet bands, IReadOnlyList<PhaseDetail> phases)
        {
            foreach (var group in phases.Where(p => p.PhaseNumber > 0).GroupBy(p => (p.UseOverlap, p.PhaseNumber)))
            {
                var movements = group
                    .Select(DescribePhaseApproach)
                    .Where(d => !string.IsNullOrEmpty(d))
                    .Distinct()
                    .ToList();
                var name = VehicleBandName(group.Key.UseOverlap, group.Key.PhaseNumber);
                bands.Add(new IncidentBand
                {
                    Key = VehicleBandKey(group.Key.UseOverlap, group.Key.PhaseNumber),
                    Kind = IncidentBandKind.Vehicle,
                    PhaseNumber = group.Key.PhaseNumber,
                    IsOverlap = group.Key.UseOverlap,
                    Label = movements.Count > 0 ? $"{name} – {string.Join(", ", movements)}" : name,
                    IsConfigured = true
                });
            }
        }

        private static void AddConfiguredPedestrianBands(BandSet bands, Location location, List<IndianaEvent> events)
        {
            foreach (var approach in location.Approaches ?? Enumerable.Empty<Approach>())
            {
                var pedPhase = approach.PedestrianPhaseNumber ?? approach.ProtectedPhaseNumber;
                if (pedPhase <= 0)
                {
                    continue;
                }

                var isOverlap = approach.IsPedestrianPhaseOverlap;
                var key = PedestrianBandKey(isOverlap, pedPhase);
                if (bands.Contains(key))
                {
                    continue;
                }

                // Without a pedestrian phase number the vehicle phase stands in, which also covers left-turn
                // phases that have no pedestrian signal, so without configured push buttons the band needs
                // walk or don't-walk events in the log.
                var intervalCodes = isOverlap ? PedestrianOverlapChangeCodes : PedestrianPhaseChangeCodes;
                var hasPedestrianSignal = !string.IsNullOrWhiteSpace(approach.PedestrianDetectors)
                    || events.Any(e => e.EventParam == pedPhase && intervalCodes.ContainsKey(e.EventCode));
                if (!hasPedestrianSignal)
                {
                    continue;
                }

                var direction = DirectionAbbreviation(approach);
                var name = PedestrianBandName(isOverlap, pedPhase);
                bands.Add(new IncidentBand
                {
                    Key = key,
                    Kind = IncidentBandKind.Pedestrian,
                    PhaseNumber = pedPhase,
                    IsOverlap = isOverlap,
                    Label = string.IsNullOrEmpty(direction) ? name : $"{name} – {direction}",
                    IsConfigured = true,
                    VehicleBandKey = approach.ProtectedPhaseNumber > 0
                        ? VehicleBandKey(approach.IsProtectedPhaseOverlap, approach.ProtectedPhaseNumber)
                        : null
                });
            }
        }

        /// <summary>
        /// Adds bands for phases and overlaps the controller logged signal changes or window events for
        /// but the configuration does not list.
        /// </summary>
        private static void AddUnconfiguredBands(BandSet bands, List<IndianaEvent> allEvents, List<IndianaEvent> windowEvents)
        {
            var referenced = allEvents.Where(IsSignalChange).Concat(windowEvents)
                .Where(e => e.EventParam > 0)
                .Select(e => (Event: e, ParamType: GetParamType(e.EventCode)))
                .Where(r => r.ParamType == IndianaEventParamType.PhaseNumber
                    || r.ParamType == IndianaEventParamType.FYA
                    || r.ParamType == IndianaEventParamType.Overlap)
                .ToList();

            // Pedestrian signal changes first, so pedestrian calls and omits for those phases land on them.
            foreach (var (e, paramType) in referenced)
            {
                var isOverlap = paramType == IndianaEventParamType.Overlap;
                var intervalCodes = isOverlap ? PedestrianOverlapChangeCodes : PedestrianPhaseChangeCodes;
                if (intervalCodes.ContainsKey(e.EventCode))
                {
                    EnsureUnconfiguredBand(bands, IncidentBandKind.Pedestrian, isOverlap, e.EventParam);
                }
            }

            foreach (var (e, paramType) in referenced)
            {
                var isOverlap = paramType == IndianaEventParamType.Overlap;
                var pedestrianCodes = isOverlap ? PedestrianOverlapEventCodes : PedestrianPhaseEventCodes;
                if (!pedestrianCodes.Contains(e.EventCode) || !bands.Contains(PedestrianBandKey(isOverlap, e.EventParam)))
                {
                    EnsureUnconfiguredBand(bands, IncidentBandKind.Vehicle, isOverlap, e.EventParam);
                }
            }

            foreach (var band in bands.All.Where(b => b.Kind == IncidentBandKind.Pedestrian && !b.IsConfigured))
            {
                var vehicleKey = VehicleBandKey(band.IsOverlap, band.PhaseNumber.Value);
                band.VehicleBandKey = bands.Contains(vehicleKey) ? vehicleKey : null;
            }
        }

        private static void EnsureUnconfiguredBand(BandSet bands, IncidentBandKind kind, bool isOverlap, int number)
        {
            var isPedestrian = kind == IncidentBandKind.Pedestrian;
            var key = isPedestrian ? PedestrianBandKey(isOverlap, number) : VehicleBandKey(isOverlap, number);
            if (bands.Contains(key))
            {
                return;
            }

            var name = isPedestrian ? PedestrianBandName(isOverlap, number) : VehicleBandName(isOverlap, number);
            bands.Add(new IncidentBand
            {
                Key = key,
                Kind = kind,
                PhaseNumber = number,
                IsOverlap = isOverlap,
                Label = $"{name} (not in configuration)",
                IsConfigured = false
            });
        }

        /// <summary>
        /// The last change at or before the window start (real time, not clipped), then every change in the window.
        /// Consecutive changes to the same indication collapse into the first.
        /// </summary>
        private static List<IncidentSignalChange> GetChanges(IncidentBand band, List<IndianaEvent> orderedEvents, IncidentReconstructionOptions options)
        {
            var codes = ChangeCodesFor(band);
            if (codes == null)
            {
                return new List<IncidentSignalChange>();
            }

            var collapsed = new List<IncidentSignalChange>();
            foreach (var e in orderedEvents)
            {
                if (e.EventParam != band.PhaseNumber || !codes.TryGetValue(e.EventCode, out var indication) || e.Timestamp > options.End)
                {
                    continue;
                }

                if (collapsed.Count > 0 && collapsed[^1].Indication == indication)
                {
                    continue;
                }

                collapsed.Add(new IncidentSignalChange { Timestamp = e.Timestamp, Indication = indication, EventCode = e.EventCode });
            }

            var startIndex = collapsed.FindLastIndex(c => c.Timestamp <= options.Start);
            return startIndex < 0 ? collapsed : collapsed.GetRange(startIndex, collapsed.Count - startIndex);
        }

        private static Dictionary<short, SignalIndication> ChangeCodesFor(IncidentBand band) => band.Kind switch
        {
            IncidentBandKind.Vehicle => band.IsOverlap ? OverlapChangeCodes : PhaseChangeCodes,
            IncidentBandKind.Pedestrian => band.IsOverlap ? PedestrianOverlapChangeCodes : PedestrianPhaseChangeCodes,
            _ => null
        };

        private static IncidentEvent ToIncidentEvent(IndianaEvent e, Location location, List<(Detector Detector, Approach Approach)> detectors, BandSet bands, IncidentReconstructionOptions options)
        {
            var paramType = GetParamType(e.EventCode);
            var result = new IncidentEvent
            {
                Timestamp = e.Timestamp,
                EventCode = e.EventCode,
                EventName = GetEventName(e.EventCode),
                EventParam = e.EventParam,
                ParamType = paramType.ToString(),
                BandKey = LocationBandKey,
                ParameterDescription = "—"
            };

            switch (paramType)
            {
                case IndianaEventParamType.PhaseNumber:
                case IndianaEventParamType.FYA:
                    result.BandKey = PhaseOrPedestrianBand(bands, false, e.EventParam, PedestrianPhaseEventCodes.Contains(e.EventCode));
                    break;

                case IndianaEventParamType.Overlap:
                    result.BandKey = PhaseOrPedestrianBand(bands, true, e.EventParam, PedestrianOverlapEventCodes.Contains(e.EventCode));
                    break;

                case IndianaEventParamType.DetectorChannel:
                    PlaceDetectorEvent(result, detectors, bands, options);
                    break;

                case IndianaEventParamType.PedDetectorChannel:
                    PlacePushButtonEvent(result, location, bands);
                    break;

                case IndianaEventParamType.Preemption:
                    result.ParameterDescription = $"Preempt {e.EventParam}";
                    break;

                case IndianaEventParamType.TSP:
                    result.ParameterDescription = $"Priority {e.EventParam}";
                    break;

                case IndianaEventParamType.Barrier:
                    result.ParameterDescription = $"Barrier {e.EventParam}";
                    break;

                default:
                    result.ParameterDescription = $"Parameter {e.EventParam}";
                    break;
            }

            return result;
        }

        private static string PhaseOrPedestrianBand(BandSet bands, bool isOverlap, int number, bool isPedestrianEvent)
        {
            if (isPedestrianEvent && bands.Contains(PedestrianBandKey(isOverlap, number)))
            {
                return PedestrianBandKey(isOverlap, number);
            }

            var vehicleKey = VehicleBandKey(isOverlap, number);
            return bands.Contains(vehicleKey) ? vehicleKey : LocationBandKey;
        }

        private static void PlaceDetectorEvent(IncidentEvent result, List<(Detector Detector, Approach Approach)> detectors, BandSet bands, IncidentReconstructionOptions options)
        {
            var onChannel = detectors.Where(d => d.Detector.DetectorChannel == result.EventParam).ToList();
            if (onChannel.Count == 0)
            {
                result.ParameterDescription = $"Detector channel {result.EventParam} (not in configuration)";
                return;
            }

            // Prefer the detector that was active during the window when a channel was reused.
            var (detector, approach) = onChannel
                .Where(d => InServiceDuring(d.Detector, options))
                .DefaultIfEmpty(onChannel[0])
                .First();
            result.ParameterDescription = DescribeDetector(detector, approach);

            var protectedKey = approach.ProtectedPhaseNumber > 0
                ? VehicleBandKey(approach.IsProtectedPhaseOverlap, approach.ProtectedPhaseNumber)
                : null;
            var permissiveKey = approach.PermissivePhaseNumber > 0
                ? VehicleBandKey(approach.IsPermissivePhaseOverlap, approach.PermissivePhaseNumber.Value)
                : null;

            if (protectedKey != null && bands.Contains(protectedKey))
            {
                result.BandKey = protectedKey;
                if (permissiveKey != null && permissiveKey != protectedKey && bands.Contains(permissiveKey))
                {
                    result.PermissiveBandKey = permissiveKey;
                }
            }
            else if (permissiveKey != null && bands.Contains(permissiveKey))
            {
                result.BandKey = permissiveKey;
            }
        }

        private static void PlacePushButtonEvent(IncidentEvent result, Location location, BandSet bands)
        {
            // An approach that lists its push buttons wins over one that only falls back to its phase number.
            var approaches = location.Approaches ?? Enumerable.Empty<Approach>();
            var approach = approaches.FirstOrDefault(a => !string.IsNullOrWhiteSpace(a.PedestrianDetectors) && PedestrianDetectorChannels(a).Contains(result.EventParam))
                ?? approaches.FirstOrDefault(a => PedestrianDetectorChannels(a).Contains(result.EventParam));
            if (approach == null)
            {
                result.ParameterDescription = $"Push button {result.EventParam} (not in configuration)";
                return;
            }

            result.ParameterDescription = $"Push button {result.EventParam}";

            var pedPhase = approach.PedestrianPhaseNumber ?? approach.ProtectedPhaseNumber;
            var pedKey = PedestrianBandKey(approach.IsPedestrianPhaseOverlap, pedPhase);
            var vehicleKey = VehicleBandKey(approach.IsProtectedPhaseOverlap, approach.ProtectedPhaseNumber);
            if (bands.Contains(pedKey))
            {
                result.BandKey = pedKey;
            }
            else if (bands.Contains(vehicleKey))
            {
                result.BandKey = vehicleKey;
            }
        }

        /// <summary>
        /// Same rule as <see cref="ApproachExtensions.GetPedDetectorsFromApproach(Approach)"/>, but skips entries that are not numbers
        /// instead of failing the report.
        /// </summary>
        private static List<int> PedestrianDetectorChannels(Approach approach)
        {
            if (string.IsNullOrWhiteSpace(approach.PedestrianDetectors))
            {
                return new List<int> { approach.ProtectedPhaseNumber };
            }

            return approach.PedestrianDetectors
                .Split(new[] { ',', '-' })
                .Select(s => int.TryParse(s, out var channel) ? channel : (int?)null)
                .Where(c => c.HasValue)
                .Select(c => c.Value)
                .ToList();
        }

        private static string DescribeDetector(Detector detector, Approach approach)
        {
            var parts = new List<string> { $"Detector {detector.DetectorChannel}" };

            var direction = DirectionAbbreviation(approach);
            var movement = detector.MovementType != MovementTypes.NA ? detector.MovementType.GetDisplayName() : null;
            var where = string.Join(" ", new[] { direction, movement }.Where(s => !string.IsNullOrEmpty(s)));
            if (!string.IsNullOrEmpty(where))
            {
                parts.Add(where);
            }

            var detectionTypes = detector.DetectionTypes?
                .Select(t => t.Id)
                .Where(t => t != DetectionTypes.NA)
                .OrderBy(t => t)
                .Select(t => t.GetDisplayName())
                .ToList();
            if (detectionTypes?.Count > 0)
            {
                parts.Add(string.Join(", ", detectionTypes));
            }

            if (detector.LaneNumber.HasValue)
            {
                parts.Add($"Lane {detector.LaneNumber}");
            }

            return string.Join(" · ", parts);
        }

        private static string DescribePhaseApproach(PhaseDetail phase)
        {
            var direction = DirectionAbbreviation(phase.Approach);
            var movements = phase.Approach.Detectors?
                .Select(d => d.MovementType)
                .Where(m => m != MovementTypes.NA)
                .Distinct()
                .OrderBy(m => m.GetAttributeOfType<DisplayAttribute>()?.Order ?? int.MaxValue)
                .Select(m => m.GetDisplayName())
                .ToList() ?? new List<string>();
            var text = string.Join(" ", new[] { direction, string.Join("/", movements) }.Where(s => !string.IsNullOrEmpty(s)));
            if (string.IsNullOrEmpty(text))
            {
                return null;
            }
            return phase.IsPermissivePhase ? $"{text} (permissive)" : text;
        }

        private static string DirectionAbbreviation(Approach approach)
        {
            if (!string.IsNullOrWhiteSpace(approach.DirectionType?.Abbreviation))
            {
                return approach.DirectionType.Abbreviation;
            }
            return approach.DirectionTypeId != DirectionTypes.NA ? approach.DirectionTypeId.ToString() : null;
        }

        private static DateTime RoundToTenth(DateTime time)
        {
            const long ticksPerTenth = TimeSpan.TicksPerSecond / 10;
            return new DateTime((time.Ticks + ticksPerTenth / 2) / ticksPerTenth * ticksPerTenth, time.Kind);
        }

        private static bool IsSignalChange(IndianaEvent e) =>
            PhaseChangeCodes.ContainsKey(e.EventCode)
            || OverlapChangeCodes.ContainsKey(e.EventCode)
            || PedestrianPhaseChangeCodes.ContainsKey(e.EventCode)
            || PedestrianOverlapChangeCodes.ContainsKey(e.EventCode);

        private static string VehicleBandKey(bool isOverlap, int number) => isOverlap ? $"overlap-{number}" : $"phase-{number}";

        private static string PedestrianBandKey(bool isOverlap, int number) => isOverlap ? $"ped-overlap-{number}" : $"ped-{number}";

        private static string VehicleBandName(bool isOverlap, int number) => isOverlap ? $"Overlap {number}" : $"Phase {number}";

        private static string PedestrianBandName(bool isOverlap, int number) => isOverlap ? $"Pedestrian Overlap {number}" : $"Pedestrian Phase {number}";

        private static string GetEventName(short code) =>
            EventCatalog.TryGetValue(code, out var entry) && !string.IsNullOrEmpty(entry.Name) ? entry.Name : $"Event {code}";

        private static IndianaEventParamType GetParamType(short code) =>
            EventCatalog.TryGetValue(code, out var entry) ? entry.ParamType : IndianaEventParamType.None;

        private static Dictionary<short, (string Name, IndianaEventParamType ParamType)> BuildEventCatalog()
        {
            var catalog = new Dictionary<short, (string, IndianaEventParamType)>();
            foreach (var value in Enum.GetValues<IndianaEnumerations>())
            {
                catalog.TryAdd((short)value, (
                    value.GetAttributeOfType<DisplayAttribute>()?.Name,
                    value.GetAttributeOfType<IndianaEventLayerAttribute>()?.IndianaEventParamType ?? IndianaEventParamType.None));
            }
            return catalog;
        }

        /// <summary>
        /// Bands by key, ordered for display: each phase, then its pedestrian bands, then overlaps, and the location-wide band last.
        /// </summary>
        private class BandSet
        {
            private readonly Dictionary<string, IncidentBand> _bands = new();

            public IEnumerable<IncidentBand> All => _bands.Values;

            public bool Contains(string key) => _bands.ContainsKey(key);

            public void Add(IncidentBand band) => _bands.Add(band.Key, band);

            public List<IncidentBand> Ordered()
            {
                var vehicles = _bands.Values
                    .Where(b => b.Kind == IncidentBandKind.Vehicle)
                    .OrderBy(b => b.IsOverlap)
                    .ThenBy(b => b.PhaseNumber)
                    .ToList();
                var pedestrians = _bands.Values
                    .Where(b => b.Kind == IncidentBandKind.Pedestrian)
                    .OrderBy(b => b.IsOverlap)
                    .ThenBy(b => b.PhaseNumber)
                    .ToList();

                var ordered = new List<IncidentBand>();
                foreach (var vehicle in vehicles)
                {
                    ordered.Add(vehicle);
                    ordered.AddRange(pedestrians.Where(p => p.VehicleBandKey == vehicle.Key));
                }
                ordered.AddRange(pedestrians.Where(p => p.VehicleBandKey == null || !_bands.ContainsKey(p.VehicleBandKey)));
                ordered.Add(new IncidentBand
                {
                    Key = LocationBandKey,
                    Kind = IncidentBandKind.LocationWide,
                    Label = "Location-wide",
                    IsConfigured = true
                });
                return ordered;
            }
        }
    }
}
