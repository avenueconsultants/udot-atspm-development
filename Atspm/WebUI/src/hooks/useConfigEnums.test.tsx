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
import { configAxios } from '@/lib/axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ConfigEnum, useConfigEnums } from './useConfigEnums'

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  configAxios: { get: jest.fn() },
}))

const METADATA_XML = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="ATSPM" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EnumType Name="LaneTypes">
        <Member Name="Thru" Value="0" />
        <Member Name="Left" Value="1" />
      </EnumType>
      <EnumType Name="MovementTypes">
        <Member Name="RightTurn" Value="0" />
      </EnumType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
  return Wrapper
}

describe('useConfigEnums', () => {
  beforeEach(() => {
    ;(configAxios.get as jest.Mock).mockReset()
  })

  it('parses only the requested EnumType out of the $metadata document', async () => {
    ;(configAxios.get as jest.Mock).mockResolvedValue(METADATA_XML)

    const { result } = renderHook(() => useConfigEnums(ConfigEnum.LaneTypes), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data).toEqual([
      { name: 'Thru', value: 0 },
      { name: 'Left', value: 1 },
    ])
  })

  it('finds a member by name or by numeric value', async () => {
    ;(configAxios.get as jest.Mock).mockResolvedValue(METADATA_XML)

    const { result } = renderHook(() => useConfigEnums(ConfigEnum.LaneTypes), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.findEnumByNameOrAbbreviation('Left')).toEqual({
      name: 'Left',
      value: 1,
    })
    expect(result.current.findEnumByNameOrAbbreviation(0)).toEqual({
      name: 'Thru',
      value: 0,
    })
    expect(
      result.current.findEnumByNameOrAbbreviation('NotARealMember')
    ).toBeUndefined()
  })

  it('returns undefined from findEnumByNameOrAbbreviation before data has loaded', () => {
    ;(configAxios.get as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    )

    const { result } = renderHook(() => useConfigEnums(ConfigEnum.LaneTypes), {
      wrapper: createWrapper(),
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.findEnumByNameOrAbbreviation('Thru')).toBeUndefined()
  })
})
