/**
 * **Overrides**
 *
 * This file is what takes prepares the user config to be merged with
 * the default config. For anyone that uses this, ensure you define
 * the alias `~config/` in your tsconfig.json file.
 */

import type { StacksConfig } from '@stacksjs/types'

// PRODUCTION BINARY MODE: Skip runtime config loading
// When SKIP_CONFIG_LOADING is set, return empty config to avoid parsing external TS files
const skipConfigLoading = process.env.SKIP_CONFIG_LOADING === 'true'

let ai, analytics, app, cache, cli, cloud, database, dns, email, errors, git, hashing, library, logging, notification, payment, ports, queue, realtime, saas, searchEngine, security, services, filesystems, team, ui

if (!skipConfigLoading) {
  // Development mode: Load config files normally
  ai = (await import('~/config/ai')).default
  analytics = (await import('~/config/analytics')).default
  app = (await import('~/config/app')).default
  cache = (await import('~/config/cache')).default
  cli = (await import('~/config/cli')).default
  cloud = (await import('~/config/cloud')).default
  database = (await import('~/config/database')).default
  dns = (await import('~/config/dns')).default
  email = (await import('~/config/email')).default
  errors = (await import('~/config/errors')).default
  git = (await import('~/config/git')).default
  hashing = (await import('~/config/hashing')).default
  library = (await import('~/config/library')).default
  logging = (await import('~/config/logging')).default
  notification = (await import('~/config/notification')).default
  payment = (await import('~/config/payment')).default
  ports = (await import('~/config/ports')).default
  queue = (await import('~/config/queue')).default
  realtime = (await import('~/config/realtime')).default
  saas = (await import('~/config/saas')).default
  searchEngine = (await import('~/config/search-engine')).default
  security = (await import('~/config/security')).default
  services = (await import('~/config/services')).default
  filesystems = (await import('~/config/filesystems')).default
  team = (await import('~/config/team')).default
  ui = (await import('~/config/ui')).default
}

export const overrides: StacksConfig = {
  ai: ai || {},
  analytics: analytics || {},
  app: app || { name: process.env.APP_NAME || 'Stacks', env: process.env.APP_ENV || 'production' },
  cache: cache || {},
  cli: cli || {},
  cloud: cloud || {},
  database: database || {},
  dns: dns || {},
  realtime: realtime || {},
  // docs,
  email: email || {},
  errors: errors || {},
  git: git || {},
  hashing: hashing || {},
  library: library || {},
  logging: logging || {},
  notification: notification || {},
  queue: queue || {},
  payment: payment || {},
  ports: ports || {},
  saas: saas || {},
  searchEngine: searchEngine || {},
  security: security || {},
  services: services || {},
  filesystems: filesystems || {},
  team: team || {},
  ui: ui || {},
}

export default overrides
