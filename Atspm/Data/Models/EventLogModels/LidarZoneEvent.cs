#region license
// Copyright 2026 Utah Departement of Transportation
// Licensed under the Apache License, Version 2.0.
#endregion

#nullable disable

namespace Utah.Udot.Atspm.Data.Models.EventLogModels
{
    /// <summary>
    /// Canonical event produced when a tracked object traverses a LiDAR zone.
    /// </summary>
    public class LidarZoneEvent : EventLogModelBase
    {
        public long ServerId { get; set; }
        public int? PerceptionId { get; set; }
        public DateTime? CreatedAt { get; set; }
        public string ObjectId { get; set; }
        public long ZoneId { get; set; }
        public string ZoneName { get; set; }
        public long? DwellTimeMs { get; set; }
        public int? NumSamples { get; set; }
        public float? AvgSpeed { get; set; }
        public float? P50Speed { get; set; }
        public float? P85Speed { get; set; }
        public string Units { get; set; }
        public float? AvgHeight { get; set; }
        public float? AvgLength { get; set; }
        public float? AvgWidth { get; set; }
        public string Classification { get; set; }
        public string VendorClassification { get; set; }
        public string SubClassification { get; set; }
        public string UserClassification { get; set; }
        public string SpeedBin { get; set; }

        public override bool Equals(object obj) =>
            obj is LidarZoneEvent other &&
            LocationIdentifier == other.LocationIdentifier &&
            Timestamp == other.Timestamp &&
            ZoneId == other.ZoneId &&
            ObjectId == other.ObjectId &&
            ServerId == other.ServerId;

        public override int GetHashCode() =>
            HashCode.Combine(LocationIdentifier, Timestamp, ZoneId, ObjectId, ServerId);

        public override string ToString() =>
            $"{LocationIdentifier}-{Timestamp:o}-{ZoneId}-{ObjectId}-{ServerId}";
    }
}
