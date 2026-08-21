import {
  Region,
  SearchLocation as Location,
  useDeleteRegionFromKey,
  useGetLocationLocationsForSearch,
  useGetRegion,
  usePatchRegionFromKey,
  usePostRegion,
} from '@/api/config'
import AdminTable from '@/components/AdminTable/AdminTable'
import DeleteModal from '@/components/AdminTable/DeleteModal'
import { ResponsivePageLayout } from '@/components/ResponsivePage'
import {
  PageNames,
  useUserHasClaim,
  useViewPage,
} from '@/features/identity/pagesCheck'
import RegionEditorModal from '@/features/regions/components/RegionEditorModal'
import { formatInstantAsLocalDate, formatInstantAsLocalDateTime } from '@/utils/dateTime'
import { Backdrop, CircularProgress } from '@mui/material'

const RegionsAdmin = () => {
  const pageAccess = useViewPage(PageNames.Region)
  const hasLocationsEditClaim = useUserHasClaim('LocationConfiguration:Edit')
  const hasLocationsDeleteClaim = useUserHasClaim(
    'LocationConfiguration:Delete'
  )

  const { mutateAsync: createMutation } = usePostRegion()
  const { mutateAsync: deleteMutation } = useDeleteRegionFromKey()
  const { mutateAsync: editMutation } = usePatchRegionFromKey()

  const { data: locationsData } = useGetLocationLocationsForSearch()
  const locations = locationsData

  const {
    data: regionData,
    isLoading,
    refetch: refetchRegions,
  } = useGetRegion()

  const regions = regionData

  if (pageAccess.isLoading) {
    return null
  }
  const HandleCreateRegion = async (regionData: Region) => {
    const { id, description } = regionData
    try {
      await createMutation({ data: { id, description } })
      refetchRegions()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  const HandleDeleteRegion = async (id: string | number) => {
    try {
      await deleteMutation({ key: Number(id) })
      refetchRegions()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  const HandleEditRegion = async (regionData: Region) => {
    const { id, description } = regionData
    try {
      await editMutation({
        data: { id, description },
        key: Number(id),
      })
      refetchRegions()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  const onModalClose = () => {
    //do something?? potentially just delete
  }

  const filterAssociatedObjects = (
    regionId: number,
    objects: Location[]
  ): { id: number; name: string }[] => {
    const associatedLocations = objects.filter(
      (object) => object.regionId === regionId && object.id != null
    )

    return associatedLocations.map((location) => ({
      id: location.id as number,
      name: `${location.primaryName} & ${location.secondaryName}`,
    }))
  }

  if (isLoading) {
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    )
  }

  if (!regions) {
    return <div>Error returning data</div>
  }

  const filteredData = regions.map((region) => {
    return {
      ...region,
      created: formatInstantAsLocalDate(region.created),
      modified: formatInstantAsLocalDate(region.modified),
    }
  })

  const cells = [
    {
      key: 'description',
      label: 'Description',
    },
  ]

  return (
    <ResponsivePageLayout title="Manage Regions" noBottomMargin>
      <AdminTable
        pageName="Region"
        cells={cells}
        data={filteredData}
        hasEditPrivileges={hasLocationsEditClaim}
        hasDeletePrivileges={hasLocationsDeleteClaim}
        editModal={
          <RegionEditorModal
            isOpen={true}
            onSave={HandleEditRegion}
            onClose={onModalClose}
          />
        }
        createModal={
          <RegionEditorModal
            isOpen={true}
            onSave={HandleCreateRegion}
            onClose={onModalClose}
          />
        }
        deleteModal={
          <DeleteModal
            id={0}
            name={''}
            objectType="Region"
            deleteLabel={(selectedRow: (typeof filteredData)[number]) =>
              selectedRow.description
            }
            open={false}
            onClose={onModalClose}
            onConfirm={HandleDeleteRegion}
            associatedObjects={locations}
            associatedObjectsLabel="locations"
            filterFunction={filterAssociatedObjects}
          />
        }
      />
    </ResponsivePageLayout>
  )
}

export default RegionsAdmin
