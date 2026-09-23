import { Route, useGetRoute } from '@/api/config'
import { useEffect, useState } from 'react'

export interface RouteHandler {
  routeId: string
  routes: Route[]
  changeRouteId(routeId: string): void
}

export const useRouteHandler = () => {
  const { data } = useGetRoute({ expand: 'routeLocations' })
  const [routeId, setRouteId] = useState('')
  const [routes, setRoutes] = useState<Route[]>([])

  useEffect(() => {
    if (data) {
      const sortedRoutes = [...data].sort((a, b) => {
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
      setRoutes(sortedRoutes)
    }
  }, [data])

  const component: RouteHandler = {
    routes,
    routeId,
    changeRouteId(routeId) {
      setRouteId(routeId)
    },
  }

  return component
}
