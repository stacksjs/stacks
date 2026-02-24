import type { EnvKey } from '../../../env'
import type { StacksEnv } from './types'
import p from 'node:process'
import { projectPath } from '@stacksjs/path'
import fs from 'node:fs'
import { envEnum } from './types'

const handler: ProxyHandler<StacksEnv> = {
  get: (target: StacksEnv, key: string) => {
    const value = target[key]

    // if value is a string but only contains numbers, and the key is not AWS_ACCOUNT_ID, return it as a number
    if (typeof value === 'string' && /^\d+$/.test(value) && key !== 'AWS_ACCOUNT_ID')
      return Number(value)

    // if value is a string but only contains boolean values, return it as a boolean
    if (typeof value === 'string' && /^true|false$/.test(value))
      return value === 'true'

    return value
  },
}

export function process(): StacksEnv {
  return typeof Bun !== 'undefined' ? (Bun.env as unknown as StacksEnv) : (p.env as unknown as StacksEnv)
}

export const env: StacksEnv = new Proxy(process(), handler)

export function writeEnv(key: EnvKey, value: string, options?: { path: string }): void {
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
  else lines.push(`${key}=${value}`)

  // Join the lines back into a string and write it to the .env file
  fs.writeFileSync(envPath, lines.join('\n'))
}

/**
 * Validate environment variables against the envEnum constraints.
 * Returns an array of validation error messages (empty if all valid).
 */
export function validateEnv(envProxy: StacksEnv = env): string[] {
  const errors: string[] = []

  for (const [key, allowedValues] of Object.entries(envEnum)) {
    const value = envProxy[key]
    if (value !== undefined && value !== '' && !allowedValues.includes(String(value))) {
      errors.push(`${key}="${value}" is not valid. Allowed values: ${allowedValues.join(', ')}`)
    }
  }

  return errors
}

export * from './types'
export * from './crypto'
export * from './parser'
export * from './plugin'
export * from './cli'
export * from './utils'
