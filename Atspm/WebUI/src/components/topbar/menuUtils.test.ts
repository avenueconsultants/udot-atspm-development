// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - menuUtils.test.ts
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
import type { MenuItem } from '@/api/config'
import { transformMenuItems } from './menuUtils'

describe('transformMenuItems', () => {
  it('nests children under their parent and keeps root items at the top level', () => {
    const items: MenuItem[] = [
      { id: 1, name: 'Reports', parentId: null },
      { id: 2, name: 'Time Space', parentId: 1 },
      { id: 3, name: 'Turning Movement', parentId: 1 },
      { id: 4, name: 'Admin', parentId: null },
    ]

    const tree = transformMenuItems(items)

    expect(tree.map((item) => item.name)).toEqual(['Reports', 'Admin'])
    expect(tree[0].children.map((child) => child.name)).toEqual([
      'Time Space',
      'Turning Movement',
    ])
    expect(tree[1].children).toEqual([])
  })

  it('supports multiple levels of nesting', () => {
    const items: MenuItem[] = [
      { id: 1, name: 'Root', parentId: null },
      { id: 2, name: 'Child', parentId: 1 },
      { id: 3, name: 'Grandchild', parentId: 2 },
    ]

    const tree = transformMenuItems(items)

    expect(tree[0].children[0].children[0].name).toBe('Grandchild')
  })

  it('drops items missing an id or name', () => {
    const items = [
      { id: 1, name: 'Reports', parentId: null },
      { id: undefined, name: 'No Id', parentId: 1 },
      { id: 2, name: undefined, parentId: 1 },
    ] as unknown as MenuItem[]

    const tree = transformMenuItems(items)

    expect(tree).toEqual([expect.objectContaining({ name: 'Reports' })])
    expect(tree[0].children).toEqual([])
  })

  it('silently drops a child whose parentId does not match any known item', () => {
    const items: MenuItem[] = [
      { id: 1, name: 'Reports', parentId: null },
      { id: 2, name: 'Orphan', parentId: 999 },
    ]

    const tree = transformMenuItems(items)

    // The orphan is neither a root item (parentId isn't null) nor attached
    // to any parent's children, so it disappears from the tree entirely.
    expect(tree).toEqual([expect.objectContaining({ name: 'Reports' })])
  })

  it('defaults a null icon through unchanged and preserves a provided icon', () => {
    const items = [
      { id: 1, name: 'No Icon', parentId: null, icon: null },
      { id: 2, name: 'With Icon', parentId: null, icon: 'star' },
    ] as unknown as MenuItem[]

    const tree = transformMenuItems(items)

    expect(tree[0].icon).toBeNull()
    expect(tree[1].icon).toBe('star')
  })

  it('returns an empty array for null or empty input', () => {
    expect(transformMenuItems(null as unknown as MenuItem[])).toEqual([])
    expect(transformMenuItems([])).toEqual([])
  })
})
