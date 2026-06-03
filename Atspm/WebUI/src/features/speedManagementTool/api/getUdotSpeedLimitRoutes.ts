import { useEnv } from '@/hooks/useEnv'
import axios from 'axios'
import { useQuery } from 'react-query'

const DEFAULT_QUERY_PARAMS = {
  where: '1=1',
  outFields: '*',
  returnGeometry: 'true',
  outSR: '4326',
  f: 'geojson',
} as const

const buildSpeedLimitRouteUrl = (route: string) => {
  const url = new URL(route)

  Object.entries(DEFAULT_QUERY_PARAMS).forEach(([key, value]) => {
    if (!url.searchParams.get(key)) {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

export function useUdotSpeedLimitRoutes() {
  const env = useEnv()
  const route = env.SPEED_LIMIT_MAP_LAYER

  return useQuery(
    ['udot-speed-limit', route],
    () => {
      if (!route) {
        throw new Error('SPEED_LIMIT_MAP_LAYER is not configured.')
      }

      return axios
        .get(buildSpeedLimitRouteUrl(route))
        .then((res) => res.data as UdotSpeedLimitRoute)
    },
    { enabled: !!route }
  )
}

interface UdotSpeedLimitRoute {
  features: {
    geometry: { coordinates: number[][] }
    properties: { route_id: string; speedLimit: number }
  }[]
}
