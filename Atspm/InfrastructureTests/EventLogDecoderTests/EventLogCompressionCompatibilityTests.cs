#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests/EventLogCompressionCompatibilityTests.cs
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

using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Data.Utility;
using Utah.Udot.Atspm.Infrastructure.Converters;
using Utah.Udot.Atspm.Infrastructure.Services.EventLogDecoders;
using Xunit;
using Xunit.Abstractions;

namespace Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests
{
    public class EventLogCompressionCompatibilityTests
    {
        private const string LegacyGoldenJson = "[{\"value\":42}]";
        private const string LegacyGoldenGZip = "H4sIAAAAAAACCouuVipLzClNVbIyMaqNBQDvBnzJDgAAAA==";

        private readonly ITestOutputHelper output;

        public EventLogCompressionCompatibilityTests(ITestOutputHelper output) => this.output = output;

        [Fact]
        public void GoldenLegacyGZipPayloadIsStillReadable()
        {
            var data = Convert.FromBase64String(LegacyGoldenGZip);

            var result = EventLogCompression.Decode(data);

            Assert.Equal(LegacyGoldenJson, result);
        }

        [Fact]
        public void VersionOneBrotliEnvelopeRoundTrips()
        {
            const string json = "[{\"locationIdentifier\":\"5017\",\"eventId\":2000}]";

            var data = EventLogCompression.EncodeBrotli(json);

            Assert.Equal("ATSPMCMP", Encoding.ASCII.GetString(data, 0, 8));
            Assert.Equal(EventLogCompression.CurrentEnvelopeVersion, data[8]);
            Assert.Equal(EventLogCompression.BrotliCodec, data[9]);
            Assert.Equal(json, EventLogCompression.Decode(data));
        }

        public static IEnumerable<object[]> InvalidEnvelopeCases()
        {
            yield return ["unknown format", new byte[] { 1, 2, 3, 4 }];
            yield return ["truncated envelope", Encoding.ASCII.GetBytes("ATSPMCMP")];
            yield return ["unknown version", MutateEnvelope(data => data[8] = 2)];
            yield return ["unknown codec", MutateEnvelope(data => data[9] = 2)];
            yield return ["length mismatch", MutateEnvelope(data => data[10]++)];
            yield return ["hash mismatch", MutateEnvelope(data => data[18] ^= 0xff)];
            yield return ["payload corruption", MutateEnvelope(data => data[EventLogCompression.EnvelopeHeaderLength] ^= 0xff)];
        }

        [Theory]
        [MemberData(nameof(InvalidEnvelopeCases))]
        public void InvalidOrCorruptEnvelopeIsRejected(string _, byte[] data)
        {
            Assert.Throws<InvalidDataException>(() => EventLogCompression.Decode(data));
        }

        [Fact]
        public async Task ReleaseOneWritesLegacyGZip()
        {
            await using var connection = await OpenConnection();
            var options = EventLogOptions(connection);

            await using (var context = new EventLogContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                context.BluebandLidarEvents.Add(CreateArchive("5017", 17, 2000));
                await context.SaveChangesAsync();
            }

            var bytes = await ReadBlob(connection, "CompressedEvents", "5017");

            Assert.Equal(0x1f, bytes[0]);
            Assert.Equal(0x8b, bytes[1]);
            Assert.NotEqual("ATSPMCMP", Encoding.ASCII.GetString(bytes, 0, Math.Min(8, bytes.Length)));
        }

        [Fact]
        public async Task LegacyGZipAndBrotliRowsCoexistInOneEventLogQuery()
        {
            await using var connection = await OpenConnection();
            var options = EventLogOptions(connection);

            await using (var context = new EventLogContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                context.BluebandLidarEvents.AddRange(
                    CreateArchive("5017", 17, 2000),
                    CreateArchive("5018", 18, 3002));
                await context.SaveChangesAsync();
            }

            var legacy = await ReadBlob(connection, "CompressedEvents", "5018");
            var envelope = EventLogCompression.EncodeBrotli(EventLogCompression.Decode(legacy));
            await UpdateBlob(connection, "CompressedEvents", "5018", envelope);

            await using (var context = new EventLogContext(options))
            {
                var rows = await context.BluebandLidarEvents.OrderBy(item => item.LocationIdentifier).ToListAsync();

                Assert.Equal(2, rows.Count);
                Assert.Equal(2000, Assert.Single(rows[0].Data).EventId);
                Assert.Equal(3002, Assert.Single(rows[1].Data).EventId);
            }

            var stillLegacy = await ReadBlob(connection, "CompressedEvents", "5017");
            var nowBrotli = await ReadBlob(connection, "CompressedEvents", "5018");
            Assert.Equal(new byte[] { 0x1f, 0x8b }, stillLegacy[..2]);
            Assert.Equal("ATSPMCMP", Encoding.ASCII.GetString(nowBrotli, 0, 8));
        }

        [Fact]
        public async Task AggregationStorageRemainsLegacyGZip()
        {
            await using var connection = await OpenConnection();
            var options = new DbContextOptionsBuilder<AggregationContext>()
                .UseSqlite(connection)
                .Options;
            var start = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc);

            await using (var context = new AggregationContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                context.SignalEventCountAggregations.Add(new CompressedAggregations<SignalEventCountAggregation>
                {
                    LocationIdentifier = "5017",
                    DataType = typeof(SignalEventCountAggregation),
                    Start = start,
                    End = start.AddMinutes(15),
                    Data =
                    [
                        new SignalEventCountAggregation
                        {
                            LocationIdentifier = "5017",
                            Start = start,
                            End = start.AddMinutes(15),
                            EventCount = 42
                        }
                    ]
                });
                await context.SaveChangesAsync();
            }

            var bytes = await ReadBlob(connection, "CompressedAggregations", "5017");

            Assert.Equal(new byte[] { 0x1f, 0x8b }, bytes[..2]);
        }

        [Fact]
        public void ExternalCompressedJsonTranscoderRemainsGZip()
        {
            var transcoder = new CompressedJsonFileTranscoder();

            var bytes = transcoder.EncodeItem(new CompressionFixture { Value = 42 });

            Assert.Equal(".gz", transcoder.FileExtension);
            Assert.Equal(new byte[] { 0x1f, 0x8b }, bytes[..2]);
            Assert.Equal(42, transcoder.DecodeItem<CompressionFixture>(bytes).Value);
        }

        [Fact]
        public void ExactArchivedBluebandModelPayloadReportsBrotliSize()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "EventLogDecoderTests", "TestData", "blueband-events.json");
            using var stream = File.OpenRead(path);
            var device = new Device
            {
                Location = new Location { LocationIdentifier = "5017" },
                DeviceConfiguration = new DeviceConfiguration
                {
                    Decoders = [nameof(BluebandLidarEventDecoder)]
                }
            };
            var models = new BluebandLidarEventDecoder()
                .Decode(device, stream)
                .Cast<EventLogModelBase>()
                .ToList();
            var converter = new EventLogCompressedListConverter<EventLogModelBase>();
            var legacy = (byte[])converter.ConvertToProvider(models)!;
            var json = EventLogCompression.Decode(legacy);
            var brotli = EventLogCompression.EncodeBrotli(json);

            output.WriteLine($"Exact archived Blueband model JSON: {Encoding.UTF8.GetByteCount(json)} bytes");
            output.WriteLine($"Legacy GZip: {legacy.Length} bytes; enveloped Brotli Optimal: {brotli.Length} bytes");

            Assert.Equal(json, EventLogCompression.Decode(brotli));
            Assert.NotEmpty(legacy);
            Assert.True(brotli.Length > EventLogCompression.EnvelopeHeaderLength);
        }

        private static byte[] MutateEnvelope(Action<byte[]> mutation)
        {
            var data = EventLogCompression.EncodeBrotli("[{\"value\":42}]");
            mutation(data);
            return data;
        }

        private static CompressedEventLogs<BluebandLidarEvent> CreateArchive(string locationIdentifier, int deviceId, int eventId)
        {
            var start = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc).AddHours(deviceId);
            return new CompressedEventLogs<BluebandLidarEvent>
            {
                LocationIdentifier = locationIdentifier,
                DeviceId = deviceId,
                DataType = typeof(BluebandLidarEvent),
                Start = start,
                End = start.AddHours(1),
                Data =
                [
                    new BluebandLidarEvent
                    {
                        LocationIdentifier = locationIdentifier,
                        EventId = eventId,
                        SourceTimestampMilliseconds = new DateTimeOffset(start).ToUnixTimeMilliseconds(),
                        SourcePayloadBytes = 412,
                        Timestamp = start,
                        Lane = "NBT1"
                    }
                ]
            };
        }

        private static DbContextOptions<EventLogContext> EventLogOptions(SqliteConnection connection) =>
            new DbContextOptionsBuilder<EventLogContext>().UseSqlite(connection).Options;

        private static async Task<SqliteConnection> OpenConnection()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            return connection;
        }

        private static async Task<byte[]> ReadBlob(SqliteConnection connection, string table, string locationIdentifier)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT Data FROM {table} WHERE LocationIdentifier = $location";
            command.Parameters.AddWithValue("$location", locationIdentifier);
            return (byte[])(await command.ExecuteScalarAsync())!;
        }

        private static async Task UpdateBlob(SqliteConnection connection, string table, string locationIdentifier, byte[] data)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"UPDATE {table} SET Data = $data WHERE LocationIdentifier = $location";
            command.Parameters.AddWithValue("$data", data);
            command.Parameters.AddWithValue("$location", locationIdentifier);
            Assert.Equal(1, await command.ExecuteNonQueryAsync());
        }

        public class CompressionFixture
        {
            public int Value { get; set; }
        }
    }
}
