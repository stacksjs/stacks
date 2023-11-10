import type { AppConfig, CacheConfig, CdnConfig, ChatConfig, CliConfig, DatabaseConfig, DependenciesConfig, DnsConfig, EmailConfig, Events, GitConfig, HashingConfig, JobConfig, LibraryConfig, Model, NotificationConfig, PaymentConfig, QueueConfig, SearchEngineConfig, SecurityConfig, ServicesConfig, SmsConfig, StacksConfig, StorageConfig, UiConfig } from '@stacksjs/types'
import { config } from './'

export type LocalUrlType = 'frontend' | 'backend' | 'api' | 'admin' | 'library' | 'email' | 'docs' | 'inspect' | 'desktop'

export function localUrl({
  url = config.app.url || 'stacks',
  type = 'frontend' as LocalUrlType,
  localhost = false,
} = {}) {
  switch (type) {
    case 'frontend':
      if (localhost)
        return `http://localhost:${config.app.ports?.frontend}`
      return url.replace(/\.[^\.]+$/, '.localhost');
    case 'backend':
      if (localhost)
        return `http://localhost:${config.app.ports?.backend}`
      return url.replace(/\.[^\.]+$/, '.localhost/api/');
    case 'api':
      if (localhost)
        return `http://localhost:${config.app.ports?.backend}`
      return url.replace(/\.[^\.]+$/, '.localhost/api/');
    case 'admin':
      if (localhost)
        return `http://localhost:${config.app.ports?.admin}`
      return url.replace(/\.[^\.]+$/, '.localhost/admin/');
    case 'library':
      if (localhost)
        return `http://localhost:${config.app.ports?.library}`
      return url.replace(/\.[^\.]+$/, '.localhost/libs/');
    case 'email':
      if (localhost)
        return `http://localhost:${config.app.ports?.email}`
      return url.replace(/\.[^\.]+$/, '.localhost/email-testing/');
    case 'docs':
      if (localhost)
        return `http://localhost:${config.app.ports?.docs}`
      return url.replace(/\.[^\.]+$/, '.localhost/docs/');
    case 'inspect':
      if (localhost)
        return `http://localhost:${config.app.ports?.inspect}`
      return url.replace(/\.[^\.]+$/, '.localhost/__inspect/');
    default:
      if (localhost)
        return `http://localhost:${config.app.ports?.frontend}`
      return url.replace(/\.[^\.]+$/, '.localhost');
  }
}

export function defineStacksConfig(config: StacksConfig) {
  return config
}

export function defineApp(config: AppConfig) {
  return config
}

export function defineCache(config: CacheConfig) {
  return config
}

export function defineCdn(config: CdnConfig) {
  return config
}

export function defineChat(config: ChatConfig) {
  return config
}

export function defineCli(config: CliConfig) {
  return config
}

export function defineJob(config: JobConfig) {
  return config
}

export function defineCronJob(config: JobConfig) {
  return config
}

export function defineDatabase(config: DatabaseConfig) {
  return config
}

export function defineDependencies(config: DependenciesConfig) {
  return config
}

export function defineDns(config: DnsConfig) {
  return config
}

export function defineEmailConfig(config: EmailConfig) {
  return config
}

export function defineEmail(config: EmailConfig) {
  return config
}

export function defineGit(config: GitConfig) {
  return config
}

export function defineHashing(config: HashingConfig) {
  return config
}

export function defineLibrary(config: LibraryConfig) {
  return config
}

export function defineNotification(config: NotificationConfig) {
  return config
}

export function definePayment(config: PaymentConfig) {
  return config
}

export function defineQueue(config: QueueConfig) {
  return config
}

export function defineSearchEngine(config: SearchEngineConfig) {
  return config
}

export function defineSecurity(config: SecurityConfig) {
  return config
}

export function defineServices(config: ServicesConfig) {
  return config
}

export function defineSms(config: SmsConfig) {
  return config
}

export function defineStorage(config: StorageConfig) {
  return config
}

export function defineUi(config: UiConfig) {
  return config
}

export function defineModel(config: Model) {
  return config
}

export function defineEvents(config: Events) {
  return config
}
