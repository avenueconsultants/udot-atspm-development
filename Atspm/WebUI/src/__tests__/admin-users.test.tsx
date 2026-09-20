import type { Area, Jurisdiction, Region } from '@/api/config'
import type { RolesResult, UserDTO } from '@/api/identity'
import UsersAdmin from '@/pages/admin/users'
import { CONFIG_API, IDENTITY_API, odataCollection } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/test/test-utils'
import Cookies from 'js-cookie'
import { http, HttpResponse } from 'msw'

const mockNotify = jest.fn()
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: mockNotify }),
}))

const areas = [{ id: 31, name: 'North Valley' }] satisfies Area[]
const regions = [{ id: 11, description: 'Northern Region' }] satisfies Region[]
const jurisdictions = [
  { id: 21, name: 'Example City' },
] satisfies Jurisdiction[]
const roles = [
  { role: 'ReportAdmin', claims: ['Report:View'] },
  { role: 'WatchdogSubscriber', claims: ['Watchdog:View'] },
] satisfies RolesResult[]

let users: UserDTO[]
let requests: UserDTO[]
let reads: number
let deletes: string[]

beforeEach(() => {
  mockNotify.mockClear()
  Cookies.set('loggedIn', 'true')
  Cookies.set('claims', 'User:View,User:Edit,User:Delete')
  users = [
    {
      userId: 'user-123',
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      userName: 'Jane.Doe',
      email: 'Jane@Example.com',
      agency: 'UDOT',
      roles: null,
      areaIds: null,
      regionIds: null,
      jurisdictionIds: null,
      areas: null,
      regions: null,
      jurisdictions: null,
    },
  ]
  requests = []
  reads = 0
  deletes = []
  server.use(
    http.get(`${IDENTITY_API}/Users`, () => {
      reads++
      return HttpResponse.json(users)
    }),
    http.get(`${IDENTITY_API}/Roles`, () => HttpResponse.json(roles)),
    http.get(`${CONFIG_API}/Area`, () =>
      HttpResponse.json(odataCollection('Area', areas))
    ),
    http.get(`${CONFIG_API}/Region`, () =>
      HttpResponse.json(odataCollection('Region', regions))
    ),
    http.get(`${CONFIG_API}/Jurisdiction`, () =>
      HttpResponse.json(odataCollection('Jurisdiction', jurisdictions))
    ),
    http.post(`${IDENTITY_API}/Users/update`, async ({ request }) => {
      const update = (await request.json()) as UserDTO
      requests.push(update)
      applyUpdate(update)
      return new HttpResponse(null, { status: 204 })
    }),
    http.delete(`${IDENTITY_API}/Users/:userId`, ({ params }) => {
      deletes.push(String(params.userId))
      return new HttpResponse(null, { status: 204 })
    })
  )
})

afterEach(() => {
  Cookies.remove('loggedIn')
  Cookies.remove('claims')
})

function applyUpdate(update: UserDTO) {
  users = users.map((user) =>
    user.userId === update.userId
      ? {
          ...user,
          ...update,
          fullName: `${update.firstName} ${update.lastName}`,
          areas: areas.filter((area) => update.areaIds?.includes(area.id)),
          regions: regions.filter((region) =>
            update.regionIds?.includes(region.id)
          ),
          jurisdictions: jurisdictions.filter((jurisdiction) =>
            update.jurisdictionIds?.includes(jurisdiction.id)
          ),
        }
      : user
  )
}

async function openEditor() {
  const row = await screen.findByRole('row', { name: /Jane Doe/ })
  await userEvent.click(within(row).getByRole('button', { name: 'more' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
  return screen.findByRole('dialog')
}

// CustomSelect currently does not associate its labels with the comboboxes.
// Select by the existing form order while exercising the actual MUI controls.
async function selectAssignment(index: number, option: string) {
  await userEvent.click(screen.getAllByRole('combobox')[index])
  await userEvent.click(await screen.findByRole('option', { name: option }))
  await userEvent.keyboard('{Escape}')
}

it('sends generated user fields with numeric assignments and refreshes the displayed user after saving', async () => {
  renderWithProviders(<UsersAdmin />)
  const dialog = await openEditor()
  await userEvent.clear(within(dialog).getByLabelText('First Name'))
  await userEvent.type(within(dialog).getByLabelText('First Name'), 'Janet')
  await selectAssignment(0, 'Report Admin')
  await selectAssignment(1, 'Northern Region')
  await selectAssignment(2, 'Example City')
  await selectAssignment(3, 'North Valley')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  const updatedRow = await screen.findByRole('row', { name: /Janet Doe/ })
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  expect(requests).toEqual([
    {
      userId: 'user-123',
      firstName: 'Janet',
      lastName: 'Doe',
      agency: 'UDOT',
      email: 'jane@example.com',
      userName: 'jane.doe',
      roles: ['ReportAdmin'],
      areaIds: [31],
      regionIds: [11],
      jurisdictionIds: [21],
    },
  ])
  expect(reads).toBeGreaterThan(1)
  expect(within(updatedRow).getByText('Report Admin')).toBeVisible()
  expect(within(updatedRow).getByText('Northern Region')).toBeVisible()
  expect(within(updatedRow).getByText('Example City')).toBeVisible()
  expect(within(updatedRow).getByText('North Valley')).toBeVisible()
  expect(within(updatedRow).getByText('jane@example.com')).toBeVisible()
})

it('keeps the draft through a pending and rejected save, prevents duplicate writes, and permits retry', async () => {
  let releaseFirstWrite: () => void = () => {
    throw new Error('Deferred request was not initialized')
  }
  const firstWrite = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve
  })
  server.use(
    http.post(`${IDENTITY_API}/Users/update`, async ({ request }) => {
      const update = (await request.json()) as UserDTO
      requests.push(update)
      if (requests.length === 1) {
        await firstWrite
        return HttpResponse.json(
          { detail: 'Temporary failure' },
          { status: 503 }
        )
      }
      applyUpdate(update)
      return new HttpResponse(null, { status: 204 })
    })
  )
  const consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined)
  try {
    renderWithProviders(<UsersAdmin />)
    const dialog = await openEditor()
    const firstName = within(dialog).getByLabelText('First Name')
    await userEvent.clear(firstName)
    await userEvent.type(firstName, 'Janet')
    const save = within(dialog).getByRole('button', { name: 'Save' })
    await userEvent.click(save)
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(save).toBeDisabled()
    expect(dialog).toBeVisible()
    expect(firstName).toHaveValue('Janet')
    fireEvent.click(save)
    expect(requests).toHaveLength(1)
    releaseFirstWrite()

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      )
    )
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(firstName).toHaveValue('Janet')
    await waitFor(() => expect(save).toBeEnabled())
    expect(reads).toBe(1)
    await userEvent.click(save)

    await screen.findByRole('row', { name: /Janet Doe/ })
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(requests).toHaveLength(2)
    expect(requests[1]).toEqual(requests[0])
    expect(mockNotify).toHaveBeenLastCalledWith({
      title: 'User updated successfully.',
      type: 'success',
    })
  } finally {
    releaseFirstWrite()
    consoleError.mockRestore()
  }
})

it('validates required fields before sending an update', async () => {
  renderWithProviders(<UsersAdmin />)
  const dialog = await openEditor()
  await userEvent.clear(within(dialog).getByLabelText('First Name'))
  await userEvent.clear(within(dialog).getByLabelText('Email'))
  await userEvent.type(within(dialog).getByLabelText('Email'), 'invalid-email')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('First name required')).toBeVisible()
  expect(screen.getByText('Please enter a valid email address')).toBeVisible()
  expect(requests).toHaveLength(0)
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('allows a view-only user to read the list without exposing edit or delete actions', async () => {
  Cookies.set('claims', 'User:View')
  renderWithProviders(<UsersAdmin />)
  await screen.findByRole('row', { name: /Jane Doe/ })

  expect(
    screen.queryByRole('columnheader', { name: 'Actions' })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'more' })).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Edit' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('menuitem', { name: 'Delete' })
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(requests).toHaveLength(0)
  expect(deletes).toHaveLength(0)
})
