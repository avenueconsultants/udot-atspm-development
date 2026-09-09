// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - watchdogIssueType.transformer.test.ts
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
import type { EChartsOption } from 'echarts'
import transformWatchdogIssueTypeData from './watchdogIssueType.transformer'

// The runtime shape is nested: issue type -> products -> model -> firmware,
// with counts on the leaves and every level nullable in the generated
// WatchDogIssueTypeGroup. This branch corrected the local type to match what
// the transformer actually reads, so these tests pin that reading.

type SunburstNode = {
  name: string
  value?: number
  children?: SunburstNode[]
}

const issueType = (
  name: string,
  firmwareCounts: number[],
  over: Record<string, unknown> = {}
) =>
  ({
    name,
    products: [
      {
        name: `${name} product`,
        model: [
          {
            name: `${name} model`,
            firmware: firmwareCounts.map((counts, i) => ({
              name: `fw-${i}`,
              counts,
            })),
          },
        ],
      },
    ],
    ...over,
  }) as never

const rootsOf = (chart: EChartsOption): SunburstNode[] => {
  const series = (
    Array.isArray(chart.series) ? chart.series[0] : chart.series
  ) as { data?: SunburstNode[] }
  return series?.data ?? []
}

const allNames = (nodes: SunburstNode[]): string[] =>
  nodes.flatMap((node) => [node.name, ...allNames(node.children ?? [])])

describe('transformWatchdogIssueTypeData', () => {
  it('builds a sunburst root per issue type with its share of the total', () => {
    const { sunburst } = transformWatchdogIssueTypeData([
      issueType('Force Off', [30]),
      issueType('Max Out', [10]),
    ])

    const roots = rootsOf(sunburst)
    expect(roots.map((r) => r.name)).toEqual([
      'Force Off\n75.0%',
      'Max Out\n25.0%',
    ])
  })

  it('nests products, models, and firmware under each issue type', () => {
    const { sunburst } = transformWatchdogIssueTypeData([
      issueType('Force Off', [30]),
    ])

    const root = rootsOf(sunburst)[0]
    expect(root.children?.[0].name).toBe('Force Off product')
    expect(root.children?.[0].children?.[0].name).toBe('Force Off model')
    expect(root.children?.[0].children?.[0].children?.[0].value).toBe(30)
  })

  it('excludes deselected issue types from the sunburst but keeps them in the legend', () => {
    const { sunburst, legendData } = transformWatchdogIssueTypeData(
      [issueType('Force Off', [30]), issueType('Max Out', [10])],
      ['Max Out']
    )

    expect(rootsOf(sunburst).map((r) => r.name)).toEqual(['Force Off\n100.0%'])
    expect(legendData.map((l) => l.name)).toEqual(['Force Off', 'Max Out'])
    expect(legendData.find((l) => l.name === 'Max Out')?.selected).toBe(false)
  })

  // Colors are indexed off the position in the original response, so hiding
  // an earlier issue type must not recolor the ones still showing.
  it('keeps colors stable when an earlier issue type is deselected', () => {
    const all = transformWatchdogIssueTypeData([
      issueType('Force Off', [30]),
      issueType('Max Out', [10]),
    ])
    const filtered = transformWatchdogIssueTypeData(
      [issueType('Force Off', [30]), issueType('Max Out', [10])],
      ['Force Off']
    )

    const maxOutColorAll = all.legendData.find(
      (l) => l.name === 'Max Out'
    )?.color
    const maxOutColorFiltered = filtered.legendData.find(
      (l) => l.name === 'Max Out'
    )?.color

    expect(maxOutColorFiltered).toBe(maxOutColorAll)
  })

  it('treats missing nested collections as empty', () => {
    const { sunburst } = transformWatchdogIssueTypeData([
      { name: 'Force Off', products: null } as never,
    ])

    expect(() => rootsOf(sunburst)).not.toThrow()
    expect(rootsOf(sunburst)[0].children).toEqual([])
  })

  it('treats a null firmware count as zero', () => {
    const { sunburst } = transformWatchdogIssueTypeData([
      issueType('Force Off', [30]),
      {
        name: 'Max Out',
        products: [
          {
            name: 'p',
            model: [{ name: 'm', firmware: [{ name: 'fw', counts: null }] }],
          },
        ],
      } as never,
    ])

    const maxOut = rootsOf(sunburst)[1]
    expect(maxOut.children?.[0].children?.[0].children?.[0].value).toBe(0)
  })

  // Every percentage here divides by a count derived from the data, so an
  // all-zero dashboard - the normal state before anything has been flagged -
  // must not put "NaN%" into the node labels a user reads.
  it('does not render NaN percentages when nothing has been counted', () => {
    const { sunburst } = transformWatchdogIssueTypeData([
      issueType('Force Off', [0]),
      issueType('Max Out', [0]),
    ])

    const names = allNames(rootsOf(sunburst))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name).not.toContain('NaN')
    }
  })

  it('handles an empty response', () => {
    const { sunburst, legendData } = transformWatchdogIssueTypeData([])

    expect(rootsOf(sunburst)).toEqual([])
    expect(legendData).toEqual([])
  })
})
