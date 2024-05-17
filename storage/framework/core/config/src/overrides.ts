import type { StacksConfig } from '@stacksjs/types'
import ai from '~/config/ai'
import analytics from '~/config/analytics'
import api from '~/config/api'
import app from '~/config/app'
import cache from '~/config/cache'
import cli from '~/config/cli'
import cloud from '~/config/cloud'
import database from '~/config/database'
import dns from '~/config/dns'
import docs from '~/config/docs'
import email from '~/config/email'
import errors from '~/config/errors'
import git from '~/config/git'
import hashing from '~/config/hashing'
import library from '~/config/library'
import logger from '~/config/logger'
import notification from '~/config/notification'
import payment from '~/config/payment'
import ports from '~/config/ports'
import queue from '~/config/queue'
import searchEngine from '~/config/search-engine'
import security from '~/config/security'
import services from '~/config/services'
import storage from '~/config/storage'
import team from '~/config/team'
import ui from '~/config/ui'

// this "user config" will override the default config options
export default {
  ai,
  analytics,
  api,
  app,
  cache,
  cli,
  cloud,
  database,
  dns,
  docs,
  email,
  errors,
  git,
  hashing,
  library,
  logger,
  notification,
  queue,
  payment,
  ports,
  searchEngine,
  security,
  services,
  storage,
  team,
  ui,
} satisfies StacksConfig
