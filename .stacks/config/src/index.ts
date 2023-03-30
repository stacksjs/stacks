import { type CliOptions } from '@stacksjs/types'
import app from '../../../config/app.ts'
import cache from '../../../config/cache'
import database from '../../../config/database'
import debug from '../../../config/debug'
import deploy from '../../../config/deploy'
import dns from '../../../config/dns'
import events from '../../../config/events'
import git from '../../../config/git'
import hashing from '../../../config/hashing'
import library from '../../../config/library'
import page from '../../../config/page'
import payments from '../../../config/payment'
import notification from '../../../config/notification'
import searchEngine from '../../../config/search-engine'
import services from '../../../config/services'
import storage from '../../../config/storage'
import ui from '../../../config/ui'

// TODO: Vitepress requires this to be a named export
import * as docs from '../../../config/docs'

const c = {
  app,
  cache,
  database,
  debug,
  deploy,
  dns,
  docs,
  events,
  git,
  hashing,
  library,
  page,
  payments,
  notification,
  searchEngine,
  services,
  storage,
  ui,
}

type Config = 'app' | 'cache' | 'database' | 'debug' | 'deploy' | 'docs' | 'git' | 'hashing' | 'library' | 'notification' | 'searchEngine' | 'services' | 'storage' | 'ui'

/**
 * Determines the level of debugging.
 * @param options
 */
export function determineDebugMode(options?: CliOptions) {
  if (options?.verbose === true)
    return true

  if (app.debug === true)
    return true

  return false
}

export function config(key?: Config, fallback?: any) {
  return key ? c[key] : fallback
}

export function env(key: string, fallback: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}
