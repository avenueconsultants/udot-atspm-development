import type { Device, DeviceConfiguration, Product } from '@/api/config'
import { CONFIG_API, odataCollection } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { HttpResponse, http } from 'msw'
import DeviceModal from './NewDeviceModal'

const mockAddNotification = jest.fn()
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: mockAddNotification }),
}))

const product = {
  id: 2,
  manufacturer: 'Example',
  model: 'Controller',
} satisfies Product
const configuration = {
  id: 3,
  productId: 2,
  description: 'Default configuration',
  product,
} satisfies DeviceConfiguration
const device = {
  id: 7,
  deviceIdentifier: null,
  loggingEnabled: false,
  ipaddress: null,
  deviceStatus: 'Inactive',
  deviceType: 'SignalController',
  notes: null,
  locationId: 12,
  deviceConfigurationId: 3,
  deviceConfiguration: configuration,
  createdBy: null,
  modifiedBy: null,
} satisfies Device

beforeEach(() => {
  mockAddNotification.mockClear()
  server.use(
    http.get(`${CONFIG_API}/Product`, () =>
      HttpResponse.json(odataCollection('Product', [product]))
    ),
    http.get(`${CONFIG_API}/DeviceConfiguration`, () =>
      HttpResponse.json(odataCollection('DeviceConfiguration', [configuration]))
    )
  )
})

// The existing selects do not associate their InputLabel with the combobox.
// Use their stable form order while exercising the real MUI controls.
async function chooseOption(index: number, option: string) {
  const selects = await screen.findAllByRole('combobox')
  await userEvent.click(selects[index])
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

it('creates a device with generated enum names and flattened property-editor values', async () => {
  const requests: unknown[] = []
  const onClose = jest.fn()
  const refetchDevices = jest.fn()
  server.use(
    http.post(`${CONFIG_API}/Device`, async ({ request }) => {
      requests.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    })
  )

  renderWithProviders(
    <DeviceModal
      locationId={12}
      onClose={onClose}
      refetchDevices={refetchDevices}
    />
  )
  await chooseOption(0, 'Example - Controller')
  await chooseOption(1, 'Default configuration')
  await chooseOption(2, 'SignalController')
  await userEvent.click(
    screen.getByRole('button', { name: '+ Device Property' })
  )
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Key 1' }),
    'timeout'
  )
  await userEvent.type(screen.getByRole('textbox', { name: 'Value 1' }), '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(refetchDevices).toHaveBeenCalledTimes(1)
  expect(requests).toEqual([
    {
      deviceIdentifier: '',
      loggingEnabled: true,
      ipaddress: '',
      deviceStatus: 'Active',
      notes: '',
      deviceType: 'SignalController',
      deviceConfigurationId: 3,
      locationId: 12,
      timeout: '30',
    },
  ])
})

it('preserves OData open properties, nullable defaults, and the draft after an update failure', async () => {
  const requests: unknown[] = []
  const onClose = jest.fn()
  const refetchDevices = jest.fn()
  server.use(
    http.put(`${CONFIG_API}/Device/7`, async ({ request }) => {
      requests.push(await request.json())
      return requests.length === 1
        ? new HttpResponse(null, { status: 500 })
        : new HttpResponse(null, { status: 204 })
    })
  )
  const odataDevice = { ...device, timeout: 30, secure: false }
  renderWithProviders(
    <DeviceModal
      device={odataDevice}
      locationId={12}
      onClose={onClose}
      refetchDevices={refetchDevices}
    />
  )
  await chooseOption(1, 'Default configuration')
  expect(screen.getByRole('textbox', { name: 'Value 1' })).toHaveValue('30')
  expect(screen.getByRole('textbox', { name: 'Value 2' })).toHaveValue('false')
  expect(
    screen.getByRole('checkbox', { name: 'Enable Logging' })
  ).not.toBeChecked()
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Notes' }),
    'Edited note'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(mockAddNotification).toHaveBeenCalledWith({
      title: 'Device Update Failed',
      type: 'error',
    })
  )
  expect(onClose).not.toHaveBeenCalled()
  expect(refetchDevices).not.toHaveBeenCalled()
  expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue(
    'Edited note'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(refetchDevices).toHaveBeenCalledTimes(1)
  expect(requests).toEqual([
    {
      id: 7,
      deviceIdentifier: '',
      loggingEnabled: false,
      ipaddress: '',
      deviceStatus: 'Inactive',
      notes: 'Edited note',
      deviceType: 'SignalController',
      deviceConfigurationId: 3,
      locationId: 12,
      timeout: '30',
      secure: 'false',
    },
    requests[0],
  ])
})

it('accepts existing property-editor rows without treating them as an OData property', async () => {
  const requests: unknown[] = []
  const onClose = jest.fn()
  server.use(
    http.put(`${CONFIG_API}/Device/7`, async ({ request }) => {
      requests.push(await request.json())
      return new HttpResponse(null, { status: 204 })
    })
  )
  const preparedDevice = {
    ...device,
    deviceProperties: [{ key: 'community', value: 'public' }],
  }
  renderWithProviders(
    <DeviceModal
      device={preparedDevice}
      locationId={12}
      onClose={onClose}
      refetchDevices={jest.fn()}
    />
  )
  await chooseOption(1, 'Default configuration')
  expect(screen.getByRole('textbox', { name: 'Key 1' })).toHaveValue(
    'community'
  )
  expect(screen.getByRole('textbox', { name: 'Value 1' })).toHaveValue('public')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(requests[0]).toMatchObject({ id: 7, community: 'public' })
  expect(requests[0]).not.toHaveProperty('deviceProperties')
  expect(requests[0]).not.toHaveProperty('productId')
})
