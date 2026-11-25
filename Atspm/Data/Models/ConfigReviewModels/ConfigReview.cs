using System.ComponentModel.DataAnnotations;

namespace Utah.Udot.Atspm.Data.Models.ConfigReviewModels;

public class ConfigReview
{
    public Guid Id { get; set; }
    [MaxLength(64)] public string LocationIdentifier { get; set; }
    public int? RouteId { get; set; }
    public Guid? BatchId { get; set; }
    public DateTime AsOfDate { get; set; }
    [MaxLength(20)] public string Status { get; set; }
    [MaxLength(256)] public string CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CurrentSnapshotId { get; set; }
    [ConcurrencyCheck] public Guid Revision { get; set; }
}

public class ConfigReviewBaseline
{
    [Key] public Guid ReviewId { get; set; }
    public int LocationId { get; set; }
    public string Configuration { get; set; }
    public DateTime CapturedAt { get; set; }
}

public class ConfigSnapshotFile
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    [MaxLength(255)] public string Name { get; set; }
    [MaxLength(64)] public string Sha256 { get; set; }
    public long Size { get; set; }
    public bool Stored { get; set; }
    [MaxLength(512)] public string ParseReport { get; set; }
    public DateTime ReceivedAt { get; set; }
}

public class ConfigSnapshot
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    public string Contract { get; set; }
    public DateTime ReceivedAt { get; set; }
}

public class ConfigReviewItem
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    [MaxLength(128)] public string Field { get; set; }
    [MaxLength(32)] public string Group { get; set; }
    [MaxLength(24)] public string Classification { get; set; }
    [MaxLength(24)] public string Disposition { get; set; }
    [MaxLength(256)] public string Summary { get; set; }
    public string BaselineValue { get; set; }
    public string ControllerValue { get; set; }
    public string Sources { get; set; }
    public string? Annotation { get; set; }
}

public class LocationControllerField
{
    public Guid Id { get; set; }
    public int LocationId { get; set; }
    [MaxLength(128)] public string Field { get; set; }
    public string Value { get; set; }
}

public class ConfigPromotionField
{
    public Guid Id { get; set; }
    public Guid ReviewId { get; set; }
    public Guid SnapshotId { get; set; }
    public int LocationId { get; set; }
    [MaxLength(128)] public string Field { get; set; }
    public string Value { get; set; }
    public string Sources { get; set; }
    [MaxLength(256)] public string ApprovedBy { get; set; }
    public DateTime ApprovedAt { get; set; }
    [MaxLength(512)] public string Reason { get; set; }
    [MaxLength(20)] public string Basis { get; set; }
    public string? Annotation { get; set; }
}
