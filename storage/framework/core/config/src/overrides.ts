/**
 * **Overrides**
 *
 * This file is what takes prepares the user config to be merged with
 * the default config. For anyone that uses this, ensure you define
 * the alias `~config/` in your tsconfig.json file.
 */

import type { StacksConfig } from '@stacksjs/types'
import ai from '~/config/ai'
import analytics from '~/config/analytics'
import app from '~/config/app'
import cache from '~/config/cache'
import cli from '~/config/cli'
import cloud from '~/config/cloud'
import database from '~/config/database'
import dns from '~/config/dns'
import email from '~/config/email'
import errors from '~/config/errors'
import git from '~/config/git'
import hashing from '~/config/hashing'
import library from '~/config/library'
import logging from '~/config/logging'
import notification from '~/config/notification'
import payment from '~/config/payment'
import ports from '~/config/ports'
import queue from '~/config/queue'
import realtime from '~/config/realtime'
import saas from '~/config/saas'
import searchEngine from '~/config/search-engine'
import security from '~/config/security'
import services from '~/config/services'
import storage from '~/config/storage'
import team from '~/config/team'
import ui from '~/config/ui'
// import docs from '~/docs/config'

export const overrides: StacksConfig = {
  ai,
  analytics,
  app,
  cache,
  cli,
  cloud,
  database,
  dns,
  realtime,
  // docs,
  email,
  errors,
  git,
  hashing,
  library,
  logging,
  notification,
  queue,
  payment,
  ports,
  saas,
  searchEngine,
  security,
  services,
  storage,
  team,
  ui,
}

export default overrides
