/**
 * Bun plugin for .env file loading with encryption support
 * Automatically loads and decrypts .env files at runtime
 */

import type { BunPlugin } from 'bun'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decryptValue, getPrivateKey, parseEnvFromKey } from './crypto'
import { parse } from './parser'

export interface EnvPluginOptions {
  /**
   * Path(s) to .env file(s) to load
   * @default ['.env']
   */
  path?: string | string[]

  /**
   * Whether to override existing environment variables
   * @default false
   */
  overload?: boolean

  /**
   * Environment to load (e.g., 'production', 'ci')
   * Will look for .env.{env} file and DOTENV_PRIVATE_KEY_{ENV} variable
   */
  env?: string

  /**
   * Custom private key for decryption
   */
  privateKey?: string

  /**
   * Path to .env.keys file
   */
  keysFile?: string

  /**
   * Whether to suppress output
   * @default false
   */
  quiet?: boolean

  /**
   * Root directory to resolve paths from
   * @default process.cwd()
   */
  cwd?: string
}

function isEncryptedValue(value: string | undefined): boolean {
  return typeof value === 'string' && (value.startsWith('encrypted:') || value.startsWith('enc:'))
}

function normalizeEnvName(value: string | undefined): string | undefined {
  if (!value || isEncryptedValue(value))
    return undefined

  const normalized = value.trim().toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(normalized))
    return undefined

  if (normalized === 'prod')
    return 'production'
  if (normalized === 'stage')
    return 'staging'
  if (normalized === 'dev')
    return 'development'

  return normalized
}

// --- Lazy decryption for the env proxy -------------------------------------
// The eager path (`autoLoadEnv`) bulk-decrypts every value into process.env at
// boot, but it only runs from the preloader. Fast CLI commands skip the
// preloader, and config/app code can read env before it runs — so the env
// proxy needs to decrypt on read too. These helpers resolve the private key
// once (process.env first, then `.env.keys`) and cache the result (including
// "no key") per environment, so a per-read decrypt costs a map lookup rather
// than a disk read.

let cachedKeyEnv: string | null = null
let cachedPrivateKey: string | undefined

function keyFromKeysFile(envName: string | undefined, cwd: string, keysFile = '.env.keys'): string | undefined {
  const keysPath = resolve(cwd, keysFile)
  if (!existsSync(keysPath))
    return undefined

  try {
    const { parsed } = parse(readFileSync(keysPath, 'utf-8'))
    if (envName) {
      const specific = parsed[`DOTENV_PRIVATE_KEY_${envName.toUpperCase()}`]
      if (specific)
        return specific
    }
    return parsed.DOTENV_PRIVATE_KEY
  }
  catch {
    return undefined
  }
}

/**
 * Resolve the dotenvx private key for the active environment, checking
 * process.env (`DOTENV_PRIVATE_KEY_<ENV>` then `DOTENV_PRIVATE_KEY`) and
 * finally a local `.env.keys` file. The result — key or `undefined` — is
 * cached per environment so the env proxy can call this on every encrypted
 * read without repeatedly touching disk.
 */
export function resolvePrivateKey(options: { env?: string, cwd?: string } = {}): string | undefined {
  const envName = normalizeEnvName(options.env)
    || normalizeEnvName(process.env.APP_ENV)
    || normalizeEnvName(process.env.NODE_ENV)
    || normalizeEnvName(process.env.DOTENV_ENV)
    || 'development'
  const cwd = options.cwd || process.cwd()

  if (cachedKeyEnv === envName)
    return cachedPrivateKey

  let key = getPrivateKey(envName)
  if (!key)
    key = process.env.DOTENV_PRIVATE_KEY
  if (!key)
    key = keyFromKeysFile(envName, cwd)

  cachedKeyEnv = envName
  cachedPrivateKey = key
  return key
}

/**
 * Clear the cached private key. Needed after key rotation and between tests
 * that swap `DOTENV_PRIVATE_KEY*` or `APP_ENV`.
 */
export function resetPrivateKeyCache(): void {
  cachedKeyEnv = null
  cachedPrivateKey = undefined
}

/**
 * Decrypt a single `encrypted:` / `enc:` value on demand. Returns the
 * plaintext, or `undefined` when the value is unusable (no key available or
 * decryption failed) so callers can treat it exactly like an unset variable.
 * Non-encrypted input is returned unchanged.
 */
export function decryptEnvValue(value: string, options: { env?: string, cwd?: string } = {}): string | undefined {
  if (!isEncryptedValue(value))
    return value

  const key = resolvePrivateKey(options)
  if (!key)
    return undefined

  try {
    const normalized = value.startsWith('enc:') ? `encrypted:${value.slice(4)}` : value
    return decryptValue(normalized, key)
  }
  catch {
    return undefined
  }
}

/**
 * Load .env files and inject into process.env
 */
export function loadEnv(options: EnvPluginOptions = {}): { loaded: number, errors: string[] } {
  const {
    path: envPaths = ['.env'],
    overload = false,
    env: envName,
    privateKey: customPrivateKey,
    keysFile = '.env.keys',
    quiet = false,
    cwd = process.cwd(),
  } = options

  const paths = Array.isArray(envPaths) ? envPaths : [envPaths]
  const errors: string[] = []
  let loaded = 0

  // Snapshot genuine shell/CI overrides before loading any files. Values that
  // Bun preloaded as ciphertext are not usable overrides and may be replaced.
  // Values loaded from an earlier file in this call are also not external, so
  // a later, more-specific file can override them without `overload: true`.
  const externalOverrides = new Set(
    Object.entries(process.env)
      .filter(([, value]) => value !== undefined && !isEncryptedValue(value))
      .map(([key]) => key),
  )

  // Determine which private key to use
  let privateKey = customPrivateKey

  if (!privateKey && keysFile) {
    // Load private key from .env.keys file
    const keysPath = resolve(cwd, keysFile)
    if (existsSync(keysPath)) {
      try {
        const keysContent = readFileSync(keysPath, 'utf-8')
        const { parsed } = parse(keysContent)

        if (envName) {
          const keyName = `DOTENV_PRIVATE_KEY_${envName.toUpperCase()}`
          privateKey = parsed[keyName]
        }
        else {
          privateKey = parsed.DOTENV_PRIVATE_KEY
        }
      }
      catch (error) {
        errors.push(`Failed to load keys file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  // If still no private key, check environment variables
  if (!privateKey) {
    privateKey = getPrivateKey(envName || '')
  }

  // Resolve and load each .env file
  for (const envPath of paths) {
    const fullPath = resolve(cwd, envPath)

    if (!existsSync(fullPath)) {
      if (!quiet) {
        errors.push(`File not found: ${fullPath}`)
      }
      continue
    }

    try {
      const content = readFileSync(fullPath, 'utf-8')
      const { parsed, errors: parseErrors, skippedEncrypted } = parse(content, {
        privateKey,
        processEnv: process.env as Record<string, string>,
      })

      errors.push(...parseErrors)

      // Encrypted entries with no available key were skipped by the parser.
      // Scrub any ciphertext Bun preloaded natively for the same keys (Bun
      // auto-loads .env/.env.<NODE_ENV> without knowing about encryption),
      // so config falls back to defaults instead of validating against
      // unusable ciphertext. Then warn — once per file per process, even in
      // quiet mode, because running on defaults in what the user believes
      // is a configured environment is a correctness issue, not noise.
      if (skippedEncrypted.length > 0) {
        for (const key of skippedEncrypted) {
          if (isEncryptedValue(process.env[key]))
            delete process.env[key]
        }

        const keyName = envName ? `DOTENV_PRIVATE_KEY_${envName.toUpperCase()}` : 'DOTENV_PRIVATE_KEY'
        const preview = skippedEncrypted.slice(0, 5).join(', ')
        const rest = skippedEncrypted.length > 5 ? `, … +${skippedEncrypted.length - 5} more` : ''
        console.warn(`[env] warning: skipped ${skippedEncrypted.length} encrypted value(s) in ${envPath} (${keyName} not set; defaults apply): ${preview}${rest}`)
      }

      // Inject parsed values into process.env
      let applied = 0
      for (const [key, value] of Object.entries(parsed)) {
        // Skip DOTENV_PUBLIC_KEY
        if (key === 'DOTENV_PUBLIC_KEY') {
          continue
        }

        const existing = process.env[key]

        // Bun natively loads `.env` / `.env.<mode>` into process.env before
        // any preload script runs, and it knows nothing about dotenvx-style
        // encryption — so on an encrypted file it leaves raw `encrypted:...`
        // ciphertext in process.env before this plugin ever executes. The
        // `undefined` check below then treated that ciphertext as a
        // pre-existing value and skipped the decrypted one, so every secret
        // stayed encrypted process-wide with no error: config validation
        // reported `database.default: got "encrypted:..."`, DB_CONNECTION
        // never resolved to a real driver, and auth-table creation silently
        // wrote nowhere. Ciphertext is unusable to every consumer, so it
        // never wins; genuine external overrides (shell/CI) still do.
        const isStaleCiphertext = isEncryptedValue(existing) && value !== existing

        if (overload || !externalOverrides.has(key) || isStaleCiphertext) {
          process.env[key] = value
          loaded++
          applied++
        }
      }

      // Only log once per process to avoid duplicate messages. Report what
      // was actually applied, not the parsed count — the old message said
      // "loaded 64 variables" even when it had injected none of them, which
      // is precisely what hid the decryption failure above.
      if (!quiet && !process.env.__ENV_LOADED__) {
        // Environment diagnostics belong on stderr so commands with a
        // machine-readable stdout contract can be piped and parsed safely.
        console.error(`[env] loaded ${applied}/${Object.keys(parsed).length} variables from ${envPath}`)
        process.env.__ENV_LOADED__ = '1'
      }
    }
    catch (error) {
      errors.push(`Failed to load ${fullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return { loaded, errors }
}

/**
 * Bun plugin for automatic .env loading
 */
export function envPlugin(options: EnvPluginOptions = {}): BunPlugin {
  return {
    name: 'env-plugin',
    setup(build) {
      // Load .env files when plugin is initialized
      loadEnv(options)
    },
  }
}

/**
 * Auto-detect and load .env files based on environment
 */
export function autoLoadEnv(options: Omit<EnvPluginOptions, 'path'> = {}): { loaded: number, errors: string[] } {
  const env = normalizeEnvName(options.env)
    || normalizeEnvName(process.env.NODE_ENV)
    || normalizeEnvName(process.env.DOTENV_ENV)
    || normalizeEnvName(process.env.APP_ENV)
    || 'development'
  const cwd = options.cwd || process.cwd()

  // Load from least to most specific. loadEnv preserves variables that were
  // present before this call while allowing later files in this list to
  // override values loaded from earlier files.
  const paths: string[] = []
  const addIfPresent = (file: string): void => {
    if (!paths.includes(file) && existsSync(resolve(cwd, file)))
      paths.push(file)
  }

  addIfPresent('.env')
  addIfPresent('.env.local')

  const envFile = `.env.${env}`
  const envLocalFile = `.env.${env}.local`
  addIfPresent(envFile)
  addIfPresent(envLocalFile)

  return loadEnv({
    ...options,
    path: paths,
    env,
  })
}

// Default export for easy usage
export default envPlugin
