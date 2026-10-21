export const scenarios = {
  unknownLocation: 'E2E-UNKNOWN-01',
  commute: 'E2ETODC01',
  freeFallback: 'E2ETODF01',
  splitPressure: 'E2ETODS01',
  capacityChanges: 'E2ETODV01',
  noAggregations: 'E2ETODN01',
  zeroVolume: 'E2ETODZ01',
  lunchSpike: 'E2ETODL01',
  partialPlan: 'E2ETODP01',
  noVehicleDetectors: 'E2ETODX01',
  noTurningMovementDetectors: 'E2ETODT01',
  regexIdentifier: 'E2E(TOD01',
  multiLocationMedian: [
    'E2ETODM01A',
    'E2ETODM01B',
    'E2ETODM01C',
  ],
} as const

export const knownDates = {
  monday: '2026-01-05',
  tuesday: '2026-01-06',
  wednesday: '2026-01-07',
} as const
