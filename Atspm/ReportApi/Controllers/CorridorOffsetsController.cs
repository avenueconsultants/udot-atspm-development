using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Utah.Udot.Atspm.Business.CorridorOffsets;
using Utah.Udot.Atspm.ReportApi.ReportServices;

namespace Utah.Udot.Atspm.ReportApi.Controllers;

[ApiController]
[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/[controller]")]
public class CorridorOffsetsController(CorridorOffsetReportService service) : ControllerBase
{
    [HttpPost("getReportData")]
    public async Task<ActionResult<CorridorResult>> GetReportData(CorridorOffsetOptions options, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await service.ExecuteAsync(options, cancellationToken));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }
}
