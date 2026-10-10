#region license
// Copyright 2026 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Services.DeviceDownloaders/BluebandLidarDownloader.cs
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

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net;
using System.Runtime.CompilerServices;
using Utah.Udot.Atspm.Common;
using Utah.Udot.Atspm.Data.Enums;

namespace Utah.Udot.Atspm.Infrastructure.Services.DeviceDownloaders
{
    /// <summary>
    /// BlueBand LiDAR adapter for the shared device-download workflow.
    /// It reuses the HTTP client and device configuration path while adding
    /// bearer authentication, JSON file naming, and payload-size validation.
    /// </summary>
    public class BluebandLidarDownloader : DeviceDownloader
    {
        /// <summary>
        /// Decoder name used in device configuration to opt into BlueBand ingestion.
        /// </summary>
        public const string DecoderName = "BluebandLidarEventDecoder";

        /// <inheritdoc/>
        public BluebandLidarDownloader(
            IEnumerable<IDownloaderClient> clients,
            ILogger<IDeviceDownloader> log,
            IOptionsSnapshot<DeviceDownloaderConfiguration> options)
            : base(clients, log, options)
        {
        }

        /// <summary>
        /// Identifies a BlueBand source without claiming other HTTP LiDAR devices.
        /// </summary>
        public static bool IsBluebandDevice(Device device)
        {
            return device?.DeviceType == DeviceTypes.LidarSensor
                && device.DeviceConfiguration?.Protocol == TransportProtocols.Http
                && device.DeviceConfiguration.Decoders?.Contains(DecoderName, StringComparer.OrdinalIgnoreCase) == true;
        }

        /// <inheritdoc/>
        public override bool CanExecute(Device value)
        {
            return value?.LoggingEnabled == true && IsBluebandDevice(value);
        }

        /// <inheritdoc/>
        public override Uri GenerateLocalFilePath(Device device, Uri resource)
        {
            var generated = base.GenerateLocalFilePath(device, resource);
            return new Uri(Path.ChangeExtension(generated.LocalPath, ".json"));
        }

        /// <summary>
        /// Measures a completed download on disk and validates it against the named
        /// downloader configuration before the importer loads it into memory.
        /// </summary>
        public bool TryMeasureDownload(FileInfo file, out long length)
        {
            length = 0;

            if (file == null)
                return false;

            file.Refresh();
            if (!file.Exists)
                return false;

            length = file.Length;
            var minimum = Math.Max(0, _options.MinimumFileSizeBytes);
            var maximum = _options.MaximumFileSizeBytes;

            return length >= minimum && (maximum < 1 || length <= maximum);
        }

        /// <inheritdoc/>
        public override async IAsyncEnumerable<Tuple<Device, FileInfo>> Execute(
            Device parameter,
            IProgress<ControllerDownloadProgress> progress = null,
            [EnumeratorCancellation] CancellationToken cancelToken = default)
        {
            await foreach (var result in base.Execute(parameter, progress, cancelToken))
            {
                if (TryMeasureDownload(result.Item2, out var length))
                {
                    _log.LogInformation(
                        "Measured BlueBand LiDAR payload {File} at {PayloadBytes} bytes for device {DeviceIdentifier}",
                        result.Item2.FullName,
                        length,
                        parameter.DeviceIdentifier);

                    yield return result;
                    continue;
                }

                _log.LogWarning(
                    "Rejected BlueBand LiDAR payload {File} at {PayloadBytes} bytes for device {DeviceIdentifier}; expected {MinimumBytes}..{MaximumBytes} bytes",
                    result.Item2.FullName,
                    length,
                    parameter.DeviceIdentifier,
                    _options.MinimumFileSizeBytes,
                    _options.MaximumFileSizeBytes);

                try
                {
                    result.Item2.Delete();
                }
                catch (IOException e)
                {
                    _log.LogWarning(e, "Could not remove rejected BlueBand LiDAR payload {File}", result.Item2.FullName);
                }
            }
        }

        /// <inheritdoc/>
        protected override Dictionary<string, string> GetConnectionProperties(Device device)
        {
            var properties = base.GetConnectionProperties(device) is { } configured
                ? new Dictionary<string, string>(configured, StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            properties.TryAdd("Accept", "application/json");

            if (!properties.ContainsKey("Authorization") && !string.IsNullOrWhiteSpace(device?.DeviceConfiguration?.Password))
                properties.Add("Authorization", $"bearer {device.DeviceConfiguration.Password}");

            return properties;
        }

        /// <inheritdoc/>
        protected override NetworkCredential GetCredentials(Device device, IPAddress ipaddress)
        {
            // The BlueBand token is sent only in the Authorization header, never in the URI.
            return new NetworkCredential(string.Empty, string.Empty, ipaddress.ToString());
        }
    }
}
