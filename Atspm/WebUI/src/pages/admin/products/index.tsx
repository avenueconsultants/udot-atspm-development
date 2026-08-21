import {
  Product,
  useDeleteProductFromKey,
  useGetProduct,
  usePatchProductFromKey,
  usePostProduct,
} from '@/api/config'
import AdminTable from '@/components/AdminTable/AdminTable'
import DeleteModal from '@/components/AdminTable/DeleteModal'
import { ResponsivePageLayout } from '@/components/ResponsivePage'
import {
  PageNames,
  useUserHasClaim,
  useViewPage,
} from '@/features/identity/pagesCheck'
import ProductEditorModal from '@/features/products/components/ProductEditorModal'
import { formatInstantAsLocalDate } from '@/utils/dateTime'
import { Backdrop, CircularProgress } from '@mui/material'

const ProductsAdmin = () => {
  const pageAccess = useViewPage(PageNames.Products)

  const hasDeviceEditClaim = useUserHasClaim('Device:Edit')
  const hasDeviceDeleteClaim = useUserHasClaim('Device:Delete')

  const { mutateAsync: createMutation } = usePostProduct()
  const { mutateAsync: deleteMutation } = useDeleteProductFromKey()
  const { mutateAsync: editMutation } = usePatchProductFromKey()

  const {
    data: productData,
    isLoading,
    refetch: refetchProducts,
  } = useGetProduct()

  const products = productData

  if (pageAccess.isLoading) {
    return
  }

  const onModalClose = () => {
    //do something?? potentially just delete
  }

  const HandleCreateProduct = async (productData: Product) => {
    const { manufacturer, model, webPage, notes } = productData

    const sanitizedProduct: Partial<Product> = {}

    if (manufacturer) sanitizedProduct.manufacturer = manufacturer
    if (model) sanitizedProduct.model = model
    if (webPage) sanitizedProduct.webPage = webPage
    if (notes) sanitizedProduct.notes = notes

    try {
      await createMutation({ data: sanitizedProduct })
      refetchProducts()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  const HandleDeleteProduct = async (id: string | number) => {
    try {
      await deleteMutation({ key: Number(id) })
      refetchProducts()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  const HandleEditProduct = async (productData: Product) => {
    const { id, manufacturer, model, webPage, notes } = productData
    try {
      await editMutation({
        data: { manufacturer, model, webPage, notes },
        key: id,
      })
      refetchProducts()
    } catch (error) {
      console.error('Mutation Error:', error)
    }
  }

  if (isLoading) {
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    )
  }

  if (!products) {
    return <div>Error returning data</div>
  }

  const filteredData = products.map((obj: Product) => {
    return {
      ...obj,
      created: formatInstantAsLocalDate(obj.created),
      modified: formatInstantAsLocalDate(obj.modified),
    }
  })

  const cells = [
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'model', label: 'Model' },
    { key: 'webPage', label: 'Web Page' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <ResponsivePageLayout title="Manage Products" noBottomMargin>
      <AdminTable
        pageName="Product"
        cells={cells}
        data={filteredData}
        hasEditPrivileges={hasDeviceEditClaim}
        hasDeletePrivileges={hasDeviceDeleteClaim}
        editModal={
          <ProductEditorModal
            isOpen={true}
            onSave={HandleEditProduct}
            onClose={onModalClose}
          />
        }
        createModal={
          hasDeviceEditClaim ? (
            <ProductEditorModal
              isOpen={true}
              onSave={HandleCreateProduct}
              onClose={onModalClose}
            />
          ) : undefined
        }
        deleteModal={
          <DeleteModal
            id={0}
            name={''}
            objectType="Product"
            deleteLabel={(selectedRow: (typeof filteredData)[number]) =>
              `${selectedRow.manufacturer} - ${selectedRow.model}`
            }
            open={false}
            onClose={onModalClose}
            onConfirm={HandleDeleteProduct}
          />
        }
      />
    </ResponsivePageLayout>
  )
}

export default ProductsAdmin
