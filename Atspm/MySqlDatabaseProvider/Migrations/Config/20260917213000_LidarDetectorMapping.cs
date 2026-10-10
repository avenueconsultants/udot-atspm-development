using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Utah.Udot.Atspm.Data;

#nullable disable

namespace Utah.Udot.Atspm.MySqlDatabaseProvider.Migrations.Config
{
    [DbContext(typeof(ConfigContext))]
    [Migration("20260917213000_LidarDetectorMapping")]
    public partial class LidarDetectorMapping : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.AddColumn<long>(
                name: "LidarZoneId",
                table: "Detectors",
                type: "bigint",
                nullable: true);

        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.DropColumn(name: "LidarZoneId", table: "Detectors");
    }
}
