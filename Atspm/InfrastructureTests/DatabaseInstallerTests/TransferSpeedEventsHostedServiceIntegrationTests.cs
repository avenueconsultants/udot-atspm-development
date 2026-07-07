#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.DatabaseInstallerTests/TransferSpeedEventsHostedServiceIntegrationTests.cs
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

using DatabaseInstaller.Commands;
using DatabaseInstaller.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.DatabaseInstallerTests;

public class TransferSpeedEventsHostedServiceIntegrationTests
{
    [Fact]
    public async Task StartAsync_WithStubbedSourceLogs_PersistsAllGeneratedCompressedEventLogs()
    {
        var (serviceProvider, testContext) = CreateTestServiceProvider();

        var config = new TransferCommandConfiguration
        {
            Source = "Data Source=fake;Initial Catalog=fake;Integrated Security=True",
            Start = new DateTime(2026, 7, 7),
            End = new DateTime(2026, 7, 7)
        };

        var locations = new[]
        {
            CreateLocation("1001", CreateDevice(1, DeviceTypes.SpeedSensor)),
            CreateLocation("1002", CreateDevice(2, DeviceTypes.SpeedSensor))
        };

        var locationRepository = new Mock<ILocationRepository>(MockBehavior.Strict);
        locationRepository
            .Setup(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()))
            .Returns((DateTime _) => locations.ToList());

        var service = new StubbedTransferSpeedEventsHostedService(
            serviceProvider,
            locationRepository.Object,
            config);

        await service.StartAsync(CancellationToken.None);

        var persistedLogs = testContext.CompressedEvents.Local
            .OfType<CompressedEventLogs<SpeedEvent>>()
            .ToList();

        Assert.Equal(48, persistedLogs.Count);
        Assert.Equal(24, persistedLogs.Count(log => log.LocationIdentifier == "1001"));
        Assert.Equal(24, persistedLogs.Count(log => log.LocationIdentifier == "1002"));
        Assert.All(persistedLogs, log => Assert.Equal(1, log.Data.Count));
        Assert.All(persistedLogs, log => Assert.Equal(log.LocationIdentifier == "1001" ? 1 : 2, log.DeviceId));
    }

    private class StubbedTransferSpeedEventsHostedService : TransferSpeedEventsHostedService
    {
        public StubbedTransferSpeedEventsHostedService(
            IServiceProvider serviceProvider,
            ILocationRepository locationRepository,
            TransferCommandConfiguration config)
            : base(Mock.Of<ILogger<TransferSpeedEventsHostedService>>(), serviceProvider, locationRepository, Options.Create(config))
        {
        }

        protected override Task GetLogsAsync(
            DateTime startUtc,
            DateTime endUtc,
            string sourceConnectionString,
            ConcurrentBag<CompressedEventLogs<SpeedEvent>> archiveLogs,
            Location location,
            CancellationToken cancellationToken)
        {
            var device = location.Devices.First(d => d.DeviceType == DeviceTypes.SpeedSensor);
            archiveLogs.Add(CreateLog(location.LocationIdentifier, device.Id, startUtc, endUtc));
            return Task.CompletedTask;
        }
    }

    private static (IServiceProvider serviceProvider, EventLogContext testContext) CreateTestServiceProvider()
    {
        var options = new DbContextOptionsBuilder<EventLogContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        var testContext = new EventLogContext(options);
        var services = new ServiceCollection();
        services.AddSingleton<EventLogContext>(testContext);

        return (services.BuildServiceProvider(), testContext);
    }

    private static Location CreateLocation(string locationIdentifier, Device device)
    {
        return new Location
        {
            LocationIdentifier = locationIdentifier,
            Devices = new HashSet<Device> { device }
        };
    }

    private static Device CreateDevice(int id, DeviceTypes deviceType)
    {
        return new Device
        {
            Id = id,
            DeviceIdentifier = $"DEV{id}",
            DeviceType = deviceType,
            DeviceStatus = DeviceStatus.Active,
            Ipaddress = "127.0.0.1",
            DeviceProperties = new Dictionary<string, object>()
        };
    }

    private static CompressedEventLogs<SpeedEvent> CreateLog(string locationIdentifier, int deviceId, DateTime startUtc, DateTime endUtc)
    {
        return new CompressedEventLogs<SpeedEvent>
        {
            LocationIdentifier = locationIdentifier,
            DeviceId = deviceId,
            Start = startUtc,
            End = endUtc,
            Data = new List<SpeedEvent>
            {
                new() { DetectorId = $"{locationIdentifier}A", Mph = 55, Kph = 88, Timestamp = startUtc }
            }
        };
    }
}
