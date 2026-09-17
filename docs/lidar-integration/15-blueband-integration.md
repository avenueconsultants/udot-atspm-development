# 15 — BlueBand LiDAR Integration (already implemented)

Unlike Ouster BlueCity (docs 01–14, design-only until Codex builds it), a **second LiDAR
vendor is already implemented** on branch `codex/blueband-lidar-event-import`
(commit `1b4f5ba8`, "Add Blueband LiDAR event import and compression compatibility"), off
`main` at `a4a0ef2b` (pre-dates this branch's `feature/lidar-integration` work). This doc
records what's actually there so the two vendors form one coherent LiDAR picture, and folds
its real precedents back into docs 03/05/10/12 rather than treating it as unrelated work.

**This doc is a record of existing code, not a design proposal** — nothing here needs
Codex to build; it needs `feature/lidar-integration` to either merge/rebase onto this branch
or cherry-pick it before the Ouster storage-format work lands, since both touch the same
shared `EventLogContext`/compression code (see "Coordination required" below).

## What BlueBand is

BlueBand units expose an HTTP JSON API (`GET /api/app/spm+/events`) returning **SPM+ style
events** — these are much closer to ATSPM's native signal-event model than BlueCity's
zone/object records: each event carries an `id` (event type, e.g. 1002 = detector-state),
a Unix-ms `date`, optional `duration`, and optional `detector` / `phase` / `ring` /
`incident` / `heading` / `lane` fields, plus arbitrary vendor extension data.

**This matters for scope:** BlueCity's Edge API has *no* phase data at all (memory:
"No phase data anywhere in the Edge API" — zone→phase is inherited via channel-match, doc 06,
never observed directly). **BlueBand's events carry `phase`/`ring`/`detector` directly.** If
UDOT's BlueBand units report phase-correlated events, that reopens doors BlueCity's scope
closed off (doc 09 "out of scope": SPM measures, phase-based analysis) — for BlueBand
specifically, not as a change to the BlueCity scope decisions. Worth a scoping conversation
once real BlueBand payloads are available to inspect (`AdditionalData` — see below — likely
carries more; the promoted fields above are what's common/reliable enough to model directly).

## Why it doesn't map into the canonical `LidarZoneEvent`

Doc 12 anticipated this: *"If a vendor's data model is fundamentally different in kind (not
just field coverage), that is a signal for a genuinely new canonical model, not a forced
fit."* BlueBand's SPM+ events are detector/phase/ring-based, not zone/object-based — a
different kind of record, not just a different field set. So it got its own model:

**`Atspm/Data/Models/EventLogModels/BluebandLidarEvent.cs`** — `: EventLogModelBase`,
Newtonsoft-attributed (`[JsonProperty]`), common scalar fields promoted for querying
(`EventId`, `SourceTimestampMilliseconds`, `DurationMilliseconds`, `Detector`, `Phase`,
`Ring`, `Incident`, `Heading`, `Lane`, `SourcePayloadBytes`), everything else preserved
losslessly in `AdditionalData` (`[JsonExtensionData]` — an `IDictionary<string, JToken>`
catch-all for movement/object/zone/environmental/behavior sub-objects the vendor sends).
This `JsonExtensionData` pattern is itself worth considering for `LidarZoneEvent` (doc 03) if
BlueCity's payload ever grows fields the promoted-field table doesn't cover.

Storage-wise this changes nothing structurally — `BluebandLidarEvent` is just another
`EventLogModelBase` subclass, auto-discovered and auto-discriminated by
`AddCompressedTableDiscriminators` exactly like `LidarZoneEvent` would be (doc 03), landing
in the same shared `CompressedEvents` table via its own `CompressedEventLogs<BluebandLidarEvent>`
DbSet.

## Ingestion: a third registration pattern (lighter than doc 12 anticipated)

Doc 12's plug-in contract assumed every new vendor needs a new `TransportProtocols` enum
value + a full `DownloaderClientBase` (item 2, doc 12) because BlueCity's edge REST auth
(Keycloak client-credentials token exchange, page-cursor pagination) doesn't fit the generic
`HttpDownloaderClient`. BlueBand's API is plain HTTP GET + a static bearer token — the
existing generic HTTP path almost fits, so the actual implementation is **lighter**:

- **No new `TransportProtocols` value.** BlueBand devices are configured with the existing
  `Http` protocol.
- **Disambiguation by predicate, not protocol enum:** `BluebandLidarDownloader.IsBluebandDevice(Device)`
  checks `DeviceType == LidarSensor && Protocol == Http && Decoders.Contains("BluebandLidarEventDecoder")`.
- **`BluebandLidarDownloader : DeviceDownloader`** (subclasses the *generic* downloader, not
  `DownloaderClientBase`) and overrides `CanExecute` to claim only BlueBand devices; the base
  `DeviceDownloader.CanExecute` was patched with `!BluebandLidarDownloader.IsBluebandDevice(value) && …`
  so the two predicates stay disjoint — generic HTTP devices are never double-claimed.
- Overrides `GetConnectionProperties`/`GetCredentials` (new `protected virtual` extension
  points added to the base `DeviceDownloader`) to inject `Authorization: bearer <token>` —
  token comes from `ConnectionProperties["Authorization"]` if present, else falls back to
  `DeviceConfiguration.Password` (chosen because `ConnectionProperties` allows 1024 chars vs.
  `Password`'s 50-char limit — the same M1 concern doc 10 flagged for BlueCity's Keycloak
  secret, resolved pragmatically here rather than widening the column).
- Adds a **payload-size guard**: `DeviceDownloaderConfiguration.MinimumFileSizeBytes` /
  `MaximumFileSizeBytes` (new fields on the *existing* shared config class, defaults 2 bytes /
  128 MiB), checked in an overridden `Execute()` before the file reaches the decoder — rejects
  and deletes truncated/oversized downloads, logging measured byte counts either way. This is
  a generally useful pattern; consider it for `OusterBlueCityEdgeDownloaderClient` too (doc 02
  WP2) rather than reinventing it.
- **`BluebandLidarEventDecoder : EventLogDecoderBase<BluebandLidarEvent>`** parses the
  `{ "events": [...] }` envelope, sets `LocationIdentifier` from `device.Location`, and
  converts `date` (Unix ms) to **UTC** (`DateTimeOffset.FromUnixTimeMilliseconds(...).UtcDateTime`)
  — see next section.

**Takeaway for doc 12:** the plug-in contract should document **two** transport patterns, not
one — (A) a dedicated `IDownloaderClient`/`DownloaderClientBase` for vendors with nonstandard
auth/pagination (BlueCity: Keycloak token exchange, cursor pagination), and (B) a thin
`DeviceDownloader` subclass with predicate-based claiming for vendors that fit plain
HTTP/FTP/SFTP semantics already (BlueBand: static bearer token, single GET). Pick per-vendor
based on how much the transport actually deviates from the existing generic downloaders —
don't default to a full new client when a subclass override suffices.

## Time base: BlueBand stores UTC, and the importer now tolerates mixed Kind

Doc 10's finding **B1** says the ATSPM event-log pipeline is naive intersection-local, not
UTC (`EventLogFileImporter.IsAcceptableDateRange` used `DateTime.Now`) — this drove doc 03's
decision to store BlueCity's `LidarZoneEvent.Timestamp` as naive local, matching the rest of
the pipeline.

**BlueBand's decoder stores UTC instead** (`Timestamp = ...UtcDateTime`, i.e.
`DateTimeKind.Utc`), and the branch **patches `IsAcceptableDateRange`** to be `Kind`-aware:

```csharp
var now = log.Timestamp.Kind == DateTimeKind.Utc ? DateTime.UtcNow : DateTime.Now;
return log.Timestamp <= now && log.Timestamp > _options.EarliestAcceptableDate;
```

This **partially resolves B1**: the importer already supports a mixed fleet — some event
types naive-local (`IndianaEvent`, `SpeedEvent`, and BlueCity's planned `LidarZoneEvent`),
one now UTC (`BluebandLidarEvent`) — without conflict, because the check branches on the
value's own `DateTimeKind` rather than assuming one global time base. **Still open:** whether
anything *downstream* of the importer (aggregation, `dataapi`/`reportapi` reads, `webui`
display) also assumes one global time base when comparing/joining across event types at the
same location — B1's broader concern (doc 10) isn't fully closed by this one fix, just proven
tractable. Add to doc 05 as a refinement of B1, not a new item.

## Storage precedent — confirms doc 05 X14

This branch is the concrete precedent for X14 (doc 05): it did **not** give
`BluebandLidarEvent` its own converter. It modified the **one shared** converter
(`CompressedListConverter<EventLogModelBase>` → renamed `EventLogCompressedListConverter<EventLogModelBase>`,
still registered once on `CompressedEventLogBase` for the whole TPH hierarchy) to read a new
versioned envelope format (`EventLogCompression.cs`: `ATSPMCMP` magic + version + codec byte +
declared length + SHA-256 integrity hash) while **still writing legacy raw GZip(JSON) in this
release** — `EncodeBrotli` exists and is dual-read-capable but is explicitly "not the active
Event Log write path in Release 1." The codec byte currently defined: `BrotliCodec = 1`
(payload still JSON, just optionally Brotli-compressed instead of GZip, once the write path
is flipped in a later release).

**Correction (2026-09-17, per Codex's preflight review, doc 17 §1): this branch's existence
does not by itself settle X14** — it shows the shared-envelope *pattern* was chosen for a
different codec (Brotli), but doesn't prove anything about EF Core's behavior with a
per-closed-type converter override. X14 was subsequently settled by an actual spike (doc 17
§2: the per-type override throws `InvalidOperationException`), which happens to confirm the
same shared-converter direction this branch took — but by direct evidence, not by inference
from this branch. See doc 03 §"`Data` payload format," rewritten around the spike results.

## Coordination required with `feature/lidar-integration`

Both branches touch `EventLogContext.cs`'s `OnModelCreating` and the compression converter
class. Before Ouster's storage-format work (doc 03) is built:

1. Merge or rebase `feature/lidar-integration` onto (or cherry-pick) `codex/blueband-lidar-event-import`
   so there's one `EventLogCompression`/`EventLogCompressedListConverter` implementation, not two
   competing ones.
2. Add the Protobuf codec to the **same** envelope/converter this branch introduced, not a
   parallel file.
3. `LidarZoneEvent` (BlueCity) and `BluebandLidarEvent` both become subject to whatever
   polymorphic-serialization constraint Protobuf introduces (see doc 03 — `[ProtoInclude]`
   subtype registration is per-`EventLogModelBase`-hierarchy, not per vendor), so this is a
   shared design conversation across both vendors, not a BlueCity-only decision.

## Operational notes (from `Atspm/EventLogUtility/BLUEBAND.md`)

- No separate command/scheduler — BlueBand rides the existing `EventLogUtility log` workflow
  like everything else (same pattern doc 08 WP4 chose for BlueCity, independently).
- Device config: `DeviceType=LidarSensor`, `Protocol=Http`, `Port=8088`,
  `Path=/api/app/spm+/events`, `Query` uses the existing `[LogStartTime]`/`[DateTime]` token
  syntax (same mechanism doc 02 relies on for BlueCity), `Decoders=["BluebandLidarEventDecoder"]`,
  token in `ConnectionProperties["Authorization"]` (preferred) or `Password` (fallback, short
  tokens only).
- Reference payload size: ~12 MB per 2-hour pull at the validated site — informs the
  `MaximumFileSizeBytes` default (128 MiB) and is a useful cross-check for BlueCity's own
  volume estimate (doc 03: ~110k events/day/box).

## Open items this raises (add to doc 05 tracking)

| # | Item | Impact |
| --- | --- | --- |
| X15 | Does UDOT's BlueBand fleet reliably populate `phase`/`ring`/`detector`? If so, is phase-based analysis (closed for BlueCity, doc 09) back in scope for BlueBand specifically? | Could reopen SPM-style measures for BlueBand only — a scope conversation, not a design blocker. |
| X16 | Should `OusterBlueCityEdgeDownloaderClient` (doc 02/08 WP2) adopt the same `MinimumFileSizeBytes`/`MaximumFileSizeBytes` payload-size guard BlueBand introduced on the shared `DeviceDownloaderConfiguration`? | Cheap, already-built protection against truncated/oversized downloads; no reason to skip it for BlueCity. |
| X17 | Does anything downstream of `EventLogFileImporter` (aggregation, `dataapi`, `reportapi`, `webui`) assume a single global time-base `DateTimeKind` when comparing events across types at one location, now that BlueBand is UTC and BlueCity (planned) is naive-local? | Refines B1 (doc 10) — the importer itself tolerates mixed `Kind`; unclear if everything downstream does. |
