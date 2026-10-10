using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Utah.Udot.Atspm.Data;

#nullable disable

namespace Utah.Udot.Atspm.MySqlDatabaseProvider.Migrations.EventLog
{
    [DbContext(typeof(EventLogContext))]
    [Migration("20260917213001_LidarIntegration")]
    public partial class LidarIntegration : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder) { }
        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
