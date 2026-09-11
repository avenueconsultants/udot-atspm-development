# 06 — Auto-Config Feasibility

**Question:** can ATSPM pull configuration from a BlueCity edge unit and **automatically
create the `Approach` + `Detector` assignments** for that location, instead of an operator
hand-entering one detector per zone?

**Verdict: yes, and cleanly — as a channel-match against the pre-existing ATSPM signal.**
Two documents settle it:

1. The live box exposes a full zone inventory (`GET /snmp/zone_mappings`) and every zone
   name follows a **documented UDOT standard**.
2. UDOT's *"Ouster LiDAR Setup Guidance"* (v1.10, 2026-01-11) already defines the manual
   ATSPM procedure — and the key rule: **on an existing intersection the LiDAR reuses the
   channel numbers the previous detection used**, so ATSPM needs no channel change.

So the phase number is never guessed. The LiDAR zone's **channel number** is the join key
to the `Detector` (and therefore `Approach` and phase) that **already exists** in ATSPM for
that signal.

## The join

Zone name grammar (see [`07-edge-api-reference.md`](07-edge-api-reference.md) §"Zone naming
convention"): `CLASSES-APPROACH-DIRECTION+LANE-TYPE-CHANNEL#`, e.g. `VC-NB-L1-CO-22`.

```
LiDAR zone  VC-NB-L1-CO-22
                        │ channel 22
                        ▼
ATSPM  Location (this signal) ─▶ Approach (NB) ─▶ Detector where DetectorChannel == 22
                                                   └─ already has phase, movement, lane
```

For each zone from `/snmp/zone_mappings`:

1. **Parse** the name → `{ classes[], approach, movement, lane, services:[{type, channel}] }`.
   (One zone can yield several `(type, channel)` pairs — `COYR-1723` → ch 17 Count + ch 23
   Yellow-Red.)
2. For each `(type, channel)`:
   - **Match** an existing `Detector` at this `Location` with `DetectorChannel == channel`.
     - **Found** → update in place: `DetectionHardware = LiDar`, `LatencyCorrection = 0`
       (exactly the guidance's manual steps), and record the BlueCity `zone_id` on it (new
       nullable field, or `DeviceProperties`) so `object_events` rows join back.
     - **Not found** (new detection — passive ped, count-only, …) → create a new `Detector`
       on the `Approach` for `approach`/`movement`, `DetectionHardware = LiDar`,
       `MovementType` from `movement`, `LaneNumber` from `lane`, `DetectionTypes` from
       `type` (mapping below), `DetectorChannel = channel`. **Phase comes from the
       `Approach`**, which either already exists (match by `DirectionType`) or is created
       and flagged "needs phase" for operator review.
3. Zones whose names don't parse, or `-Q-` / crosswalk-only zones with no channel → create a
   `Detector` **disabled**, flagged "needs review".

`TYPE` → `DetectionTypes` (reuse existing enum; refine later):

| Zone `TYPE` | ATSPM `DetectionTypes` |
| --- | --- |
| `PR` Presence | `SBP` (stop-bar) or `AP` (advanced), by `DistanceFromStopBar` |
| `CO` Count | `LLC` lane-by-lane count |
| `QU` Queue | `IQ` / `EQ` |
| `YR` Yellow-Red | out of scope (UDOT not adding these to ATSPM) |
| `PU` Pulse / `SI` Sign | case-by-case |

`DIRECTION` → `MovementType`: `T→T R→R L→L TL→TL TR→TR TLR→LTR`.
`APPROACH` → `DirectionType`: `NB→NB SB→SB EB→EB WB→WB`; `N/S/E/W` → crosswalk on that leg.

## What still needs a human / an input

| Item | Resolution |
| --- | --- |
| **Phase number** | Inherited from the matched/《existing》`Approach`. Only "needs review" when a brand-new approach is created (rare — new detection on an existing signal still lands on an existing approach). |
| **Which ATSPM `Location` is this box?** | The BlueCity **site name** encodes the UDOT Intersection ID as its first token (guidance: `IntersectionID_Major / Minor_City`, e.g. `5000_Riverdale Rd (SR-26) / 700 W_Riverdale`). If that's readable from the API (not in `/about` or `/config` — **check site-settings**), the box→`Location` link can be automatic; otherwise operator enters it once on the `Device`. |
| **Zone geometry** (`DistanceFromStopBar`, exact `LaneType`) | Not in the API. Guidance gives standard lengths (through presence 65 ft, left stop-bar 50 ft, left queue 15 ft @ 50 ft back). Operator adjusts, or accept defaults. |
| Name-convention drift | Parser tolerates known variants (`LT` vs `TL`, prefix-less `SB-Q-Ln`); anything else → "needs review". |

## Proposed shape — "propose, don't auto-apply"

Same as before: mirror `SignalTimingPlans`
(`Generate…` → `MergeExisting…` → `Reconcile…`). A `configapi` action +
`DatabaseInstaller` command (`lidar-autoconfig --device <id>`) that:

1. pulls `/snmp/zone_mappings` + `/config` (+ site settings if available);
2. generates the draft per the join above, tagging each field's source
   (`matched-channel` / `new-on-existing-approach` / `needs-review`);
3. merges onto the `Location` — matching existing `Detector`s by `DetectorChannel`, never
   clobbering hand-built config;
4. reconciles on re-run (new zone → new disabled `Detector`; zone gone → `DateDisabled`;
   renamed → update);
5. returns the draft for review; applying it creates a new **"LiDAR" `Location` version**
   (`AtspmConfigModelBase` / `LocationVersionActions`) — which is exactly the version the
   guidance tells operators to add by hand today.

This automates the guidance's "Setup and Adjustments in ATSPM" section
(add "LiDAR" approach version → set Hardware = LiDAR → Latency Correction = 0 → **verify
channel assignments match**) and turns its manual "verify channels" step into the primary
mechanism.

## Feasibility verdict

| Piece | Verdict |
| --- | --- |
| Zone inventory | **Available** (`/snmp/zone_mappings`) |
| Parse name → approach / movement / lane / type / channel | **Reliable** — documented UDOT standard, tolerate a few known variants |
| `Detector` fields | **Auto-fillable** from the name + channel match |
| `Approach` + **phase number** | **Inherited** from the existing ATSPM signal via channel match; new-approach case is the only review point |
| Box → `Location` | The analytics API does **not** expose the intersection id (`/about`, `/config` checked). `LocationIdentifier` is operator-entered on the `Device`; reading it from the Detect core API is a possible fast-follow. |
| Fully hands-off | **Close.** With the co-located ATSPM signal present (normal for UDOT), a run produces an apply-ready "LiDAR" `Location` version with only geometry tweaks and the (rare) new-approach phase left for the operator. |

## Decisions

- **In Phase 1** (per README decisions log): the channel-match **draft** generator — match
  zone channel → existing `Detector`, stage `Hardware = LiDAR` + `Latency = 0`, stage new
  detectors for unmatched zones, present as a reviewable "LiDAR" `Location` version. See
  [`08-integration-plan.md`](08-integration-plan.md) WP6.
- **Fast-follow:** full generate/merge/reconcile with scheduled re-sync; reading the
  intersection id from the Detect core API.
- **Confirm during build:** the `TYPE → DetectionTypes` mapping with UDOT (doc 05 Q12).
