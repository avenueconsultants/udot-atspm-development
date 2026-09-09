// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - watchdogControllerType.transformer.test.ts
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
import transformWatchdogControllerTypeData from './watchdogControllerType.transformer'

// Controller type -> model -> firmware -> issue type, with counts on the
// leaves. Sibling of watchdogIssueType, and shares its percentage labelling.

type SunburstNode = {
  name: string
  value?: number
  children?: SunburstNode[]
}

const controller = (name: string, issues: { name: string; counts: number }[]) =>
  ({
    name,
    model: [
      {
        name: `${name} model`,
        firmware: [{ name: `${name} fw`, issueType: issues }],
      },
    ],
  }) as never

const rootsOf = (chart: EChartsOption): SunburstNode[] => {
  const series = (
    Array.isArray(chart.series) ? chart.series[0] : chart.series
  ) as { data?: SunburstNode[] }
  return series?.data ?? []
}

const allNames = (nodes: SunburstNode[]): string[] =>
  nodes.flatMap((node) => [node.name, ...allNames(node.children ?? [])])

describe('transformWatchdogControllerTypeData', () => {
  it('builds a sunburst root per controller type with its share of the total', () => {
    const { sunburst } = transformWatchdogControllerTypeData([
      controller('Cobalt', [{ name: 'Force Off', counts: 30 }]),
      controller('M60', [{ name: 'Force Off', counts: 10 }]),
    ])

    expect(rootsOf(sunburst).map((r) => r.name)).toEqual([
      'Cobalt\n75.0%',
      'M60\n25.0%',
    ])
  })

  it('nests model, firmware, and issue type under each controller', () => {
    const { sunburst } = transformWatchdogControllerTypeData([
      controller('Cobalt', [{ name: 'Force Off', counts: 30 }]),
    ])

    const root = rootsOf(sunburst)[0]
    expect(root.children?.[0].name).toBe('Cobalt model')
    expect(root.children?.[0].children?.[0].name).toBe('Cobalt fw')
    expect(root.children?.[0].children?.[0].children?.[0].value).toBe(30)
  })

  // The dashboard hides unconfigured-detector noise by default; the toggle
  // is what lets an admin see it.
  it('hides unconfigured issue types unless asked for them', () => {
    const input = [
      controller('Cobalt', [
        { name: 'Force Off', counts: 30 },
        { name: 'UnconfiguredDetector', counts: 5 },
        { name: 'UnconfiguredApproach', counts: 3 },
      ]),
    ]

    const hidden = transformWatchdogControllerTypeData(
      input,
      [],
      false
    ).sunburst
    const shown = transformWatchdogControllerTypeData(input, [], true).sunburst

    expect(allNames(rootsOf(hidden)).join()).not.toContain('Unconfigured')
    expect(allNames(rootsOf(shown)).join()).toContain('UnconfiguredDetector')
    expect(allNames(rootsOf(shown)).join()).toContain('UnconfiguredApproach')
  })

  it('excludes deselected controllers but keeps them in the legend', () => {
    const { sunburst, legendData } = transformWatchdogControllerTypeData(
      [
        controller('Cobalt', [{ name: 'Force Off', counts: 30 }]),
        controller('M60', [{ name: 'Force Off', counts: 10 }]),
      ],
      ['M60']
    )

    expect(rootsOf(sunburst).map((r) => r.name)).toEqual(['Cobalt\n100.0%'])
    expect(legendData.map((l) => l.name)).toEqual(['Cobalt', 'M60'])
    expect(legendData.find((l) => l.name === 'M60')?.selected).toBe(false)
  })

  it('does not render NaN percentages when nothing has been counted', () => {
    const { sunburst } = transformWatchdogControllerTypeData([
      controller('Cobalt', [{ name: 'Force Off', counts: 0 }]),
      controller('M60', [{ name: 'Force Off', counts: 0 }]),
    ])

    const names = allNames(rootsOf(sunburst))
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      expect(name).not.toContain('NaN')
    }
  })

  it('handles an empty response', () => {
    const { sunburst, legendData } = transformWatchdogControllerTypeData([])

    expect(rootsOf(sunburst)).toEqual([])
    expect(legendData).toEqual([])
  })
})
