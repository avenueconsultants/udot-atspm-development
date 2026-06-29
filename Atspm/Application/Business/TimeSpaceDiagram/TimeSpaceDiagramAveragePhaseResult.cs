#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.TimeSpaceDiagram/TimeSpaceDiagramAveragePhaseResult.cs
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
    /// Wrapper for time space diagram average results that can represent either a successful result or an error
    /// </summary>
    public class TimeSpaceDiagramAveragePhaseResult : ReportResult<TimeSpaceDiagramAverageResult>
    {
        /// <summary>
        /// Creates a successful result wrapper
        /// </summary>
        public static TimeSpaceDiagramAveragePhaseResult Success(TimeSpaceDiagramAverageResult result)
            => new() { Result = result };

        /// <summary>
        /// Creates a failed result wrapper with an error message
        /// </summary>
        public static TimeSpaceDiagramAveragePhaseResult Failure(string error)
            => new() { Error = ReportErrorFactory.Create("TimeSpaceDiagramAverageError", error, "TimeSpaceDiagramAverage") };

        public static TimeSpaceDiagramAveragePhaseResult Failure(ReportError error)
            => new() { Error = error };
    }
}
