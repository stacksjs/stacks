import type { DashboardProviderOptions } from '@stacksjs/types'
import type { ResolvedDashboardToggles } from './toggles'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { resolveDashboardToggles } from './toggles'

interface DashboardPageAvailability {
  sections?: ResolvedDashboardToggles
  schemaModels?: readonly string[]
  inbox?: boolean
  remote?: boolean
  providers?: DashboardProviderOptions
}

interface DashboardPageExclusion {
  path: string
  exact?: boolean
}

const modelRequirements = {
  '/data/activity': ['Activity'],
  '/data/teams': ['Team'],
  '/data/subscribers': ['Subscriber'],
  '/teams': ['Team'],
  '/releases': ['Release'],
  '/deployments': ['Deployment'],
  '/requests': ['Request'],
  '/queries': ['QueryLog'],
  '/analytics/events': ['AnalyticsEvent'],
  '/analytics/marketing': ['Campaign'],
  '/notifications': ['Notification'],
  '/settings/billing': ['PaymentTransaction'],
  '/management/permissions': ['Role', 'Permission'],
  '/kanban': ['Board', 'Card', 'Column'],
  '/inbox/settings': ['MailPreference'],
}

const webAnalyticsPages = ['web', 'pages', 'referrers', 'countries', 'devices', 'browsers', 'blog', 'commerce/web']

const sectionPages = {
  library: ['/library', '/functions', '/packages', '/releases', '/dependencies'],
  content: ['/content'],
  commerce: ['/commerce', '/analytics/commerce', '/marketing/abandoned-carts', '/marketing/reviews'],
  marketing: ['/marketing'],
  analytics: ['/analytics'],
  management: ['/management', '/cloud', '/servers', '/remote', '/serverless', '/dns', '/mailboxes', '/logs', '/health', '/insights', '/kanban'],
  // Settings is also opened by the native application menu and the browser account menu.
  utilities: ['/buddy', '/environment', '/access-tokens'],
  ci: ['/ci'],
} as const satisfies Partial<Record<keyof ResolvedDashboardToggles, readonly string[]>>

const dataPages = {
  dashboard: '/data/dashboard',
  activity: '/data/activity',
  users: '/data/users',
  teams: '/data/teams',
  subscribers: '/data/subscribers',
  allModels: '/models',
} as const satisfies Record<keyof ResolvedDashboardToggles['data'], string>

export function unavailableDashboardPages({ sections, schemaModels, inbox, remote, providers }: DashboardPageAvailability): DashboardPageExclusion[] {
  const unavailable = new Map<string, DashboardPageExclusion>()
  function exclude(path: string, exact = false): void {
    if (!exact || !unavailable.has(path))
      unavailable.set(path, { path, exact })
  }

  if (sections) {
    for (const [section, paths] of Object.entries(sectionPages)) {
      if (!sections[section as keyof typeof sectionPages]) {
        for (const path of paths)
          exclude(path)
      }
    }
    for (const [row, path] of Object.entries(dataPages)) {
      if (!sections.data[row as keyof typeof dataPages])
        exclude(path, row === 'allModels')
    }
  }

  if (schemaModels) {
    const models = new Set(schemaModels)
    for (const [path, required] of Object.entries(modelRequirements)) {
      if (!required.every(model => models.has(model)))
        exclude(path)
    }
    if (!models.has('Error') && providers?.errors?.driver !== 'hq')
      exclude('/errors')
    if (!models.has('Log') && providers?.logs?.driver !== 'hq')
      exclude('/logs')

    if (!models.has('Request') && providers?.analytics?.driver !== 'hq') {
      exclude('/analytics', true)
      for (const page of webAnalyticsPages)
        exclude(`/analytics/${page}`)
    }
  }

  if (inbox === false) {
    exclude('/inbox', true)
    exclude('/inbox/activity')
  }

  if (remote === false)
    exclude('/remote')

  return [...unavailable.values()]
}

export function dashboardPageAvailable(path: string, unavailable: readonly DashboardPageExclusion[]): boolean {
  const pathname = path.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'
  return !unavailable.some(page => pathname === page.path || (!page.exact && pathname.startsWith(`${page.path}/`)))
}

/** Exclude only framework files, preserving app-owned pages at the same URLs. */
export function dashboardViewExclusions(root: string, availability: DashboardPageAvailability): string[] {
  return unavailableDashboardPages(availability).flatMap(({ path, exact }) => {
    const view = join(root, path.slice(1))
    return [`${view}.stx`, exact ? join(view, 'index.stx') : view]
  })
}

/** Both dashboard hosts and the STX server scripts read the settled app configuration. */
export function readDashboardPageAvailability(): Required<DashboardPageAvailability> {
  const require = createRequire(import.meta.url)
  const { config, feature } = require('@stacksjs/config') as typeof import('@stacksjs/config')
  const { listModelSources } = require('@stacksjs/database/model-sources') as typeof import('@stacksjs/database/model-sources')
  const { projectPath } = require('@stacksjs/path') as typeof import('@stacksjs/path')
  const remoteConfig = projectPath('config/remote.ts')
  const remote = existsSync(remoteConfig) && Boolean(require(remoteConfig).hosts?.length)
  const mailServer = config.email?.server
  const sections = resolveDashboardToggles(config.dashboard, feature)
  const schemaModels = (listModelSources() ?? []).map(model => model.name)
  return {
    sections: { ...sections, ci: sections.management && sections.ci },
    schemaModels,
    // The live inbox reads the serverless mail store. Captured Mail and the
    // database-backed Mail Settings page are available independently.
    inbox: Boolean(mailServer?.enabled && mailServer.mode === 'serverless'),
    remote,
    providers: config.dashboard?.providers ?? {},
  }
}

export function dashboardPageVisibility(): (path: string) => boolean {
  const unavailable = unavailableDashboardPages(readDashboardPageAvailability())
  return path => dashboardPageAvailable(path, unavailable)
}
