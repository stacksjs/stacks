import p from 'node:process'
import { readFileSync, writeFileSync } from 'node:fs'
import { projectPath } from '@stacksjs/path'
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

export function writeEnv(key: EnvKey, value: string, options?: { path: string }) {
  const envPath = options?.path || projectPath('.env')
  const env = readFileSync(envPath, 'utf-8')

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
  writeFileSync(envPath, lines.join('\n'))
}

export * from './types'
