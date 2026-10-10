#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Models.EventLogModels/BluebandLidarEvent.cs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
#endregion

using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

#nullable disable

namespace Utah.Udot.Atspm.Data.Models.EventLogModels
{
    /// <summary>
    /// Event returned by the BlueBand SPM+ events API.
    /// Common scalar fields are promoted for querying while vendor-specific and
    /// nested fields are retained in <see cref="AdditionalData"/>.
    /// </summary>
    public class BluebandLidarEvent : EventLogModelBase
    {
        /// <summary>
        /// BlueBand event identifier (for example 1002 for a detector-state event).
        /// </summary>
        [JsonProperty("id")]
        public int EventId { get; set; }

        /// <summary>
        /// Original Unix epoch timestamp from the device, in milliseconds.
        /// </summary>
        [JsonProperty("date")]
        public long SourceTimestampMilliseconds { get; set; }

        /// <summary>
        /// Optional event duration supplied by BlueBand, in milliseconds.
        /// </summary>
        [JsonProperty("duration")]
        public int? DurationMilliseconds { get; set; }

        /// <summary>
        /// Optional detector channel associated with the event.
        /// </summary>
        [JsonProperty("detector")]
        public int? Detector { get; set; }

        /// <summary>
        /// Optional signal phase associated with the event.
        /// </summary>
        [JsonProperty("phase")]
        public int? Phase { get; set; }

        /// <summary>
        /// Optional signal ring associated with the event.
        /// </summary>
        [JsonProperty("ring")]
        public int? Ring { get; set; }

        /// <summary>
        /// Optional BlueBand incident identifier.
        /// </summary>
        [JsonProperty("incident")]
        public long? Incident { get; set; }

        /// <summary>
        /// Optional cardinal travel heading (for example, nb or sw).
        /// </summary>
        [JsonProperty("heading")]
        public string Heading { get; set; }

        /// <summary>
        /// Optional lane name supplied by the LiDAR unit.
        /// </summary>
        [JsonProperty("lane")]
        public string Lane { get; set; }

        /// <summary>
        /// UTF-8 size of this individual event as it arrived from the API.
        /// </summary>
        [JsonProperty("sourcePayloadBytes")]
        public int SourcePayloadBytes { get; set; }

        /// <summary>
        /// All additional vendor fields, including movement, object, zone,
        /// environmental, and behavior objects.
        /// </summary>
        [JsonExtensionData(ReadData = true, WriteData = true)]
        public IDictionary<string, JToken> AdditionalData { get; set; } = new Dictionary<string, JToken>();
    }
}
