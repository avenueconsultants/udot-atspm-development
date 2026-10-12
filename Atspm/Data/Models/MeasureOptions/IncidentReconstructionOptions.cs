#region license
// Copyright 2026 Utah Departement of Transportation
// for Data - Utah.Udot.Atspm.Data.Models.MeasureOptions/IncidentReconstructionOptions.cs
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

using System.ComponentModel.DataAnnotations;

namespace Utah.Udot.Atspm.Data.Models.MeasureOptions
{
    /// <summary>
    /// Options for the incident reconstruction report: one location and a short window of controller time.
    /// </summary>
    public class IncidentReconstructionOptions : MeasureOptionsBase, IValidatableObject
    {
        /// <summary>
        /// Longest window the report accepts.
        /// </summary>
        public static readonly TimeSpan MaxWindow = TimeSpan.FromMinutes(60);

        /// <summary>
        /// Earliest start the report accepts, the same as the page's date picker. It also leaves room to look back before the start.
        /// </summary>
        public static readonly DateTime EarliestStart = new(1900, 1, 1);

        /// <inheritdoc/>
        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (string.IsNullOrWhiteSpace(LocationIdentifier))
            {
                yield return new ValidationResult("A location is required.", new[] { nameof(LocationIdentifier) });
            }

            if (Start < EarliestStart)
            {
                yield return new ValidationResult($"Start must be on or after {EarliestStart:yyyy-MM-dd}.", new[] { nameof(Start) });
            }

            if (End <= Start)
            {
                yield return new ValidationResult("End must be after Start.", new[] { nameof(Start), nameof(End) });
            }
            else if (End - Start > MaxWindow)
            {
                yield return new ValidationResult($"The window can be at most {MaxWindow.TotalMinutes} minutes.", new[] { nameof(Start), nameof(End) });
            }
        }
    }
}
