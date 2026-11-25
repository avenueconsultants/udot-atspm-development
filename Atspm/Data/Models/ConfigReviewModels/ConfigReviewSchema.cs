using Microsoft.EntityFrameworkCore;

namespace Utah.Udot.Atspm.Data.Models.ConfigReviewModels;

public static class ConfigReviewSchema
{
    public static void Apply(ModelBuilder builder)
    {
        var entities = new[]
        {
            typeof(ConfigReview), typeof(ConfigReviewBaseline), typeof(ConfigSnapshotFile), typeof(ConfigSnapshot),
            typeof(ConfigReviewItem), typeof(LocationControllerField), typeof(ConfigPromotionField)
        };
        foreach (var entity in entities)
        {
            var type = builder.Entity(entity);
            type.Property(entity == typeof(ConfigReviewBaseline) ? "ReviewId" : "Id").ValueGeneratedNever();
            foreach (var property in entity.GetProperties().Where(property => property.PropertyType == typeof(string)))
                type.Property(property.Name).IsUnicode(true);
        }

        builder.Entity<ConfigReview>().ToTable("ConfigReviews").HasIndex(review => review.LocationIdentifier);
        builder.Entity<ConfigReview>().HasIndex(review => review.BatchId);
        builder.Entity<ConfigReviewBaseline>().ToTable("ConfigReviewBaselines")
            .HasOne<ConfigReview>().WithOne().HasForeignKey<ConfigReviewBaseline>(baseline => baseline.ReviewId);
        builder.Entity<ConfigSnapshotFile>().ToTable("ConfigSnapshotFiles").HasIndex(file => file.ReviewId);
        builder.Entity<ConfigSnapshot>().ToTable("ConfigSnapshots").HasIndex(snapshot => snapshot.ReviewId);
        builder.Entity<ConfigReviewItem>().ToTable("ConfigReviewItems").HasIndex(item => item.ReviewId);
        builder.Entity<ConfigPromotionField>().ToTable("ConfigPromotionFields").HasIndex(field => field.ReviewId);
        builder.Entity<LocationControllerField>().ToTable("LocationControllerFields")
            .HasIndex(field => new { field.LocationId, field.Field }).IsUnique();
    }
}
