using System.Security.Claims;
using Asp.Versioning;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Utah.Udot.Atspm.Common;
using Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;
using Utah.Udot.Atspm.Data.Models.ConfigReviewModels;
using Utah.Udot.Atspm.Infrastructure.Attributes;
using Review = Utah.Udot.Atspm.Data.Models.ConfigReviewModels.ConfigReview;

namespace Utah.Udot.Atspm.ConfigApi.Controllers;

[ApiController]
[ApiVersion(1.0)]
[Route("api/v{version:apiVersion}/ConfigReview")]
[AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsView)]
public sealed class ConfigReviewController(ConfigReviewService reviews) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(List<Review>), StatusCodes.Status200OK)]
    public Task<List<Review>> List([FromQuery] string? locationIdentifier, CancellationToken token) =>
        reviews.List(locationIdentifier, token);

    [HttpGet("routes/{batchId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<RouteReviewLocation>), StatusCodes.Status200OK)]
    public Task<ActionResult<IReadOnlyList<RouteReviewLocation>>> RouteRollup(Guid batchId, CancellationToken token) =>
        Run(() => reviews.RouteRollup(batchId, token));

    [HttpPost]
    [ProducesResponseType(typeof(IReadOnlyList<Review>), StatusCodes.Status200OK)]
    [AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsEdit)]
    public Task<ActionResult<IReadOnlyList<Review>>> Create(CreateReview create, CancellationToken token) =>
        Run(() => reviews.Create(create, Actor, token));

    [HttpPost("{id:guid}/load")]
    [ProducesResponseType(typeof(ReviewBaseline), StatusCodes.Status200OK)]
    [AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsEdit)]
    public Task<ActionResult<ReviewBaseline>> Load(Guid id, CancellationToken token) => Run(() => reviews.Load(id, token));

    [HttpPost("{id:guid}/files")]
    [ProducesResponseType(typeof(SnapshotReceipt), StatusCodes.Status200OK)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(SnapshotContract.MaximumBytes + 32 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = SnapshotContract.MaximumBytes + 1024)]
    [HttpLogging(HttpLoggingFields.RequestPath | HttpLoggingFields.ResponseStatusCode)]
    [AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsEdit)]
    public async Task<ActionResult<SnapshotReceipt>> Upload(Guid id, [FromForm] ReviewSnapshotUpload upload, CancellationToken token)
    {
        await using var stream = upload.File.OpenReadStream();
        return await Run(() => reviews.Upload(id, upload.File.FileName, stream, false, token));
    }

    [HttpGet("{id:guid}/snapshot")]
    [ProducesResponseType(typeof(SnapshotReceipt), StatusCodes.Status200OK)]
    public Task<ActionResult<SnapshotReceipt>> Snapshot(Guid id, CancellationToken token) =>
        Run(() => reviews.GetSnapshot(id, token));

    [HttpPut("{id:guid}/snapshot")]
    [ProducesResponseType(typeof(SnapshotReceipt), StatusCodes.Status200OK)]
    [Consumes("application/json")]
    [RequestSizeLimit(SnapshotContract.MaximumBytes + 1024)]
    [HttpLogging(HttpLoggingFields.RequestPath | HttpLoggingFields.ResponseStatusCode)]
    [AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsEdit)]
    public Task<ActionResult<SnapshotReceipt>> PutSnapshot(Guid id, CancellationToken token) =>
        Run(() => reviews.Upload(id, "client-snapshot.json", Request.Body, true, token));

    [HttpGet("{id:guid}/items")]
    [ProducesResponseType(typeof(List<ConfigReviewItem>), StatusCodes.Status200OK)]
    public Task<ActionResult<List<ConfigReviewItem>>> Items(Guid id, CancellationToken token) =>
        Run(() => reviews.GetItems(id, token));

    [HttpPatch("{id:guid}/items/{itemId:guid}")]
    [ProducesResponseType(typeof(ConfigReviewItem), StatusCodes.Status200OK)]
    [AuthorizePermission(AtspmAuthorization.Permissions.LocationConfigurationsEdit)]
    public Task<ActionResult<ConfigReviewItem>> Annotate(Guid id, Guid itemId, ReviewItemUpdate update, CancellationToken token) =>
        Run(() => reviews.Annotate(id, itemId, update, token));

    [HttpPost("{id:guid}/promote")]
    [ProducesResponseType(typeof(ReviewReport), StatusCodes.Status200OK)]
    [AuthorizePermission(AtspmAuthorization.Permissions.ConfigurationReviewPromote)]
    public Task<ActionResult<ReviewReport>> Promote(Guid id, PromoteReview request, CancellationToken token) =>
        Run(() => reviews.Promote(id, request, Actor, token));

    [HttpGet("{id:guid}/report")]
    [ProducesResponseType(typeof(ReviewReport), StatusCodes.Status200OK)]
    public Task<ActionResult<ReviewReport>> Report(Guid id, CancellationToken token) =>
        Run(() => reviews.Report(id, token));

    [HttpGet("configuration")]
    public Task<ActionResult<Dictionary<string, System.Text.Json.JsonElement>>> Configuration(
        [FromQuery] string locationIdentifier, [FromQuery] DateOnly asOfDate, CancellationToken token) =>
        Run(() => reviews.GetConfiguration(locationIdentifier, asOfDate, token));

    private string Actor => User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue("sub") ?? User.Identity?.Name ?? throw new InvalidOperationException("The caller has no auditable identity.");

    private async Task<ActionResult<T>> Run<T>(Func<Task<T>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (KeyNotFoundException error)
        {
            return Problem(error.Message, statusCode: 404);
        }
        catch (InvalidDataException error)
        {
            return Problem(error.Message, statusCode: 400);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Problem("This review was changed by another request. Reload and try again.", statusCode: 409);
        }
        catch (InvalidOperationException error)
        {
            return Problem(error.Message, statusCode: 409);
        }
    }
}

public sealed class ReviewSnapshotUpload
{
    public required IFormFile File { get; init; }
}
