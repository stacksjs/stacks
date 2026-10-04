/**
 * Env files, read the way Stacks reads them - the pure half of ./env.ts.
 *
 * Decryption and key lookup are not reimplemented here: they are
 * `@stacksjs/env`'s own (core/env/src), bundled into the extension, so a value
 * the hover decrypts is exactly what `./buddy env:get` prints.
 */
import { basename } from 'node:path'
import { envPrivateKeyNames } from '../../../../core/env/src/cli'
import { decryptValue } from '../../../../core/env/src/crypto'
import { parseEnvFile } from './project'

/** `.env`, `.env.local`, `.env.production`, ... - not `.env.keys`, which holds the private keys themselves. */
export function isEnvFile(path: string): boolean {
  const name = basename(path)
  return /^\.env(?:\..+)?$/.test(name) && name !== '.env.keys'
}

export function isEncrypted(value: string): boolean {
  return value.startsWith('encrypted:')
}

export interface EnvEntry {
  key: string
  value: string
  /** Character offsets of the value on its line, quotes excluded. */
  start: number
  end: number
}

/** The `KEY=value` on one line, with where its value sits, by `parseEnvFile`'s rules. */
export function envEntryAt(line: string): EnvEntry | undefined {
  const match = line.match(/^(\s*(?:export\s+)?([A-Z_a-z][\w.-]*)\s*=\s*)(.*)$/)
  if (!match)
    return undefined

  const key = match[2] as string
  const value = parseEnvFile(line)[key]
  if (value === undefined)
    return undefined

  const rest = match[3] as string
  const quoted = rest[0] === '"' || rest[0] === '\'' || rest[0] === '`'
  const start = (match[1] as string).length + (quoted ? 1 : 0)
  return { key, value, start, end: start + value.length }
}

/** Keys `.env.example` declares that the env file does not set, in example order. */
export function missingKeys(example: string, actual: string): string[] {
  const present = parseEnvFile(actual)
  return Object.keys(parseEnvFile(example)).filter(key => !(key in present))
}

export interface PrivateKey {
  name: string
  key: string
  from: '.env.keys' | 'environment'
}

/**
 * The private key for an env file, looked up as `./buddy env:get` does:
 * `envPrivateKeyNames` (`DOTENV_PRIVATE_KEY_<ENV>`, then `DOTENV_PRIVATE_KEY`)
 * in `.env.keys`, then in the environment, the dotenvx convention for CI and
 * servers where `.env.keys` must not exist.
 */
export function findPrivateKey(envFile: string, keysFile: string | undefined, environment: Record<string, string | undefined>): PrivateKey | undefined {
  const names = envPrivateKeyNames(basename(envFile))
  const keys = keysFile === undefined ? {} : parseEnvFile(keysFile)

  for (const name of names) {
    if (keys[name])
      return { name, key: keys[name] as string, from: '.env.keys' }
  }
  for (const name of names) {
    if (environment[name])
      return { name, key: environment[name] as string, from: 'environment' }
  }
  return undefined
}

export type Decryption =
  | { ok: true, value: string, key: PrivateKey }
  | { ok: false, reason: 'no-key', looked: string[] }
  | { ok: false, reason: 'failed', key: PrivateKey }

/** Decrypt one value in memory. The result is never cached or written anywhere. */
export function decryptEnvValue(
  envFile: string,
  value: string,
  keysFile: string | undefined,
  environment: Record<string, string | undefined>,
): Decryption {
  const key = findPrivateKey(envFile, keysFile, environment)
  if (!key)
    return { ok: false, reason: 'no-key', looked: envPrivateKeyNames(basename(envFile)) }

  try {
    return { ok: true, value: decryptValue(value, key.key), key }
  }
  catch {
    return { ok: false, reason: 'failed', key }
  }
}
