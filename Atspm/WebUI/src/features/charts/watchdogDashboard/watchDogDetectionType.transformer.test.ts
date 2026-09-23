import { DetectionTypes, WatchDogDetectionTypeGroup } from '@/api/reports'
import transformDetectionTypeData from './watchDogDetectionType.transformer'

describe('transformDetectionTypeData', () => {
  it('keeps hardware series aligned with each detection type', () => {
    const data: WatchDogDetectionTypeGroup[] = [
      {
        name: 'First',
        detectionType: DetectionTypes.LLC,
        hardware: [
          { name: 'Radar', counts: 3 },
          { name: 'Loop', counts: 4 },
        ],
      },
      {
        name: 'Second',
        detectionType: DetectionTypes.AC,
        hardware: [{ name: 'Loop', counts: 2 }],
      },
    ]
    const chart = transformDetectionTypeData(data)
    expect(chart.xAxis).toEqual([
      expect.objectContaining({
        data: [
          `First (${DetectionTypes.LLC})`,
          `Second (${DetectionTypes.AC})`,
        ],
      }),
    ])
    expect(chart.legend).toEqual(
      expect.objectContaining({ data: ['Radar', 'Loop'] })
    )
    expect(chart.series).toEqual([
      expect.objectContaining({ name: 'Radar', type: 'bar', data: [3, 0] }),
      expect.objectContaining({ name: 'Loop', type: 'bar', data: [4, 2] }),
    ])
  })

  it('handles nullable names, missing collections, and absent counts', () => {
    const data: WatchDogDetectionTypeGroup[] = [
      { name: null, hardware: null },
      {
        name: 'Second',
        hardware: [{ name: null }, { name: 'Radar', counts: 0 }],
      },
      {},
    ]
    const chart = transformDetectionTypeData(data)
    expect(chart.xAxis).toEqual([
      expect.objectContaining({
        data: ['Unknown (Unknown)', 'Second (Unknown)', 'Unknown (Unknown)'],
      }),
    ])
    expect(chart.legend).toEqual(
      expect.objectContaining({ data: ['Unknown', 'Radar'] })
    )
    expect(chart.series).toEqual([
      expect.objectContaining({ name: 'Unknown', data: [0, 0, 0] }),
      expect.objectContaining({ name: 'Radar', data: [0, 0, 0] }),
    ])
  })

  it('handles an empty response', () => {
    const chart = transformDetectionTypeData([])
    expect(chart.series).toEqual([])
    expect(chart.legend).toEqual(expect.objectContaining({ data: [] }))
    expect(chart.xAxis).toEqual([expect.objectContaining({ data: [] })])
  })
})
