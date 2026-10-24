# 17 — Codex preflight findings

Verified 2026-09-17 on `feature/lidar-integration` at `da9502b7`, including the existing uncommitted design documents. No feature code, branch merge, or existing document edits were made.

The executable spike lives in `C:/Users/nlitteral/AppData/Local/Temp/atspm-lidar-preflight-20260917/` (`Program.cs`, `Spike.csproj`, `results.txt`). Run `dotnet run --project Spike.csproj` there. It references the real Data project, subclasses its real EventLogContext, and uses EF Core/SQLite 8.0.11, toolkit 1.6.0, and protobuf-net 3.2.56. The protobuf version is a spike dependency, not a production dependency decision. Database round-trips used in-memory SQLite; no deployed database or box was queried.

## 1. Branch coordination — not reconciled

After `git fetch origin`, `origin/main` is `f630f98d`; BlueBand remains at `1b4f5ba8`. `git branch -r --contains 1b4f5ba8` lists only the BlueBand branch. Its commit remains in `origin/main..origin/codex/blueband-lidar-event-import`; main still uses the old converter. BlueBand is **not merged into main**. The common ancestor with this feature branch is `a4a0ef2b`.

Recommended coordination plan: preserve/commit the current documentation work, merge current `origin/main` into the feature branch, then merge `origin/codex/blueband-lidar-event-import`, resolving and testing shared ingestion/compression changes together. Prefer this over cherry-picking isolated converter files, which would separate the envelope from its compatibility tests and other integration changes. This is a recommendation, not an executed or team-approved merge. WP1 storage remains gated on reconciliation.

Doc 15's description of the branch is supported, but “shipped” and “this settles X14” are not established by the branch's existence.

## 2. X14 — the proposed independent override fails

The real model maps `CompressedEventLogBase.Data` once (`Atspm/Data/EventLogContext.cs:95`). The generic class **hides** it with `new ICollection<T> Data` (`Atspm/Data/Models/CompressedDataBase.cs:96`).

Spike results:

- Baseline: a no-op byte converter is shared by IndianaEvent and SpeedEvent; their `FindProperty("Data")` results are the same metadata object.
- Exact proposed expression, `Entity<CompressedEventLogs<IndianaEvent>>().Property(e => e.Data).HasConversion(...)`, with an `ICollection<IndianaEvent>` XOR converter: **InvalidOperationException during model construction** — “The property 'Data' cannot be added to the type 'CompressedEventLogBase' because it is declared on the CLR type 'CompressedEventLogs<IndianaEvent>'.”
- Targeting the inherited property by name with its actual `IEnumerable<EventLogModelBase>` type succeeds, but replaces the converter **for the entire hierarchy**, including SpeedEvent.
- No-op bytes `801D7E2AA414DF08` versus XOR bytes `7FE281D55BEB20F7`; both decode to the original timestamp. Both successful model configurations also passed SQLite save/clear-tracker/read round-trips.

Therefore the proposed per-closed-type override is not viable with this mapping. A shared converter dispatcher is feasible as a design direction, but **branching on `typeof(T)` cannot distinguish event types here**: T is always EventLogModelBase. It would need to inspect/validate runtime element types on write and use a payload codec/type identifier on read, since a value converter receives the property value, not the row's discriminator. Empty/mixed lists need explicit rules. Concrete protobuf serialization can live behind that dispatcher; independent EF converters are not a prerequisite. This dispatcher/envelope integration was not implemented or integration-tested.

## 3. Protobuf — concrete contracts work, with two important qualifications

Using protobuf-net 3.2.56:

- Serializing `List<EventLogModelBase>` containing an annotated concrete subtype fails: no serializer for the unannotated actual base.
- An annotated throwaway base without subtype registrations fails with “Unexpected sub-type” when given a derived instance. This agrees with protobuf-net's [documented inheritance contract](https://github.com/protobuf-net/protobuf-net#inheritance).
- Serializing `List<ProtoEvent>` directly succeeds without ProtoInclude, but annotating only the subtype's own field **silently loses inherited Timestamp** (it returns DateTime.MinValue). Explicitly registering Timestamp and the concrete field in a flat RuntimeTypeModel contract preserved both. A concrete wire DTO is another design option; all required inherited fields must be accounted for.
- The closed generic property is **not an absolute runtime invariant**. Assigning a SpeedEvent through `((CompressedEventLogBase)indianaRow).Data` succeeds; reading `indianaRow.Data` then throws InvalidCastException. The discriminator does not validate list contents. Normal archival does create homogeneous lists by runtime event type (`Atspm/Infrastructure/WorkflowSteps/ArchiveDataEvents.cs:57–86`), but other base-property write paths can violate that assumption.

Conclusion: a validated, concrete, flat protobuf contract can be ProtoInclude-free. The current shared base-typed serializer cannot simply switch to protobuf, and the TPH discriminator alone does not make that safe. Runtime subtype registrations are also possible; attributes on the shared base are not the only way to configure polymorphism.

## 4. H1 — snaps, but exact-hour batches still break canonical hour keys

Pinned dependency: `Atspm/Data/Data.csproj:60`, Utah.Udot.NetStandardToolkit **1.6.0**. Executed the installed assembly's actual `Timeline<StartEndRange>(IEnumerable<ITimestamp>, TimeSpan)` constructor, the overload used by ArchiveDataEvents.

| Input timestamps | Start | End |
| --- | --- | --- |
| 10:12:23 and 10:48:51 | 10:00 | 11:00 |
| 10:12:23 only | 10:00 | 11:00 |
| 10:00:00 exactly, alone | 10:00 | **10:00** |
| 10:12:23 and 11:00:00 | 10:00 | 11:00 |

It floors the start and ceilings the end in these cases; an already aligned end remains aligned. Consequently “it snaps, therefore no code change” in WP7 is too broad. A poll containing only events exactly at 10:00 and a subsequent poll containing events later in that hour produce different primary keys. Use a canonical hour start and **end = start + one hour** for each archive hour group; merely applying floor/ceil again does not fix the exact-boundary case. Add overlapping-poll coverage for that case alongside equality/hash tests. No archive fix was written during this pass.

## 5. Config lengths and security — limits confirmed; read exposure confirmed in source

`Atspm/Data/Configuration/DeviceConfigConfiguration.cs:49–51,83–89` configures ConnectionProperties at **1024**, UserName at **50**, and Password at **50**. The 1024 limit applies to the entire serialized dictionary, not each value. These are model constraints; actual database enforcement depends on provider/schema.

Password is explicitly in the OData model (`Atspm/ConfigApi/Configuration/DeviceConfigurationOdataConfiguration.cs:49`). The entity also exposes ConnectionProperties without an ignore attribute (`Atspm/Data/Models/ConfigurationModels/DeviceConfiguration.cs:54,95`). GET actions require **Device:View**, not Device:Edit or a dedicated credential permission (`Atspm/ConfigApi/Controllers/DevicePolicyControllerBase.cs:37–48`), and return repository entities without redaction (`ConfigControllerBase.cs:63–65,82–91`). Default reads and `$select=*` therefore include Password; ConnectionProperties is not a safe read-hiding place for a secret either.

This establishes exposure to callers authorized for device reads, not necessarily anonymous access. For example, LocationConfigurationAdmin receives DeviceView without device-edit permission (`Atspm/Application/Common/AtspmAuthorization.cs:225–233`). No live HTTP/security-policy test was run against a deployment.

Lockdown needs a credential-free read DTO/EDM projection (also covering expanded device configuration and secret-valued ConnectionProperties), with a separately authorized write path that preserves omitted secrets. Removing Password alone would leave the proposed Keycloak secret exposed in ConnectionProperties. Treat response redaction and write semantics together rather than blindly adding an ignore attribute to a shared read/write entity.

## 6. WP0 — partial seed available, no authoritative fleet inventory found

Repository config/deployment/data-file searches found no LiDAR fleet export or deployment inventory linking all box addresses to LocationIdentifier. `Atspm/DeviceEmulator/devices.json` uses loopback emulator addresses. `Atspm/ApplicationTests/Analysis/TestData/Location7115TestData.json` is a Redwood Road / 7000 South test fixture, not the documented pilot.

Existing doc 07 supplies one historical seed: **10.235.13.48**, “US-89 / Wash Blvd / 12th St / SR-39”, realm `detect`, with Analytics/auth previously verified on 2026-09-10 (`07-edge-api-reference.md:3` and doc 02's authentication section). It does not establish the authoritative ATSPM LocationIdentifier or current fleet health.

The configuration schema can support an inventory export: Device.Ipaddress, Device.LocationId, Device.DeviceConfigurationId (`Atspm/Data/Models/ConfigurationModels/Device.cs:49,69,79`) join to Location.LocationIdentifier (`Location.cs:87`) and product/config metadata. Export only non-secret fields and relevant realm information from a deployed config source; there is no such verified export in this checkout. Do not assume illustrative device IDs in doc 04 are real inventory.

WP0's ConfigApi exposure item is now answered by development work (item 5), so it need not wait for UDOT. Secret rotation, fleet enablement, authoritative IDs/realms, TLS deployment choice, mapping approval, retention representativeness, secret-length policy, and IP-versus-hostname coverage still need operational evidence.

## 7. ProtectedPhaseNumber = 0 — no phase-zero write validator found

Confirmed in the checked source: ApproachDto has an unconstrained int (`Atspm/ConfigApi/DTO/ApproachDto.cs:28`), Approach has an unconstrained int (`Atspm/Data/Models/ConfigurationModels/Approach.cs:44`), and ApproachService copies it unchanged on update and insert (`Atspm/ConfigApi/Services/ApproachService.cs:55,145`). ApproachConfiguration adds indexes, not phase constraints; ApproachOdataConfiguration adds no phase rule. The SQL Server model snapshot stores it as int without a phase-range check.

The frontend explicitly accepts zero: `Atspm/WebUI/src/features/locations/components/editApproach/EditApproach.tsx:110–128` rejects null/blank, not 0. Therefore no discovered DTO, service, EF model, or inspected UI validator blocks/coerces staged zero. This is a source-level conclusion, not a write test against a deployed database with potentially external triggers.

Other required data still matters: provide a valid Location/direction and initialized detector collections; ApproachService's response mapping enumerates Detectors. The future needs-review/apply gate remains necessary and is not supplied by existing validation. Zero alone does not prevent application of an unreviewed approach.

The storage dispatcher decision, branch reconciliation, exact-hour key correction, and credential read protection need to be reflected in the design before WP1+ implementation starts.
