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

export function defaultDashboardToggles(): ResolvedDashboardToggles {
  return {
    library: true,
    content: true,
    commerce: true,
    marketing: true,
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

export function resolveDashboardToggles(value: unknown): ResolvedDashboardToggles {
  const config = objectValue(value, 'dashboard config')
  const sections = config.sections === undefined
    ? {}
    : objectValue(config.sections, 'dashboard config sections')
  const data = sections.data === undefined
    ? {}
    : objectValue(sections.data, 'dashboard config sections.data')

  return {
    library: sectionEnabled(sections.library, 'library', true),
    content: sectionEnabled(sections.content, 'content', true),
    commerce: sectionEnabled(sections.commerce, 'commerce', true),
    marketing: sectionEnabled(sections.marketing, 'marketing', true),
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
  if (!existsSync(configPath))
    return defaultDashboardToggles()

  try {
    const moduleUrl = pathToFileURL(configPath)
    moduleUrl.searchParams.set('dashboard-config-mtime', String(statSync(configPath).mtimeMs))
    const configModule = await import(moduleUrl.href) as { default?: unknown }
    return resolveDashboardToggles(configModule.default)
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
