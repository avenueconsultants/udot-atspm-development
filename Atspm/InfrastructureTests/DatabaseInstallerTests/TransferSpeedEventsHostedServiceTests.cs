#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.DatabaseInstallerTests/TransferSpeedEventsHostedServiceTests.cs
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
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.EventLogModels;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.DatabaseInstallerTests;

public class TransferSpeedEventsHostedServiceTests
{
    [Fact]
    public async Task StartAsync_WithEmptyLocations_DoesNotCreateScope()
    {
        var config = new TransferCommandConfiguration
        {
            Source = "Data Source=fake;Initial Catalog=fake;Integrated Security=True",
            Start = new DateTime(2026, 7, 7),
            End = new DateTime(2026, 7, 7)
        };

        var locationRepository = new Mock<ILocationRepository>(MockBehavior.Strict);
        locationRepository
            .Setup(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()))
            .Returns(new List<Location>());

        var serviceProvider = new ServiceCollection()
            .BuildServiceProvider();

        var service = CreateHostedService(serviceProvider, locationRepository.Object, config);

        await service.StartAsync(CancellationToken.None);

        locationRepository.Verify(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()), Times.Exactly(24));
    }

    [Fact]
    public async Task StartAsync_WithMultiDayRange_CallsLocationRepositoryForEachHour()
    {
        var config = new TransferCommandConfiguration
        {
            Source = "Data Source=fake;Initial Catalog=fake;Integrated Security=True",
            Start = new DateTime(2026, 7, 6),
            End = new DateTime(2026, 7, 7)
        };

        var locationRepository = new Mock<ILocationRepository>(MockBehavior.Strict);
        locationRepository
            .Setup(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()))
            .Returns(new List<Location>());

        var serviceProvider = new ServiceCollection()
            .BuildServiceProvider();

        var service = CreateHostedService(serviceProvider, locationRepository.Object, config);

        await service.StartAsync(CancellationToken.None);

        // 2 days * 24 hours
        locationRepository.Verify(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()), Times.Exactly(48));
    }

    [Fact]
    public async Task FlushLogsAsync_PersistsCompressedEventLogsToEventLogContext()
    {
        var databaseName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddDbContext<EventLogContext>(options =>
            options.UseInMemoryDatabase(databaseName));

        var serviceProvider = services.BuildServiceProvider();

        var config = new TransferCommandConfiguration
        {
            Source = "Data Source=fake;Initial Catalog=fake;Integrated Security=True",
            Start = new DateTime(2026, 7, 7),
            End = new DateTime(2026, 7, 7)
        };

        var locationRepository = new Mock<ILocationRepository>(MockBehavior.Strict);
        locationRepository
            .Setup(x => x.GetLatestVersionOfAllLocations(It.IsAny<DateTime>()))
            .Returns(new List<Location>());

        var service = CreateHostedService(serviceProvider, locationRepository.Object, config);

        var archiveLogs = new ConcurrentBag<CompressedEventLogs<SpeedEvent>>();
        archiveLogs.Add(CreateLog("1001", 1, new[] { CreateSpeedEvent("1001A", 45, 72, new DateTimeOffset(2026, 7, 7, 0, 0, 0, TimeSpan.Zero)) }));
        archiveLogs.Add(CreateLog("1002", 2, new[] { CreateSpeedEvent("1002A", 50, 80, new DateTimeOffset(2026, 7, 7, 0, 30, 0, TimeSpan.Zero)) }));

        await InvokePrivateAsync(service, "FlushLogsAsync", archiveLogs);

        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<EventLogContext>();

        var persisted = await context.CompressedEvents.OfType<CompressedEventLogs<SpeedEvent>>().ToListAsync();
        Assert.Equal(2, persisted.Count);
        Assert.Contains(persisted, item => item.LocationIdentifier == "1001" && item.DeviceId == 1);
        Assert.Contains(persisted, item => item.LocationIdentifier == "1002" && item.DeviceId == 2);
    }

    private static TransferSpeedEventsHostedService CreateHostedService(
        IServiceProvider serviceProvider,
        ILocationRepository locationRepository,
        TransferCommandConfiguration config)
    {
        var logger = Mock.Of<ILogger<TransferSpeedEventsHostedService>>();
        var options = Options.Create(config);
        return new TransferSpeedEventsHostedService(logger, serviceProvider, locationRepository, options);
    }

    private static async Task InvokePrivateAsync(object instance, string methodName, params object[] args)
    {
        var method = instance.GetType().GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Instance);
        Assert.NotNull(method);

        var result = method!.Invoke(instance, args);
        var task = Assert.IsType<Task>(result);
        await task;
    }

    private static CompressedEventLogs<SpeedEvent> CreateLog(string locationIdentifier, int deviceId, IEnumerable<SpeedEvent> events)
    {
        return new CompressedEventLogs<SpeedEvent>
        {
            LocationIdentifier = locationIdentifier,
            DeviceId = deviceId,
            Start = new DateTime(2026, 7, 7, 0, 0, 0, DateTimeKind.Utc),
            End = new DateTime(2026, 7, 7, 1, 0, 0, DateTimeKind.Utc),
            Data = events.ToList()
        };
    }

    private static SpeedEvent CreateSpeedEvent(string detectorId, int mph, int kph, DateTimeOffset timestamp)
    {
        return new SpeedEvent
        {
            DetectorId = detectorId,
            Mph = mph,
            Kph = kph,
            Timestamp = timestamp.UtcDateTime
        };
    }
}
