// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - getChartDefaults.ts
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
import { getMeasureType } from '@/api/config'
import { chartTypeForMeasure } from '@/features/charts/common/measureAbbreviations'
import { ChartDefaults, Default } from '@/features/charts/types'
import { ExtractFnReturnType, QueryConfig } from '@/lib/react-query'
import { useQuery } from '@tanstack/react-query'

// Stored option values that the report API no longer accepts, mapped to
// the value it does: Split Monitor's percentile once travelled as the word
// "None", but the contract's field is an int, where 0 means no percentile.
// Measure defaults saved before that change still hold the word.
const LEGACY_OPTION_VALUES: Record<string, Record<string, string>> = {
  percentileSplit: { None: '0' },
}

const normalizeOptionValue = ({ option, value }: Default) =>
  typeof value === 'string'
    ? (LEGACY_OPTION_VALUES[option]?.[value] ?? value)
    : value

export const getChartDefaults = async (): Promise<ChartDefaults[]> => {
  const response = (await getMeasureType({
    expand: 'measureOptions',
  })) as unknown as ChartDefaults[]

  return response.map((chart: ChartDefaults) => ({
    ...chart,
    // Keyed on the abbreviation, as the measure picker is: a seeded name
    // need not spell the chart type ("Transit Signal Priority Summary").
    chartType: chartTypeForMeasure(chart),
    measureOptions: (chart.measureOptions ?? []).reduce(
      (acc, current) => {
        acc[current.option] = {
          ...current,
          value: normalizeOptionValue(current),
        }
        return acc
      },
      {} as Record<string, Default>
    ),
  }))
}

type QueryFnType = typeof getChartDefaults

type UseChartDefaultsOptions = {
  config?: QueryConfig<QueryFnType>
}

export const useChartDefaults = ({ config }: UseChartDefaultsOptions = {}) => {
  return useQuery<ExtractFnReturnType<QueryFnType>>({
    ...config,
    queryKey: ['chartdefaults'],
    queryFn: getChartDefaults,
  })
}
