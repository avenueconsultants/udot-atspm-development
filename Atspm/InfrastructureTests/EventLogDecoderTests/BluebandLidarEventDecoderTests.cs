#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.EventLogDecoderTests/BluebandLidarEventDecoderTests.cs
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

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
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
    public class BluebandLidarEventDecoderTests
    {
        private static Device CreateDevice() => new()
        {
            Location = new Location { LocationIdentifier = "5017" },
            DeviceConfiguration = new DeviceConfiguration
            {
                Decoders = [nameof(BluebandLidarEventDecoder)]
            }
        };

        [Fact]
        public void DecodePreservesRepresentativeBluebandEvents()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "EventLogDecoderTests", "TestData", "blueband-events.json");
            using var stream = File.OpenRead(path);

            var result = new BluebandLidarEventDecoder().Decode(CreateDevice(), stream).ToList();

            Assert.Equal(4, result.Count);
            Assert.All(result, item => Assert.Equal("5017", item.LocationIdentifier));
            Assert.All(result, item => Assert.Equal(DateTimeKind.Utc, item.Timestamp.Kind));
            Assert.All(result, item => Assert.True(item.SourcePayloadBytes > 0));

            var detector = Assert.Single(result, item => item.EventId == 1002);
            Assert.Equal(18, detector.Detector);
            Assert.Equal(DateTimeOffset.FromUnixTimeMilliseconds(1779392674894).UtcDateTime, detector.Timestamp);

            var vehicle = Assert.Single(result, item => item.EventId == 2000);
            Assert.Equal(2086, vehicle.DurationMilliseconds);
            Assert.Equal("NBT1", vehicle.Lane);
            Assert.Equal("through", vehicle.AdditionalData["movement"]?["type"]?.ToString());
            Assert.Equal("vehicle", vehicle.AdditionalData["object"]?["classification"]?.ToString());

            var incident = Assert.Single(result, item => item.EventId == 3002);
            Assert.Equal(17266, incident.Incident);
        }

        [Fact]
        public void DecodeRejectsResponseWithoutEventsArray()
        {
            using var stream = new MemoryStream(Encoding.UTF8.GetBytes("{\"state\":{}}"));

            Assert.Throws<EventLogDecoderException>(() => new BluebandLidarEventDecoder().Decode(CreateDevice(), stream).ToList());
        }

        [Fact]
        public async Task SharedEventLogFileImporterImportsBluebandFixture()
        {
            var path = Path.Combine(AppContext.BaseDirectory, "EventLogDecoderTests", "TestData", "blueband-events.json");
            var configuration = new EventLogImporterConfiguration
            {
                EarliestAcceptableDate = new DateTime(2020, 1, 1),
                DeleteSource = false
            };
            var options = new Mock<IOptionsSnapshot<EventLogImporterConfiguration>>();
            options.Setup(item => item.Get(nameof(EventLogFileImporter))).Returns(configuration);
            options.Setup(item => item.Value).Returns(configuration);
            var importer = new EventLogFileImporter(
                [new BluebandLidarEventDecoder()],
                new NullLogger<IEventLogImporter>(),
                options.Object);
            var result = new List<BluebandLidarEvent>();

            await foreach (var item in importer.Execute(Tuple.Create(CreateDevice(), new FileInfo(path))))
                result.Add(Assert.IsType<BluebandLidarEvent>(item.Item2));

            Assert.Equal(4, result.Count);
        }

        [Fact]
        public void DecoderIsDiscoverableForSharedRegistrationAndConfigurationOptions()
        {
            var decoders = AppDomain.CurrentDomain.GetAssemblies()
                .Where(assembly => assembly.FullName?.StartsWith("Utah.Udot.Atspm") == true)
                .SelectMany(assembly => assembly.GetTypes())
                .Where(type => !type.IsAbstract && !type.IsInterface)
                .Where(type => type.GetInterfaces().Any(item =>
                    item.IsGenericType && item.GetGenericTypeDefinition() == typeof(IEventLogDecoder<>)))
                .Select(type => type.Name)
                .ToList();

            Assert.Contains(nameof(BluebandLidarEventDecoder), decoders);
        }
    }
}
