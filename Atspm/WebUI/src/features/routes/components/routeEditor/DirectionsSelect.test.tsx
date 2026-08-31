// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - DirectionsSelect.test.tsx
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
import { approachNorthbound, routeLocation1001 } from '@/test/fixtures/config'
import { server } from '@/test/msw/server'
import { renderWithProviders, screen, userEvent } from '@/test/test-utils'
import { HttpResponse, http } from 'msw'
import DirectionSelect from './DirectionsSelect'

describe('DirectionSelect', () => {
  // The Approach entity set, filtered to the link's location and expanded
  // with each direction - the recorded shape of that call.
  beforeEach(() => {
    server.use(
      http.get(`${CONFIG_API}/Approach`, () =>
        HttpResponse.json(odataCollection('Approach', [approachNorthbound]))
      )
    )
  })

  // Regression test: option values were built from the approach's direction
  // name ("NB", as the config API sends it) but parsed back with Number(), so
  // a choice never matched an approach and onUpdate never fired.
  it('applies the chosen approach to the link with the numeric direction id', async () => {
    const onUpdate = jest.fn()
    renderWithProviders(
      <DirectionSelect
        hasErrors={false}
        link={routeLocation1001}
        onUpdate={onUpdate}
        updateType="opposing"
      />
    )

    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(
      await screen.findByRole('option', { name: /Northbound/ })
    )

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        opposingDirectionId: 1,
        opposingDirectionDescription: 'Northbound',
        opposingPhase: 2,
        isOpposingOverlap: false,
      })
    )
  })

  it('labels each option with the direction the API expanded for it', async () => {
    renderWithProviders(
      <DirectionSelect
        hasErrors={false}
        link={routeLocation1001}
        onUpdate={jest.fn()}
        updateType="primary"
      />
    )

    await userEvent.click(screen.getByRole('combobox'))

    expect(
      await screen.findByRole('option', { name: /Northbound/ })
    ).toBeInTheDocument()
  })
})
