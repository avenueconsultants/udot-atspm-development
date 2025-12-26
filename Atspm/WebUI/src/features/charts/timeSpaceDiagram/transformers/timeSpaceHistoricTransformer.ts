// #region license
// Copyright 2024 Utah Departement of Transportation
// for WebUI - timeSpaceHistoricTransformer.ts
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
import {
  createDisplayProps,
  createLegend,
  createTitle,
  createToolbox,
  createXAxis,
  createYAxis,
  formatExportFileName,
} from '@/features/charts/common/transformers'
import { ToolType } from '@/features/charts/common/types'
import { TransformedToolResponse } from '@/features/charts/types'
import {
  SolidLineSeriesSymbol,
  formatChartDateTimeRange,
} from '@/features/charts/utils'
import { dateToTimestamp } from '@/utils/dateTime'
import {
  DataZoomComponentOption,
  EChartsOption,
  GridComponentOption,
  SeriesOption,
} from 'echarts'
import { RawTimeSpaceDiagramResponse, RawTimeSpaceHistoricData } from '../types'
import {
  generateCycles,
  generateGreenEventLines,
  generateOpposingCycleLabels,
  generatePrimaryCycleLabels,
  getDistancesLabelOption,
  getDraggableOffsetabelOption,
  getLocationsLabelOption,
} from './timeSpaceTransformerBase'

export default function transformTimeSpaceHistoricData(
  response: RawTimeSpaceDiagramResponse
): TransformedToolResponse {
  const chart = {
    chart: transformData(response.data as RawTimeSpaceHistoricData[]),
  }
  return {
    type: ToolType.TimeSpaceHistoric,
    data: {
      charts: [chart],
    },
  }
}

function transformData(data: RawTimeSpaceHistoricData[]): EChartsOption {
  const primaryPhaseData = data.filter(
    (location) => location.phaseType === 'Primary'
  )

  const opposingPhaseData = data.filter(
    (location) => location.phaseType === 'Opposing'
  )

  const titleHeader = `Time Space Diagram (Historic),\nPrimary Phase - ${primaryPhaseData[0].approachDescription}\nOpposing Phase - ${opposingPhaseData[0].approachDescription}`
  const dateRange = formatChartDateTimeRange(data[0].start, data[0].end)
  const title = createTitle({
    title: titleHeader,
    dateRange,
    info: `Route data from ${primaryPhaseData[0].locationDescription} to ${primaryPhaseData[primaryPhaseData.length - 1].locationDescription} \n`,
  })

  const xAxis = createXAxis(data[0].start, data[0].end)

  let initialDistance = 250

  const primaryDirection = primaryPhaseData[0].approachDescription.split(' ')[0]
  const opposingDirection =
    opposingPhaseData[0].approachDescription.split(' ')[0]

  const distanceData: number[] = []
  primaryPhaseData.forEach((location) => {
    distanceData.push(initialDistance)
    initialDistance += location.distanceToNextLocation
  })
  const yAxis = createYAxis(false, {
    show: false,
    data: distanceData,
    axisLabel: {
      show: false,
    },
  })

  const legends = createLegend({
    top: 195,
    data: [
      {
        name: `Cycles ${primaryDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: '#f0807f' },
      },
      {
        name: `Cycles ${opposingDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: '#f0807f' },
      },
      {
        name: `Lane by Lane Count ${primaryDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: 'darkblue' },
      },
      {
        name: `Lane by Lane Count ${opposingDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: 'orange' },
      },
      {
        name: `Advance Count ${primaryDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: 'darkblue' },
      },
      {
        name: `Advance Count ${opposingDirection}`,
        icon: SolidLineSeriesSymbol,
        itemStyle: { color: 'orange' },
      },
      {
        name: `Stop Bar Presence ${primaryDirection}`,
        itemStyle: { color: 'lightBlue' },
      },
      {
        name: `Stop Bar Presence ${opposingDirection}`,
        itemStyle: { color: 'orange' },
      },
      {
        name: `Green Bands ${primaryDirection}`,
        itemStyle: { color: 'green', opacity: 0.3 },
      },
      {
        name: `Green Bands ${opposingDirection}`,
        itemStyle: { color: 'green', opacity: 0.3 },
      },
    ],
    selected: {
      [`Cycles ${primaryDirection}`]: true,
      [`Cycles ${opposingDirection}`]: true,
      [`Green Bands ${primaryDirection}`]: true,
      [`Green Bands ${opposingDirection}`]: true,
      [`Lane by Lane Count ${primaryDirection}`]: false,
      [`Lane by Lane Count ${opposingDirection}`]: false,
      [`Advance Count ${primaryDirection}`]: false,
      [`Advance Count ${opposingDirection}`]: false,
      [`Stop Bar Presence ${primaryDirection}`]: false,
      [`Stop Bar Presence ${opposingDirection}`]: false,
    },
  })

  const grid: GridComponentOption = {
    top: 200,
    left: 100,
    right: 250,
    show: true,
    borderWidth: 1,
  }

  const start = new Date(data[0].end)
  const end = new Date(data[0].start)
  const timeDiff = (start.getTime() - end.getTime()) / 3600000

  let dataZoom: DataZoomComponentOption[]

  if (timeDiff > 6) {
    dataZoom = [
      {
        type: 'slider',
        filterMode: 'filter',
        show: true,
        start: 0,
        end: 10,
        maxSpan: 10,
        minSpan: 0.2,
      },
      {
        type: 'inside',
        filterMode: 'filter',
        show: true,
        minSpan: 0.2,
      },
    ]
  } else {
    dataZoom = [
      {
        type: 'slider',
        filterMode: 'none',
        show: true,
      },
      {
        type: 'inside',
        filterMode: 'none',
        show: true,
      },
    ]
  }

  const toolbox = createToolbox(
    {
      title: formatExportFileName(titleHeader, data[0].start, data[0].end),
      dateRange,
    },
    data[0].locationIdentifier,
    ToolType.TimeSpaceHistoric
  )

  const colorMap: Map<number, string> = new Map([
    [1, 'lightgreen'],
    [8, 'yellow'],
    [9, 'red'],
  ])

  const series: SeriesOption[] = []

  series.push(
    ...generateCycles(
      primaryPhaseData,
      distanceData,
      colorMap,
      primaryDirection
    )
  )

  series.push(
    ...generateLaneByLaneCountEventLines(
      primaryPhaseData,
      distanceData,
      'darkblue',
      primaryDirection
    )
  )

  series.push(
    ...generateAdvanceCountEventLines(
      primaryPhaseData,
      distanceData,
      'darkblue',
      primaryDirection
    )
  )

  series.push(
    ...generateStopBarPresenceEventLines(
      primaryPhaseData,
      distanceData,
      'lightblue',
      primaryDirection,
      true
    )
  )

  series.push(
    ...generateGreenEventLines(
      primaryPhaseData,
      distanceData,
      primaryDirection,
      true
    )
  )
  series.push(getLocationsLabelOption(primaryPhaseData, distanceData))
  series.push(getDistancesLabelOption(primaryPhaseData, distanceData))
  series.push(
    ...getDraggableOffsetabelOption(
      primaryPhaseData,
      distanceData,
      primaryDirection,
      true
    )
  )

  let reverseDistanceData = distanceData.reverse()
  reverseDistanceData = reverseDistanceData.map((distance) => (distance += 300))
  series.push(
    ...generateCycles(
      opposingPhaseData,
      reverseDistanceData,
      colorMap,
      opposingDirection
    )
  )

  series.push(
    ...generateLaneByLaneCountEventLines(
      opposingPhaseData,
      reverseDistanceData,
      'orange',
      opposingDirection
    )
  )

  series.push(
    ...generateAdvanceCountEventLines(
      opposingPhaseData,
      reverseDistanceData,
      'orange',
      opposingDirection
    )
  )

  series.push(
    ...generateStopBarPresenceEventLines(
      opposingPhaseData,
      reverseDistanceData,
      'orange',
      opposingDirection,
      false
    )
  )

  series.push(
    ...generateGreenEventLines(
      opposingPhaseData,
      reverseDistanceData,
      opposingDirection,
      false
    )
  )

  series.push(generatePrimaryCycleLabels(distanceData, primaryDirection))
  series.push(
    generateOpposingCycleLabels(reverseDistanceData, opposingDirection)
  )
  series.push(
    ...getDraggableOffsetabelOption(
      opposingPhaseData,
      reverseDistanceData,
      opposingDirection,
      false
    )
  )

  const displayProps = createDisplayProps({
    description: '',
    numberOfLocations: primaryPhaseData.length,
  })

  const chartOptions: EChartsOption = {
    title: title,
    xAxis: xAxis,
    yAxis: yAxis,
    grid: grid,
    dataZoom: dataZoom,
    legend: legends,
    toolbox: toolbox,
    animation: false,
    series: series,
    displayProps,
  }

  return chartOptions
}

function generateLaneByLaneCountEventLines(
  data: RawTimeSpaceHistoricData[],
  distanceData: number[],
  color: string,
  phaseType?: string
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []
  data.forEach((location, i) => {
    const series: SeriesOption = {
      name: `Lane by Lane Count ${phaseType?.length && phaseType}`,
      id: `LLC ${location.locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
      type: 'line',
      symbol: 'none',
      lineStyle: {
        width: 2,
        color,
      },
      data: location.laneByLaneCountDetectors.flatMap((events) => {
        const initialX = events.detectorOn
        const finalX = getArrivalTime(
          location.distanceToNextLocation,
          location.speed,
          initialX
        )
        const values = [
          [initialX, distanceData[i]],
          [finalX, distanceData[i + 1]],
          null,
        ]
        return values
      }),
    }
    seriesOptions.push(series)
  })
  return seriesOptions
  // return {
  //   name: `Lane by Lane Count ${phaseType?.length && phaseType}`,
  //   id: `LLC ${data[i].locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
  //   type: 'line',
  //   symbol: 'none',
  //   lineStyle: {
  //     width: 2,
  //     color,
  //   },
  //   data: data.reduce((result, location, i) => {
  //     if (location.laneByLaneCountDetectors) {
  //       const points: any[] = location.laneByLaneCountDetectors.flatMap(
  //         (events) => {
  //           const initialX = events.detectorOn
  //           const finalX = getArrivalTime(
  //             location.distanceToNextLocation,
  //             location.speed,
  //             initialX
  //           )
  //           const values = [
  //             [initialX, distanceData[i]],
  //             [finalX, distanceData[i + 1]],
  //             null,
  //           ]
  //           return values
  //         }
  //       )
  //       points.push(null)
  //       result.push(...points)
  //     }
  //     return result
  //   }, [] as any[]),
  // }
}

// function calculateTimeSpaceResult(
//   events: TimeSpaceDetectorEventWithDistanceDTO[],
//   speed: number,
//   distanceToNextLocation: number
// ): TimeSpaceEvent[] {
//   const results: TimeSpaceEvent[] = []

//   if (!events || events.length < 1) {
//     return results
//   }

//   for (const detectorEvent of events) {
//     if (!detectorEvent.detectorOn) {
//       continue
//     }

//     const speedLimit = speed

//     const currentDetectorOn = detectorEvent.detectorOn

//     const arrivalTime = getArrivalTime(
//       distanceToNextLocation,
//       speedLimit,
//       currentDetectorOn
//     )

//     const resultOn: TimeSpaceEvent = {
//       initialX: currentDetectorOn,
//       finalX: arrivalTime,
//       isDetectorOn: null,
//     }

//     results.push(resultOn)
//   }

//   return results
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

function generateAdvanceCountEventLines(
  data: RawTimeSpaceHistoricData[],
  distanceData: number[],
  color: string,
  phaseType?: string
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []
  data.forEach((location, i) => {
    if (location.advanceCountDetectors.length) {
      const series: SeriesOption = {
        name: `Advance Count ${phaseType?.length && phaseType}`,
        id: `AC ${i !== 0 ? data[i - 1].locationIdentifier : location.locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
        type: 'line',
        symbol: 'none',
        lineStyle: {
          width: 2,
          color,
        },
        data: location.advanceCountDetectors.flatMap((events) => {
          const finalX = getArrivalTime(
            events.distanceToStopBar,
            location.speed,
            events.detectorOn
          )

          const initialX = getArrivalTime(
            -location.distanceToPreviousLocation,
            location.speed,
            finalX
          )
          const values = [
            [initialX, distanceData[i - 1]],
            [finalX, distanceData[i]],
            null,
          ]
          return values
        }),
      }
      seriesOptions.push(series)
    }
  })
  return seriesOptions
  // return {
  //   name: `Advance Count ${phaseType?.length && phaseType}`,
  //   type: 'line',
  //   symbol: 'none',
  //   lineStyle: {
  //     width: 2,
  //     color,
  //   },
  //   data: data.reduce((result, location, i) => {
  //     if (location.advanceCountDetectors) {
  //       const points: any[] = location.advanceCountDetectors.flatMap(
  //         (events) => {
  //           const finalX = getArrivalTime(
  //             events.distanceToStopBar,
  //             location.speed,
  //             events.detectorOn
  //           )

  //           const initialX = getArrivalTime(
  //             -location.distanceToPreviousLocation,
  //             location.speed,
  //             finalX
  //           )
  //           const values = [
  //             [initialX, distanceData[i - 1]],
  //             [finalX, distanceData[i]],
  //             null,
  //           ]
  //           return values
  //         }
  //       )
  //       // points.push(null)
  //       result.push(...points)
  //     }
  //     return result
  //   }, [] as any[]),
  // }
}

// function generateStopBarPresenceEventLines(
//   data: RawTimeSpaceHistoricData[],
//   distanceData: number[],
//   color: string,
//   phaseType?: string
// ): SeriesOption[] {
//   const dataPoints = getStopBarPresenceDataPoints(data, distanceData)
//   const chunkSize = 1000
//   const options: SeriesOption[] = []

//   for (let i = 0, j = 0; i < dataPoints.length; i += chunkSize, j++) {
//     const startIndex = j * chunkSize
//     const endIndex = Math.min((j + 1) * chunkSize, dataPoints.length)
//     const chunk = dataPoints.slice(startIndex, endIndex)

//     options.push({
//       name: `Stop Bar Presence ${phaseType?.length && phaseType}`,
//       type: 'custom',
//       data: chunk,
//       clip: true,
//       selectedMode: false,
//       renderItem: function (params, api) {
//         if (params.context.rendered) {
//           return
//         }
//         params.context.rendered = true
//         let points = []
//         const polygons: any[] = []
//         for (let j = 0; j < chunk.length; j++) {
//           if (chunk[j] === null) {
//             polygons.push({
//               type: 'polygon',
//               transition: ['shape'],
//               shape: {
//                 points: points,
//               },
//               style: {
//                 opacity: 1,
//                 fill: color,
//                 lineWidth: 3,
//               },
//             })
//             points = []
//           } else {
//             points.push(api.coord(chunk[j]))
//           }
//         }
//         return {
//           type: 'group',
//           children: polygons,
//         }
//       },
//     })
//   }

//   return options
// }

function generateStopBarPresenceEventLines(
  data: RawTimeSpaceHistoricData[],
  distanceData: number[],
  color: string,
  phaseType?: string,
  isPrimary?: boolean
): SeriesOption[] {
  const seriesOptions: SeriesOption[] = []

  for (let i = 0; i < data.length; i++) {
    const location = data[i]
    const dataPoints = getStopBarPresenceDataPoints(location, distanceData[i])

    const seriesOption: SeriesOption = {
      name: `Stop Bar Presence ${phaseType?.length && phaseType}`,
      id: `SBP ${data[i].locationIdentifier} ${phaseType?.length ? phaseType : ''}`,
      type: 'custom',
      data: dataPoints,
      clip: true,
      selectedMode: false,
      renderItem: function (params, api) {
        const i = params.dataIndex
        if (!dataPoints || i >= dataPoints.length - 1 || i % 2 !== 0) {
          return
        }
        const nextIndex = i + 1
        const distanceToNext = isPrimary
          ? location.distanceToNextLocation
          : -location.distanceToNextLocation
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
            opacity: 1,
            fill: color,
            lineWidth: 3,
          },
        }
      },
    }
    seriesOptions.push(seriesOption)
  }
  return seriesOptions
}

function getStopBarPresenceDataPoints(
  location: RawTimeSpaceHistoricData,
  currDistance: number
) {
  if (location.stopBarPresenceDetectors.length) {
    return location.stopBarPresenceDetectors.flatMap((events) => {
      return [
        [events.detectorOn, currDistance],
        [events.detectorOff, currDistance],
      ]
    })
  }
}

// function getStopBarPresenceDataPoints(
//   data: RawTimeSpaceHistoricData[],
//   distanceData: number[]
// ) {
//   return data.reduce((result, location, index) => {
//     if (location.stopBarPresenceDetectors) {
//       const stopBarEvents = location.stopBarPresenceDetectors
//       for (let i = 0; i < stopBarEvents.length; ) {
//         const currPoint = stopBarEvents[i]
//         const nextPoint = stopBarEvents[i + 1]
//         if (i === 0 && currPoint.isDetectorOn === false) {
//           result.push(
//             [location.start, distanceData[index]],
//             [currPoint.initialX, distanceData[index]],
//             [currPoint.finalX, distanceData[index + 1]],
//             [location.start, distanceData[index + 1]],
//             null
//           )
//           i++
//         } else if (
//           i === stopBarEvents.length - 1 &&
//           currPoint.isDetectorOn === true
//         ) {
//           result.push(
//             [currPoint.initialX, distanceData[index]],
//             [location.end, distanceData[index]],
//             [location.end, distanceData[index + 1]],
//             [currPoint.finalX, distanceData[index + 1]],
//             null
//           )
//           i++
//         } else {
//           result.push(
//             ...[
//               [currPoint.initialX, distanceData[index]],
//               [nextPoint.initialX, distanceData[index]],
//               [nextPoint.finalX, distanceData[index + 1]],
//               [currPoint.finalX, distanceData[index + 1]],
//               null,
//             ]
//           )
//           i += 2
//         }
//       }
//     }
//     return result
//   }, [] as any)
// }
