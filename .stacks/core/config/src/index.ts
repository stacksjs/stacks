import type { AppOptions, CacheOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DeployOptions, DnsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, Model, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'
import app from '../../../../config/app'
import cache from '../../../../config/cache'
import database from '../../../../config/database'
import debug from '../../../../config/debug'
import deploy from '../../../../config/deploy'
import dns from '../../../../config/dns'
import events from '../../../../config/events'
import git from '../../../../config/git'
import hashing from '../../../../config/hashing'
import library from '../../../../config/library'
import page from '../../../../config/page'
import payments from '../../../../config/payment'
import notification from '../../../../config/notification'
import searchEngine from '../../../../config/search-engine'
import services from '../../../../config/services'
import storage from '../../../../config/storage'
import ui from '../../../../config/ui'

// TODO: Vitepress requires this to be a named export
import * as docs from '../../../../config/docs'

type Config = 'app' | 'cache' | 'database' | 'debug' | 'deploy' | 'docs' | 'git' | 'hashing' | 'library' | 'notification' | 'searchEngine' | 'services' | 'storage' | 'ui'

const conf = {
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

export { app, cache, database, debug, deploy, dns, docs, events, git, hashing, library, page, payments, notification, searchEngine, services, storage, ui }

export function config(key?: Config, fallback?: any) {
  return key ? conf[key] : fallback
}

export function env(key: string, fallback: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

export { defineBuildConfig } from 'unbuild'

export function defineAppConfig(options: AppOptions) {
  return options
}

export function defineCacheConfig(options: CacheOptions) {
  return options
}

export function defineCliConfig(options: CliOptions) {
  return options
}

export function defineCronJobsConfig(options: CronJobOptions[]) {
  return options
}

export function defineDatabaseConfig(options: DatabaseOptions) {
  return options
}

export function defineDebugConfig(options: DebugOptions) {
  return options
}

export function defineDeployConfig(options: DeployOptions) {
  return options
}

export function defineDnsConfig(options: DnsOptions) {
  return options
}

export function defineEmailConfig(options: EmailOptions) {
  return options
}

export function defineEventsConfig(options: Events) {
  return options
}

export function defineGitConfig(options: GitOptions) {
  return options
}

export function defineHashingConfig(options: HashingOptions) {
  return options
}

export function defineLibraryConfig(options: LibraryOptions) {
  return options
}

export function defineModel(options: Model) {
  return options
}

export function defineNotificationConfig(options: NotificationOptions) {
  return options
}

export function definePageConfig(options: PagesOption) {
  return options
}

export function definePaymentConfig(options: PaymentOptions) {
  return options
}

export function defineSearchEngineConfig(options: SearchEngineOptions) {
  return options
}

export function defineServicesConfig(options: ServicesOptions) {
  return options
}

export function defineStorageConfig(options: StorageOptions) {
  return options
}

export function defineUiConfig(options: UiOptions) {
  return options
}
