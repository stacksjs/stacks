import envConfig from '~/config/env'
import { EnvKey } from '~/storage/framework/stacks/env'
import { ValidationEnum, ValidationBoolean, ValidationNumber } from '@stacksjs/validation'
import p from 'node:process'
import { Env } from '@stacksjs/types'

interface EnumObject {
  [key: string]: string[]
}

export const enums: EnumObject = {
  APP_ENV: ['development', 'staging', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'planetscale'],
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'postmark', 'sendmail', 'log'],
  SEARCH_ENGINE_DRIVER: ['meilisearch', 'algolia', 'typesense'],
  FRONTEND_APP_ENV: ['development', 'staging', 'production'],
}

const handler = {
  get: (target: typeof Bun.env, key: EnvKey) => {
    const value = envConfig[key]

    if (value instanceof ValidationEnum)
      return process[key]

    if (value instanceof ValidationBoolean)
      return !!process[key]

    if (value instanceof ValidationNumber)
      return Number(process[key])

    return value
  }
}

export const process = typeof Bun !== 'undefined'
  ? Bun.env as Env
  : p.env as unknown as Env

export const env: Env = new Proxy(process, handler)
