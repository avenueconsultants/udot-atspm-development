#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.IncidentReconstruction/IncidentReconstructionResult.cs
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

using System.Text.Json.Serialization;
using Utah.Udot.Atspm.Business.Common;

namespace Utah.Udot.Atspm.Business.IncidentReconstruction
{
    /// <summary>
    /// What a signal head showed after a change.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum SignalIndication
    {
        Green,
        Yellow,
        RedClearance,
        Red,
        Walk,
        FlashingDontWalk,
        DontWalk
    }

    /// <summary>
    /// The kind of row a band draws on the incident timeline.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IncidentBandKind
    {
        Vehicle,
        Pedestrian,
        LocationWide
    }

    /// <summary>
    /// Signal states and controller events for one location around an incident.
    /// Times are controller clock time, to the tenth of a second.
    /// </summary>
    public class IncidentReconstructionResult : LocationResult
    {
        public IncidentReconstructionResult(string locationId, DateTime start, DateTime end) : base(locationId, start, end)
        {
        }

        /// <summary>
        /// Earliest time searched for the signal state in effect at <see cref="BaseResult.Start"/>.
        /// </summary>
        public DateTime LookbackStart { get; set; }

        public List<IncidentBand> Bands { get; set; } = new();

        public List<IncidentEvent> Events { get; set; } = new();
    }

    /// <summary>
    /// One timeline row: a vehicle phase or overlap, a pedestrian signal, or the location-wide row.
    /// </summary>
    public class IncidentBand
    {
        /// <summary>
        /// "phase-2", "overlap-1", "ped-2", "ped-overlap-1" or "location".
        /// </summary>
        public string Key { get; set; }

        public IncidentBandKind Kind { get; set; }

        public int? PhaseNumber { get; set; }

        public bool IsOverlap { get; set; }

        public string Label { get; set; }

        /// <summary>
        /// False when the band only exists because the controller logged events for a phase the configuration does not have.
        /// </summary>
        public bool IsConfigured { get; set; }

        /// <summary>
        /// For pedestrian bands, the vehicle band they sit under.
        /// </summary>
        public string VehicleBandKey { get; set; }

        /// <summary>
        /// The last change at or before the window start, with its real time, then every change inside the window.
        /// Empty when the band's state is unknown.
        /// </summary>
        public List<IncidentSignalChange> Changes { get; set; } = new();
    }

    public class IncidentSignalChange
    {
        public DateTime Timestamp { get; set; }

        public SignalIndication Indication { get; set; }

        public short EventCode { get; set; }
    }

    public class IncidentEvent
    {
        public DateTime Timestamp { get; set; }

        public short EventCode { get; set; }

        public string EventName { get; set; }

        public short EventParam { get; set; }

        /// <summary>
        /// What the parameter means, from the event's Indiana layer: "PhaseNumber", "DetectorChannel", "Preemption", "None" and so on.
        /// </summary>
        public string ParamType { get; set; }

        public string BandKey { get; set; }

        /// <summary>
        /// For detector events on an approach with a permissive phase, that phase's band.
        /// </summary>
        public string PermissiveBandKey { get; set; }

        public string ParameterDescription { get; set; }
    }
}
