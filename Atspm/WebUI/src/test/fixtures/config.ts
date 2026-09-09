// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - test/fixtures/config.ts
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import type {
  Approach,
  Detector,
  DirectionType,
  Location,
  MeasureType,
  RouteLocationDto,
  SearchLocation,
  WatchDogIgnoreEvent,
} from '@/api/config'

// Config-API payloads in the shape the API actually sends, recorded from
// ConfigApi running against a seeded in-memory database (2026-08-28).
//
// Two things about that shape matter to almost every consumer:
// - Entity enums are member names ("NB", "V", "Initial"), because the OData
//   formatter writes them that way. DTOs that System.Text.Json serializes
//   (RouteLocationDto below) carry the integer instead.
// - Navigation properties are present but null unless $expand asked for
//   them - and the Location/{key}/approaches navigation action ignores query
//   options altogether, so its directionType is always null
//   (approachesOfLocation1001). The Approach entity set honours $expand
//   (approachNorthbound).
//
// `satisfies` keeps each fixture honest against the generated type it stands
// in for, so a spec change that alters a shape fails here, at compile time.

export const measureTypes = [
  {
    abbreviation: 'PPT',
    name: 'Purdue Phase Termination',
    showOnWebsite: true,
    showOnAggregationSite: false,
    displayOrder: 1,
    id: 1,
    created: null,
    modified: null,
    createdBy: null,
    modifiedBy: null,
  },
  {
    abbreviation: 'SM',
    name: 'Split Monitor',
    showOnWebsite: true,
    showOnAggregationSite: false,
    displayOrder: 5,
    id: 2,
    created: null,
    modified: null,
    createdBy: null,
    modifiedBy: null,
  },
] satisfies MeasureType[]

export const directionTypes = [
  {
    abbreviation: 'NA',
    description: 'Unknown',
    displayOrder: 0,
    id: 'NA',
    created: null,
    modified: null,
    createdBy: null,
    modifiedBy: null,
  },
  {
    abbreviation: 'NB',
    description: 'Northbound',
    displayOrder: 3,
    id: 'NB',
    created: null,
    modified: null,
    createdBy: null,
    modifiedBy: null,
  },
] satisfies DirectionType[]

const audit = {
  created: '2026-08-28T21:09:14.9405961Z',
  modified: '2026-08-28T21:09:14.9405961Z',
  createdBy: 'System',
  modifiedBy: 'System',
}

export const detector10011 = {
  dectectorIdentifier: '10011',
  detectorChannel: 1,
  distanceFromStopBar: null,
  minSpeedFilter: null,
  dateAdded: '2026-01-01T00:00:00-07:00',
  dateDisabled: null,
  laneNumber: 1,
  movementType: 'T',
  laneType: 'V',
  detectionHardware: 'NA',
  decisionPoint: null,
  movementDelay: null,
  latencyCorrection: 0.0,
  approachId: 1,
  id: 1,
  ...audit,
} satisfies Detector

// GET /Approach/1?$expand=directionType (and each item of
// GET /Approach?$filter=locationId eq 1&$expand=directionType)
export const approachNorthbound = {
  description: 'Northbound',
  mph: 35,
  protectedPhaseNumber: 2,
  isProtectedPhaseOverlap: false,
  permissivePhaseNumber: null,
  isPermissivePhaseOverlap: false,
  pedestrianPhaseNumber: null,
  isPedestrianPhaseOverlap: false,
  pedestrianDetectors: '',
  transitSignalPriorityNumber: null,
  locationId: 1,
  directionTypeId: 'NB',
  id: 1,
  ...audit,
  directionType: directionTypes[1],
} satisfies Approach

// GET /Location/1/approaches - the navigation-property form: same entity,
// nothing expanded beneath it, and no way to ask (the action ignores
// $expand).
export const approachesOfLocation1001 = [
  { ...approachNorthbound, directionType: null },
] satisfies Approach[]

// GET /Location/1?$expand=approaches($expand=detectors)
export const location1001 = {
  latitude: 40.758701,
  longitude: -111.876183,
  note: '',
  primaryName: 'Main St',
  locationIdentifier: '1001',
  secondaryName: '400 S',
  jurisdictionId: null,
  chartEnabled: true,
  versionAction: 'Initial',
  start: '2026-01-01T00:00:00-07:00',
  pedsAre1to1: false,
  locationTypeId: 1,
  regionId: null,
  id: 1,
  ...audit,
  jurisdiction: null,
  region: null,
  approaches: [
    {
      ...approachNorthbound,
      directionType: null,
      detectors: [detector10011],
    },
  ],
} satisfies Location

// GET /Location/GetLocationsForSearch - also an OData entity set, so it
// arrives in the collection envelope like the rest.
export const searchLocations = [
  {
    id: 1,
    locationIdentifier: '1001',
    latitude: 40.758701,
    longitude: -111.876183,
    primaryName: 'Main St',
    secondaryName: '400 S',
    chartEnabled: true,
    regionId: null,
    jurisdictionId: null,
    areas: [],
    charts: [1, 2, 3, 4, 14, 15, 17, 31, 39],
    start: '2026-01-01T00:00:00-07:00',
    locationTypeId: 1,
    hasRampDevice: null,
  },
] satisfies SearchLocation[]

// GET /WatchDogIgnoreEvent needs a signed-in user, so this one is built from
// the generated type rather than recorded; the enum fields follow the same
// member-name rule the recorded entities show.
export const watchDogIgnoreEvents = [
  {
    id: 1,
    locationId: 1,
    locationIdentifier: '1001',
    start: '2026-03-01T00:00:00',
    end: '2026-03-31T00:00:00',
    issueType: 'RecordCount',
    componentType: 'Location',
    componentId: 1,
    phase: 2,
    key: '',
    ...audit,
  },
] satisfies WatchDogIgnoreEvent[]

// GET /GetRouteView/{id} returns RouteDto through System.Text.Json, so its
// direction ids are the integers (1 = NB, 2 = SB), not the names.
export const routeLocation1001 = {
  id: 10,
  order: 1,
  primaryPhase: 2,
  opposingPhase: 6,
  primaryDirectionId: 1,
  primaryDirectionDescription: 'Northbound',
  opposingDirectionId: 2,
  opposingDirectionDescription: 'Southbound',
  isPrimaryOverlap: false,
  isOpposingOverlap: false,
  previousLocationDistanceId: null,
  previousLocationDistance: null,
  nextLocationDistanceId: null,
  nextLocationDistance: null,
  locationIdentifier: '1001',
  longitude: -111.876183,
  latitude: 40.758701,
  primaryName: 'Main St',
  secondaryName: '400 S',
  locationId: 1,
  routeId: 5,
  approaches: null,
} satisfies RouteLocationDto
