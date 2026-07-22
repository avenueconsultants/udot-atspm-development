using Utah.Udot.Atspm.Data.Models.MeasureOptions;
using Utah.Udot.Atspm.ReportApi.ReportServices;

namespace ReportApiTests
{
    public class TimeOfDayReportServiceTests
    {
        [Fact]
        public void NormalizeForExecution_KeepsOmittedBinSizeAtFixedFifteenMinutes()
        {
            var options = new TimeOfDayOptions();

            TimeOfDayReportService.NormalizeForExecution(options);

            Assert.Equal(15, options.BinSizeMinutes);
        }

        [Theory]
        [InlineData(15)]
        [InlineData(30)]
        public void NormalizeForExecution_ForcesFixedFifteenMinuteBinSize(int requestedBinSizeMinutes)
        {
            var options = new TimeOfDayOptions
            {
                BinSizeMinutes = requestedBinSizeMinutes
            };

            TimeOfDayReportService.NormalizeForExecution(options);

            Assert.Equal(15, options.BinSizeMinutes);
        }
    }
}
