#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Utility/EventLogCompressedListConverter.cs
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

using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Newtonsoft.Json;
using ProtoBuf;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.NetStandardToolkit.Extensions;

#nullable disable

namespace Utah.Udot.Atspm.Data.Utility
{
    /// <summary>
    /// Converts Event Log model lists to compressed JSON. Release 1 writes the
    /// existing raw GZip format and reads both GZip and versioned envelopes.
    /// </summary>
    /// <typeparam name="T">Event Log model base type.</typeparam>
    internal class EventLogCompressedListConverter<T> : ValueConverter<IEnumerable<T>, byte[]>
    {
        /// <summary>
        /// Creates the Release 1 dual-read, legacy-write converter.
        /// </summary>
        public EventLogCompressedListConverter() : base(
            v => Encode(v),
            v => Decode(v))
        { }

        private static byte[] Encode(IEnumerable<T> values)
        {
            var materialized = values?.ToList() ?? throw new ArgumentNullException(nameof(values));
            if (materialized.Any(value => value is null))
                throw new InvalidDataException("A compressed Event Log row cannot contain null events.");
            var concreteTypes = materialized.Where(value => value is not null).Select(value => value.GetType()).Distinct().ToList();
            if (concreteTypes.Count > 1)
                throw new InvalidDataException("A compressed Event Log row cannot contain multiple event types.");

            if (concreteTypes.Count == 1 && concreteTypes[0] == typeof(LidarZoneEvent))
            {
                using var stream = new MemoryStream();
                Serializer.Serialize(stream, materialized.Cast<LidarZoneEvent>().Select(LidarZoneEventContract.FromModel).ToList());
                return EventLogCompression.EncodeProtobuf(typeof(LidarZoneEvent).FullName, stream.ToArray());
            }

            object jsonValue = materialized;
            if (concreteTypes.Count == 1)
            {
                var typedList = (System.Collections.IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(concreteTypes[0]));
                foreach (var value in materialized)
                    typedList.Add(value);
                jsonValue = typedList;
            }

            return JsonConvert.SerializeObject(jsonValue, JsonSettings()).GZipCompressToByte();
        }

        private static IEnumerable<T> Decode(byte[] data)
        {
            var payload = EventLogCompression.DecodePayload(data);
            if (payload.Codec == EventLogCompression.ProtobufCodec)
            {
                if (payload.TypeIdentifier != typeof(LidarZoneEvent).FullName)
                    throw new InvalidDataException($"Unsupported protobuf Event Log type '{payload.TypeIdentifier}'.");
                using var stream = new MemoryStream(payload.Payload);
                return Serializer.Deserialize<List<LidarZoneEventContract>>(stream)
                    .Select(value => (T)(object)value.ToModel())
                    .ToList();
            }

            return JsonConvert.DeserializeObject<IEnumerable<T>>(System.Text.Encoding.UTF8.GetString(payload.Payload), JsonSettings());
        }

        private static JsonSerializerSettings JsonSettings() => new()
        {
            TypeNameHandling = TypeNameHandling.Arrays,
            SerializationBinder = new CompressedSerializationBinder<T>()
        };

        // A flat wire contract deliberately repeats inherited EventLogModelBase fields.
        // This prevents protobuf-net from silently dropping them at the inheritance boundary.
        [ProtoContract]
        private sealed class LidarZoneEventContract
        {
            [ProtoMember(1)] public string LocationIdentifier { get; set; }
            [ProtoMember(2)] public DateTime Timestamp { get; set; }
            [ProtoMember(3)] public long ServerId { get; set; }
            [ProtoMember(4)] public int? PerceptionId { get; set; }
            [ProtoMember(5)] public DateTime? CreatedAt { get; set; }
            [ProtoMember(6)] public string ObjectId { get; set; }
            [ProtoMember(7)] public long ZoneId { get; set; }
            [ProtoMember(8)] public string ZoneName { get; set; }
            [ProtoMember(9)] public long? DwellTimeMs { get; set; }
            [ProtoMember(10)] public int? NumSamples { get; set; }
            [ProtoMember(11)] public float? AvgSpeed { get; set; }
            [ProtoMember(12)] public float? P50Speed { get; set; }
            [ProtoMember(13)] public float? P85Speed { get; set; }
            [ProtoMember(14)] public string Units { get; set; }
            [ProtoMember(15)] public float? AvgHeight { get; set; }
            [ProtoMember(16)] public float? AvgLength { get; set; }
            [ProtoMember(17)] public float? AvgWidth { get; set; }
            [ProtoMember(18)] public string Classification { get; set; }
            [ProtoMember(19)] public string VendorClassification { get; set; }
            [ProtoMember(20)] public string SubClassification { get; set; }
            [ProtoMember(21)] public string UserClassification { get; set; }
            [ProtoMember(22)] public string SpeedBin { get; set; }

            internal static LidarZoneEventContract FromModel(LidarZoneEvent value) => new()
            {
                LocationIdentifier = value.LocationIdentifier, Timestamp = value.Timestamp, ServerId = value.ServerId,
                PerceptionId = value.PerceptionId, CreatedAt = value.CreatedAt, ObjectId = value.ObjectId,
                ZoneId = value.ZoneId, ZoneName = value.ZoneName, DwellTimeMs = value.DwellTimeMs,
                NumSamples = value.NumSamples, AvgSpeed = value.AvgSpeed, P50Speed = value.P50Speed,
                P85Speed = value.P85Speed, Units = value.Units, AvgHeight = value.AvgHeight,
                AvgLength = value.AvgLength, AvgWidth = value.AvgWidth, Classification = value.Classification,
                VendorClassification = value.VendorClassification, SubClassification = value.SubClassification,
                UserClassification = value.UserClassification, SpeedBin = value.SpeedBin
            };

            internal LidarZoneEvent ToModel() => new()
            {
                LocationIdentifier = LocationIdentifier, Timestamp = Timestamp, ServerId = ServerId,
                PerceptionId = PerceptionId, CreatedAt = CreatedAt, ObjectId = ObjectId,
                ZoneId = ZoneId, ZoneName = ZoneName, DwellTimeMs = DwellTimeMs,
                NumSamples = NumSamples, AvgSpeed = AvgSpeed, P50Speed = P50Speed,
                P85Speed = P85Speed, Units = Units, AvgHeight = AvgHeight,
                AvgLength = AvgLength, AvgWidth = AvgWidth, Classification = Classification,
                VendorClassification = VendorClassification, SubClassification = SubClassification,
                UserClassification = UserClassification, SpeedBin = SpeedBin
            };
        }
    }
}
