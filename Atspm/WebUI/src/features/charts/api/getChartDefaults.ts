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

// Stored option values the panels no longer offer, mapped to one they do.
// Split Monitor's percentile once offered "None", which the report API's
// int field could not carry; the option is gone and defaults saved while
// it existed (as the word, or as the 0 it was briefly sent as) fall back
// to the seeded 85th.
const LEGACY_OPTION_VALUES: Record<string, Record<string, string>> = {
  percentileSplit: { None: '85', '0': '85' },
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
