#region license
// Copyright 2026 Utah Departement of Transportation
// for InfrastructureTests - Utah.Udot.Atspm.InfrastructureTests.DeviceDownloaderTests/BluebandLidarDownloaderTests.cs
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

using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Infrastructure.Configuration;
using Utah.Udot.Atspm.Infrastructure.Services.DeviceDownloaders;
using Utah.Udot.Atspm.Infrastructure.Services.DownloaderClients;
using Utah.Udot.Atspm.Services;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.DeviceDownloaderTests
{
    public class BluebandLidarDownloaderTests : IDisposable
    {
        private readonly string _tempPath = Path.Combine(Path.GetTempPath(), $"atspm-blueband-{Guid.NewGuid():N}");
        private readonly IOptionsSnapshot<DeviceDownloaderConfiguration> _options;

        public BluebandLidarDownloaderTests()
        {
            Directory.CreateDirectory(_tempPath);
            var configuration = new DeviceDownloaderConfiguration
            {
                BasePath = _tempPath,
                MinimumFileSizeBytes = 2,
                MaximumFileSizeBytes = 8
            };

            var options = new Mock<IOptionsSnapshot<DeviceDownloaderConfiguration>>();
            options.Setup(item => item.Get(It.IsAny<string>())).Returns(configuration);
            options.Setup(item => item.Value).Returns(configuration);
            _options = options.Object;
        }

        private static Device CreateBluebandDevice() => new()
        {
            DeviceIdentifier = "lidar-5017",
            DeviceType = DeviceTypes.LidarSensor,
            Ipaddress = "10.235.6.20",
            LoggingEnabled = true,
            Location = new Location { LocationIdentifier = "5017" },
            DeviceConfiguration = new DeviceConfiguration
            {
                Protocol = TransportProtocols.Http,
                Password = "test-token",
                Decoders = [BluebandLidarDownloader.DecoderName]
            }
        };

        [Fact]
        public void DownloaderPredicatesAllowBluebandAndControllerDevicesToCoexist()
        {
            var clients = Array.Empty<IDownloaderClient>();
            var logger = new NullLogger<IDeviceDownloader>();
            var generic = new DeviceDownloader(clients, logger, _options);
            var blueband = new BluebandLidarDownloader(clients, logger, _options);
            var lidar = CreateBluebandDevice();
            var controller = new Device
            {
                LoggingEnabled = true,
                DeviceType = DeviceTypes.SignalController,
                DeviceConfiguration = new DeviceConfiguration
                {
                    Protocol = TransportProtocols.Sftp,
                    Decoders = ["AscToIndianaDecoder"]
                }
            };

            Assert.False(generic.CanExecute(lidar));
            Assert.True(blueband.CanExecute(lidar));
            Assert.True(generic.CanExecute(controller));
            Assert.False(blueband.CanExecute(controller));
        }

        [Fact]
        public void TryMeasureDownloadUsesOnDiskByteLengthAndConfiguredBounds()
        {
            var sut = new BluebandLidarDownloader([], new NullLogger<IDeviceDownloader>(), _options);
            var validPath = Path.Combine(_tempPath, "valid.json");
            var oversizedPath = Path.Combine(_tempPath, "oversized.json");
            File.WriteAllBytes(validPath, [1, 2, 3, 4]);
            File.WriteAllBytes(oversizedPath, new byte[9]);

            Assert.True(sut.TryMeasureDownload(new FileInfo(validPath), out var validLength));
            Assert.Equal(4, validLength);
            Assert.False(sut.TryMeasureDownload(new FileInfo(oversizedPath), out var oversizedLength));
            Assert.Equal(9, oversizedLength);
        }

        [Fact]
        public void ConnectionUsesBearerHeaderWithoutPuttingTokenInCredentials()
        {
            var sut = new InspectableBluebandDownloader([], new NullLogger<IDeviceDownloader>(), _options);
            var device = CreateBluebandDevice();

            var properties = sut.ConnectionProperties(device);
            var credentials = sut.Credentials(device);

            Assert.Equal("application/json", properties["Accept"]);
            Assert.Equal("bearer test-token", properties["Authorization"]);
            Assert.Equal(string.Empty, credentials.UserName);
            Assert.Equal(string.Empty, credentials.Password);
        }

        [Fact]
        public async Task ExistingHttpClientBuildsBluebandEventsEndpoint()
        {
            using var httpClient = new HttpClient();
            using var client = new HttpDownloaderClient(httpClient);
            var device = CreateBluebandDevice();
            device.DeviceConfiguration.Port = 8088;
            device.DeviceConfiguration.Path = "/api/app/spm+/events";
            device.DeviceConfiguration.LoggingOffset = 120;
            device.DeviceConfiguration.Query =
            [
                "?start=[LogStartTime:yyyy-MM-ddTHH:mm:ss]&end=[DateTime:yyyy-MM-ddTHH:mm:ss]&q=state"
            ];
            var properties = new Dictionary<string, string>
            {
                ["Accept"] = "application/json",
                ["Authorization"] = "bearer test-token"
            };

            await client.ConnectAsync(
                new IPEndPoint(IPAddress.Parse(device.Ipaddress), device.DeviceConfiguration.Port),
                new NetworkCredential(),
                connectionProperties: properties);
            var query = new ObjectPropertyParser(device, device.DeviceConfiguration.Query.Single()).ToString();
            var resource = Assert.Single(await client.ListResourcesAsync(device.DeviceConfiguration.Path, query: [query]));

            Assert.Equal("http", resource.Scheme);
            Assert.Equal(device.Ipaddress, resource.Host);
            Assert.Equal(8088, resource.Port);
            Assert.Equal("/api/app/spm+/events", resource.AbsolutePath);
            Assert.Contains("start=", resource.Query);
            Assert.Contains("end=", resource.Query);
            Assert.Contains("q=state", resource.Query);
            Assert.Equal("bearer test-token", httpClient.DefaultRequestHeaders.Authorization?.ToString());
        }

        public void Dispose()
        {
            if (Directory.Exists(_tempPath))
                Directory.Delete(_tempPath, true);
        }

        private sealed class InspectableBluebandDownloader(
            IEnumerable<IDownloaderClient> clients,
            NullLogger<IDeviceDownloader> logger,
            IOptionsSnapshot<DeviceDownloaderConfiguration> options)
            : BluebandLidarDownloader(clients, logger, options)
        {
            public Dictionary<string, string> ConnectionProperties(Device device) => GetConnectionProperties(device);

            public NetworkCredential Credentials(Device device) => GetCredentials(device, IPAddress.Loopback);
        }
    }
}
