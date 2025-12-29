// #region license
// Copyright 2024 Utah Departement of Transportation
// for WebUI - timeSpaceTransformerBase.ts
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
import { dateToTimestamp } from '@/utils/dateTime'
import { CustomSeriesRenderItemReturn, SeriesOption } from 'echarts'
import { Cycle } from '../../timingAndActuation/types'
import {
  RawTimeSpaceAverageData,
  TimeSpaceDetectorEvent,
  TimeSpaceResponseData,
} from '../types'

export function generateCycles(
  data: TimeSpaceResponseData,
  distanceData: number[],
  colorMap: Map<number, string>,
  phaseType?: string
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []
  for (let i = 0; i < data.length; i++) {
    const cycleEvents = getCycleEvents(data[i].cycleAllEvents, distanceData[i])
    const seriesOption: SeriesOption = {
      name: `Cycles ${phaseType?.length ? phaseType : ''}`,
      id: `Cycles ${data[i].locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
      type: 'custom',
      clip: true,
      z: 5,
      silent: true,
      data: cycleEvents,
      renderItem: (param, api): CustomSeriesRenderItemReturn => {
        const i = param.dataIndex
        if (!cycleEvents || i >= cycleEvents.length - 1) {
          return
        }
        const nextIndex = i + 1

        const [x1, y1, v1] = [api.value(0), api.value(1), api.value(2)]

        const [x2, y2, v2] = [
          api.value(0, nextIndex),
          api.value(1, nextIndex),
          api.value(2, nextIndex),
        ]
        const newX2 = new Date(x2).getTime()
        const p1 = api.coord([x1, y1])
        const p2 = api.coord([newX2, y2])
        return {
          type: 'rect',
          shape: {
            x: p1[0],
            y: p1[1],
            width: p2[0] - p1[0],
            height: 10,
          },
          style: {
            fill: getSegmentColor(v1 as number, v2 as number),
          },
        }
      },
    }
    seriesOptions.push(seriesOption)
  }
  return seriesOptions
}

function getSegmentColor(from: number, to: number): string {
  if (from === 1 && to === 8) return 'green'
  if (from === 8 && to === 9) return 'yellow'
  if (from === 9 && to === 1) return 'red'
  return '#999' // fallback
}

// export function generateCycles(
//   data: TimeSpaceResponseData,
//   distanceData: number[],
//   colorMap: Map<number, string>,
//   phaseType?: string
// ): SeriesOption[] {
//   const series: SeriesOption[] = []

//   const greenBands = getBandData(data, distanceData, 1)
//   const yellowBands = getBandData(data, distanceData, 8)
//   const redBands = getBandData(data, distanceData, 9)

//   const bandSpecs = [
//     { items: greenBands, color: colorMap.get(1) },
//     { items: yellowBands, color: colorMap.get(8) },
//     { items: redBands, color: colorMap.get(9) },
//   ]

//   for (const band of bandSpecs) {
//     series.push({
//       type: 'custom',
//       name: `Cycles ${phaseType ?? ''}`,
//       renderItem: renderCycleBand,

//       itemStyle: {
//         color: band.color,
//         opacity: 0.8,
//       },

//       encode: {
//         x: [1, 2], // start & end time
//         y: 0, // distance index
//       },

//       data: band.items,
//     })
//   }

//   return series
// }

// function toTimestamp(dt: string): number {
//   return new Date(dt).getTime()
// }

// function getBandData(
//   data: TimeSpaceResponseData,
//   distanceData: number[],
//   value: number
// ) {
//   const bands: Array<{ name: string; value: number[] }> = []

//   data.forEach((location, index) => {
//     if (!location.cycleAllEvents?.length) return

//     const cycles = location.cycleAllEvents
//     const startIndex = cycles.findIndex((e) => e.value === value)
//     if (startIndex < 0) return

//     for (let i = startIndex; i < cycles.length; i += 3) {
//       const startTimeStr = cycles[i].start
//       const endTimeStr =
//         i === cycles.length - 1 ? location.end : cycles[i + 1].start

//       const startTime = toTimestamp(startTimeStr)
//       const endTime = toTimestamp(endTimeStr)

//       bands.push({
//         name: `${value}`,
//         value: [
//           index, // y-axis category index
//           startTime, // x-axis start (timestamp)
//           endTime, // x-axis end (timestamp)
//         ],
//       })
//     }
//   })

//   return bands
// }

// function renderCycleBand(params, api) {
//   const yIndex = api.value(0)
//   const xStart = api.value(1)
//   const xEnd = api.value(2)

//   const startCoord = api.coord([xStart, yIndex])
//   const endCoord = api.coord([xEnd, yIndex])

//   // console.log(yIndex, startCoord, endCoord)

//   // band thickness in Y units:
//   const height = api.size([0, 1])[1] * 5 // adjust width (% of row height)
//   console.log(height)

//   const rect = graphic.clipRectByRect(
//     {
//       x: startCoord[0],
//       y: startCoord[1] - height / 2,
//       width: endCoord[0] - startCoord[0],
//       height,
//     },
//     {
//       x: params.coordSys.x,
//       y: params.coordSys.y,
//       width: params.coordSys.width,
//       height: params.coordSys.height,
//     }
//   )

//   return (
//     rect && {
//       type: 'rect',
//       shape: rect,
//       style: api.style(),
//     }
//   )
// }

function getCycleEvents(
  data: Cycle[] | null,
  distanceData: number
): [string, number, number][] {
  if (data === null) return

  return data.map((e) => [e.start, distanceData, e.value])
}

function getDataByValue(
  data: TimeSpaceResponseData,
  distanceData: number[],
  value: number
) {
  return data.reduce((result, location, index: number) => {
    if (location.cycleAllEvents?.length) {
      const cycles = location.cycleAllEvents
      const startingIndex = location.cycleAllEvents.findIndex(
        (event) => event.value === value
      )
      for (let i = startingIndex; i < cycles.length; i += 3) {
        const currPoint = [cycles[i].start, distanceData[index]]
        let nextPoint: any[]
        if (i === cycles.length - 1) {
          nextPoint = [location.end, distanceData[index]]
        } else {
          nextPoint = [cycles[i + 1].start, distanceData[index]]
        }

        result.push(...[currPoint, nextPoint, null])
      }
    }
    return result
  }, [] as any[])
}

export function generateGreenEventLines(
  data: TimeSpaceResponseData,
  distanceData: number[],
  phaseType?: string,
  isPrimary?: boolean
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []
  for (let i = 0; i < data.length; i++) {
    const location = data[i]
    const dataPoints = getGreenEventsDataPoints(
      location.greenTimeEvents,
      distanceData[i],
      location.start,
      location.end
    )
    const seriesOption: SeriesOption = {
      name: `Green Bands ${phaseType?.length ? phaseType : ''}`,
      id: `Green Bands ${data[i].locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
      type: 'custom',
      data: dataPoints,
      clip: true,
      renderItem: function (params, api) {
        const i = params.dataIndex
        if (!dataPoints || i >= dataPoints.length - 1 || i % 2 !== 0) {
          return
        }
        const distanceToNext = isPrimary
          ? location.distanceToNextLocation
          : -location.distanceToNextLocation

        const nextIndex = i + 1
        const [x1, y1] = [api.value(0), api.value(1)]

        const [x2, y2] = [api.value(0, nextIndex), api.value(1, nextIndex)]
        const currPointFinalX = getArrivalTime(
          location.distanceToNextLocation,
          location.speed,
          x1 as string
        )
        const nextPointFinalX = getArrivalTime(
          location.distanceToNextLocation,
          location.speed,
          x2 as string
        )
        const points = [
          api.coord([x1, y1]),
          api.coord([x2, y2]),
          api.coord([nextPointFinalX, (y2 as number) + distanceToNext]),
          api.coord([currPointFinalX, (y1 as number) + distanceToNext]),
        ]
        return {
          type: 'polygon',
          transition: ['shape'],
          shape: {
            points: points,
          },
          style: {
            z: -1,
            opacity: 0.2,
            fill: 'green',
          },
        }
      },
    }
    seriesOptions.push(seriesOption)
  }
  return seriesOptions
}

function getGreenEventsDataPoints(
  greenEvents: TimeSpaceDetectorEvent[],
  currDistance: number,
  start: string,
  end: string
) {
  const result = []
  for (let i = 0; i < greenEvents.length; ) {
    const currPoint = greenEvents[i]
    const nextPoint = greenEvents[i + 1]
    if (i === 0 && currPoint.isDetectorOn === false) {
      result.push([start, currDistance], [currPoint.initialX, currDistance])
      i++
    } else if (
      i === greenEvents.length - 1 &&
      currPoint.isDetectorOn === true
    ) {
      result.push([currPoint.initialX, currDistance], [end, currDistance])
      i++
    } else if (currPoint.isDetectorOn === false) {
      i++
    } else {
      result.push(
        ...[
          [currPoint.initialX, currDistance],
          [nextPoint.initialX, currDistance],
        ]
      )
      i += 2
    }
  }

  return result
}

// function getGreenEventsDataPoints(
//   data: TimeSpaceResponseData,
//   distanceData: number[]
// ) {
//   return data.reduce((result, location, index) => {
//     if (location.greenTimeEvents) {
//       const greenEvents = location.greenTimeEvents
//       for (let i = 0; i < greenEvents.length; ) {
//         const currPoint = greenEvents[i]
//         const nextPoint = greenEvents[i + 1]
//         const currPointFinalX = getArrivalTime(
//           location.distanceToNextLocation,
//           location.speed,
//           currPoint.initialX
//         )
//         const nextPointFinalX = getArrivalTime(
//           location.distanceToNextLocation,
//           location.speed,
//           nextPoint.initialX
//         )
//         if (i === 0 && currPoint.isDetectorOn === false) {
//           result.push(
//             [location.start, distanceData[index]],
//             [currPoint.initialX, distanceData[index]]
//             // [currPointFinalX, distanceData[index + 1]],
//             // [location.start, distanceData[index + 1]],
//             // null
//           )
//           i++
//         } else if (
//           i === greenEvents.length - 1 &&
//           currPoint.isDetectorOn === true
//         ) {
//           result.push(
//             [currPoint.initialX, distanceData[index]],
//             [location.end, distanceData[index]]
//             // [location.end, distanceData[index + 1]],
//             // [currPointFinalX, distanceData[index + 1]],
//             // null
//           )
//           i++
//         } else if (currPoint.isDetectorOn === false) {
//           i++
//         } else {
//           result.push(
//             ...[
//               [currPoint.initialX, distanceData[index]],
//               [nextPoint.initialX, distanceData[index]],
//               // [nextPointFinalX, distanceData[index + 1]],
//               // [currPointFinalX, distanceData[index + 1]],
//               // null,
//             ]
//           )
//           i += 2
//         }
//       }
//     }
//     return result
//   }, [] as any)
// }

function getArrivalTime(
  distanceToNextLocation: number,
  speed: number,
  currentDetectorOn: Date | string
): string {
  const start = new Date(currentDetectorOn)
  const speedInFeetPerSecond = getSpeedInFeetPerSecond(speed)
  const timeToTravelSeconds = distanceToNextLocation / speedInFeetPerSecond

  const arrivalMs = start.getTime() + timeToTravelSeconds * 1000

  return dateToTimestamp(new Date(arrivalMs))
}

function getSpeedInFeetPerSecond(speed: number): number {
  return (speed * 5280) / 3600
}

export function getLocationsLabelOption(
  data: TimeSpaceResponseData,
  distanceData: number[]
): SeriesOption {
  return {
    name: `Labels location`,
    type: 'custom',
    renderItem: (params, api) => {
      const [, y] = api.coord([api.value(0), api.value(1)])
      return {
        type: 'group',
        position: [0, y],
        children: [
          {
            type: 'path',
            shape: {
              d: 'M0,0 L0,-20 L30,-20 C42,-20 38,-1 50,-1 L70,-1 L30,0 Z',
              x: 0,
              y: -20,
              width: 90,
              height: 20,
              layout: 'cover',
            },
            style: {
              fill: 'lightgreen',
              opacity: 0.7,
            },
          },
          {
            type: 'text',
            style: {
              x: 22,
              y: -1,
              textVerticalAlign: 'bottom',
              textAlign: 'center',
              text: api.value(2).toString(),
              textFill: '#000',
              fontSize: 15,
            },
          },
        ],
      }
    },
    data: distanceData.map((distance, index) => [
      data[index].start,
      distance,
      data[index].locationIdentifier,
    ]),
  }
}

export function getOffsetAndProgramSplitLabel(
  primaryPhaseData: RawTimeSpaceAverageData[],
  opposingPhaseData: RawTimeSpaceAverageData[],
  distanceData: number[],
  primaryDirection: string,
  opposingDirection: string,
  endDate: string
): SeriesOption {
  return {
    name: `Labels offset and program split`,
    type: 'custom',
    renderItem: (params: any, api) => {
      const [x, y] = api.coord([api.value(0), api.value(1)])
      const width = params.coordSys.width
      return {
        type: 'group',
        position: [width + 140, y + 11],
        children: [
          {
            type: 'text',
            style: {
              x: 60,
              y: 10,
              textVerticalAlign: 'bottom',
              textAlign: 'center',
              text:
                'Cycle Length: ' +
                api.value(2).toString() +
                's\n' +
                `Offset (${primaryDirection}: ${api.value(
                  3
                )}s | ${opposingDirection}: ${api.value(5)}s)\n` +
                `Split (${primaryDirection}: ${api.value(
                  4
                )}s | ${opposingDirection}: ${api.value(6)}s)\n`,
              textFill: '#000',
              fontSize: 10,
            },
          },
        ],
      }
    },
    data: distanceData.map((distance, index) => [
      endDate,
      distance,
      primaryPhaseData[index].cycleLength,
      primaryPhaseData[index].offset,
      primaryPhaseData[index].programmedSplit,
      opposingPhaseData[distanceData.length - 1 - index].offset,
      opposingPhaseData[distanceData.length - 1 - index].programmedSplit,
    ]),
  }
}

export function getDistancesLabelOption(
  data: TimeSpaceResponseData,
  distanceData: number[]
): SeriesOption {
  const dataPoints = distanceData.map((distance, index) => [
    data[index].end,
    distance,
    index !== distanceData.length - 1 ? data[index].distanceToNextLocation : '',
    index !== distanceData.length - 1 ? data[index].speed : '',
  ])
  return {
    name: `Labels distance`,
    type: 'custom',
    renderItem: (params, api) => {
      const [, y] = api.coord([
        0,
        (api.value(1) as number) + (api.value(2) as number) / 2,
      ])
      return {
        type: 'group',
        children: [
          {
            type: 'text',
            style: {
              x: 50,
              y: y - 10,
              text:
                params.dataIndex !== dataPoints.length - 1
                  ? api.value(2).toString() +
                    ' ft' +
                    '\n' +
                    api.value(3).toString() +
                    'mph'
                  : '',
              textFill: '#000',
              fontSize: 10,
            },
          },
        ],
      }
    },
    data: dataPoints,
  }
}

export function getDraggableOffsetabelOption(
  data: TimeSpaceResponseData,
  distanceData: number[],
  phaseType?: string,
  isPrimary?: boolean
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []
  for (let i = 0; i < data.length; i++) {
    const location = data[i]
    const distance = distanceData[i]
    const dataPoint: [string, number, number, number][] = [
      [
        location.end,
        distance,
        i !== distanceData.length - 1 ? location.distanceToNextLocation : 0,
        0,
      ],
    ]
    const seriesOption: SeriesOption = {
      name: `Offset amount`,
      id: `Offset ${location.locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
      type: 'custom',
      data: dataPoint,
      renderItem: (params, api) => {
        const distanceToNext = isPrimary
          ? location.distanceToNextLocation
          : -location.distanceToNextLocation
        const [x, y] = api.coord([
          api.value(0),
          (api.value(1) as number) + distanceToNext / 2,
        ])
        const offsetValue = api.value(3)
        return {
          type: 'text',
          style: {
            x: x + 20,
            y: y - 10,
            text: phaseType + ' Offset: ' + offsetValue.toString() + ' seconds',
            textFill: '#000',
            fontSize: 10,
          },
        }
      },
    }
    seriesOptions.push(seriesOption)
  }
  return seriesOptions
}

export function generatePrimaryCycleLabels(
  distanceData: number[],
  primaryDirection: string
): SeriesOption {
  return {
    name: `Cycles ${primaryDirection}`,
    type: 'custom',
    renderItem: (params: any, api) => {
      const [, y] = api.coord([0, api.value(0)])
      const width = params.coordSys.width
      return {
        type: 'group',
        position: [width + 100, y],
        children: [
          {
            type: 'text',
            style: {
              x: 15,
              y: -4,
              textAlign: 'center',
              text: primaryDirection,
              textFill: '#000',
              fontSize: 10,
            },
          },
        ],
      }
    },
    data: distanceData,
  }
}

export function generateOpposingCycleLabels(
  reverseDistanceData: number[],
  opposingDirection: string
): SeriesOption {
  return {
    name: `Cycles ${opposingDirection}`,
    type: 'custom',
    renderItem: (params: any, api) => {
      const [, y] = api.coord([0, api.value(0)])
      const width = params.coordSys.width
      return {
        type: 'group',
        position: [width + 100, y],
        children: [
          {
            type: 'text',
            style: {
              x: 15,
              y: -7,
              textAlign: 'center',
              text: opposingDirection,
              textFill: '#000',
              fontSize: 10,
            },
          },
        ],
      }
    },
    data: reverseDistanceData,
  }
}
