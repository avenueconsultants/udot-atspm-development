import { useEnv } from '@/hooks/useEnv'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import type { ForwardedRef, ReactNode } from 'react'
import LocationMap from './LocationMap'

jest.mock('@/hooks/useEnv', () => ({ useEnv: jest.fn() }))
jest.mock('@/components/LocationMap/Markers', () => () => null)
jest.mock('@/components/MapFilters', () => () => null)
jest.mock('esri-leaflet-renderers', () => ({}))
jest.mock('react-leaflet', () => {
  const React = jest.requireActual('react')
  return {
    MapContainer: React.forwardRef(function MockMapContainer(
      { children }: { children: ReactNode },
      ref: ForwardedRef<HTMLDivElement>
    ) {
      void ref
      return <div>{children}</div>
    }),
    Polyline: () => null,
    TileLayer: ({ url }: { url: string }) => {
      // Leaflet expands URL templates when creating a tile.
      const tile = url.replace('{z}', '0')
      return <div data-testid="tile-layer">{tile}</div>
    },
  }
})

const props = {
  location: null,
  setLocation: jest.fn(),
  locations: [],
  filteredLocations: [],
  filters: {},
  updateFilters: jest.fn(),
}
const originalFetch = global.fetch
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false })
})
afterEach(() => {
  global.fetch = originalFetch
})

it.each([undefined, '', '   '])(
  'does not mount tiles with missing URL %s',
  async (url) => {
    ;(useEnv as jest.Mock).mockReturnValue({ MAP_TILE_LAYER: url })
    render(<LocationMap {...props} />)
    expect(
      await screen.findByText('Map tiles are not configured.')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('tile-layer')).not.toBeInTheDocument()
  }
)

it('uses a configured tile URL', async () => {
  ;(useEnv as jest.Mock).mockReturnValue({
    MAP_TILE_LAYER: 'https://tiles.example/{z}/{x}/{y}.png',
  })
  render(<LocationMap {...props} />)
  expect(await screen.findByTestId('tile-layer')).toHaveTextContent(
    'https://tiles.example/0/{x}/{y}.png'
  )
})

it('loads Google tiles without a fallback tile URL', async () => {
  ;(useEnv as jest.Mock).mockReturnValue({})
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ session: 'test-session' }),
  })
  render(<LocationMap {...props} />)
  expect(await screen.findByTestId('tile-layer')).toHaveTextContent(
    '/api/google/tiles/0/{x}/{y}?session=test-session'
  )
})
