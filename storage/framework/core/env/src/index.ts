import p from 'node:process'
import fs from 'fs-extra'
import { projectPath } from '@stacksjs/path'
import { ValidationBoolean, ValidationEnum, ValidationNumber } from '@stacksjs/validation'
import type { EnvKey } from '../../../env'
import type { Env } from './types'

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

    // if value is a string but only contains numbers, and the key is not AWS_ACCOUNT_ID, return it as a number
    if (typeof value === 'string' && /^\d+$/.test(value) && key !== 'AWS_ACCOUNT_ID')
      return Number(value)

    // if value is a string but only contains boolean values, return it as a boolean
    if (typeof value === 'string' && /^(true|false)$/.test(value))
      return value === 'true'

    // at some point, let's see if we can remove the need for below
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
    ? Bun.env as unknown as Env
    : p.env as unknown as Env
}

export const env: Env = new Proxy(process(), handler)

export function writeEnv(key: EnvKey, value: string, options?: { path: string }) {
  const envPath = options?.path || projectPath('.env')
  const env = fs.readFileSync(envPath, 'utf-8')

  // Split the file into lines
  const lines = env.split('\n')

  // Find the line with the variable we want to update
  const index = lines.findIndex(line => line.startsWith(`${key}=`))

  // If the variable exists, update it
  if (index !== -1)
    lines[index] = `${key}=${value}`

  // Otherwise, add a new line
  else
    lines.push(`${key}=${value}`)

  // Join the lines back into a string and write it to the .env file
  fs.writeFileSync(envPath, lines.join('\n'))
}

export * from './types'
