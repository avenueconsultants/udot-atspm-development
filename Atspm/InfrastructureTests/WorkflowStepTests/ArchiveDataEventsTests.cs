using System;
using Utah.Udot.ATSPM.Infrastructure.WorkflowSteps;
using Xunit;

namespace Utah.Udot.Atspm.InfrastructureTests.WorkflowStepTests
{
    public class ArchiveDataEventsTests
    {
        [Theory]
        [InlineData(0, 0, 0)]
        [InlineData(12, 23, 0)]
        [InlineData(59, 59, 999)]
        public void CanonicalHourRangeAlwaysSpansOneHour(int minute, int second, int millisecond)
        {
            var timestamp = new DateTime(2026, 9, 17, 10, minute, second, millisecond, DateTimeKind.Utc);

            var range = ArchiveDataEvents.GetCanonicalHourRange(timestamp);

            Assert.Equal(new DateTime(2026, 9, 17, 10, 0, 0, DateTimeKind.Utc), range.Start);
            Assert.Equal(new DateTime(2026, 9, 17, 11, 0, 0, DateTimeKind.Utc), range.End);
        }
    }
}
