// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - common.test.ts
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
  ExportableReportOptions,
  ExportableReportResult,
  ImpactDto,
  RouteSpeed,
} from '@/api/speedManagement/aTSPMSpeedManagementApi.schemas'
import { ExportableReportType } from '@/api/speedManagement/aTSPMSpeedManagementApi.schemas'
import type {
  RoutesResponse,
  SpeedManagementRoute,
} from '../../types/routes'
import {
  createHotspotSegmentsFromImpacts,
  formatFilters,
  generateBaseText,
  generateLocationFilter,
  generateReportSpecificText,
  getAdjustedRoutes,
  getHotspotSegments,
  getHotspotsBasedOnChartType,
  getImpactHostpot,
  getTableData,
  roundToTwoDecimals,
  roundToWholeNumber,
} from './common'

const buildOptions = (
  overrides: Partial<ExportableReportOptions> = {}
): ExportableReportOptions =>
  ({
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    ...overrides,
  }) as unknown as ExportableReportOptions

describe('roundToWholeNumber / roundToTwoDecimals', () => {
  it('formats a number to the requested precision', () => {
    expect(roundToWholeNumber(12.6)).toBe('13')
    expect(roundToTwoDecimals(12.345)).toBe('12.35')
  })

  it('returns "N/A" for null or undefined', () => {
    expect(roundToWholeNumber(null)).toBe('N/A')
    expect(roundToWholeNumber(undefined)).toBe('N/A')
    expect(roundToTwoDecimals(null)).toBe('N/A')
  })
})

describe('generateLocationFilter', () => {
  it('joins only the filters that are present, labeling the region', () => {
    const filter = generateLocationFilter(
      buildOptions({ city: ['Provo'], region: ['3'] })
    )
    expect(filter).toBe('Provo, Region 3')
  })

  it('returns an empty string when no location filters are set', () => {
    expect(generateLocationFilter(buildOptions())).toBe('')
  })
})

describe('formatFilters', () => {
  it('builds a single leadership-style paragraph and ignores the other filters', () => {
    const result = formatFilters(
      buildOptions({
        reportManagementType: 'Leadership' as ExportableReportOptions['reportManagementType'],
        city: ['Provo'],
        sourceId: 1 as unknown as ExportableReportOptions['sourceId'],
      })
    )
    expect(result).toContain('ATSPM')
    expect(result).toContain('Provo')
    expect(result.split('\n')).toHaveLength(1)
  })

  it('lists each active standard filter on its own line', () => {
    const result = formatFilters(
      buildOptions({ city: ['Provo'], county: ['Utah'], limit: 10 })
    )
    expect(result.split('\n')).toEqual([
      'City: Provo',
      'County: Utah',
      'Date Range: 2026-04-01 to 2026-04-30',
      'Limit: 10',
    ])
  })

  it('falls back to a single-ended date range label', () => {
    const result = formatFilters(buildOptions({ endDate: undefined }))
    expect(result).toBe('Start Date: 2026-04-01')
  })
})

describe('generateBaseText / generateReportSpecificText', () => {
  it('returns report-type-specific base copy, or an empty string for an unknown type', () => {
    expect(
      generateBaseText(ExportableReportType.Violations, buildOptions())
    ).toContain('highest percentage of vehicles')
    expect(
      generateBaseText(
        'NotARealType' as ExportableReportType,
        buildOptions()
      )
    ).toBe('')
  })

  it('describes a Violations segment using its percentViolations figure', () => {
    const segment = {
      name: 'Main St',
      percentViolations: 12.345,
    } as unknown as RouteSpeed
    const text = generateReportSpecificText(
      ExportableReportType.Violations,
      buildOptions(),
      segment
    )
    expect(text).toContain('12.35% of the vehicles on Main St')
  })

  it('describes an EffectivenessOfStrategies segment using the impact figures', () => {
    const impact = {
      description: 'Segment A',
      createdOn: '2026-01-01',
      beforeAverageEightyFifthSpeed: 60,
      afterAverageEightyFifthSpeed: 55,
    } as unknown as ImpactDto
    const text = generateReportSpecificText(
      ExportableReportType.EffectivenessOfStrategies,
      buildOptions(),
      {} as RouteSpeed,
      impact
    )
    expect(text).toContain('decreased to 55 MPH')
    expect(text).toContain('5 MPH decrease')
  })
})

describe('getTableData', () => {
  it('builds an impacts table for EffectivenessOfStrategies, ranked in order', () => {
    const report = {
      exportableReportType: ExportableReportType.EffectivenessOfStrategies,
      impacts: [
        {
          description: 'A',
          changeInEightyFifthPercentileSpeed: -1.234,
          speedLimit: 55,
        },
      ],
    } as unknown as ExportableReportResult

    const { headers, rows, boldedColumn } = getTableData(report)
    expect(headers).toContain('% Change in Eighty Fifth Speed')
    expect(rows[0]).toEqual(['1', 'A', '-1.23', '55 MPH'])
    expect(boldedColumn).toBe(2)
  })

  it('returns a placeholder row when there is no report data', () => {
    const report = {
      exportableReportType: ExportableReportType.Violations,
      reportData: [],
    } as unknown as ExportableReportResult

    expect(getTableData(report)).toEqual({
      headers: ['Rank', 'Unknown Data', 'Name'],
      rows: [['No Data', '', '']],
    })
  })

  it('signs the difference column for ComplianceToSpeedLimit based on the sign of the value', () => {
    const report = {
      exportableReportType: ExportableReportType.ComplianceToSpeedLimit,
      reportData: [
        {
          name: 'Over',
          averageEightyFifthSpeed: 60,
          speedLimit: 55,
          eightyFifthSpeedVsSpeedLimit: 5,
        },
        {
          name: 'Under',
          averageEightyFifthSpeed: 50,
          speedLimit: 55,
          eightyFifthSpeedVsSpeedLimit: -5,
        },
      ],
    } as unknown as ExportableReportResult

    const { rows } = getTableData(report)
    expect(rows[0].at(-1)).toBe('+5 MPH')
    expect(rows[1].at(-1)).toBe('-5 MPH')
  })

  it('falls back to an unknown-data table for an unrecognized report type', () => {
    const report = {
      exportableReportType: 'NotARealType',
      reportData: [{ name: 'Whatever' }],
    } as unknown as ExportableReportResult

    expect(getTableData(report).headers).toEqual([
      'Rank',
      'Unknown Data',
      'Name',
    ])
  })
})

describe('getAdjustedRoutes', () => {
  it('flips [lng, lat] coordinates to [lat, lng] and drops routes with no geometry', () => {
    const response = {
      features: [
        {
          geometry: { coordinates: [[-111.1, 40.1]] },
          properties: { route_id: 'r1' },
        },
        { geometry: { coordinates: null }, properties: { route_id: 'r2' } },
      ],
    } as unknown as RoutesResponse

    const result = getAdjustedRoutes(response)

    expect(result).toHaveLength(1)
    expect(result[0].geometry.coordinates).toEqual([[40.1, -111.1]])
  })
})

describe('getHotspotSegments / getHotspotsBasedOnChartType', () => {
  const routes = [
    {
      properties: { route_id: 'r1' },
      geometry: {
        coordinates: [
          [-111.1, 40.1],
          [-111.2, 40.2],
        ],
      },
    },
  ] as unknown as SpeedManagementRoute[]

  it('returns an empty array when given no segment ids', () => {
    expect(getHotspotSegments([], routes)).toEqual([])
  })

  it('flips coordinates for a matched segment and leaves them undefined for an unmatched one', () => {
    const result = getHotspotSegments(['r1', 'missing'], routes)

    expect(result[0]).toEqual({
      segmentId: 'r1',
      coordinates: [
        [40.1, -111.1],
        [40.2, -111.2],
      ],
    })
    expect(result[1]).toEqual({ segmentId: 'missing', coordinates: undefined })
  })

  it('derives hotspot segments from a list of speed segments', () => {
    const speedSegments = [{ segmentId: 'r1' }] as unknown as RouteSpeed[]
    const result = getHotspotsBasedOnChartType(speedSegments, routes)

    expect(result).toHaveLength(1)
    expect(result[0].segmentId).toBe('r1')
  })
})

describe('getImpactHostpot / createHotspotSegmentsFromImpacts', () => {
  const routes = [
    {
      properties: { route_id: 'r1' },
      geometry: { coordinates: [[-111.1, 40.1]] },
    },
    {
      properties: { route_id: 'r2' },
      geometry: { coordinates: [[-111.2, 40.2]] },
    },
  ] as unknown as SpeedManagementRoute[]

  it('groups the hotspot segments for each impact, ignoring ids with no matching route', () => {
    const impacts = [
      { id: 'impact-1', segmentIds: ['r1', 'unknown'] },
    ] as unknown as ImpactDto[]

    const result = getImpactHostpot(impacts, routes)

    expect(result).toEqual([
      {
        impactId: 'impact-1',
        impactedSegments: [
          { segmentId: 'r1', coordinates: [[40.1, -111.1]] },
        ],
      },
    ])
  })

  it('picks the middle impacted segment for each impact', () => {
    const impacts = [
      {
        impactId: 'impact-1',
        impactedSegments: [
          { segmentId: 'r1', coordinates: [] },
          { segmentId: 'r2', coordinates: [] },
          { segmentId: 'r3', coordinates: [] },
        ],
      },
    ]

    const result = createHotspotSegmentsFromImpacts(impacts)

    expect(result).toEqual([{ segmentId: 'r2', coordinates: [] }])
  })
})
