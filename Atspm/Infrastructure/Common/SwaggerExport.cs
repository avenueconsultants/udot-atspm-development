#region license
// Copyright 2026 Utah Departement of Transportation
// for Infrastructure - Utah.Udot.Atspm.Infrastructure.Common/SwaggerExport.cs
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

namespace Utah.Udot.Atspm.Infrastructure.Common
{
    /// <summary>
    /// Tells an API host whether this process was started to export its OpenAPI document
    /// rather than to serve requests.
    /// </summary>
    /// <remarks>
    /// The export target in <c>Atspm/Directory.Build.targets</c> sets
    /// <see cref="EnvironmentVariable"/> for the process it spawns. Exporting runs the API's
    /// real startup, so anything startup writes to the console ends up in the build log.
    /// </remarks>
    public static class SwaggerExport
    {
        /// <summary>
        /// Environment variable the export target sets on the process it spawns.
        /// </summary>
        public const string EnvironmentVariable = "ATSPM_SWAGGER_EXPORT";

        /// <summary>
        /// <see langword="true"/> when this process is exporting an OpenAPI document.
        /// </summary>
        public static bool InProgress { get; } = string.Equals(
            Environment.GetEnvironmentVariable(EnvironmentVariable),
            "true",
            StringComparison.OrdinalIgnoreCase);
    }
}
