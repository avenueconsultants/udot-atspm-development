#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests/BluebandLidarPersistenceTests.cs
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
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests
{
    public class BluebandLidarPersistenceTests
    {
        [Fact]
        public async Task ExistingCompressedEventTableRoundTripsBluebandPayload()
        {
            await using var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<EventLogContext>()
                .UseSqlite(connection)
                .Options;

            await using (var context = new EventLogContext(options))
            {
                await context.Database.EnsureCreatedAsync();
                context.BluebandLidarEvents.Add(new CompressedEventLogs<BluebandLidarEvent>
                {
                    LocationIdentifier = "5017",
                    DeviceId = 17,
                    DataType = typeof(BluebandLidarEvent),
                    Start = new DateTime(2026, 5, 21, 12, 0, 0, DateTimeKind.Utc),
                    End = new DateTime(2026, 5, 21, 13, 0, 0, DateTimeKind.Utc),
                    Data = new List<BluebandLidarEvent>
                    {
                        new()
                        {
                            LocationIdentifier = "5017",
                            EventId = 2000,
                            SourceTimestampMilliseconds = 1779392675646,
                            SourcePayloadBytes = 412,
                            Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(1779392675646).UtcDateTime,
                            Lane = "NBT1",
                            AdditionalData = new Dictionary<string, JToken>
                            {
                                ["movement"] = JObject.Parse("{\"heading\":\"nb\",\"type\":\"through\"}")
                            }
                        }
                    }
                });
                await context.SaveChangesAsync();
            }

            await using (var context = new EventLogContext(options))
            {
                var stored = await context.BluebandLidarEvents.SingleAsync();
                var item = Assert.Single(stored.Data);

                Assert.Equal(2000, item.EventId);
                Assert.Equal(412, item.SourcePayloadBytes);
                Assert.Equal("NBT1", item.Lane);
                Assert.Equal("through", item.AdditionalData["movement"]?["type"]?.ToString());
            }
        }
    }
}
