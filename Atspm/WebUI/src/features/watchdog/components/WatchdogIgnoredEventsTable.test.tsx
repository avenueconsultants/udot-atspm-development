// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - WatchdogIgnoredEventsTable.test.tsx
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
import WatchdogIgnoredEventsTable from './WatchdogIgnoredEventsTable'

jest.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({ addNotification: jest.fn() }),
}))

describe('WatchdogIgnoredEventsTable', () => {
  // Regression test: the labels used to be looked up by integer while the
  // config API sends member names, so every row fell through to the raw name.
  it('shows the ignored events with their issue and component labelled', async () => {
    server.use(
      http.get(`${CONFIG_API}/WatchDogIgnoreEvent`, () =>
        HttpResponse.json(
          odataCollection('WatchDogIgnoreEvent', watchDogIgnoreEvents)
        )
      )
    )

    renderWithProviders(
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <WatchdogIgnoredEventsTable />
      </LocalizationProvider>
    )

    expect(await screen.findByText('Record Count')).toBeInTheDocument()
    expect(screen.getByText('Location (1)')).toBeInTheDocument()
    expect(screen.getByText('1001')).toBeInTheDocument()
  })
})
