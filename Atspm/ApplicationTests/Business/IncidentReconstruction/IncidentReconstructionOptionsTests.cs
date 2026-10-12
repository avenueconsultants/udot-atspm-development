#region license
// Copyright 2026 Utah Departement of Transportation
// for ApplicationTests - Utah.Udot.Atspm.ApplicationTests.Business.IncidentReconstruction/IncidentReconstructionOptionsTests.cs
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

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Xunit;

namespace Utah.Udot.Atspm.ApplicationTests.Business.IncidentReconstruction
{
    public class IncidentReconstructionOptionsTests
    {
        private static readonly DateTime Start = new(2026, 4, 14, 17, 42, 0);

        [Theory]
        [InlineData(0)]
        [InlineData(-30)]
        public void Validate_EndNotAfterStart_IsRejected(int seconds)
        {
            Assert.False(IsValid(new IncidentReconstructionOptions { LocationIdentifier = "7115", Start = Start, End = Start.AddSeconds(seconds) }));
        }

        [Fact]
        public void Validate_WindowOverSixtyMinutes_IsRejected()
        {
            Assert.False(IsValid(new IncidentReconstructionOptions { LocationIdentifier = "7115", Start = Start, End = Start.AddMinutes(60).AddSeconds(1) }));
        }

        [Fact]
        public void Validate_WindowOfExactlySixtyMinutes_IsAccepted()
        {
            Assert.True(IsValid(new IncidentReconstructionOptions { LocationIdentifier = "7115", Start = Start, End = Start.AddMinutes(60) }));
        }

        [Fact]
        public void Validate_StartBefore1900_IsRejected()
        {
            var start = new DateTime(1, 1, 1, 0, 5, 0);
            Assert.False(IsValid(new IncidentReconstructionOptions { LocationIdentifier = "7115", Start = start, End = start.AddMinutes(10) }));
        }

        [Fact]
        public void Validate_MissingLocation_IsRejected()
        {
            Assert.False(IsValid(new IncidentReconstructionOptions { LocationIdentifier = " ", Start = Start, End = Start.AddMinutes(1) }));
        }

        private static bool IsValid(IncidentReconstructionOptions options) =>
            Validator.TryValidateObject(options, new ValidationContext(options), new List<ValidationResult>(), validateAllProperties: true);
    }
}
