import app from '../../../../../config/app'
import cache from '../../../../../config/cache'
import cdn from '../../../../../config/cdn'
import database from '../../../../../config/database'
import debug from '../../../../../config/debug'

// import deploy from '../../../../../config/cloud'
import dns from '../../../../../config/dns'
import email from '../../../../../config/email'
import events from '../../../../../config/events'
import git from '../../../../../config/git'
import hashing from '../../../../../config/hashing'
import library from '../../../../../config/library'
import pages from '../../../../../config/page'
import payment from '../../../../../config/payment'
import notification from '../../../../../config/notification'
import searchEngine from '../../../../../config/search-engine'
import services from '../../../../../config/services'
import storage from '../../../../../config/storage'
import ui from '../../../../../config/ui'

// TODO: Vitepress requires this to be a named export
import * as docs from '../../../../../config/docs'

const conf = {
  app,
  cache,
  cdn,
  database,
  debug,
  // deploy,
  dns,
  docs,
  email,
  events,
  git,
  hashing,
  library,
  pages,
  payment,
  notification,
  searchEngine,
  services,
  storage,
  ui,
}

export { app, cache, cdn, database, debug, dns, docs, email, events, git, hashing, library, pages, payment, notification, searchEngine, services, storage, ui }

type Config = 'app' | 'cache' | 'cdn' | 'database' | 'debug' | 'dns' | 'docs' | 'email' | 'events' | 'git' | 'hashing' | 'library' | 'pages' | 'payment' | 'notification' | 'searchEngine' | 'services' | 'storage' | 'ui'

export function config(key?: Config, fallback?: any) {
  return key ? conf[key] : fallback
}
