using Microsoft.Extensions.Logging;
using Moq;
using Utah.Udot.Atspm.Repositories.EventLogRepositories;
using Xunit;

namespace Utah.Udot.ATSPM.Infrastructure.Services.WatchDogServices.Tests
{
    public class WatchDogRampLogServiceTests
    {
        private readonly Mock<IIndianaEventLogRepository> _controllerEventLogRepositoryMock;
        private readonly Mock<ILogger<WatchDogRampLogService>> _loggerMock;
        private readonly WatchDogRampLogService _watchDogRampLogService;

        public WatchDogRampLogServiceTests()
        {
            _controllerEventLogRepositoryMock = new Mock<IIndianaEventLogRepository>();
            _loggerMock = new Mock<ILogger<WatchDogRampLogService>>();

            _watchDogRampLogService = new WatchDogRampLogService(
                _controllerEventLogRepositoryMock.Object,
                _loggerMock.Object
            );
        }

        [Fact]
        public void Constructor_Should_Create_Instance()
        {
            Assert.NotNull(_watchDogRampLogService);
        }
    }
}
