import { useGetProfileProfile } from '@/api/identity'
import type { ProfileData } from '@/features/identity/types/profile'
import ProfilePage from '@/pages/user/profile'
import { IDENTITY_API } from '@/test/fixtures/api'
import { server } from '@/test/msw/server'
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/test/test-utils'
import { http, HttpResponse } from 'msw'

const mockNotify = jest.fn()
jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: mockNotify }),
}))

function ProfileConsumer() {
  const { data } = useGetProfileProfile<ProfileData>()
  return <output aria-label="Account name">{data?.firstName}</output>
}

it('preserves rejected profile edits and refreshes shared profile data after retry', async () => {
  let profile: ProfileData = {
    firstName: 'Jane',
    lastName: 'Doe',
    agency: 'UDOT',
    email: 'jane@example.com',
    phoneNumber: '',
    roles: 'Admin',
  }
  let writes = 0
  server.use(
    http.get(`${IDENTITY_API}/Profile`, () => HttpResponse.json(profile)),
    http.put(`${IDENTITY_API}/Profile`, async ({ request }) => {
      if (++writes === 1) {
        return HttpResponse.json(
          { detail: 'Temporarily unavailable' },
          { status: 503 }
        )
      }
      profile = {
        ...profile,
        ...((await request.json()) as Partial<ProfileData>),
      }
      return new HttpResponse(null, { status: 204 })
    })
  )
  const user = userEvent.setup()
  renderWithProviders(
    <>
      <ProfilePage />
      <ProfileConsumer />
    </>
  )
  await waitFor(() =>
    expect(screen.getByLabelText('First Name')).toHaveValue('Jane')
  )
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.clear(screen.getByLabelText('First Name'))
  await user.type(screen.getByLabelText('First Name'), 'Janet')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Temporarily unavailable',
      })
    )
  )
  expect(screen.getByLabelText('First Name')).toHaveValue('Janet')
  expect(screen.getByLabelText('First Name')).toBeEnabled()
  expect(screen.getByLabelText('Account name')).toHaveTextContent('Jane')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.getByLabelText('Account name')).toHaveTextContent('Janet')
  )
  expect(await screen.findByRole('button', { name: 'Edit' })).toBeEnabled()
  expect(writes).toBe(2)
  expect(mockNotify).toHaveBeenLastCalledWith({
    type: 'success',
    title: 'Profile updated',
  })
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  await user.clear(screen.getByLabelText('First Name'))
  await user.type(screen.getByLabelText('First Name'), 'Unsaved')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByLabelText('First Name')).toHaveValue('Janet')
})
