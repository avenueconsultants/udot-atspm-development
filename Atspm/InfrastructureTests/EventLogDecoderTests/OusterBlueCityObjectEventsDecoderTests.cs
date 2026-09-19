#region license
// Copyright 2026 Utah Departement of Transportation
// Licensed under the Apache License, Version 2.0.
#endregion

using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Exceptions;
using Utah.Udot.Atspm.Infrastructure.Configuration;
using Utah.Udot.Atspm.Infrastructure.Services.EventLogDecoders;
using Utah.Udot.Atspm.Infrastructure.Services.EventLogImporters;
using Utah.Udot.Atspm.Services;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests
{
    public class OusterBlueCityObjectEventsDecoderTests
    {
        private static Device CreateDevice() => new()
        {
            Location = new Location { LocationIdentifier = "5017" },
            DeviceConfiguration = new DeviceConfiguration { Decoders = [nameof(OusterBlueCityObjectEventsDecoder)] }
        };

        [Fact]
        public void RecordedFixtureMapsEveryFieldAndIgnoresUnknownFields()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "EventLogDecoderTests", "TestData", "bluecity-object-events.json");
            using var stream = File.OpenRead(path);

            var item = Assert.Single(new OusterBlueCityObjectEventsDecoder().Decode(CreateDevice(), stream));

            Assert.Equal("5017", item.LocationIdentifier);
            Assert.Equal(DateTime.Parse("2026-09-10T13:12:25.116278"), item.Timestamp);
            Assert.Equal(DateTimeKind.Unspecified, item.Timestamp.Kind);
            Assert.Equal(98765432101, item.ServerId);
            Assert.Equal(29044184, item.PerceptionId);
            Assert.Equal(DateTimeKind.Unspecified, item.CreatedAt.Value.Kind);
            Assert.Equal("ab2abe42-cbad-48a3-b6a0-5a47d9ad7cd7", item.ObjectId);
            Assert.Equal(1785960513198, item.ZoneId);
            Assert.Equal("VC-SB-T2-CO-6", item.ZoneName);
            Assert.Equal(699, item.DwellTimeMs);
            Assert.Equal(8, item.NumSamples);
            Assert.Equal(31.5f, item.AvgSpeed);
            Assert.Equal(30.1f, item.P50Speed);
            Assert.Equal(35.7f, item.P85Speed);
            Assert.Equal("imperial", item.Units);
            Assert.Equal(4.8f, item.AvgHeight);
            Assert.Equal(14.2f, item.AvgLength);
            Assert.Equal(6.1f, item.AvgWidth);
            Assert.Equal("Vehicle", item.Classification);
            Assert.Equal("VEHICLE", item.VendorClassification);
            Assert.Equal("car", item.SubClassification);
            Assert.Null(item.UserClassification);
            Assert.Equal("Other", item.SpeedBin);
        }

        [Fact]
        public void OverlapDeduplicatesButFallBackEventsWithDifferentServerIdsSurvive()
        {
            const string first = """{"id":1,"timestamp":"2026-11-01T01:30:00-06:00","object_id":"same","zone_id":10,"classification":"PERSON"}""";
            const string duplicate = """{"id":1,"timestamp":"2026-11-01T01:30:00-06:00","object_id":"same","zone_id":10,"classification":"PERSON"}""";
            const string fallback = """{"id":2,"timestamp":"2026-11-01T01:30:00-07:00","object_id":"same","zone_id":10,"classification":"PERSON"}""";
            using var stream = JsonStream($$"""{"timezone":"US/Mountain","units":"metric","events":[{{first}},{{duplicate}},{{fallback}}]}""");

            var result = new OusterBlueCityObjectEventsDecoder().Decode(CreateDevice(), stream).ToList();

            Assert.Equal(2, result.Count);
            Assert.All(result, item => Assert.Equal(new DateTime(2026, 11, 1, 1, 30, 0, DateTimeKind.Unspecified), item.Timestamp));
            Assert.Equal(new long[] { 1, 2 }, result.Select(item => item.ServerId).OrderBy(value => value));
            Assert.All(result, item => Assert.Equal("Pedestrian", item.Classification));
        }

        [Theory]
        [InlineData("{not-json")]
        [InlineData("{\"timezone\":\"US/Mountain\",\"events\":[]}")]
        [InlineData("{\"timezone\":\"US/Mountain\",\"units\":\"yards\",\"events\":[]}")]
        [InlineData("{\"timezone\":\"US/Mountain\",\"units\":\"imperial\"}")]
        public void MalformedOrUnsafeEnvelopeThrowsOnlyDecoderException(string json)
        {
            using var stream = JsonStream(json);
            Assert.Throws<EventLogDecoderException>(() => new OusterBlueCityObjectEventsDecoder().Decode(CreateDevice(), stream).ToList());
        }

        [Fact]
        public void EmptyEventsArrayIsValid()
        {
            using var stream = JsonStream("""{"timezone":"US/Mountain","units":"imperial","events":[]}""");
            Assert.Empty(new OusterBlueCityObjectEventsDecoder().Decode(CreateDevice(), stream));
        }

        [Fact]
        public async Task UnspecifiedTimestampPassesSharedImporterRangeCheckWithoutUtcConversion()
        {
            var wallTime = DateTime.Now.AddMinutes(-1);
            var timestamp = wallTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff") + "-06:00";
            var json = $$"""{"timezone":"US/Mountain","units":"imperial","events":[{"id":9,"timestamp":"{{timestamp}}","object_id":"range","zone_id":99,"classification":"UNKNOWN"}]}""";
            var path = Path.Combine(Path.GetTempPath(), $"bluecity-import-{Guid.NewGuid():N}.json");
            await File.WriteAllTextAsync(path, json);
            try
            {
                var configuration = new EventLogImporterConfiguration { EarliestAcceptableDate = DateTime.Now.AddDays(-1), DeleteSource = false };
                var options = new Mock<IOptionsSnapshot<EventLogImporterConfiguration>>();
                options.Setup(item => item.Get(nameof(EventLogFileImporter))).Returns(configuration);
                options.Setup(item => item.Value).Returns(configuration);
                var importer = new EventLogFileImporter([new OusterBlueCityObjectEventsDecoder()], new NullLogger<IEventLogImporter>(), options.Object);
                var result = new List<LidarZoneEvent>();

                await foreach (var value in importer.Execute(Tuple.Create(CreateDevice(), new FileInfo(path))))
                    result.Add(Assert.IsType<LidarZoneEvent>(value.Item2));

                var item = Assert.Single(result);
                Assert.Equal(DateTimeKind.Unspecified, item.Timestamp.Kind);
                Assert.Equal(wallTime.ToString("yyyy-MM-dd HH:mm:ss.fff"), item.Timestamp.ToString("yyyy-MM-dd HH:mm:ss.fff"));
            }
            finally { File.Delete(path); }
        }

        private static MemoryStream JsonStream(string value) => new(Encoding.UTF8.GetBytes(value));
    }
}
