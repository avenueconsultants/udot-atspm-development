#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeSpaceDiagram/TimeSpaceDiagramPhaseResult.cs
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

using Utah.Udot.Atspm.Business.Common;

namespace Utah.Udot.Atspm.Business.TimeSpaceDiagram
{
    /// <summary>
    /// Wrapper for time space diagram phase results that can represent either a successful result or an error
    /// </summary>
    public class TimeSpaceDiagramPhaseResult : ReportResult<TimeSpaceDiagramResultForPhase>
    {
        /// <summary>
        /// Creates a successful result wrapper
        /// </summary>
        public static TimeSpaceDiagramPhaseResult Success(TimeSpaceDiagramResultForPhase result)
            => new() { Result = result };

        /// <summary>
        /// Creates a failed result wrapper with an error message
        /// </summary>
        public static TimeSpaceDiagramPhaseResult Failure(string error)
            => new() { Error = ReportErrorFactory.Create("TimeSpaceDiagramError", error, "TimeSpaceDiagram") };

        public static TimeSpaceDiagramPhaseResult Failure(ReportError error)
            => new() { Error = error };

        /// <summary>
        /// Creates a failed result wrapper with phase metadata for rendering an empty/no-data row
        /// </summary>
        public static TimeSpaceDiagramPhaseResult Failure(string error, TimeSpaceDiagramResultForPhase result)
            => new() { Error = ReportErrorFactory.Create("TimeSpaceDiagramError", error, "TimeSpaceDiagram"), Result = result };

        public static TimeSpaceDiagramPhaseResult Failure(ReportError error, TimeSpaceDiagramResultForPhase result)
            => new() { Error = error, Result = result };
    }
}
