import type { EnvKey } from '../../../env'
import type { StacksEnv } from './types'
import p from 'node:process'
import { projectPath } from '@stacksjs/path'
import fs from 'node:fs'
import { envEnum } from './types'

const handler: ProxyHandler<StacksEnv> = {
  get: (target: StacksEnv, key: string) => {
    const value = target[key]

    // Only coerce to number for keys that are clearly numeric settings (PORT, etc.)
    // Don't coerce IDs, codes, or values with leading zeros as they lose information
    const NUMERIC_SUFFIXES = ['_PORT', '_TIMEOUT', '_TTL', '_SIZE', '_LIMIT', '_MAX', '_MIN', '_INTERVAL', '_RETRIES', '_CONCURRENCY', '_WORKERS', '_CONNECTIONS']
    if (typeof value === 'string' && /^\d+$/.test(value) && !value.startsWith('0') && NUMERIC_SUFFIXES.some(s => key.endsWith(s)))
      return Number(value)

    // If the string value looks like a boolean, coerce it. Use a case-
    // insensitive match so common variants like "TRUE" / "False" / "true"
    // all behave the same — earlier behavior coerced "true" but left
    // "TRUE" as the literal string "TRUE", which is truthy and silently
    // broke `if (env.SOMETHING) {}` flips on case-sensitive shells.
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true') return true
      if (lower === 'false') return false
    }

    return value
  },
}

export function process(): StacksEnv {
  return typeof Bun !== 'undefined' ? (Bun.env as unknown as StacksEnv) : (p.env as unknown as StacksEnv)
}

export const env: StacksEnv = new Proxy(process(), handler)

// eslint-disable-next-line pickier/no-unused-vars
export function writeEnv(key: EnvKey, value: string, options?: { path: string }): void {
  const envPath = options?.path || projectPath('.env')
  const env = fs.readFileSync(envPath, 'utf-8')

  // Split the file into lines
  const lines = env.split('\n')

  // Find the line with the variable we want to update
  const index = lines.findIndex(line => line.startsWith(`${key}=`))

  // Quote value if it contains spaces, quotes, or special characters
  const needsQuoting = /[\s"'#$\\]/.test(value)
  const quotedValue = needsQuoting ? `"${value.replace(/"/g, '\\"')}"` : value

  // If the variable exists, update it
  if (index !== -1)
    lines[index] = `${key}=${quotedValue}`
  // Otherwise, add a new line
  else lines.push(`${key}=${quotedValue}`)

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

/**
 * Assert that every key in `keys` is set on `process.env` (non-empty).
 *
 * Use this at boot to fail fast on misconfigured environments —
 * `requireEnv(['APP_KEY', 'STRIPE_SECRET'])` throws a single error
 * listing every missing key, which is much friendlier than "your
 * Stripe API key is empty" mid-checkout. Returns the env proxy so it
 * can be chained: `const envOk = requireEnv([...])`.
 */
export function requireEnv(keys: ReadonlyArray<string>, envProxy: StacksEnv = env): StacksEnv {
  const missing: string[] = []
  for (const key of keys) {
    const value = envProxy[key]
    if (value === undefined || value === '' || value === null) missing.push(key)
  }
  if (missing.length > 0) {
    throw new Error(`[env] Missing required environment variable(s): ${missing.join(', ')}. Set them in .env or your process environment before booting.`)
  }
  return envProxy
}

export * from './types'
export * from './crypto'
export * from './parser'
export * from './plugin'
export * from './cli'
export * from './utils'
