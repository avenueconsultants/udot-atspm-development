using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Utah.Udot.Atspm.Data;
using Utah.Udot.Atspm.Data.Enums;
using Utah.Udot.Atspm.Data.Models;
using Utah.Udot.Atspm.Data.Models.ConfigReviewModels;
using Utah.Udot.Atspm.Extensions;
using Utah.Udot.Atspm.Infrastructure.Extensions;
using Utah.Udot.Atspm.Repositories.ConfigurationRepositories;
using Review = Utah.Udot.Atspm.Data.Models.ConfigReviewModels.ConfigReview;
using AtspmDetector = Utah.Udot.Atspm.Data.Models.Detector;

namespace Utah.Udot.Atspm.ConfigApi.Services.ConfigReview;

public sealed class ConfigReviewService(ConfigContext db, ILocationRepository locations,
    IApproachRepository approaches, IDetectorRepository detectors, IDeviceRepository devices)
{
    public async Task<IReadOnlyList<Review>> Create(CreateReview request, string actor, CancellationToken token)
    {
        if (request.AsOfDate == default || request.AsOfDate == DateOnly.MaxValue ||
            (string.IsNullOrWhiteSpace(request.LocationIdentifier) == !request.RouteId.HasValue))
            throw new InvalidDataException("Supply a date and either a location identifier or a route.");
        var identifiers = request.RouteId.HasValue
            ? await db.RouteLocations.Where(row => row.RouteId == request.RouteId).OrderBy(row => row.Order)
                .Select(row => row.LocationIdentifier).ToListAsync(token)
            : [request.LocationIdentifier!.Trim()];
        if (identifiers.Count == 0 || identifiers.Any(id => id.Length is 0 or > 64))
            throw new InvalidDataException("The selected location or route is invalid.");

        var batch = request.RouteId.HasValue ? Guid.NewGuid() : (Guid?)null;
        var reviews = identifiers.Distinct().Select(id => new Review
        {
            Id = Guid.NewGuid(), LocationIdentifier = id, AsOfDate = request.AsOfDate.ToDateTime(TimeOnly.MinValue),
            RouteId = request.RouteId, BatchId = batch,
            Status = "Draft", CreatedAt = DateTime.UtcNow, CreatedBy = actor, Revision = Guid.NewGuid()
        }).ToArray();
        db.ConfigReviews.AddRange(reviews);
        if (batch.HasValue)
        {
            foreach (var review in reviews)
            {
                try
                {
                    var baseline = await Capture(review.LocationIdentifier, review.AsOfDate, token);
                    db.ConfigReviewBaselines.Add(new ConfigReviewBaseline
                    {
                        ReviewId = review.Id, LocationId = baseline.LocationId,
                        Configuration = SnapshotContract.Serialize(baseline), CapturedAt = DateTime.UtcNow
                    });
                }
                catch (KeyNotFoundException)
                {
                    // Preserve the location in the route review even when there is no historical version to attach.
                }
            }
        }
        await db.SaveChangesAsync(token);
        return reviews;
    }

    public async Task<ReviewBaseline> Load(Guid id, CancellationToken token)
    {
        var review = await Editable(id, token);
        if (review.CurrentSnapshotId.HasValue)
            throw new InvalidOperationException("Start a new review to replace a baseline that already has a snapshot.");
        var baseline = await Capture(review.LocationIdentifier, review.AsOfDate, token);
        var stored = await db.ConfigReviewBaselines.FindAsync([id], token);
        if (stored == null)
        {
            stored = new ConfigReviewBaseline { ReviewId = id };
            db.ConfigReviewBaselines.Add(stored);
        }
        stored.LocationId = baseline.LocationId;
        stored.Configuration = SnapshotContract.Serialize(baseline);
        stored.CapturedAt = DateTime.UtcNow;
        Touch(review);
        await db.SaveChangesAsync(token);
        return baseline;
    }

    public async Task<SnapshotReceipt> Upload(Guid id, string name, Stream input, bool external, CancellationToken token)
    {
        var review = await Editable(id, token);
        var baseline = await Baseline(id, token) ?? throw new InvalidOperationException("Load the ATSPM baseline first.");
        var receipt = new ConfigSnapshotFile
        {
            Id = Guid.NewGuid(), ReviewId = id, Name = SafeName(name), Sha256 = "", ReceivedAt = DateTime.UtcNow,
            Stored = false, ParseReport = "Rejected"
        };
        ControllerSnapshot normalized;
        try
        {
            using var stream = new MemoryStream();
            var buffer = new byte[8192];
            for (var count = await input.ReadAsync(buffer, token); count != 0; count = await input.ReadAsync(buffer, token))
            {
                receipt.Size += count;
                if (receipt.Size > SnapshotContract.MaximumBytes)
                    throw new InvalidDataException("Snapshot exceeds the 512 KiB limit.");
                stream.Write(buffer, 0, count);
            }
            var bytes = stream.ToArray();
            receipt.Sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
            normalized = SnapshotContract.Read(bytes, review.LocationIdentifier, external);
            var previous = await Snapshot(review, token);
            normalized = SnapshotContract.Merge(previous, normalized);
        }
        catch (Exception error) when (error is JsonException or InvalidDataException)
        {
            receipt.ParseReport = error is InvalidDataException ? error.Message : "Snapshot JSON did not match the schema.";
            db.ConfigSnapshotFiles.Add(receipt);
            await db.SaveChangesAsync(token);
            throw new InvalidDataException(receipt.ParseReport);
        }

        var merged = new ConfigSnapshot
        {
            Id = Guid.NewGuid(), ReviewId = id, Contract = SnapshotContract.Serialize(normalized), ReceivedAt = DateTime.UtcNow
        };
        var previousItems = await db.ConfigReviewItems.Where(item => item.ReviewId == id).ToListAsync(token);
        var items = ConfigurationComparison.Compare(id, baseline, normalized);
        var savedDecisions = previousItems.ToLookup(item => (item.Field, item.BaselineValue, item.ControllerValue, item.Sources));
        foreach (var item in items)
        {
            var decision = savedDecisions[(item.Field, item.BaselineValue, item.ControllerValue, item.Sources)].FirstOrDefault();
            if (decision != null)
            {
                item.Disposition = decision.Disposition;
                item.Annotation = decision.Annotation;
            }
        }

        db.ConfigReviewItems.RemoveRange(previousItems);
        db.ConfigReviewItems.AddRange(items);
        db.ConfigSnapshots.Add(merged);
        receipt.ParseReport = "Normalized snapshot accepted. Original payload bytes were discarded.";
        db.ConfigSnapshotFiles.Add(receipt);
        review.CurrentSnapshotId = merged.Id;
        review.Status = "Reviewed";
        Touch(review);
        await db.SaveChangesAsync(token);
        return await GetSnapshot(id, token);
    }

    public async Task<ConfigReviewItem> Annotate(Guid id, Guid itemId, ReviewItemUpdate update, CancellationToken token)
    {
        var review = await Editable(id, token);
        var item = await db.ConfigReviewItems.SingleOrDefaultAsync(item => item.ReviewId == id && item.Id == itemId, token)
            ?? throw new KeyNotFoundException("Review item not found.");
        if (update.Disposition is not ("Pending" or "Accepted" or "Rejected" or "Deferred"))
            throw new InvalidDataException("Choose a valid disposition.");
        var annotation = update.Annotation;
        if (annotation != null && (annotation.Basis is not ("Measured" or "Inferred") ||
            string.IsNullOrWhiteSpace(annotation.Reason) || annotation.Reason.Length > 512 ||
            annotation.Confidence is < 0 or > 1 || (annotation.Basis == "Inferred" && !annotation.Confidence.HasValue) ||
            annotation.Direction is < 1 || annotation.Movement is < 1 || annotation.Lane is < 1))
            throw new InvalidDataException("Supply a valid basis, reason, and confidence between zero and one for an inference.");
        if (annotation?.Direction is int direction && !Enum.IsDefined((DirectionTypes)direction) ||
            annotation?.Movement is int movement && !Enum.IsDefined((MovementTypes)movement))
            throw new InvalidDataException("Choose a configured direction and movement.");
        if (item.Field.StartsWith('!') && update.Disposition is "Accepted" or "Rejected" && annotation == null)
            throw new InvalidDataException("Record a reason when dispositioning a source conflict.");
        if (item.Classification == "NeedsDirection" && update.Disposition == "Accepted" &&
            (annotation?.Direction == null || (item.Group == "detectors" && (annotation.Movement == null || annotation.Lane == null))))
            throw new InvalidDataException("Supply direction and, for a detector, movement and lane before accepting.");
        item.Disposition = update.Disposition;
        item.Annotation = annotation == null ? null : SnapshotContract.Serialize(annotation);
        Touch(review);
        await db.SaveChangesAsync(token);
        return item;
    }

    public async Task<ReviewReport> Promote(Guid id, PromoteReview request, string actor, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 512)
            throw new InvalidDataException("A promotion reason is required and may contain at most 512 characters.");
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, token) : null;
        var review = await Editable(id, token);
        var baseline = await Baseline(id, token) ?? throw new InvalidOperationException("Load the ATSPM baseline first.");
        var current = await Capture(review.LocationIdentifier, review.AsOfDate, token);
        if (SnapshotContract.Serialize(baseline) != SnapshotContract.Serialize(current))
            throw new InvalidOperationException("ATSPM configuration changed since capture. Start a new review.");
        var snapshot = await Snapshot(review, token) ?? throw new InvalidOperationException("A snapshot is required.");
        var items = await GetItems(id, token);
        var blocked = items.Where(item => item.Field.StartsWith('!') && item.Disposition is "Pending" or "Deferred")
            .Select(item => item.Group).ToHashSet();
        var accepted = items.Where(item => !item.Field.StartsWith('!') && item.Disposition == "Accepted" &&
            item.Classification is "Certain" or "NeedsDirection" && !blocked.Contains(item.Group) &&
            !(item.Group is "phaseStructure" or "phaseTiming" && blocked.Contains("phases")))
            .OrderBy(item => item.Field.StartsWith("approaches.", StringComparison.Ordinal) ? 0 : 1).ToArray();
        if (accepted.Length == 0)
            throw new InvalidOperationException("There are no accepted, promotable items with resolved source conflicts.");

        var asOfEnd = review.AsOfDate.AddDays(1);
        var target = await LiveLocation(review.LocationIdentifier, asOfEnd, token);
        var fields = await db.LocationControllerFields.Where(field => field.LocationId == target.Id).ToListAsync(token);
        if (request.EffectiveDate is { } date)
        {
            if (date == DateOnly.MaxValue)
                throw new InvalidDataException("Choose a valid effective date.");
            var effective = date.ToDateTime(TimeOnly.MinValue);
            if (effective <= target.Start || effective > review.AsOfDate ||
                (await LiveLocation(review.LocationIdentifier, effective.AddDays(1), token)).Id != target.Id ||
                await db.Locations.AnyAsync(location => location.LocationIdentifier == review.LocationIdentifier &&
                    location.Start == effective, token))
                throw new InvalidDataException("The new date must follow the baseline version start and be in effect on the review date.");

            // The existing versioning service copies approaches and detectors without changing the baseline version.
            var currentId = await db.Locations.Where(location => location.LocationIdentifier == review.LocationIdentifier &&
                location.Start < DateTime.Today.AddDays(1)).OrderByDescending(location => location.Start)
                .ThenByDescending(location => location.Id).Select(location => location.Id).FirstAsync(token);
            var deviceIds = currentId == target.Id && effective <= DateTime.Today
                ? await db.Devices.Where(device => device.LocationId == target.Id).Select(device => device.Id).ToListAsync(token)
                : [];
            var version = await locations.CopyLocationToNewVersion(target.Id, request.Reason[..Math.Min(256, request.Reason.Length)], effective);
            devices.UpdateDevicesForNewVersion(deviceIds, version.Id);
            target = await LiveLocation(review.LocationIdentifier, asOfEnd, token);
            if (target.Id != version.Id)
                throw new InvalidOperationException("The new version did not become effective for the review date.");
            fields = fields.Select(field => new LocationControllerField
            {
                Id = Guid.NewGuid(), LocationId = target.Id, Field = field.Field, Value = field.Value
            }).ToList();
            db.LocationControllerFields.AddRange(fields);
        }

        foreach (var item in accepted)
        {
            var annotation = item.Annotation == null ? null : JsonSerializer.Deserialize<ReviewAnnotation>(item.Annotation, SnapshotContract.Json);
            if (item.Classification == "NeedsDirection")
                await ApplyAssignment(target, item, annotation!, review.AsOfDate, token);
            var stored = fields.SingleOrDefault(field => field.Field == item.Field);
            if (stored == null)
            {
                stored = new LocationControllerField { Id = Guid.NewGuid(), LocationId = target.Id, Field = item.Field };
                fields.Add(stored);
                db.LocationControllerFields.Add(stored);
            }
            stored.Value = item.ControllerValue;
            db.ConfigPromotionFields.Add(new ConfigPromotionField
            {
                Id = Guid.NewGuid(), ReviewId = id, SnapshotId = review.CurrentSnapshotId!.Value,
                LocationId = target.Id, Field = item.Field, Value = item.ControllerValue,
                Sources = SnapshotContract.Serialize(new
                {
                    field = SnapshotContract.Element(item.Sources),
                    checksums = SnapshotContract.Sources(snapshot, item.Group, item.Field).Where(source => !string.IsNullOrEmpty(source.Sha256))
                        .Select(source => source.Sha256).Distinct()
                }),
                ApprovedBy = actor, ApprovedAt = DateTime.UtcNow, Reason = request.Reason,
                Basis = annotation?.Basis ?? "Measured", Annotation = item.Annotation
            });
        }

        review.Status = "Promoted";
        Touch(review);
        await db.SaveChangesAsync(token);
        if (transaction != null)
            await transaction.CommitAsync(token);
        return await Report(id, token);
    }

    private async Task ApplyAssignment(Location target, ConfigReviewItem item, ReviewAnnotation annotation,
        DateTime asOf, CancellationToken token)
    {
        var phase = JsonSerializer.Deserialize<int>(item.ControllerValue);
        var direction = (DirectionTypes)annotation.Direction!.Value;
        var matching = target.Approaches.Where(ap => !ap.IsProtectedPhaseOverlap && ap.ProtectedPhaseNumber == phase &&
            ap.DirectionTypeId == direction).ToArray();
        if (matching.Length > 1)
            throw new InvalidOperationException("Multiple ATSPM approaches match the annotated direction and phase.");

        var approach = matching.SingleOrDefault();
        if (approach == null)
        {
            approach = new Approach
            {
                LocationId = target.Id, Location = target, DirectionTypeId = direction, ProtectedPhaseNumber = phase,
                Description = $"{direction} phase {phase}"
            };
            await approaches.AddAsync(approach);
        }
        if (item.Group != "detectors")
            return;

        var channel = int.Parse(item.Field.Split('.')[1], CultureInfo.InvariantCulture);
        var channelDetectors = target.Approaches.SelectMany(ap => ap.Detectors)
            .Where(detector => detector.DetectorChannel == channel && detector.DateAdded < asOf.AddDays(1) &&
                (detector.DateDisabled == null || detector.DateDisabled.Value >= asOf)).ToArray();
        if (channelDetectors.Length > 1)
            throw new InvalidOperationException($"Channel {channel} has multiple active ATSPM detector records.");
        var existing = channelDetectors.SingleOrDefault();
        if (existing == null)
        {
            var identifier = $"{target.LocationIdentifier}-{channel}";
            if (identifier.Length > 50)
                throw new InvalidOperationException("The generated detector identifier exceeds the configured limit.");
            await detectors.AddAsync(new AtspmDetector
            {
                ApproachId = approach.Id, Approach = approach, DetectorChannel = channel, DectectorIdentifier = identifier,
                DateAdded = asOf, LaneNumber = annotation.Lane, MovementType = (MovementTypes)annotation.Movement!.Value
            });
        }
        else
        {
            existing.Approach = approach;
            existing.ApproachId = approach.Id;
            existing.LaneNumber = annotation.Lane;
            existing.MovementType = (MovementTypes)annotation.Movement!.Value;
            await detectors.UpdateAsync(existing);
        }
        token.ThrowIfCancellationRequested();
    }

    public Task<List<Review>> List(string? location, CancellationToken token) => db.ConfigReviews.AsNoTracking()
        .Where(review => location == null || review.LocationIdentifier == location)
        .OrderByDescending(review => review.CreatedAt).ThenBy(review => review.Id).Take(100).ToListAsync(token);

    public async Task<IReadOnlyList<RouteReviewLocation>> RouteRollup(Guid batch, CancellationToken token)
    {
        var reviews = await db.ConfigReviews.AsNoTracking().Where(review => review.BatchId == batch)
            .OrderBy(review => review.LocationIdentifier).ToListAsync(token);
        if (reviews.Count == 0)
            throw new KeyNotFoundException("Route review batch not found.");
        var ids = reviews.Select(review => review.Id).ToArray();
        var baselines = (await db.ConfigReviewBaselines.AsNoTracking().Where(baseline => ids.Contains(baseline.ReviewId))
            .Select(baseline => baseline.ReviewId).ToListAsync(token)).ToHashSet();
        var findings = (await db.ConfigReviewItems.AsNoTracking().Where(item => ids.Contains(item.ReviewId)).ToListAsync(token))
            .ToLookup(item => item.ReviewId);
        var snapshotIds = reviews.Where(review => review.CurrentSnapshotId.HasValue)
            .Select(review => review.CurrentSnapshotId!.Value).ToArray();
        var firmware = (await db.ConfigSnapshots.AsNoTracking().Where(snapshot => snapshotIds.Contains(snapshot.Id))
            .ToListAsync(token)).ToDictionary(snapshot => snapshot.Id, snapshot =>
                JsonSerializer.Deserialize<ControllerSnapshot>(snapshot.Contract, SnapshotContract.Json)?.Firmware?.Text);
        return reviews.Select(review => new RouteReviewLocation(review, baselines.Contains(review.Id),
            review.CurrentSnapshotId is Guid id ? firmware.GetValueOrDefault(id) : null,
            findings[review.Id].Count(item => item.Field.StartsWith("pedestrian.", StringComparison.Ordinal)),
            findings[review.Id].Count(item => item.Field.StartsWith('!') && item.Disposition is "Pending" or "Deferred"),
            findings[review.Id].Count())).ToArray();
    }

    public async Task<SnapshotReceipt> GetSnapshot(Guid id, CancellationToken token)
    {
        var review = await Get(id, token);
        var files = await db.ConfigSnapshotFiles.AsNoTracking().Where(file => file.ReviewId == id)
            .OrderByDescending(file => file.ReceivedAt).ToListAsync(token);
        return new(review.CurrentSnapshotId, await Snapshot(review, token), files);
    }

    public async Task<List<ConfigReviewItem>> GetItems(Guid id, CancellationToken token)
    {
        _ = await Get(id, token);
        return await db.ConfigReviewItems.Where(item => item.ReviewId == id)
            .OrderBy(item => item.Classification).ThenBy(item => item.Field).ToListAsync(token);
    }

    public async Task<ReviewReport> Report(Guid id, CancellationToken token) =>
        new(await Get(id, token), await Baseline(id, token), await GetSnapshot(id, token), await GetItems(id, token),
            await db.ConfigPromotionFields.AsNoTracking().Where(field => field.ReviewId == id).OrderBy(field => field.Field).ToListAsync(token));

    public async Task<Dictionary<string, JsonElement>> GetConfiguration(string location, DateOnly date, CancellationToken token)
    {
        if (date == default || date == DateOnly.MaxValue)
            throw new InvalidDataException("Choose a valid configuration date.");
        var end = date.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var version = await LiveLocation(location, end, token);
        var approved = await db.LocationControllerFields.AsNoTracking().Where(field => field.LocationId == version.Id).ToListAsync(token);
        return approved.ToDictionary(field => field.Field, field => SnapshotContract.Element(field.Value));
    }

    private async Task<ReviewBaseline> Capture(string location, DateTime date, CancellationToken token)
    {
        var end = date.AddDays(1);
        var version = await LiveLocation(location, end, token);
        var approved = await db.LocationControllerFields.AsNoTracking().Where(field => field.LocationId == version.Id).ToListAsync(token);
        return ConfigurationComparison.Capture(version, approved, end);
    }

    private async Task<Location> LiveLocation(string identifier, DateTime end, CancellationToken token)
    {
        var location = await db.Locations.Include(location => location.Approaches).ThenInclude(approach => approach.Detectors)
            .ThenInclude(detector => detector.DetectionTypes)
            .Where(location => location.LocationIdentifier == identifier && location.Start < end)
            .OrderByDescending(location => location.Start).ThenByDescending(location => location.Id).FirstOrDefaultAsync(token);
        return location == null || location.VersionAction == LocationVersionActions.Delete
            ? throw new KeyNotFoundException("No ATSPM location version was in effect on that date.") : location;
    }

    private async Task<Review> Get(Guid id, CancellationToken token) =>
        await db.ConfigReviews.FindAsync([id], token) ?? throw new KeyNotFoundException("Configuration review not found.");

    private async Task<Review> Editable(Guid id, CancellationToken token)
    {
        var review = await Get(id, token);
        if (review.Status is "Abandoned" or "Promoted")
            throw new InvalidOperationException("This review is closed.");
        return review;
    }

    private async Task<ReviewBaseline?> Baseline(Guid id, CancellationToken token)
    {
        var baseline = await db.ConfigReviewBaselines.FindAsync([id], token);
        return baseline == null ? null : JsonSerializer.Deserialize<ReviewBaseline>(baseline.Configuration, SnapshotContract.Json);
    }

    private async Task<ControllerSnapshot?> Snapshot(Review review, CancellationToken token)
    {
        if (!review.CurrentSnapshotId.HasValue)
            return null;
        var snapshot = await db.ConfigSnapshots.FindAsync([review.CurrentSnapshotId.Value], token);
        return snapshot == null ? null : JsonSerializer.Deserialize<ControllerSnapshot>(snapshot.Contract, SnapshotContract.Json);
    }

    private static void Touch(Review review) => review.Revision = Guid.NewGuid();

    private static string SafeName(string name)
    {
        // Treat names as display data. The upload is never written to a filesystem.
        if (name.Length is 0 or > 255 || name.Any(character => !char.IsAsciiLetterOrDigit(character) &&
            character is not ('_' or '-' or '.' or ' ')))
            return "snapshot.json";
        return name;
    }
}
