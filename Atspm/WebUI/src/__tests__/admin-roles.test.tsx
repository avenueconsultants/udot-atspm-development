import type {
  ClaimsModel,
  CreateRoleViewModel,
  RolesResult,
} from '@/api/identity'
import RolesAdmin from '@/pages/admin/roles'
import { IDENTITY_API } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/test-utils'
import Cookies from 'js-cookie'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

jest.mock('@/components/ResponsivePage', () => ({
  ResponsivePageLayout: ({ children }: { children: ReactNode }) => children,
}))
jest.mock('@/feature-flags/FeatureFlagContext', () => ({
  useFlags: () => ({ speedManagementTool: false }),
}))
const mockNotify = jest.fn()
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: mockNotify }),
}))

const availableClaims = [
  'User:View',
  'User:Edit',
  'User:Delete',
  'Role:View',
  'Role:Edit',
  'Role:Delete',
  'SpeedConfiguration:View',
]

function stubRoles(claims: RolesResult['claims']) {
  let role: RolesResult = { role: 'Operators', claims }
  let reads = 0
  const writes: ClaimsModel[] = []
  server.use(
    http.get(`${IDENTITY_API}/Roles`, () => {
      reads++
      return HttpResponse.json([role])
    }),
    http.get(`${IDENTITY_API}/Claims`, () =>
      HttpResponse.json(availableClaims)
    ),
    http.post(`${IDENTITY_API}/Claims/add/Operators`, async ({ request }) => {
      const data = (await request.json()) as ClaimsModel
      writes.push(data)
      role = { ...role, claims: data.claims ?? null }
      return new HttpResponse(null, { status: 204 })
    })
  )
  return {
    writes,
    get reads() {
      return reads
    },
  }
}

beforeEach(() => {
  Cookies.set('loggedIn', 'true')
  Cookies.set('claims', 'Role:View,Role:Edit,Role:Delete')
  mockNotify.mockClear()
})
afterEach(() => {
  Cookies.remove('loggedIn')
  Cookies.remove('claims')
})

async function editRole(
  user: ReturnType<typeof userEvent.setup>,
  roleName = 'Operators'
) {
  const row = await screen.findByRole('row', { name: new RegExp(roleName) })
  await user.click(within(row).getByRole('button', { name: 'more' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByRole('heading', {
      name: `Role Permissions - ${roleName}`,
    })
  ).toBeInTheDocument()
  return dialog
}

// The permission selects have no accessible label yet. Their order follows
// the generated /Claims fixture: User, then Role; the speed feature is hidden.
async function setUserPermission(
  user: ReturnType<typeof userEvent.setup>,
  value: string
) {
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getAllByRole('combobox')[0])
  await user.click(await screen.findByRole('option', { name: value }))
}

it('preserves all existing claims when an existing role is saved unchanged', async () => {
  const claims = ['User:View', 'Role:View', 'SpeedConfiguration:View']
  const backend = stubRoles(claims)
  const user = userEvent.setup()
  renderWithProviders(<RolesAdmin />)
  const dialog = await editRole(user)
  await waitFor(() =>
    expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent('View')
  )
  const readsBeforeSave = backend.reads
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(backend.writes).toHaveLength(1))
  expect(backend.writes[0]).toEqual({ claims })
  await waitFor(() => expect(backend.reads).toBeGreaterThan(readsBeforeSave))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  const reopened = await editRole(user)
  expect(within(reopened).getAllByRole('combobox')[0]).toHaveTextContent('View')
})

it('updates one permission while preserving other and feature-hidden claims, then reads back the saved value', async () => {
  const backend = stubRoles([
    'User:View',
    'Role:View',
    'SpeedConfiguration:View',
  ])
  const user = userEvent.setup()
  renderWithProviders(<RolesAdmin />)
  const dialog = await editRole(user)
  await waitFor(() =>
    expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent('View')
  )
  await setUserPermission(user, 'View & Edit')
  const readsBeforeSave = backend.reads
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(backend.writes).toHaveLength(1))
  expect(backend.writes[0].claims?.slice().sort()).toEqual(
    ['User:View', 'User:Edit', 'Role:View', 'SpeedConfiguration:View'].sort()
  )
  await waitFor(() => expect(backend.reads).toBeGreaterThan(readsBeforeSave))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  const reopened = await editRole(user)
  await waitFor(() =>
    expect(within(reopened).getAllByRole('combobox')[0]).toHaveTextContent(
      'View & Edit'
    )
  )
})

it('keeps the last permission cleared and persists an empty claims array', async () => {
  const backend = stubRoles(['User:View'])
  const user = userEvent.setup()
  renderWithProviders(<RolesAdmin />)
  const dialog = await editRole(user)
  await waitFor(() =>
    expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent('View')
  )
  await setUserPermission(user, 'None')
  await waitFor(() =>
    expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent('None')
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(backend.writes).toEqual([{ claims: [] }]))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  const reopened = await editRole(user)
  expect(within(reopened).getAllByRole('combobox')[0]).toHaveTextContent('None')
})

it('creates a role with permissions chosen before its name and reads back the saved claims', async () => {
  const roles: RolesResult[] = []
  const writes: { url: string; data: CreateRoleViewModel | ClaimsModel }[] = []
  server.use(
    http.get(`${IDENTITY_API}/Roles`, () => HttpResponse.json(roles)),
    http.get(`${IDENTITY_API}/Claims`, () =>
      HttpResponse.json(availableClaims)
    ),
    http.post(`${IDENTITY_API}/Roles`, async ({ request }) => {
      const data = (await request.json()) as CreateRoleViewModel
      writes.push({ url: request.url, data })
      roles.push({ role: data.roleName, claims: [] })
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(
      `${IDENTITY_API}/Claims/add/:roleName`,
      async ({ request, params }) => {
        const data = (await request.json()) as ClaimsModel
        writes.push({ url: request.url, data })
        const role = roles.find((item) => item.role === params.roleName)
        if (!role) return new HttpResponse(null, { status: 404 })
        role.claims = data.claims ?? null
        return new HttpResponse(null, { status: 200 })
      }
    )
  )
  const user = userEvent.setup()
  renderWithProviders(<RolesAdmin />)
  await user.click(
    await screen.findByRole('button', { name: 'New Custom Role' })
  )
  const dialog = await screen.findByRole('dialog')
  const nameInput = within(dialog).getByRole('textbox', { name: 'Role Name' })
  expect(nameInput).toHaveValue('')
  await setUserPermission(user, 'View & Edit')
  expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent(
    'View & Edit'
  )
  await user.type(nameInput, 'Analysts')
  expect(within(dialog).getAllByRole('combobox')[0]).toHaveTextContent(
    'View & Edit'
  )
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(writes).toEqual([
      { url: `${IDENTITY_API}/Roles`, data: { roleName: 'Analysts' } },
      {
        url: `${IDENTITY_API}/Claims/add/Analysts`,
        data: { claims: ['User:View', 'User:Edit'] },
      },
    ])
  )
  await screen.findByRole('row', { name: /Analysts/ })
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  const reopened = await editRole(user, 'Analysts')
  expect(within(reopened).getAllByRole('combobox')[0]).toHaveTextContent(
    'View & Edit'
  )
  expect(within(reopened).getAllByRole('combobox')[1]).toHaveTextContent('None')
  expect(writes).toHaveLength(2)
})

it('does not expose create, edit, or delete controls to a view-only role administrator', async () => {
  Cookies.set('claims', 'Role:View')
  const backend = stubRoles(null)
  renderWithProviders(<RolesAdmin />)
  const row = await screen.findByRole('row', { name: /Operators/ })
  expect(
    within(row).queryByRole('button', { name: 'more' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'New Custom Role' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Edit' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Delete' })
  ).not.toBeInTheDocument()
  expect(backend.writes).toEqual([])
})
