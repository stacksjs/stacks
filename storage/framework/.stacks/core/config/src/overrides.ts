import type { StacksConfig } from '@stacksjs/types'
import api from '../../../../../../config/api'
import app from '../../../../../../config/app'
import cache from '../../../../../../config/cache'
import binary from '../../../../../../config/cli'
import cloud from '../../../../../../config/cloud'
import database from '../../../../../../config/database'
import dns from '../../../../../../config/dns'
import docs from '../../../../../../config/docs'
import email from '../../../../../../config/email'
import git from '../../../../../../config/git'
import hashing from '../../../../../../config/hashing'
import library from '../../../../../../config/library'
import queue from '../../../../../../config/queue'
import payment from '../../../../../../config/payment'
import notification from '../../../../../../config/notification'
import storage from '../../../../../../config/storage'
import searchEngine from '../../../../../../config/search-engine'
import security from '../../../../../../config/security'
import services from '../../../../../../config/services'
import team from '../../../../../../config/team'
import ui from '../../../../../../config/ui'

// this "user config" will override the default config options
export default {
  api,
  app,
  binary,
  cache,
  cloud,
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
  team,
  ui,
} satisfies StacksConfig
