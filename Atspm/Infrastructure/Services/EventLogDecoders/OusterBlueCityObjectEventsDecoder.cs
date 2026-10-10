#region license
// Copyright 2026 Utah Departement of Transportation
// Licensed under the Apache License, Version 2.0.
#endregion

using System.Text.Json;
using System.Text.Json.Serialization;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.Infrastructure.Services.EventLogDecoders
{
    /// <summary>
    /// Decodes the combined object-events envelope produced by the BlueCity Edge downloader.
    /// </summary>
    public class OusterBlueCityObjectEventsDecoder : EventLogDecoderBase<LidarZoneEvent>
    {
        private static readonly JsonSerializerOptions Options = new()
        {
            PropertyNameCaseInsensitive = true,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Skip
        };

        /// <inheritdoc/>
        public override IEnumerable<LidarZoneEvent> Decode(Device device, Stream stream, CancellationToken cancelToken = default)
        {
            try
            {
                cancelToken.ThrowIfCancellationRequested();
                if (device?.Location == null || string.IsNullOrWhiteSpace(device.Location.LocationIdentifier))
                    throw new InvalidDataException("BlueCity device must be assigned to a location.");
                if (stream == null || !stream.CanRead || stream.Length == 0)
                    throw new InvalidDataException("BlueCity event stream is empty.");

                stream.Position = 0;
                var envelope = JsonSerializer.Deserialize<Envelope>(stream, Options)
                    ?? throw new InvalidDataException("BlueCity event envelope is empty.");
                var units = NormalizeUnits(envelope.Units);
                if (envelope.Events == null)
                    throw new InvalidDataException("BlueCity event envelope does not contain an events array.");

                var result = new HashSet<LidarZoneEvent>();
                foreach (var source in envelope.Events)
                {
                    cancelToken.ThrowIfCancellationRequested();
                    if (source == null || source.Id == null || source.ZoneId == null
                        || source.Timestamp == null || string.IsNullOrWhiteSpace(source.ObjectId))
                        throw new InvalidDataException("BlueCity event is missing a required identity or timestamp field.");

                    var vendorClassification = source.Classification;
                    result.Add(new LidarZoneEvent
                    {
                        LocationIdentifier = device.Location.LocationIdentifier,
                        Timestamp = StripOffset(source.Timestamp.Value),
                        ServerId = source.Id.Value,
                        PerceptionId = source.PerceptionId,
                        CreatedAt = source.CreatedAt == null ? null : StripOffset(source.CreatedAt.Value),
                        ObjectId = source.ObjectId,
                        ZoneId = source.ZoneId.Value,
                        ZoneName = source.ZoneName?.Trim(),
                        DwellTimeMs = source.DwellTimeMs,
                        NumSamples = source.NumSamples,
                        AvgSpeed = source.AvgSpeed,
                        P50Speed = source.P50Speed,
                        P85Speed = source.P85Speed,
                        Units = units,
                        AvgHeight = source.AvgHeight,
                        AvgLength = source.AvgLength,
                        AvgWidth = source.AvgWidth,
                        Classification = MapClassification(vendorClassification),
                        VendorClassification = vendorClassification,
                        SubClassification = source.SubClassification,
                        UserClassification = source.UserClassification,
                        SpeedBin = source.SpeedBin
                    });
                }
                return result;
            }
            catch (OperationCanceledException) { throw; }
            catch (EventLogDecoderException) { throw; }
            catch (Exception e) { throw new EventLogDecoderException(e); }
        }

        private static DateTime StripOffset(DateTimeOffset value) =>
            DateTime.SpecifyKind(value.DateTime, DateTimeKind.Unspecified);

        private static string NormalizeUnits(string units) => units?.Trim().ToLowerInvariant() switch
        {
            "imperial" => "imperial",
            "metric" => "metric",
            _ => throw new InvalidDataException("BlueCity event envelope contains missing or unknown units.")
        };

        private static string MapClassification(string value) => value?.Trim().ToUpperInvariant() switch
        {
            "VEHICLE" => "Vehicle",
            "LARGE_VEHICLE" => "LargeVehicle",
            "PERSON" => "Pedestrian",
            "BICYCLE" => "Bicycle",
            "MOTORCYCLE" => "Motorcycle",
            _ => "Unknown"
        };

        private sealed class Envelope
        {
            [JsonPropertyName("timezone")] public string Timezone { get; set; }
            [JsonPropertyName("units")] public string Units { get; set; }
            [JsonPropertyName("events")] public List<EventRecord> Events { get; set; }
        }

        private sealed class EventRecord
        {
            [JsonPropertyName("id")] public long? Id { get; set; }
            [JsonPropertyName("perception_id")] public int? PerceptionId { get; set; }
            [JsonPropertyName("timestamp")] public DateTimeOffset? Timestamp { get; set; }
            [JsonPropertyName("created_at")] public DateTimeOffset? CreatedAt { get; set; }
            [JsonPropertyName("object_id")] public string ObjectId { get; set; }
            [JsonPropertyName("zone_id")] public long? ZoneId { get; set; }
            [JsonPropertyName("zone_name")] public string ZoneName { get; set; }
            [JsonPropertyName("dwell_time_ms")] public long? DwellTimeMs { get; set; }
            [JsonPropertyName("num_samples")] public int? NumSamples { get; set; }
            [JsonPropertyName("avg_speed")] public float? AvgSpeed { get; set; }
            [JsonPropertyName("p50_speed")] public float? P50Speed { get; set; }
            [JsonPropertyName("p85_speed")] public float? P85Speed { get; set; }
            [JsonPropertyName("avg_height")] public float? AvgHeight { get; set; }
            [JsonPropertyName("avg_length")] public float? AvgLength { get; set; }
            [JsonPropertyName("avg_width")] public float? AvgWidth { get; set; }
            [JsonPropertyName("classification")] public string Classification { get; set; }
            [JsonPropertyName("sub_classification")] public string SubClassification { get; set; }
            [JsonPropertyName("user_classification")] public string UserClassification { get; set; }
            [JsonPropertyName("speed_bin")] public string SpeedBin { get; set; }
        }
    }
}
