using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Utah.Udot.OracleDatabaseProvider.Migrations.Config
{
    /// <inheritdoc />
    public partial class LidarDetectorMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "LidarZoneId",
                table: "Detectors",
                type: "NUMBER(19)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LidarZoneId",
                table: "Detectors");
        }
    }
}
