import type { LogsmithConfig, LogsmithOptions } from '@stacksjs/logsmith'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadLogsmithConfig } from '@stacksjs/logsmith'

export async function loadChangelogConfig(dir: string, overrides: LogsmithOptions): Promise<LogsmithConfig> {
  const file = resolve(dir, 'config/changelog.ts')
  const project: LogsmithOptions = existsSync(file) ? (await import(file)).default : {}

  // Keep Logsmith's config discovery for existing apps. Stacks project settings
  // take precedence over those defaults, and command options take precedence over both.
  const definedOverrides = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined))
  return loadLogsmithConfig({ ...project, ...definedOverrides, dir })
}
