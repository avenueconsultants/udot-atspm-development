// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - MenuItemModal.test.tsx
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
import { server } from '@/test/msw/server'
import { renderWithProviders, screen, userEvent } from '@/test/test-utils'
import { HttpResponse, http } from 'msw'
import MenuItemModal from './MenuItemModal'

describe('MenuItemModal', () => {
  it('loads menu items from the API and lists top-level items as parent options', async () => {
    server.use(
      http.get('*/MenuItems', () =>
        HttpResponse.json([
          { id: 1, name: 'Reports', parentId: null, displayOrder: 0 },
          { id: 2, name: 'Report Detail', parentId: 1, displayOrder: 0 },
        ])
      )
    )

    renderWithProviders(
      <MenuItemModal isOpen onSave={jest.fn()} onClose={jest.fn()} />
    )

    await userEvent.click(screen.getByRole('combobox', { name: /parent/i }))

    // Top-level items (parentId: null) are valid parent choices.
    expect(
      await screen.findByRole('option', { name: 'Reports' })
    ).toBeInTheDocument()
    // ...items that already have a parent are not.
    expect(
      screen.queryByRole('option', { name: 'Report Detail' })
    ).not.toBeInTheDocument()
  })
})
