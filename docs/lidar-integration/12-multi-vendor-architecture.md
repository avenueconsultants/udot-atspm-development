# 12 — Multi-Vendor LiDAR Architecture

**Requirement:** a second (or third) LiDAR vendor must be addable to ATSPM **without major
development** — no changes to storage, the ingestion workflow, aggregation, or (once built,
doc 11) the measures/reporting layer. Only vendor-specific glue should differ.

This doc renames a few Phase-1 components to make the vendor boundary explicit, and defines
the plug-in contract a second vendor implements. Ouster BlueCity remains the only vendor
actually built in Phase 1; this is the shape that keeps it from being a one-off.

## Where "universal" already comes for free

The Phase-1 design (docs 01–02) already used ATSPM's two general-purpose extension points,
which is what makes multi-vendor cheap:

| Extension point | Existing ATSPM mechanism | Consequence |
| --- | --- | --- |
| **Transport/auth** | `IDownloaderClient`, matched to a `Device` by `TransportProtocols` (`DeviceDownloader: _clients.FirstOrDefault(w => protocol == w.Protocol)`) | A new vendor with different auth (API key, mTLS, SigV4, Basic…) or a different pull/pagination scheme is **one new class + one new enum value** — the workflow, archiving, and storage never change. |
| **Payload → model** | `IEventLogDecoder<T>`, matched by class name in `DeviceConfiguration.Decoders[]` | A new vendor's JSON/XML/CSV shape is **one new decoder class** mapping into the *same* `LidarZoneEvent`. Both new-component types **auto-register** in DI (`RegisterServicesByInterface<T>()`) — zero wiring. |

Nothing about `EventLogContext`, `CompressedEventLogs<LidarZoneEvent>`, `ArchiveDataEvents`,
or `Upsert` (doc 03/doc 10) is BlueCity-specific — they operate on the canonical model,
regardless of which vendor produced it. **This is why multi-vendor support is a plug-in
problem, not a rework problem**, provided the canonical model and naming stay vendor-neutral
now, before Codex builds it.

## Renaming for vendor-neutrality *(applies to docs 01, 02, 04, 05, 06, 07, 08, 09)*

Phase-1 drafts named things generically (`EdgeRestDownloaderClient`,
`BlueCityObjectEventsDecoder`, `TransportProtocols.EdgeRest`) as if there would only ever be
one REST-based LiDAR vendor. Renamed to make the vendor boundary explicit and leave room for
siblings:

| Old (Phase-1 drafts) | New | Why |
| --- | --- | --- |
| `TransportProtocols.EdgeRest` | `TransportProtocols.OusterBlueCityEdge` | Unlike `Ftp`/`Sftp`/`Http` (generic protocols), each vendor's edge REST dialect has its own auth + pagination + windowing — it isn't a shared "protocol" the way file transport is. Each vendor gets its **own enum value**, exactly like `Ftp` vs `Sftp` vs `Snmp` already do for controllers. A second vendor adds e.g. `TransportProtocols.<Vendor>Edge`. |
| `EdgeRestDownloaderClient` | `OusterBlueCityEdgeDownloaderClient` | One class per vendor; `Protocol => OusterBlueCityEdge`. |
| `BlueCityObjectEventsDecoder` | `OusterBlueCityObjectEventsDecoder` | One decoder per vendor per payload shape it emits. |

No other Phase-1 decision changes — this is a naming/packaging correction, applied before
any code exists.

## The canonical event model stays vendor-neutral

`LidarZoneEvent` (doc 03) is ATSPM's **canonical** LiDAR detection record — every vendor's
decoder maps into it. Two additions make it actually vendor-neutral instead of implicitly
BlueCity-shaped:

| Field | Type | Purpose |
| --- | --- | --- |
| `Classification` | `string`, from an **ATSPM-owned canonical set** | Normalized across vendors: `Vehicle`, `LargeVehicle`, `Pedestrian`, `Bicycle`, `Motorcycle`, `Unknown` (extend as needed). Each vendor decoder maps its native taxonomy into this set — see below. |
| `VendorClassification` | `string`, nullable | The vendor's **raw** class string, unmapped (BlueCity: `VEHICLE`/`car`; a future vendor: whatever it calls things). Keeps ingestion lossless and lets a bad mapping be corrected later without re-ingesting. |

Which vendor produced a record is **not** a field on `LidarZoneEvent` — it's resolved via
the owning `Device.DeviceConfiguration.Product` (see "Recording the vendor" below), keeping
the event model itself minimal and consistent with how ATSPM already separates "what kind of
thing" (`DeviceType`/`DetectionHardware`) from "which vendor/product" (`Product`).

Everything else in `LidarZoneEvent` (timestamp, zone id/name, object id, speeds, dimensions,
dwell time, units) is already generic — no vendor renamed those.

### Classification normalization

Each vendor decoder owns a **mapping table** from its native classes to the canonical set,
e.g.:

```
BlueCity:  VEHICLE→Vehicle, LARGE_VEHICLE→LargeVehicle, PERSON→Pedestrian,
           BICYCLE→Bicycle, PROSPECT/UNKNOWN→Unknown
VendorX:   car/truck/bus→Vehicle, ped→Pedestrian, bike→Bicycle, ...
```

The table lives with the decoder (a small `IReadOnlyDictionary<string,string>` or similar),
not in shared code — adding a vendor never touches BlueCity's mapping or vice versa.
Measures (doc 11) are built against `Classification` (canonical), so they work unmodified
across vendors; `VendorClassification` is available for vendor-specific drill-down if ever
needed.

### Recording the vendor

ATSPM already has the right entity for this: `DeviceConfiguration.ProductId → Product`. One
`Product` row per LiDAR vendor/model (e.g. "Ouster BlueCity", "VendorX Edge LiDAR"), and each
vendor's `DeviceConfiguration` template points at it — the same mechanism already used to
distinguish speed-sensor products. **No new config entity needed.** `Detector.DetectionHardware`
stays the generic `LiDar` value for all vendors (it denotes detection *technology*, not
vendor); vendor distinction lives on `DeviceConfiguration`/`Product`, matching how the rest
of ATSPM's config model separates "what kind of thing" from "which product."

## The plug-in contract for a new vendor

Adding vendor N+1, once BlueCity (N=1) is built, is:

| # | Deliverable | Touches shared code? |
| --- | --- | --- |
| 1 | `TransportProtocols.<Vendor>Edge` enum value | No — additive enum member |
| 2 | `<Vendor>DownloaderClient : DownloaderClientBase` — that vendor's auth (whatever scheme), windowing, and pagination, writing a temp file of records | No — auto-registered by interface |
| 3 | `<Vendor>ObjectEventsDecoder : EventLogDecoderBase<LidarZoneEvent>` — that vendor's payload → `LidarZoneEvent`, including its classification-mapping table | No — auto-registered by interface |
| 4 | A `Product` row + `DeviceConfiguration` template for the vendor (protocol, decoder name, connection properties) | No — existing config surface |
| 5 | *(optional)* A zone-naming parser for that vendor's auto-config (doc 06) if it has an equivalent zone/channel concept | No — see below |

Nothing in `EventLogContext`, `ArchiveEventLogsWorkflow`, `AggregationWorkflow`, or (once
built) the `reportapi`/`webui` measure layer changes. A LiDAR measure built against
`LidarZoneEvent`/`Classification` automatically covers every vendor whose decoder populates
that model — this is the concrete "no major development" guarantee.

## Auto-config (doc 06) across vendors

The channel-match *mechanics* (match a channel number to an existing ATSPM `Detector`,
stage `DetectionHardware = LiDar`, present a draft `Location` version for review, apply on
confirm) are already vendor-neutral — they operate on ATSPM config, not on vendor payloads.

What's vendor-specific is **discovering zones and reading a channel number out of them** —
today that's BlueCity's `GET /snmp/zone_mappings` + the UDOT
`CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#` naming convention. Generalize this as a
small per-vendor interface:

```csharp
interface ILidarZoneDiscoveryProvider
{
    Task<IEnumerable<LidarZoneDescriptor>> DiscoverZones(Device device, CancellationToken ct);
    // LidarZoneDescriptor: { ZoneId, ZoneName, ParsedChannels: [(Type, Channel)], Approach, Movement, Lane }
}
```

`OusterBlueCityZoneDiscoveryProvider` implements this via `/snmp/zone_mappings` + the UDOT
naming grammar (doc 07). A second vendor implements the same interface however its box
exposes zones (a dedicated config endpoint, a different naming scheme, etc.) — the
`lidar-autoconfig` command (doc 08 WP6) consumes `ILidarZoneDiscoveryProvider` generically
and never branches on vendor. If a vendor has no equivalent concept, its `Device`s simply
fall back to fully manual `Detector` entry (doc 04) — auto-config is an enhancement, not a
dependency of ingestion.

## What genuinely cannot be generalized (and that's fine)

- **Auth mechanics** — each vendor's client owns its own scheme entirely (this is normal;
  `FtpDownloaderClient`/`SftpDownloaderClient`/`HttpDownloaderClient` already differ this way).
- **Windowing/pagination quirks** — each vendor's client owns its own request/paging logic
  against `IDownloaderClient`'s file-based contract (doc 02).
- **Zone-naming convention** — inherent to how that vendor's box (and the agency's
  commissioning practice) expose zones; handled per-vendor in `ILidarZoneDiscoveryProvider`.
- **Field coverage** — a vendor with materially different data (e.g. no per-object speed, or
  extra fields BlueCity doesn't have) may need `LidarZoneEvent` extended with nullable
  fields. Prefer **additive, nullable** fields over a second model — keeps measures (doc 11)
  vendor-agnostic. If a vendor's data model is fundamentally different in kind (not just
  field coverage), that is a signal for a genuinely new canonical model, not a forced fit.

## Net effect

With the rename above, Phase 1 delivers the *first* vendor implementation of a pattern, not
a BlueCity-only pipeline. Adding a second vendor is items 1–5 above: no schema change, no
workflow change, no measures rework — matching the "universal collector" requirement.
