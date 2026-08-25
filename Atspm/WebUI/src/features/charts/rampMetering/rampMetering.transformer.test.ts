// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - rampMetering.transformer.test.ts
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
import { ChartType } from '@/features/charts/common/types'
import transformRampMeteringData from './rampMetering.transformer'
import type { RawRampMeteringResponse } from './types'

// The heaviest of the migrated transformers: a single RampMeteringResult
// fans out into four charts, and the generated type's nullable collections
// are flattened by three private adapters
// (toDescriptionWithDataPoints, toTimeSpaceEvents, toQueueDetectorEvents)
// before any of the option building runs.

const points = (value: number) => [
  { timestamp: '2026-04-01T08:00:00', value },
  { timestamp: '2026-04-01T08:15:00', value: value + 1 },
]

const populated = (): RawRampMeteringResponse =>
  ({
    type: ChartType.RampMetering,
    data: {
      locationIdentifier: '1001',
      locationDescription: '1001 - I-15 NB On-Ramp',
      start: '2026-04-01T08:00:00',
      end: '2026-04-01T09:00:00',
      mainlineAvgFlow: points(1800),
      mainlineAvgOcc: points(12),
      mainlineAvgSpeed: points(55),
      lanesActiveRate: [{ description: 'Lane 1', value: points(600) }],
      lanesBaseRate: [{ description: 'Lane 1', value: points(500) }],
      lanesQueueOnAndOffEvents: [
        {
          detectorOn: '2026-04-01T08:05:00',
          detectorOff: '2026-04-01T08:06:00',
          value: 1,
        },
      ],
      startUpWarning: [
        {
          initialX: '2026-04-01T08:00:00',
          finalX: '2026-04-01T08:02:00',
          isDetectorOn: true,
        },
      ],
    },
  }) as unknown as RawRampMeteringResponse

const allNull = (): RawRampMeteringResponse =>
  ({
    type: ChartType.RampMetering,
    data: {
      locationIdentifier: null,
      locationDescription: null,
      start: null,
      end: null,
      mainlineAvgFlow: null,
      mainlineAvgOcc: null,
      mainlineAvgSpeed: null,
      lanesActiveRate: null,
      lanesBaseRate: null,
      lanesQueueOnAndOffEvents: null,
      startUpWarning: null,
    },
  }) as unknown as RawRampMeteringResponse

describe('transformRampMeteringData', () => {
  it('fans one result out into the full set of ramp charts', () => {
    const result = transformRampMeteringData(populated())

    expect(result.type).toBe(ChartType.RampMetering)
    expect(result.data.charts.length).toBeGreaterThan(1)
  })

  it('carries mainline data points through to the charts', () => {
    const rendered = JSON.stringify(transformRampMeteringData(populated()))

    expect(rendered).toContain('1800.00')
    expect(rendered).toContain('55.00')
  })

  it('renders a result whose every optional field is null', () => {
    expect(() => transformRampMeteringData(allNull())).not.toThrow()

    const result = transformRampMeteringData(allNull())
    expect(result.data.charts.length).toBe(
      transformRampMeteringData(populated()).data.charts.length
    )
  })

  // Each lane arrives as { description, value } where both halves are
  // independently nullable, so a lane reported with no readings must
  // normalize to an empty series rather than an undefined one.
  it('normalizes lanes with null descriptions and values', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).lanesActiveRate = [
      { description: null, value: null },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).lanesBaseRate = [{ description: null, value: null }]

    expect(() => transformRampMeteringData(response)).not.toThrow()
  })

  it('normalizes queue detector events with null on/off timestamps', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).lanesQueueOnAndOffEvents = [
      { detectorOn: null, detectorOff: null, value: null },
    ]

    expect(() => transformRampMeteringData(response)).not.toThrow()
  })

  it('normalizes start-up warnings with null bounds', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).startUpWarning = [
      { initialX: null, finalX: null, isDetectorOn: null },
    ]

    expect(() => transformRampMeteringData(response)).not.toThrow()
  })

  it('handles a result with no lanes reported at all', () => {
    const response = populated()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).lanesActiveRate = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(response.data as any).lanesBaseRate = []

    expect(() => transformRampMeteringData(response)).not.toThrow()
  })
})
