import { EnvKey } from '~/storage/framework/stacks/env'
import { ValidationEnum, ValidationBoolean, ValidationNumber } from '@stacksjs/validation'
import p from 'node:process'
import { Env } from '@stacksjs/env'

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
      return !!target[key] as boolean

    if (value instanceof ValidationNumber)
      return Number(target[key]) as number

    return value as string
  }
}

export function process() {
  return typeof Bun !== 'undefined'
    ? Bun.env
    : p.env as unknown as Env
}

export const env: Env = new Proxy(process(), handler) as Env

export * from './types'
