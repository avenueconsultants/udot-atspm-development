// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/routeFixtures.ts
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
  Route,
  RouteApproachDto,
  RouteDto,
  RouteLocationDto,
  SearchLocation,
} from '../../src/api/config'
import {
  DetectionHardwareTypes,
  DirectionTypes,
  DirectionTypesName,
  LaneTypes,
  MovementTypes,
} from '../../src/api/config/config-api.schemas'
import {
  routeLocation1001,
  searchLocations,
} from '../../src/test/fixtures/config'

// One two-location corridor (1001 -> 1002), in every shape the config API
// hands it out:
// - routeEntities: the OData Route entity set (GET /Route?expand=routeLocations),
//   where the direction ids are member names
// - routeView: RouteDto from GET /GetRouteView/{id}, System.Text.Json, so
//   the direction ids are integers
// - routeViewWithDetail: the same with includeLocationDetail=true, which adds
//   each location's approaches and detectors (also integers)
// The route editor, link pivot, aggregate charts and time-space specs all
// drive the same corridor so a change to the contract shows up in one place.

export const ROUTE_ID = 5
export const ROUTE_NAME = 'Main St corridor'

const audit = {
  created: '2026-08-28T21:09:14.94Z',
  modified: '2026-08-28T21:09:14.94Z',
  createdBy: 'System',
  modifiedBy: 'System',
}

export const distance1001to1002 = {
  id: 1,
  distance: 1200,
  locationIdentifierA: '1001',
  locationIdentifierB: '1002',
}

export const link1001 = {
  ...routeLocation1001,
  order: 0,
  nextLocationDistanceId: distance1001to1002.id,
  nextLocationDistance: distance1001to1002,
} satisfies RouteLocationDto

export const link1002 = {
  ...routeLocation1001,
  id: 11,
  order: 1,
  locationId: 2,
  locationIdentifier: '1002',
  secondaryName: '500 S',
  latitude: 40.7575,
  longitude: -111.8762,
  previousLocationDistanceId: distance1001to1002.id,
  previousLocationDistance: distance1001to1002,
} satisfies RouteLocationDto

export const routeView = {
  id: ROUTE_ID,
  name: ROUTE_NAME,
  ...audit,
  routeLocations: [link1001, link1002],
} satisfies RouteDto

const routeApproach = (
  id: number,
  link: RouteLocationDto,
  direction: 'NB' | 'SB'
): RouteApproachDto => ({
  id,
  description: direction === 'NB' ? 'Northbound' : 'Southbound',
  mph: 35,
  protectedPhaseNumber: direction === 'NB' ? 2 : 6,
  isProtectedPhaseOverlap: false,
  permissivePhaseNumber: null,
  isPermissivePhaseOverlap: false,
  pedestrianPhaseNumber: null,
  isPedestrianPhaseOverlap: false,
  pedestrianDetectors: '',
  locationId: link.locationId ?? undefined,
  directionTypeId: DirectionTypes[direction],
  directionType: {
    description: direction === 'NB' ? 'Northbound' : 'Southbound',
    abbreviation: direction,
    displayOrder: direction === 'NB' ? 3 : 4,
  },
  detectors: [
    {
      id: id * 10 + 1,
      dectectorIdentifier: `${link.locationIdentifier}${id}`,
      detectorChannel: id,
      distanceFromStopBar: null,
      minSpeedFilter: null,
      dateAdded: '2026-01-01T00:00:00',
      dateDisabled: null,
      laneNumber: 1,
      movementType: MovementTypes.T,
      laneType: LaneTypes.V,
      detectionHardware: DetectionHardwareTypes.NA,
      decisionPoint: null,
      movementDelay: null,
      latencyCorrection: 0,
      approachId: id,
    },
  ],
})

export const routeViewWithDetail = {
  ...routeView,
  routeLocations: [
    {
      ...link1001,
      approaches: [
        routeApproach(1, link1001, 'NB'),
        routeApproach(2, link1001, 'SB'),
      ],
    },
    {
      ...link1002,
      approaches: [
        routeApproach(3, link1002, 'NB'),
        routeApproach(4, link1002, 'SB'),
      ],
    },
  ],
} satisfies RouteDto

const routeLocationEntity = (link: RouteLocationDto, id: number) => ({
  id,
  order: link.order,
  primaryPhase: link.primaryPhase,
  opposingPhase: link.opposingPhase,
  primaryDirectionId: DirectionTypesName.NB,
  opposingDirectionId: DirectionTypesName.SB,
  isPrimaryOverlap: false,
  isOpposingOverlap: false,
  previousLocationDistanceId: link.previousLocationDistanceId ?? null,
  nextLocationDistanceId: link.nextLocationDistanceId ?? null,
  locationIdentifier: link.locationIdentifier,
  routeId: ROUTE_ID,
  ...audit,
})

export const routeEntities = [
  {
    id: ROUTE_ID,
    name: ROUTE_NAME,
    ...audit,
    routeLocations: [
      routeLocationEntity(link1001, 10),
      routeLocationEntity(link1002, 11),
    ],
  },
] satisfies Route[]

export const routeSearchLocations = [
  searchLocations[0],
  {
    ...searchLocations[0],
    id: 2,
    locationIdentifier: '1002',
    secondaryName: '500 S',
    latitude: link1002.latitude,
    longitude: link1002.longitude,
  },
] satisfies SearchLocation[]
