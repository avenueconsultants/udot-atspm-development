using Utah.Udot.Atspm.Data.Models.EventLogModels;

namespace Utah.Udot.Atspm.Repositories.EventLogRepositories
{
    /// <summary>
    /// Repository for canonical LiDAR zone events.
    /// </summary>
    public interface ILidarZoneEventLogRepository : IEventLogRepository<LidarZoneEvent> { }
}
