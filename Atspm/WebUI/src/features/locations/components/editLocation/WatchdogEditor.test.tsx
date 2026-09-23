// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - WatchdogEditor.test.tsx
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//http://www.apache.org/licenses/LICENSE-2.
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// #endregion
import { CONFIG_API, odataCollection } from '@/test/fixtures/api'
import { watchDogIgnoreEvents } from '@/test/fixtures/config'
import { server } from '@/test/msw/server'
import { renderWithProviders, screen } from '@/test/test-utils'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { HttpResponse, http } from 'msw'
import WatchdogEditor from './WatchdogEditor'

jest.mock('@/features/locations/components/editLocation/locationStore', () => ({
  useLocationStore: () => ({
    location: { id: 1, locationIdentifier: '1001' },
  }),
}))

jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: jest.fn() }),
}))

const renderEditor = () =>
  renderWithProviders(
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <WatchdogEditor hasEditPermission />
    </LocalizationProvider>
  )

// Regression test: the editor used to compare the API's issue types against
// a local integer map. The config API sends member names ("RecordCount"), so
// nothing ever matched and every issue showed as active.
describe('WatchdogEditor', () => {
  it('shows an ignored issue as inactive for the window the API returns', async () => {
    server.use(
      http.get(`${CONFIG_API}/WatchDogIgnoreEvent`, () =>
        HttpResponse.json(
          odataCollection('WatchDogIgnoreEvent', watchDogIgnoreEvents)
        )
      )
    )

    renderEditor()

    expect(
      await screen.findByRole('button', {
        name: 'Inactive from 03/01/2026 to 03/31/2026',
      })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'active' })).toHaveLength(6)
  })

  it('shows every issue as active when nothing is ignored', async () => {
    server.use(
      http.get(`${CONFIG_API}/WatchDogIgnoreEvent`, () =>
        HttpResponse.json(odataCollection('WatchDogIgnoreEvent', []))
      )
    )

    renderEditor()

    expect(
      await screen.findAllByRole('button', { name: 'active' })
    ).toHaveLength(7)
  })
})
