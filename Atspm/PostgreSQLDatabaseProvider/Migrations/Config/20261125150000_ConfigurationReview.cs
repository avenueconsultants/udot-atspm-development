using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Models.ConfigReviewModels;

namespace Utah.Udot.Atspm.PostgreSQLDatabaseProvider.Migrations.Config;

[DbContext(typeof(ConfigContext))]
[Migration("20261125150000_ConfigurationReview")]
public sealed class ConfigurationReview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        ConfigReviewMigration.Up(migrationBuilder, "timestamp");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        ConfigReviewMigration.Down(migrationBuilder);
}
