// #region license
// Copyright 2026 Utah Departement of Transportation
// for WebUI - menuUtils.ts
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
import { MenuItem } from '@/api/config'

// The backend returns a flat list (each item references its parent via
// parentId); this builds the nested tree the topbar renders from it. Not a
// DTO mirror, so it isn't replaced by the generated MenuItem type - it adds
// the client-only `children` field on top of it.
export interface MenuItemNode extends MenuItem {
  id: number
  name: string
  children: MenuItemNode[]
}

export const transformMenuItems = (
  menuItemsData: MenuItem[]
): MenuItemNode[] => {
  if (!menuItemsData) {
    return []
  }

  const items = menuItemsData.filter(
    (item): item is MenuItem & { id: number; name: string } =>
      item.id != null && item.name != null
  )

  const menuItemsMap: { [id: number]: MenuItemNode } = {}

  items.forEach((item) => {
    menuItemsMap[item.id] = {
      ...item,
      id: item.id,
      name: item.name,
      icon: item.icon ? item.icon : null,
      children: [],
    }
  })

  items.forEach((item) => {
    if (item.parentId) {
      menuItemsMap[item.parentId]?.children.push(menuItemsMap[item.id])
    }
  })

  return items
    .filter((item) => item.parentId === null)
    .map((item) => menuItemsMap[item.id])
}
