// Fixed identifiers and controller times shared by the feature regression suites.
// Event counts are per detector: 30 activations per quarter, 120 per hour.
export const featureData = {
  location: 'E2ECORE01',
  downstream: 'E2ECORE02',
  empty: 'E2EEMPTY01',
  admin: 'E2EADMIN01',
  route: 'E2E feature regression corridor',
  start: '2026-01-05T08:00:00',
  end: '2026-01-05T09:00:00',
  date: '2026-01-05',
  ordinaryEmail: 'e2e-reader@example.invalid',
  ordinaryPassword: 'E2e-Reader-Only-2026!',
} as const
