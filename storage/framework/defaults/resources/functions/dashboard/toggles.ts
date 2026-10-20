import { existsSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export interface DashboardDataRowToggles {
  dashboard: boolean
  activity: boolean
  users: boolean
  teams: boolean
  subscribers: boolean
  allModels: boolean
}

/**
 * One row of an application-defined sidebar section.
 *
 * `icon` is either a full iconify class (`i-hugeicons-calendar-03`), which is
 * passed through as written, or one of the framework's own short sidebar icon
 * names (`calendar`, `bell`, `chart`), which resolves through its icon map.
 * The first form is what an app wants: it is the same spelling every template
 * in the project already uses, and it is not limited to the set the framework
 * happens to have named.
 */
export interface DashboardNavItem {
  label: string
  href: string
  icon?: string
  /** Role gate, matching the per-model `dashboard.roles` metadata. */
  roles?: string[]
}

export interface DashboardNavSection {
  title: string
  items: DashboardNavItem[]
}

export interface ResolvedDashboardToggles {
  library: boolean
  content: boolean
  commerce: boolean
  marketing: boolean
  analytics: boolean
  management: boolean
  utilities: boolean
  ci: boolean
  data: DashboardDataRowToggles
}

/**
 * Dashboard sections that mirror an installable feature.
 *
 * A section whose feature is off used to stay in the sidebar anyway, and every
 * page under it failed: the models those pages query are never loaded, so the
 * first call came back `Manufacturer.orderByDesc is not a function` and the
 * endpoint 503'd. Switching commerce off took two edits in two files -
 * `config/commerce.ts` and `config/dashboard.ts` - and missing the second left
 * a Commerce section that could not load. See stacksjs/stacks#2928.
 *
 * `library`, `analytics`, `management` and `utilities` are deliberately absent:
 * they have no feature of their own, so they stay on.
 */
const FEATURE_BACKED_SECTIONS = {
  commerce: 'commerce',
  content: 'cms',
  marketing: 'marketing',
} as const

/**
 * Reads whether a feature is on. Supplied by the caller rather than imported,
 * because this module is loaded on the dashboard's synchronous path and stays
 * free of `@stacksjs/*` imports - its sibling `sidebar.ts` says why.
 *
 * Omitted, every section defaults on exactly as it did before.
 */
export type FeatureResolver = (name: string) => boolean

function sectionFallback(section: keyof typeof FEATURE_BACKED_SECTIONS, isFeatureEnabled?: FeatureResolver): boolean {
  if (!isFeatureEnabled)
    return true
  return isFeatureEnabled(FEATURE_BACKED_SECTIONS[section])
}

export function defaultDashboardToggles(isFeatureEnabled?: FeatureResolver): ResolvedDashboardToggles {
  return {
    library: true,
    content: sectionFallback('content', isFeatureEnabled),
    commerce: sectionFallback('commerce', isFeatureEnabled),
    marketing: sectionFallback('marketing', isFeatureEnabled),
    analytics: true,
    management: true,
    utilities: true,
    ci: false,
    data: {
      dashboard: true,
      activity: true,
      users: true,
      teams: true,
      subscribers: true,
      allModels: true,
    },
  }
}

export function resolveDashboardToggles(value: unknown, isFeatureEnabled?: FeatureResolver): ResolvedDashboardToggles {
  const config = objectValue(value, 'dashboard config')
  const sections = config.sections === undefined
    ? {}
    : objectValue(config.sections, 'dashboard config sections')
  const data = sections.data === undefined
    ? {}
    : objectValue(sections.data, 'dashboard config sections.data')

  return {
    library: sectionEnabled(sections.library, 'library', true),
    // An explicit `enabled` in config/dashboard.ts still wins, both ways: an
    // app can show a section whose feature is off, or hide one that is on.
    content: sectionEnabled(sections.content, 'content', sectionFallback('content', isFeatureEnabled)),
    commerce: sectionEnabled(sections.commerce, 'commerce', sectionFallback('commerce', isFeatureEnabled)),
    marketing: sectionEnabled(sections.marketing, 'marketing', sectionFallback('marketing', isFeatureEnabled)),
    analytics: sectionEnabled(sections.analytics, 'analytics', true),
    management: sectionEnabled(sections.management, 'management', true),
    utilities: sectionEnabled(sections.utilities, 'utilities', true),
    ci: sectionEnabled(config.ci, 'ci', false),
    data: {
      dashboard: sectionEnabled(data.dashboard, 'data.dashboard', true),
      activity: sectionEnabled(data.activity, 'data.activity', true),
      users: sectionEnabled(data.users, 'data.users', true),
      teams: sectionEnabled(data.teams, 'data.teams', true),
      subscribers: sectionEnabled(data.subscribers, 'data.subscribers', true),
      allModels: sectionEnabled(data.allModels, 'data.allModels', true),
    },
  }
}

export async function loadDashboardToggles(configPath: string): Promise<ResolvedDashboardToggles> {
  return (await loadDashboardConfig(configPath)).toggles
}

/**
 * Application-defined sidebar sections from `config/dashboard.ts:nav`.
 *
 * The framework's own sections are a fixed list, so before this an app that
 * added dashboard pages under `resources/views/dashboard/` had pages the
 * sidebar could not reach - the pages worked, but only if you typed the URL.
 * Declaring them in config keeps the sidebar in one place and out of the
 * framework's own registry, which an app cannot edit without vendoring it.
 */
export function resolveDashboardNav(value: unknown): DashboardNavSection[] {
  if (!value || typeof value !== 'object')
    return []

  const config = value as Record<string, unknown>
  if (config.nav === undefined)
    return []

  if (!Array.isArray(config.nav))
    throw new TypeError('dashboard config nav must be an array of sections')

  return config.nav.map((entry, index) => {
    const section = objectValue(entry, `dashboard config nav[${index}]`)
    if (typeof section.title !== 'string' || !section.title)
      throw new TypeError(`dashboard config nav[${index}].title must be a non-empty string`)
    if (!Array.isArray(section.items))
      throw new TypeError(`dashboard config nav[${index}].items must be an array`)

    return {
      title: section.title,
      items: section.items.map((value, itemIndex) => {
        const label = `dashboard config nav[${index}].items[${itemIndex}]`
        const item = objectValue(value, label)
        if (typeof item.label !== 'string' || !item.label)
          throw new TypeError(`${label}.label must be a non-empty string`)
        if (typeof item.href !== 'string' || !item.href)
          throw new TypeError(`${label}.href must be a non-empty string`)

        return {
          label: item.label,
          href: item.href,
          icon: typeof item.icon === 'string' ? item.icon : undefined,
          roles: Array.isArray(item.roles) ? item.roles.map(String) : undefined,
        }
      }),
    }
  })
}

export interface LoadedDashboardConfig {
  toggles: ResolvedDashboardToggles
  nav: DashboardNavSection[]
}

/**
 * Read `config/dashboard.ts` once and return everything the sidebar needs.
 * One import rather than two: the config module is cache-busted on mtime, so a
 * second load of the same file would be a second evaluation of user code.
 */
export async function loadDashboardConfig(configPath: string, isFeatureEnabled?: FeatureResolver): Promise<LoadedDashboardConfig> {
  if (!existsSync(configPath))
    return { toggles: defaultDashboardToggles(isFeatureEnabled), nav: [] }

  try {
    const moduleUrl = pathToFileURL(configPath)
    moduleUrl.searchParams.set('dashboard-config-mtime', String(statSync(configPath).mtimeMs))
    const configModule = await import(moduleUrl.href) as { default?: unknown }
    return {
      toggles: resolveDashboardToggles(configModule.default, isFeatureEnabled),
      nav: resolveDashboardNav(configModule.default),
    }
  }
  catch (error) {
    throw new Error(`Could not load config/dashboard.ts: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function sectionEnabled(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined)
    return fallback

  const section = objectValue(value, `dashboard config ${label}`)
  if (section.enabled === undefined)
    return fallback
  if (typeof section.enabled !== 'boolean')
    throw new TypeError(`dashboard config ${label}.enabled must be a boolean`)
  return section.enabled
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError(`${label} must be an object`)
  return value as Record<string, unknown>
}
