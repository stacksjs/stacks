import { asRows } from '@stacksjs/database'
import { getDb } from '../database'

export interface MenuTreeItem {
  id: number
  label: string
  href: string
  target: '_self' | '_blank'
  visibility: 'public' | 'auth'
  children: MenuTreeItem[]
}

interface MenuItemRow {
  id: number
  label: string
  url: string | null
  target: string | null
  parent_id: number | null
  position: number | null
  visibility: string | null
  page_path: string | null
  page_status: string | null
}

/**
 * The nested items of a site's menu by handle (`main`, `footer`, ...).
 * Page-linked items resolve to the page's current path - so a slug change
 * updates navigation for free - and drop out while the page is unpublished.
 */
export async function fetchMenuTree(siteId: number, handle: string): Promise<MenuTreeItem[]> {
  const db = await getDb()

  const menu = await db
    .selectFrom('menus')
    .where('site_id', '=', siteId)
    .where('handle', '=', handle)
    .select(['id'])
    .executeTakeFirst() as { id: number } | undefined

  if (!menu)
    return []

  const rows = asRows<MenuItemRow>(await db
    .selectFrom('menu_items')
    .leftJoin('pages', 'pages.id', '=', 'menu_items.page_id')
    .where('menu_items.menu_id', '=', menu.id)
    .select([
      'menu_items.id as id',
      'menu_items.label as label',
      'menu_items.url as url',
      'menu_items.target as target',
      'menu_items.parent_id as parent_id',
      'menu_items.position as position',
      'menu_items.visibility as visibility',
      'pages.path as page_path',
      'pages.status as page_status',
    ])
    .orderBy('menu_items.position', 'asc')
    .execute())

  const toItem = (row: MenuItemRow): MenuTreeItem | null => {
    const href = row.url ?? (row.page_status === 'published' ? row.page_path : null)
    if (!href)
      return null

    return {
      id: row.id,
      label: row.label,
      href,
      target: row.target === '_blank' ? '_blank' : '_self',
      visibility: row.visibility === 'auth' ? 'auth' : 'public',
      children: [],
    }
  }

  const byId = new Map<number, MenuTreeItem>()
  const roots: MenuTreeItem[] = []

  for (const row of rows) {
    const item = toItem(row)
    if (item)
      byId.set(row.id, item)
  }

  for (const row of rows) {
    const item = byId.get(row.id)
    if (!item)
      continue

    const parent = row.parent_id ? byId.get(row.parent_id) : undefined
    if (parent)
      parent.children.push(item)
    else
      roots.push(item)
  }

  return roots
}
