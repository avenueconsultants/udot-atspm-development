// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - useConfigEnums.test.ts
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
  DetectionHardwareTypesName,
  DetectionTypesName,
  DeviceStatusName,
  DeviceTypesName,
  DirectionTypesName,
  LaneTypesName,
  LocationVersionActionsName,
  MovementTypesName,
  TransportProtocolsName,
  WatchDogIssueTypesName,
} from '@/api/config'
import { ConfigEnum, useConfigEnums } from './useConfigEnums'

describe('useConfigEnums', () => {
  it('finds a member by name or by value', () => {
    const { findEnumByNameOrAbbreviation } = useConfigEnums(
      ConfigEnum.DirectionTypes
    )

    expect(findEnumByNameOrAbbreviation('NB')).toEqual({ name: 'NB', value: 1 })
    expect(findEnumByNameOrAbbreviation(1)).toEqual({ name: 'NB', value: 1 })
    expect(findEnumByNameOrAbbreviation('Sideways')).toBeUndefined()
  })

  // The config API writes entity enums as member names (the *Name consts) and
  // reads either the name or the number (the integer consts). Both come from
  // the same C# enum through the spec, so every name the API can send must be
  // one this hook can resolve - and nothing else.
  it.each([
    [ConfigEnum.LocationVersionActions, LocationVersionActionsName],
    [ConfigEnum.DeviceStatus, DeviceStatusName],
    [ConfigEnum.DeviceTypes, DeviceTypesName],
    [ConfigEnum.TransportProtocols, TransportProtocolsName],
    [ConfigEnum.DirectionTypes, DirectionTypesName],
    [ConfigEnum.MovementTypes, MovementTypesName],
    [ConfigEnum.LaneTypes, LaneTypesName],
    [ConfigEnum.DetectionHardwareTypes, DetectionHardwareTypesName],
    [ConfigEnum.DetectionTypes, DetectionTypesName],
    [ConfigEnum.WatchDogIssueTypes, WatchDogIssueTypesName],
  ] as const)(
    '%s members match the names the API serializes',
    (enumName, names) => {
      const { data } = useConfigEnums(enumName)

      expect(data.map((member) => member.name).sort()).toEqual(
        Object.values(names).sort()
      )
    }
  )
})
