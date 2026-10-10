using Microsoft.Extensions.Logging;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.Infrastructure.Repositories.EventLogRepositories
{
    /// <summary>
    /// EF repository for canonical LiDAR zone events.
    /// </summary>
    public class LidarZoneEventLogEFRepository : EventLogEFRepositoryBase<LidarZoneEvent>, ILidarZoneEventLogRepository
    {
        public LidarZoneEventLogEFRepository(EventLogContext db, ILogger<LidarZoneEventLogEFRepository> log) : base(db, log) { }
    }
}
