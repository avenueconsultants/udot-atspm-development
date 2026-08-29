// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - e2e/support/measureFixtures.ts
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
import type { MeasureType, SearchLocation } from '../../src/api/config'
import { searchLocations } from '../../src/test/fixtures/config'

// A measure as GET /MeasureType?expand=measureOptions serves it. The options
// are what SelectChart turns into the measure's defaults: every value is a
// string in the config API, and the app sends them on as-is (booleans get
// converted, numbers do not), so a spec can see exactly what the report
// API receives.
//
// The chart-type lookup normalises `name` and compares it with the
// ChartType value, so the name must spell the chart type with spaces.
export const measureWithOptions = ({
  id,
  name,
  abbreviation,
  options,
}: {
  id: number
  name: string
  abbreviation: string
  options: Record<string, string>
}): MeasureType => ({
  id,
  name,
  abbreviation,
  showOnWebsite: true,
  showOnAggregationSite: false,
  displayOrder: id,
  created: null,
  modified: null,
  createdBy: null,
  modifiedBy: null,
  measureOptions: Object.entries(options).map(([option, value], index) => ({
    id: id * 100 + index,
    option,
    value,
    measureTypeId: id,
    created: null,
    modified: null,
    createdBy: null,
    modifiedBy: null,
  })),
})

export const purdueCoordinationDiagramMeasure = measureWithOptions({
  id: 6,
  name: 'Purdue Coordination Diagram',
  abbreviation: 'PCD',
  options: {
    binSize: '15',
    yAxisDefault: '150',
    getVolume: 'true',
    showPlanStatistics: 'true',
  },
})

// The recorded search location, offering exactly the given measures.
export const searchLocationWithMeasures = (
  measures: MeasureType[]
): SearchLocation => ({
  ...searchLocations[0],
  charts: measures.map((measure) => measure.id ?? 0),
})

export const splitMonitorMeasure = measureWithOptions({
  id: 2,
  name: 'Split Monitor',
  abbreviation: 'SM',
  options: {
    percentileSplit: '85',
    yAxisDefault: '100',
  },
})
