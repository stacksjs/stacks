import type { WebSidebarItem, WebSidebarSection } from './sidebar'

export interface DashboardNavigationCard {
  id: string
  href: string
  label: string
  icon: string
  description?: string
  section: string
  /** Each option is a path through the navigation tree. Every role group on one path must pass. */
  roleOptions: string[][][]
}

export interface DashboardNavigationHub extends DashboardNavigationCard {
  destinations: DashboardNavigationCard[]
}

const sectionDetails: Record<string, { icon: string, description: string }> = {
  library: { icon: 'i-f7-cube-box', description: 'Components, functions, releases, and packages' },
  content: { icon: 'i-f7-doc-text', description: 'Pages, posts, files, and publishing' },
  app: { icon: 'i-f7-bolt', description: 'Deployments, requests, jobs, and inboxes' },
  data: { icon: 'i-f7-table', description: 'People, activity, and application models' },
  commerce: { icon: 'i-f7-cart', description: 'Orders, customers, products, and payments' },
  delivery: { icon: 'i-f7-car-fill', description: 'Shipping, couriers, and digital delivery' },
  marketing: { icon: 'i-f7-speaker-2', description: 'Campaigns, lists, and social posts' },
  analytics: { icon: 'i-f7-chart-bar', description: 'Traffic, audiences, and events' },
  management: { icon: 'i-f7-rectangle-stack', description: 'Infrastructure, permissions, and system health' },
  utilities: { icon: 'i-f7-gear-alt', description: 'Environment, access tokens, and settings' },
}

export function buildDashboardSectionHubs(sections: readonly WebSidebarSection[]): DashboardNavigationHub[] {
  const hubs: DashboardNavigationHub[] = []
  for (const section of sections) {
    if (!section.label)
      continue

    function destinations(items: readonly WebSidebarItem[], inheritedRoles: string[][] = []): DashboardNavigationCard[] {
      return items.flatMap((item) => {
        const roles = item.roles?.length ? [...inheritedRoles, item.roles] : inheritedRoles
        const children = destinations(item.children ?? [], roles)
        if (!item.href)
          return children
        const { id, href, label, icon } = item
        const description = href.startsWith('/models/') ? 'Model records' : undefined
        return [{ id, href, label, icon, description, section: section.id, roleOptions: [roles] }, ...children]
      })
    }

    const cards = destinations(section.items)
    if (!cards.length)
      continue

    const details = sectionDetails[section.id]
    hubs.push({
      id: section.id,
      href: `/sections/${encodeURIComponent(section.id)}`,
      label: section.label,
      icon: details?.icon ?? 'i-f7-square-grid-2x2',
      description: details?.description,
      section: section.id,
      roleOptions: cards.some(card => canSeeDashboardCard(card, [], false)) ? [[]] : cards.flatMap(card => card.roleOptions),
      destinations: cards,
    })
  }
  return hubs
}

export function canSeeDashboardCard(card: DashboardNavigationCard, roles: readonly string[], localViewer: boolean): boolean {
  return localViewer || card.roleOptions.some(option => option.every(group => group.some(role => roles.includes(role))))
}

export function dashboardNavigationPath(path: string): string {
  return path.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'
}

export function activeDashboardSection(hubs: readonly DashboardNavigationHub[], path: string): string | undefined {
  const current = dashboardNavigationPath(path)
  if (current === '/')
    return 'top'

  let matched: string | undefined
  let longest = 0
  for (const hub of hubs) {
    for (const { href } of [hub, ...hub.destinations]) {
      if (!href.startsWith('/') || href.startsWith('//'))
        continue
      const candidate = dashboardNavigationPath(href)
      if (candidate !== '/' && (current === candidate || current.startsWith(`${candidate}/`)) && candidate.length > longest) {
        matched = hub.id
        longest = candidate.length
      }
    }
  }
  return matched
}
