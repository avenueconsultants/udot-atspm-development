import {
  SearchLocation as Location,
  RouteDistanceDto,
  RouteDto,
  RouteLocationDto,
  useGetLocationLocationsForSearch,
  useGetRouteDistance,
  useGetRouteRouteViewFromId,
  useUpsertRouteRoute,
} from '@/api/config'
import AuditInfo from '@/components/AuditInfo'
import { PageNames, useViewPage } from '@/features/identity/pagesCheck'
import SelectLocation from '@/features/locations/components/selectLocation/SelectLocation'
import RouteEditor from '@/features/routes/components/routeEditor'
import { useNotificationStore } from '@/stores/notifications'
import { fetchRouteDistance } from '@/utils/fetchRouteDistance'
import { removeAuditFields } from '@/utils/removeAuditFields'
import { navigateToPage } from '@/utils/routes'
import { DropResult } from '@hello-pangea/dnd'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import { Box, Button, Paper, TextField } from '@mui/material'
import { useRouter } from 'next/router'
import React, { memo, useCallback, useEffect, useState } from 'react'

const RouteAdmin = () => {
  const pageAccess = useViewPage(PageNames.Routes)
  const router = useRouter()
  const { id } = router.query
  const { addNotification } = useNotificationStore()

  const { data: locations } = useGetLocationLocationsForSearch()
  const routeId = typeof id === 'string' ? Number(id) : NaN
  const { data: route } = useGetRouteRouteViewFromId(routeId, undefined, {
    query: { enabled: typeof id === 'string' && id !== '' },
  })
  const { data: routeDistancesData } = useGetRouteDistance()
  const { mutate: updateRoute } = useUpsertRouteRoute()

  const [location, setLocation] = useState<Location | null>(null)
  const [routePolyline, setRoutePolyline] = useState<number[][]>([])
  const [updatedRoute, setUpdatedRoute] = useState<RouteDto>()
  const [hasLoaded, setHasLoaded] = useState(false)
  const [hasErrors, setHasErrors] = useState(false)
  const [routeDistances, setRouteDistances] = useState<RouteDistanceDto[]>([])

  useEffect(() => {
    if (routeDistancesData) {
      const distances = routeDistancesData.map((rd) => removeAuditFields(rd))
      setRouteDistances(distances)
    }
  }, [routeDistancesData])

  const fetchRouteDistanceAndUpdatePolyline = useCallback(
    async (routeLocations: RouteLocationDto[]) => {
      if (routeLocations.length < 2) {
        setRoutePolyline([])
        return
      }
      try {
        const polylineResponse = await fetchRouteDistance(routeLocations)
        if (polylineResponse) {
          setRoutePolyline(polylineResponse.shape)
        }
      } catch {
        addNotification({
          type: 'error',
          title: 'Error fetching route distance',
        })
      }
    },
    [addNotification]
  )

  useEffect(() => {
    if (hasLoaded) return

    if (!route || !locations || !routeDistances || pageAccess.isLoading) {
      return
    }

    const sortedLocations = [...(route.routeLocations ?? [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    )
    setUpdatedRoute({ ...route, routeLocations: sortedLocations })
    setHasLoaded(true)

    if (sortedLocations.length >= 2) {
      fetchRouteDistanceAndUpdatePolyline(sortedLocations)
    }
  }, [
    route,
    locations,
    routeDistances,
    pageAccess.isLoading,
    hasLoaded,
    fetchRouteDistanceAndUpdatePolyline,
  ])

  if (!updatedRoute || !locations || !routeDistances) {
    return null
  }

  const routeLocations = updatedRoute.routeLocations ?? []

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(routeLocations)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)

    const reIndexed = items.map((item, idx) => ({ ...item, order: idx }))

    const touch = new Set<number>([
      result.destination.index,
      result.source.index,
      result.destination.index - 1,
      result.destination.index + 1,
      result.source.index - 1,
      result.source.index + 1,
    ])
    const affected = Array.from(touch)
      .filter((i) => i >= 0 && i < reIndexed.length)
      .sort((a, b) => a - b)

    const recomputeAround = (arr: typeof reIndexed, i: number) => {
      const curr = arr[i]
      const prev = i > 0 ? arr[i - 1] : undefined
      const next = i + 1 < arr.length ? arr[i + 1] : undefined

      if (prev) {
        const d = findRouteDistance(
          prev,
          curr.locationIdentifier ?? '',
          routeDistances
        )
        curr.previousLocationDistance = d
        curr.previousLocationDistanceId = d?.id ?? null
        prev.nextLocationDistance = d
        prev.nextLocationDistanceId = d?.id ?? null
      } else {
        curr.previousLocationDistance = null
        curr.previousLocationDistanceId = null
      }

      // curr -> next
      if (next) {
        const d = findRouteDistance(
          curr,
          next.locationIdentifier ?? '',
          routeDistances
        )
        curr.nextLocationDistance = d
        curr.nextLocationDistanceId = d?.id ?? null
        next.previousLocationDistance = d
        next.previousLocationDistanceId = d?.id ?? null
      } else {
        curr.nextLocationDistance = null
        curr.nextLocationDistanceId = null
      }
    }

    affected.forEach((i) => recomputeAround(reIndexed, i))

    if (reIndexed.length > 0) {
      reIndexed[0].previousLocationDistance = null
      reIndexed[0].previousLocationDistanceId = null
      reIndexed[reIndexed.length - 1].nextLocationDistance = null
      reIndexed[reIndexed.length - 1].nextLocationDistanceId = null
    }

    fetchRouteDistanceAndUpdatePolyline(reIndexed)
    setUpdatedRoute((prev) => ({ ...prev, routeLocations: reIndexed }))
  }

  const onAddRoute = () => {
    if (!location || !updatedRoute) return
    const exists = routeLocations.some(
      (link) => link.locationIdentifier === location.locationIdentifier
    )
    if (exists) return

    const newLink: RouteLocationDto = {
      routeId: updatedRoute.id ?? undefined,
      locationId: location.id,
      locationIdentifier: location.locationIdentifier,
      primaryName: location.primaryName,
      secondaryName: location.secondaryName,
      latitude: location.latitude,
      longitude: location.longitude,
      order: routeLocations.length,
      primaryPhase: undefined,
      opposingPhase: undefined,
      primaryDirectionId: undefined,
      opposingDirectionId: undefined,
      primaryDirectionDescription: null,
      opposingDirectionDescription: null,
      isPrimaryOverlap: undefined,
      isOpposingOverlap: undefined,
      nextLocationDistance: null,
      nextLocationDistanceId: null,
    }

    const newList = [...routeLocations, newLink]
    setUpdatedRoute((prev) => ({
      ...prev!,
      routeLocations: newList,
    }))

    fetchRouteDistanceAndUpdatePolyline(newList)
    setLocation(null)
  }

  const handleDistanceChange = (
    locationIdentifier: string,
    distance: number
  ) => {
    setUpdatedRoute((prevRoute) => {
      if (!prevRoute) return prevRoute
      const prevLocations = prevRoute.routeLocations ?? []

      // Find the index of the link:
      const idx = prevLocations.findIndex(
        (rl) => rl.locationIdentifier === locationIdentifier
      )
      if (idx === -1) return prevRoute

      const thisLink = prevLocations[idx]
      const nextLink = prevLocations[idx + 1]
      if (!nextLink) return prevRoute

      const existingDist = findRouteDistance(
        thisLink,
        nextLink.locationIdentifier ?? '',
        routeDistances
      )
      const newDistObj: RouteDistanceDto = existingDist
        ? existingDist.distance === distance
          ? existingDist
          : { ...existingDist, distance }
        : {
            locationIdentifierA: thisLink.locationIdentifier,
            locationIdentifierB: nextLink.locationIdentifier,
            distance,
          }

      if (!existingDist || existingDist.distance !== newDistObj.distance) {
        setRouteDistances((prev) => {
          const filtered = prev.filter(
            (d) =>
              !(
                d.locationIdentifierA === newDistObj.locationIdentifierA &&
                d.locationIdentifierB === newDistObj.locationIdentifierB
              )
          )
          return [...filtered, newDistObj]
        })
      }

      const newLocations = prevLocations.map((rl, i) =>
        i === idx
          ? {
              ...rl,
              nextLocationDistance: newDistObj,
            }
          : rl
      )

      return {
        ...prevRoute,
        routeLocations: newLocations,
      }
    })
  }

  const handleDirectionChange = (updatedLink: RouteLocationDto) => {
    setUpdatedRoute((prev) => ({
      ...prev,
      routeLocations: (prev?.routeLocations ?? []).map((rl) =>
        rl.locationIdentifier === updatedLink.locationIdentifier
          ? updatedLink
          : rl
      ),
    }))
  }

  const handleDeleteLink = (link: RouteLocationDto) => {
    if (!updatedRoute) return
    const idx = routeLocations.findIndex(
      (rl) => rl.locationIdentifier === link.locationIdentifier
    )
    if (idx === -1) return

    // Update the previous link's distance (if any) to skip over the deleted one:
    if (idx > 0) {
      const prevLink = routeLocations[idx - 1]
      const nextAfterDeleted = routeLocations[idx + 1]
      prevLink.nextLocationDistance = nextAfterDeleted
        ? findRouteDistance(
            prevLink,
            nextAfterDeleted.locationIdentifier ?? '',
            routeDistances
          )
        : null
    }

    let filtered = routeLocations.filter(
      (rl) => rl.locationIdentifier !== link.locationIdentifier
    )
    // Decrement order on everything after the deleted index:
    filtered = filtered.map((rl, i) =>
      i >= idx ? { ...rl, order: (rl.order ?? 0) - 1 } : rl
    )

    fetchRouteDistanceAndUpdatePolyline(filtered)
    setUpdatedRoute((prev) => ({
      ...prev,
      routeLocations: filtered,
    }))
  }

  const handleEditRouteName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUpdatedRoute((prev) => ({
      ...prev,
      name: e.target.value,
    }))
  }

  const handleSaveRoute = async () => {
    if (!updatedRoute || !updatedRoute.id) return

    const hasErrorsLocal = routeLocations.some((rl, i) => {
      const notLast = i !== routeLocations.length - 1
      const missingDist = notLast && !rl.nextLocationDistance
      const missingDir =
        rl.primaryDirectionId == null || rl.opposingDirectionId == null
      return missingDist || missingDir
    })

    if (hasErrorsLocal) {
      setHasErrors(true)
      return
    }
    setHasErrors(false)

    updateRoute(
      { data: updatedRoute },
      {
        onSuccess: (savedRoute) => {
          addNotification({
            type: 'success',
            title: 'Route saved successfully',
          })
          if (!savedRoute.routeLocations) return
          savedRoute.routeLocations.sort(
            (a, b) => (a.order ?? 0) - (b.order ?? 0)
          )
          setUpdatedRoute(savedRoute)
        },
        onError: (err) => {
          const error = err as unknown
          addNotification({
            type: 'error',
            title: 'Error saving route',
            message: error instanceof Error ? error.message : undefined,
          })
        },
      }
    )
  }

  return (
    <Box>
      <Box
        display="flex"
        flexDirection="column"
        width="200px"
        alignItems="start"
      >
        <Button
          onClick={() => navigateToPage('/admin/routes')}
          sx={{ pl: 0, mb: 2 }}
        >
          <ChevronLeftIcon /> Back to Routes
        </Button>
        <Box
          display="flex"
          flexDirection="row"
          minWidth={800}
          gap={2}
          alignContent={'center'}
          alignItems={'center'}
          mb={2}
        >
          <TextField
            label="Route Name"
            value={updatedRoute.name || ''}
            onChange={handleEditRouteName}
            sx={{ fontSize: '30px', minWidth: '250px' }}
          />
          <AuditInfo obj={route} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex' }}>
        <Paper sx={{ flexGrow: 1, minWidth: '400px', p: 3 }}>
          <SelectLocation
            location={location}
            setLocation={setLocation}
            route={routePolyline}
            center={
              routePolyline[Math.floor(routePolyline.length / 2)] as [
                number,
                number,
              ]
            }
            zoom={13}
            mapHeight="calc(100vh - 330px)"
          />
        </Paper>
        <RouteEditor
          hasErrors={hasErrors}
          route={updatedRoute}
          location={location}
          onAddRoute={onAddRoute}
          onDragEnd={onDragEnd}
          handleDistanceChange={handleDistanceChange}
          handleDirectionUpdate={handleDirectionChange}
          handleDeleteLink={handleDeleteLink}
          handleSaveRoute={handleSaveRoute}
        />
      </Box>
    </Box>
  )
}

export default memo(RouteAdmin)

function findRouteDistance(
  routeLocation: RouteLocationDto,
  nextLocationIdentifier: string,
  routeDistances: RouteDistanceDto[]
): RouteDistanceDto | undefined {
  return routeDistances.find(
    (rd) =>
      routeLocation.locationIdentifier === rd.locationIdentifierA &&
      nextLocationIdentifier === rd.locationIdentifierB
  )
}
