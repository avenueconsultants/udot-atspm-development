using Microsoft.Extensions.Logging;
using Moq;
using Utah.Udot.Atspm.Business.Common;
using Utah.Udot.Atspm.Repositories.EventLogRepositories;
using Xunit;

namespace Utah.Udot.ATSPM.Infrastructure.Services.WatchDogServices.Tests
{
    public class WatchDogPmLogServiceTests
    {
        private readonly Mock<IIndianaEventLogRepository> _controllerEventLogRepositoryMock;
        private readonly Mock<PhaseService> _phaseServiceMock;
        private readonly Mock<ILogger<WatchDogRampLogService>> _loggerMock;
        private readonly WatchDogPmLogService _watchDogPmLogService;

        public WatchDogPmLogServiceTests()
        {
            _controllerEventLogRepositoryMock = new Mock<IIndianaEventLogRepository>();
            _phaseServiceMock = new Mock<PhaseService>();
            _loggerMock = new Mock<ILogger<WatchDogRampLogService>>();

            _watchDogPmLogService = new WatchDogPmLogService(
                _controllerEventLogRepositoryMock.Object,
                _phaseServiceMock.Object,
                _loggerMock.Object
            );
        }

        [Fact]
        public void Constructor_Should_Create_Instance()
        {
            Assert.NotNull(_watchDogPmLogService);
        }
    }
}
