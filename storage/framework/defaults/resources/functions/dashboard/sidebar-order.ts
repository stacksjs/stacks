import type { WebSidebarItem, WebSidebarSection } from './sidebar'

/** Personal order contains identifiers only. Labels, access and hierarchy remain team-owned. */
export interface SidebarOrder {
  version: 1
  sections: string[]
  items: Record<string, string[]>
}

export const emptySidebarOrder = (): SidebarOrder => ({ version: 1, sections: [], items: {} })
export const sidebarGroupKey = (section: string, ancestors: string[] = []): string => JSON.stringify([section, ...ancestors])

export function parseSidebarOrder(value: unknown): SidebarOrder {
  const input = value as Partial<SidebarOrder> | null
  if (!input || input.version !== 1 || !Array.isArray(input.sections) || !input.items || typeof input.items !== 'object' || Array.isArray(input.items))
    throw new TypeError('Invalid sidebar order.')
  const ids = (list: unknown, max: number): string[] => {
    if (!Array.isArray(list) || list.length > max || list.some(id => typeof id !== 'string' || !id || id.length > 256) || new Set(list).size !== list.length)
      throw new TypeError('Invalid sidebar order identifiers.')
    return [...list]
  }
  const entries = Object.entries(input.items)
  if (entries.length > 2048) throw new TypeError('Too many sidebar groups.')
  const items: Record<string, string[]> = Object.create(null)
  for (const [key, list] of entries) {
    if (key.length > 4096) throw new TypeError('Invalid sidebar group.')
    let path: unknown
    try { path = JSON.parse(key) }
    catch { throw new TypeError('Invalid sidebar group.') }
    ids(path, 32)
    if (!(path as string[]).length) throw new TypeError('Invalid sidebar group.')
    items[key] = ids(list, 2048)
  }
  if (JSON.stringify(input).length > 256 * 1024) throw new TypeError('Sidebar order is too large.')
  return { version: 1, sections: ids(input.sections, 128), items }
}

function ordered<T extends { id: string }>(defaults: T[], ids: string[] = []): T[] {
  const byId = new Map(defaults.map(item => [item.id, item]))
  const result: T[] = []
  for (const id of ids) {
    const item = byId.get(id)
    if (item) { result.push(item); byId.delete(id) }
  }
  return [...result, ...defaults.filter(item => byId.has(item.id))]
}

/** Missing/deleted identifiers cannot resurrect a row; new team rows append in team order. */
export function orderSidebarSections(sections: WebSidebarSection[], order: SidebarOrder): WebSidebarSection[] {
  const visit = (items: WebSidebarItem[], section: string, ancestors: string[] = []): WebSidebarItem[] =>
    ordered(items, order.items[sidebarGroupKey(section, ancestors)]).map(item => ({
      ...item,
      ...(item.children && { children: visit(item.children, section, [...ancestors, item.id]) }),
    }))
  return ordered(sections, order.sections).map(section => ({ ...section, items: visit(section.items, section.id) }))
}
