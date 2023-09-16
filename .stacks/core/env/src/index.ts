import p from 'node:process'
import { ValidationBoolean, ValidationEnum, ValidationNumber } from '@stacksjs/validation'
import type { Env } from '@stacksjs/env'
import type { EnvKey } from '~/storage/framework/stacks/env'

interface EnumObject {
  [key: string]: string[]
}

export const enums: EnumObject = {
  APP_ENV: ['local', 'dev', 'development', 'staging', 'prod', 'production'],
  DB_CONNECTION: ['mysql', 'sqlite', 'postgres', 'planetscale'],
  MAIL_MAILER: ['smtp', 'mailgun', 'ses', 'postmark', 'sendmail', 'log'],
  SEARCH_ENGINE_DRIVER: ['meilisearch', 'algolia', 'typesense'],
  FRONTEND_APP_ENV: ['development', 'staging', 'production'],
}

const handler = {
  get: (target: Env, key: EnvKey) => {
    const value = target[key] as any

    if (value instanceof ValidationEnum)
      return target[key] as string

    if (value instanceof ValidationBoolean)
      return !!target[key]

    if (value instanceof ValidationNumber)
      return Number(target[key])

    return value as string
  },
}

export function process() {
  return typeof Bun !== 'undefined'
    ? Bun.env
    : p.env as unknown as Env
}

export const env: Env = new Proxy(process(), handler)

export * from './types'
