using Microsoft.Extensions.Logging;
using Moq;
using Utah.Udot.Atspm.Business.Common; // for AnalysisPhaseCollectionService
using Utah.Udot.Atspm.Repositories.EventLogRepositories;
using Xunit;

namespace Utah.Udot.ATSPM.Infrastructure.Services.WatchDogServices.Tests
{
    public class WatchDogAmLogServiceTests
    {
        private readonly Mock<IIndianaEventLogRepository> _controllerEventLogRepositoryMock;
        private readonly AnalysisPhaseCollectionService _analysisPhaseCollectionService;
        private readonly Mock<ILogger<WatchDogRampLogService>> _loggerMock;
        private readonly WatchDogAmLogService _watchDogAmLogService;

        public WatchDogAmLogServiceTests()
        {
            _controllerEventLogRepositoryMock = new Mock<IIndianaEventLogRepository>();
            _loggerMock = new Mock<ILogger<WatchDogRampLogService>>();

            // Real instances for dependencies
            var planService = new PlanService();
            var phaseService = new PhaseService();
            var analysisPhaseService = new AnalysisPhaseService(phaseService);

            _analysisPhaseCollectionService = new AnalysisPhaseCollectionService(
                planService,
                analysisPhaseService
            );

            _watchDogAmLogService = new WatchDogAmLogService(
                _controllerEventLogRepositoryMock.Object,
                _analysisPhaseCollectionService,
                _loggerMock.Object
            );
        }

        [Fact]
        public void Constructor_Should_Create_Instance()
        {
            Assert.NotNull(_watchDogAmLogService);
        }
    }
}
