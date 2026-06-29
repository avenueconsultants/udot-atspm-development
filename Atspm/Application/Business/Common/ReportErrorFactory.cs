#region license
// Copyright 2026 Utah Departement of Transportation
// for Application - Utah.Udot.Atspm.Business.Common/ReportErrorFactory.cs
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

using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.TempExtensions;

namespace Utah.Udot.Atspm.Business.Common
{
    public static class ReportErrorFactory
    {
        public static ReportError Create(
            string code,
            string message,
            string report = null,
            Location location = null,
            Approach approach = null,
            PhaseDetail phase = null,
            string locationIdentifier = null,
            string locationDescription = null,
            int? approachId = null,
            string approachDescription = null,
            int? phaseNumber = null,
            string phaseType = null,
            string direction = null,
            int? sortOrder = null)
        {
            var sourceApproach = approach ?? phase?.Approach;
            var sourceLocation = location ?? sourceApproach?.Location;

            return new ReportError
            {
                Code = string.IsNullOrWhiteSpace(code) ? "ReportError" : code,
                Message = message,
                Report = report,
                LocationIdentifier = locationIdentifier ?? sourceLocation?.LocationIdentifier,
                LocationDescription = locationDescription ?? sourceLocation?.LocationDescription(),
                ApproachId = approachId ?? sourceApproach?.Id,
                ApproachDescription = approachDescription ?? sourceApproach?.Description,
                PhaseNumber = phaseNumber ?? phase?.PhaseNumber ?? sourceApproach?.ProtectedPhaseNumber,
                PhaseType = phaseType,
                Direction = direction ?? sourceApproach?.DirectionType?.Abbreviation,
                SortOrder = sortOrder
            };
        }

        public static ReportError FromException(
            Exception exception,
            string report,
            string code = "ReportExecutionError",
            Location location = null,
            Approach approach = null,
            PhaseDetail phase = null,
            string locationIdentifier = null,
            string locationDescription = null,
            string phaseType = null,
            string direction = null,
            int? sortOrder = null)
        {
            return Create(
                code,
                "Unable to generate report data.",
                report,
                location,
                approach,
                phase,
                locationIdentifier: locationIdentifier,
                locationDescription: locationDescription,
                phaseType: phaseType,
                direction: direction,
                sortOrder: sortOrder);
        }
    }
}
