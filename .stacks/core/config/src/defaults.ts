import type { ResolvedStacksOptions } from 'stacks/types'
import app from '../../../../config/app'
import cache from '../../../../config/cache'
import cdn from '../../../../config/cdn'
import cli from '../../../../config/cli'
import database from '../../../../config/database'
import dependencies from '../../../../config/deps'
import dns from '../../../../config/dns'
import docs from '../../../../config/docs'
import email from '../../../../config/email'
import git from '../../../../config/git'
import hashing from '../../../../config/hashing'
import library from '../../../../config/library'
import payment from '../../../../config/payment'
import notification from '../../../../config/notification'
import storage from '../../../../config/storage'
import searchEngine from '../../../../config/search-engine'
import services from '../../../../config/services'
import ui from '../../../../config/ui'

export const defaults: ResolvedStacksOptions = {
  app,
  cache,
  cdn,
  cli,
  database,
  dependencies,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  notification,
  payment,
  searchEngine,
  services,
  storage,
  ui,
}

export {
  app,
  cache,
  cdn,
  cli,
  database,
  dependencies,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  notification,
  payment,
  searchEngine,
  services,
  storage,
  ui,
}
