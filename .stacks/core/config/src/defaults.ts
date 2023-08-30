import type { ResolvedStacksOptions } from '@stacksjs/types'
import app from '~/config/app'
import binary from '~/config/binary'
import cache from '~/config/cache'
import cdn from '~/config/cdn'
import database from '~/config/database'
import dns from '~/config/dns'
import docs from '~/config/docs'
import email from '~/config/email'
import git from '~/config/git'
import hashing from '~/config/hashing'
import library from '~/config/library'
import queue from '~/config/queue'
import payment from '~/config/payment'
import notification from '~/config/notification'
import storage from '~/config/storage'
import searchEngine from '~/config/search-engine'
import security from '~/config/security'
import services from '~/config/services'
import ui from '~/config/ui'

const defaults: ResolvedStacksOptions = {
  app,
  binary,
  cache,
  cdn,
  database,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  notification,
  queue,
  payment,
  searchEngine,
  security,
  services,
  storage,
  ui,
}

export {
  defaults,
  app,
  binary,
  cache,
  cdn,
  database,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  notification,
  queue,
  payment,
  searchEngine,
  security,
  services,
  storage,
  ui,
}
