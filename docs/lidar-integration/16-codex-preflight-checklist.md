# 16 — Preflight Checklist for Codex (verify before writing WP1+ code)

Do not implement the LiDAR feature yet. This is a verification pass: confirm or refute each
item below against the actual codebase/tooling, and report back findings (which branch, which
option, what you found) so docs 03/05/06/08/10 can be finalized before coding starts. Where an
item says "spike," write a small throwaway test/script to get the answer — it does not need
to be kept.

Everything below cites the doc + section it affects. Read that doc's section for full context
before checking the item; this file is a checklist, not a replacement for the architecture
docs.

## 1. Branch coordination (blocks WP1 storage work entirely)

- [ ] Confirm the relationship between `feature/lidar-integration` (this branch) and
  `origin/codex/blueband-lidar-event-import` (commit `1b4f5ba8`) — the latter already
  modified `EventLogContext.cs` and added `Atspm/Data/Utility/EventLogCompression.cs` /
  `EventLogCompressedListConverter.cs`. Both branches touch the same shared compression
  converter. **Report:** has `codex/blueband-lidar-event-import` merged to `main` since?
  What's the plan — rebase `feature/lidar-integration` onto it, merge it in, or
  cherry-pick specific commits? Doc: [`15-blueband-integration.md`](15-blueband-integration.md)
  §"Coordination required."
- [ ] If not yet reconciled, do **not** start WP1's storage work until this is decided — two
  independent rewrites of the same converter will conflict.

## 2. EF Core: per-closed-type converter override under TPH (doc 05 X14)

- [ ] **Spike:** in a scratch `DbContext` (or a real unit test in `Atspm.Data.Tests` if that
  project exists), confirm whether `modelBuilder.Entity<CompressedEventLogs<SomeType>>()
  .Property(e => e.Data).HasConversion(customConverter)` actually takes effect for that one
  closed generic type, when the base `CompressedEventLogBase.Data` property already has a
  different converter configured via TPH in `OnModelCreating`. Use two throwaway converters
  (e.g. one that no-ops vs. one that XORs a byte) so a passing/failing round-trip is
  unambiguous — don't rely on protobuf itself to detect this, isolate the EF question first.
  **Report:** does the override take effect, get silently ignored, or throw at model-build
  time? Doc: [`03-data-model.md`](03-data-model.md) §"`Data` payload format", option list.
- [ ] This determines whether Protobuf storage for `LidarZoneEvent` is achievable via a
  per-type converter at all, or whether it requires branching the **shared** converter by
  `typeof(T)` instead (touches every event type, needs full regression coverage). Report
  which path is actually viable so doc 03 can be finalized to one design, not two.

## 3. Protobuf-net polymorphism constraint (doc 03, doc 10 P7)

- [ ] Confirm protobuf-net's actual behavior serializing `IEnumerable<EventLogModelBase>`
  (the converter's declared type) when the base class has **no** `[ProtoInclude]`
  registrations — does it throw at serialize time, or is there a runtime-type-resolution
  mode we're not aware of? If item 2's spike shows a per-closed-type override *does* work,
  this may be moot (the converter would only ever see one concrete `T`'s instances at a
  time) — confirm that assumption holds (i.e., does the closed-generic `CompressedEventLogs<LidarZoneEvent>.Data`
  property's runtime value ever actually contain a *different* concrete type than
  `LidarZoneEvent`, given the TPH discriminator? Should be no, but confirm — it changes
  whether `[ProtoInclude]` is needed at all for the closed-type path).
- [ ] **Report:** is the "closed, single-type" protobuf converter genuinely
  `[ProtoInclude]`-free, or did we miss a case where it still needs polymorphism?

## 4. `Timeline<StartEndRange>` hour-snap behavior (doc 05 H1, doc 08 WP7 — gating check)

- [ ] `ArchiveDataEvents` builds `new Timeline<StartEndRange>(list, TimeSpan.FromHours(1))`
  from the `Utah.Udot.NetStandardToolkit` NuGet package (source not in this repo). Find that
  package (decompile, or check if source is available from its own repo/NuGet symbols) and
  confirm: does constructing it with a 1-hour span **snap** `Start`/`End` to the hour
  boundary, or does it preserve the exact min/max timestamps of the input list?
- [ ] **Report:** which behavior, and the toolkit version pinned in this repo
  (`Atspm/Data.csproj` or wherever it's referenced). This determines whether WP7 needs an
  hour-snap fix or just `Equals`/`GetHashCode` tests (doc 08 WP7 both branches are already
  written — just needs the answer to pick one).

## 5. Config constraints (doc 05 Q8/M1, doc 10 S2)

- [ ] Confirm current column lengths: `DeviceConfiguration.Password`/`UserName`
  (`HasMaxLength(50)`?), `ConnectionProperties` (`HasMaxLength(1024)`?) — these drove the
  decision to put the BlueCity Keycloak secret in `ConnectionProperties` rather than
  `Password` (doc 04). Confirm current values are still accurate (repo may have changed since
  the review).
- [ ] Check `ConfigApi`'s `DeviceConfiguration` OData projection
  (`DeviceConfigurationOdataConfiguration` or equivalent) — does it expose `Password` to
  non-admin callers or in list/`$select=*` responses? **Report:** yes/no, and if yes, what it
  would take to lock it down (doc 10 S2).

## 6. WP0 prerequisites — which are already answerable from code/config vs. need UDOT

Doc 08 WP0 lists 9 items needing UDOT/Ouster input. A few might be partially answerable from
existing ATSPM config/deployment docs without waiting on UDOT:

- [ ] Is there an existing fleet inventory (boxes, IPs, intersection IDs) anywhere in
  ATSPM's config data or deployment scripts that could seed WP0's "list of pilot + fleet
  boxes" item, even partially?
- [ ] Report anything found — doesn't need to fully resolve WP0, just reduce what's genuinely
  blocked on UDOT.

## 7. Sanity-check the auto-config `ProtectedPhaseNumber = 0` plan (doc 06)

- [ ] We confirmed `Approach.ProtectedPhaseNumber` is non-nullable `int` and that `0` is
  used elsewhere as a "no protected phase" sentinel (`LeftTurnGapReport`/`VolumeService`/
  `ApproachVolumeReportService`/`PhaseService`). Before WP6 is built: check whether staging
  a new `Approach` row with `ProtectedPhaseNumber = 0` would trip any **validation** (DTO
  validation attributes, `ApproachService` business rules) that would reject or silently
  coerce it, since the review above only checked *read-side* usage, not write-side
  validation. **Report:** any validation that would block or complicate this.

## What to send back

A short report per numbered section above — confirm/refute + evidence (file:line, or spike
result). Once this comes back, doc 03 (storage) and doc 06/08 WP6 (auto-config) get a final
edit pass to lock in whichever path each spike confirms, and then WP1 coding can start.
