import { generatePin } from '@/features/locations/utils'
import { getEnv } from '@/utils/getEnv'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import LocationCoordinateMap from './LocationCoordinateMap'

let latestTileLayerProps: {
  attribution?: string
  url?: string
} | null = null

jest.mock('@/utils/getEnv', () => ({
  getEnv: jest.fn(),
}))

jest.mock('@/features/locations/utils', () => ({
  generatePin: jest.fn(),
}))

jest.mock('react-leaflet', () => {
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    MapContainer: React.forwardRef(function MockMapContainer(
      { children }: { children: React.ReactNode },
      ref: React.ForwardedRef<{
        getContainer: () => HTMLDivElement
        invalidateSize: () => void
        setView: () => void
      }>
    ) {
      const mapRef = React.useMemo(() => {
        const mapContainer = document.createElement('div')
        return {
          getContainer: () => mapContainer,
          invalidateSize: jest.fn(),
          setView: jest.fn(),
        }
      }, [])

      React.useEffect(() => {
        if (typeof ref === 'function') {
          ref(mapRef)
          return () => ref(null)
        }

        if (ref) {
          ref.current = mapRef
        }

        return () => {
          if (ref) {
            ref.current = null
          }
        }
      }, [ref, mapRef])

      return <div data-testid="map-container">{children}</div>
    }),
    Marker: () => <div data-testid="marker" />,
    TileLayer: (props: { attribution?: string; url?: string }) => {
      latestTileLayerProps = props
      return <div data-testid="tile-layer" />
    },
    useMapEvents: () => null,
  }
})

describe('LocationCoordinateMap', () => {
  beforeEach(() => {
    latestTileLayerProps = null
    ;(getEnv as jest.Mock).mockReset()
    ;(generatePin as jest.Mock).mockReset().mockResolvedValue({})

    class ResizeObserverMock {
      observe() {
        // This test stub does not observe real layout changes.
      }
      disconnect() {
        // There are no observers to disconnect in this test stub.
      }
    }

    global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver
  })

  it('renders the map when tile attribution is missing', async () => {
    ;(getEnv as jest.Mock).mockResolvedValue({
      MAP_TILE_LAYER: 'https://tiles.example/{z}/{x}/{y}.png',
      MAP_TILE_ATTRIBUTION: null,
    })

    render(
      <LocationCoordinateMap
        center={[40.7608, -111.891]}
        zoom={12}
        onSelect={jest.fn()}
        locationTypeId={1}
      />
    )

    await waitFor(() =>
      expect(screen.getByTestId('map-container')).toBeInTheDocument()
    )

    expect(screen.getByTestId('tile-layer')).toBeInTheDocument()
    expect(latestTileLayerProps).toEqual(
      expect.objectContaining({
        attribution: '',
        url: 'https://tiles.example/{z}/{x}/{y}.png',
      })
    )
  })

  it('shows a message when map tiles are not configured', async () => {
    ;(getEnv as jest.Mock).mockResolvedValue({
      MAP_TILE_LAYER: null,
      MAP_TILE_ATTRIBUTION: null,
    })

    render(
      <LocationCoordinateMap
        center={[40.7608, -111.891]}
        zoom={12}
        onSelect={jest.fn()}
      />
    )

    await waitFor(() =>
      expect(
        screen.getByText('Map tiles are not configured.')
      ).toBeInTheDocument()
    )
  })
})
