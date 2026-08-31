// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - useConfigEnums.ts
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
import {
  DetectionHardwareTypes,
  DetectionTypes,
  DeviceStatus,
  DeviceTypes,
  DirectionTypes,
  LaneTypes,
  LocationVersionActions,
  MovementTypes,
  TransportProtocols,
  WatchDogIssueTypes,
} from '@/api/config'

export enum ConfigEnum {
  LocationVersionActions = 'LocationVersionActions',
  DeviceStatus = 'DeviceStatus',
  DeviceTypes = 'DeviceTypes',
  TransportProtocols = 'TransportProtocols',
  DirectionTypes = 'DirectionTypes',
  MovementTypes = 'MovementTypes',
  LaneTypes = 'LaneTypes',
  DetectionHardwareTypes = 'DetectionHardwareTypes',
  DetectionTypes = 'DetectionTypes',
  WatchDogIssueTypes = 'WatchDogIssueTypes',
}

export type EnumMember = {
  name: string
  value: number
}

// The config API serializes these enums by member name and accepts either the
// name or the number on the way in. The generated consts carry both (the names
// come from the spec's x-enum-varnames), so there is nothing to fetch - this
// used to download and parse the OData $metadata document for every consumer.
const membersOf = (members: Record<string, number>): EnumMember[] =>
  Object.entries(members).map(([name, value]) => ({ name, value }))

const CONFIG_ENUM_MEMBERS: Record<ConfigEnum, EnumMember[]> = {
  [ConfigEnum.LocationVersionActions]: membersOf(LocationVersionActions),
  [ConfigEnum.DeviceStatus]: membersOf(DeviceStatus),
  [ConfigEnum.DeviceTypes]: membersOf(DeviceTypes),
  [ConfigEnum.TransportProtocols]: membersOf(TransportProtocols),
  [ConfigEnum.DirectionTypes]: membersOf(DirectionTypes),
  [ConfigEnum.MovementTypes]: membersOf(MovementTypes),
  [ConfigEnum.LaneTypes]: membersOf(LaneTypes),
  [ConfigEnum.DetectionHardwareTypes]: membersOf(DetectionHardwareTypes),
  [ConfigEnum.DetectionTypes]: membersOf(DetectionTypes),
  [ConfigEnum.WatchDogIssueTypes]: membersOf(WatchDogIssueTypes),
}

export function useConfigEnums(enumName: ConfigEnum) {
  const data = CONFIG_ENUM_MEMBERS[enumName]

  const findEnumByNameOrAbbreviation = (
    nameOrAbbreviation: string | number
  ): EnumMember | undefined =>
    data.find(
      (member) =>
        member.name === nameOrAbbreviation ||
        member.value === nameOrAbbreviation
    )

  return {
    data,
    findEnumByNameOrAbbreviation,
  }
}
