import type { DetectionTypeGroup, DeviceGroup } from '../../src/api/config'
import {
  DetectionTypes,
  WatchDogIssueTypes,
  type WatchDogDashboardGroup,
} from '../../src/api/reports'

export const summaryDevices = [
  { manufacturer: 'Acme', model: 'C1', firmware: '1.0', count: 8 },
] satisfies DeviceGroup[]

export const summaryDetectionCounts = [
  { id: 'Advance Count', count: 12 },
] satisfies DetectionTypeGroup[]

export const watchdogSummary = {
  controllerTypeGroup: [
    {
      name: 'Acme',
      model: [
        {
          name: 'C1',
          firmware: [
            {
              name: '1.0',
              issueType: [
                { name: 'LowDetectorHits', counts: 6 },
                { name: 'UnconfiguredDetector', counts: 2 },
              ],
            },
          ],
        },
      ],
    },
  ],
  issueTypeGroup: [
    {
      name: 'LowDetectorHits',
      issueType: WatchDogIssueTypes.LowDetectorHits,
      products: [
        {
          name: 'Acme',
          model: [{ name: 'C1', firmware: [{ name: '1.0', counts: 6 }] }],
        },
      ],
    },
    {
      name: 'UnconfiguredDetector',
      issueType: WatchDogIssueTypes.UnconfiguredDetector,
      products: [
        {
          name: 'Acme',
          model: [{ name: 'C1', firmware: [{ name: '1.0', counts: 2 }] }],
        },
      ],
    },
  ],
  detectionTypeGroup: [
    {
      name: 'Advance Count',
      detectionType: DetectionTypes.AC,
      hardware: [{ name: 'Video', counts: 6 }],
    },
  ],
} satisfies WatchDogDashboardGroup
