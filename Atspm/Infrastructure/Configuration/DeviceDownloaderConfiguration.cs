#region license
// Copyright 2026 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Configuration/DeviceDownloaderConfiguration.cs
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

namespace Utah.Udot.Atspm.Infrastructure.Configuration
{
    /// <summary>
    /// Options pattern model for services that implement <see cref="IDeviceDownloader"/>
    /// </summary>
    public class DeviceDownloaderConfiguration
    {
        /// <summary>
        /// Base path to store downloaded event logs
        /// </summary>
        public string BasePath { get; set; }

        /// <summary>
        /// Flag for deleting remote file after downloading
        /// </summary>
        public bool DeleteRemoteFile { get; set; }

        /// <summary>
        /// Flag to ping <see cref="Device"/> to verify <see cref="Device.Ipaddress"/> before downloading
        /// </summary>
        public bool Ping { get; set; }

        /// <summary>
        /// Minimum acceptable size of a newly downloaded resource, in bytes.
        /// Specialized downloaders may use this to reject incomplete payloads.
        /// </summary>
        public long MinimumFileSizeBytes { get; set; } = 2;

        /// <summary>
        /// Maximum acceptable size of a newly downloaded resource, in bytes.
        /// A value less than one disables the upper bound.
        /// </summary>
        public long MaximumFileSizeBytes { get; set; } = 134_217_728;

        /// <inheritdoc/>
        public override string ToString()
        {
            return $"{BasePath} - {DeleteRemoteFile} - {Ping} - {MinimumFileSizeBytes}:{MaximumFileSizeBytes} bytes";
        }
    }
}
