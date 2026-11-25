using Microsoft.EntityFrameworkCore.Migrations;

namespace Utah.Udot.Atspm.Data.Models.ConfigReviewModels;

public static class ConfigReviewMigration
{
    public static void Up(MigrationBuilder migrationBuilder, string? dateTimeType)
    {
        migrationBuilder.CreateTable(
            name: "ConfigReviews",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                LocationIdentifier = table.Column<string>(unicode: true, maxLength: 64, nullable: false),
                RouteId = table.Column<int>(nullable: true),
                BatchId = table.Column<Guid>(nullable: true),
                AsOfDate = table.Column<DateTime>(type: dateTimeType, nullable: false),
                Status = table.Column<string>(unicode: true, maxLength: 20, nullable: false),
                CreatedBy = table.Column<string>(unicode: true, maxLength: 256, nullable: false),
                CreatedAt = table.Column<DateTime>(type: dateTimeType, nullable: false),
                CurrentSnapshotId = table.Column<Guid>(nullable: true),
                Revision = table.Column<Guid>(nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigReviews", row => row.Id);
            });

        migrationBuilder.CreateTable(
            name: "ConfigReviewBaselines",
            columns: table => new
            {
                ReviewId = table.Column<Guid>(nullable: false),
                LocationId = table.Column<int>(nullable: false),
                Configuration = table.Column<string>(unicode: true, nullable: false),
                CapturedAt = table.Column<DateTime>(type: dateTimeType, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigReviewBaselines", row => row.ReviewId);
                table.ForeignKey("FK_ConfigReviewBaselines_ConfigReviews_ReviewId", row => row.ReviewId,
                    "ConfigReviews", "Id", onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ConfigSnapshotFiles",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                ReviewId = table.Column<Guid>(nullable: false),
                Name = table.Column<string>(unicode: true, maxLength: 255, nullable: false),
                Sha256 = table.Column<string>(unicode: true, maxLength: 64, nullable: false),
                Size = table.Column<long>(nullable: false),
                Stored = table.Column<bool>(nullable: false),
                ParseReport = table.Column<string>(unicode: true, maxLength: 512, nullable: false),
                ReceivedAt = table.Column<DateTime>(type: dateTimeType, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigSnapshotFiles", row => row.Id);
            });

        migrationBuilder.CreateTable(
            name: "ConfigSnapshots",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                ReviewId = table.Column<Guid>(nullable: false),
                Contract = table.Column<string>(unicode: true, nullable: false),
                ReceivedAt = table.Column<DateTime>(type: dateTimeType, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigSnapshots", row => row.Id);
            });

        migrationBuilder.CreateTable(
            name: "ConfigReviewItems",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                ReviewId = table.Column<Guid>(nullable: false),
                Field = table.Column<string>(unicode: true, maxLength: 128, nullable: false),
                Group = table.Column<string>(unicode: true, maxLength: 32, nullable: false),
                Classification = table.Column<string>(unicode: true, maxLength: 24, nullable: false),
                Disposition = table.Column<string>(unicode: true, maxLength: 24, nullable: false),
                Summary = table.Column<string>(unicode: true, maxLength: 256, nullable: false),
                BaselineValue = table.Column<string>(unicode: true, nullable: false),
                ControllerValue = table.Column<string>(unicode: true, nullable: false),
                Sources = table.Column<string>(unicode: true, nullable: false),
                Annotation = table.Column<string>(unicode: true, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigReviewItems", row => row.Id);
            });

        migrationBuilder.CreateTable(
            name: "LocationControllerFields",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                LocationId = table.Column<int>(nullable: false),
                Field = table.Column<string>(unicode: true, maxLength: 128, nullable: false),
                Value = table.Column<string>(unicode: true, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_LocationControllerFields", row => row.Id);
            });

        migrationBuilder.CreateTable(
            name: "ConfigPromotionFields",
            columns: table => new
            {
                Id = table.Column<Guid>(nullable: false),
                ReviewId = table.Column<Guid>(nullable: false),
                SnapshotId = table.Column<Guid>(nullable: false),
                LocationId = table.Column<int>(nullable: false),
                Field = table.Column<string>(unicode: true, maxLength: 128, nullable: false),
                Value = table.Column<string>(unicode: true, nullable: false),
                Sources = table.Column<string>(unicode: true, nullable: false),
                ApprovedBy = table.Column<string>(unicode: true, maxLength: 256, nullable: false),
                ApprovedAt = table.Column<DateTime>(type: dateTimeType, nullable: false),
                Reason = table.Column<string>(unicode: true, maxLength: 512, nullable: false),
                Basis = table.Column<string>(unicode: true, maxLength: 20, nullable: false),
                Annotation = table.Column<string>(unicode: true, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ConfigPromotionFields", row => row.Id);
            });

        migrationBuilder.CreateIndex("IX_ConfigReviews_BatchId", "ConfigReviews", "BatchId");
        migrationBuilder.CreateIndex("IX_ConfigReviews_LocationIdentifier", "ConfigReviews", "LocationIdentifier");
        migrationBuilder.CreateIndex("IX_ConfigSnapshotFiles_ReviewId", "ConfigSnapshotFiles", "ReviewId");
        migrationBuilder.CreateIndex("IX_ConfigSnapshots_ReviewId", "ConfigSnapshots", "ReviewId");
        migrationBuilder.CreateIndex("IX_ConfigReviewItems_ReviewId", "ConfigReviewItems", "ReviewId");
        migrationBuilder.CreateIndex("IX_ConfigPromotionFields_ReviewId", "ConfigPromotionFields", "ReviewId");
        migrationBuilder.CreateIndex("IX_LocationControllerFields_LocationId_Field", "LocationControllerFields",
            new[] { "LocationId", "Field" }, unique: true);
    }

    public static void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("ConfigPromotionFields");
        migrationBuilder.DropTable("LocationControllerFields");
        migrationBuilder.DropTable("ConfigReviewItems");
        migrationBuilder.DropTable("ConfigSnapshots");
        migrationBuilder.DropTable("ConfigSnapshotFiles");
        migrationBuilder.DropTable("ConfigReviewBaselines");
        migrationBuilder.DropTable("ConfigReviews");
    }
}
