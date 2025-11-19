/**
 * Bun plugin for .env file loading with encryption support
 * Automatically loads and decrypts .env files at runtime
 */

import type { BunPlugin } from 'bun'
import { existsSync } from 'node:fs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getPrivateKey, parseEnvFromKey } from './crypto'
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

/**
 * Load .env files and inject into process.env
 */
export function loadEnv(options: EnvPluginOptions = {}): { loaded: number, errors: string[] } {
  const {
    path: envPaths = ['.env'],
    overload = false,
    env: envName,
    privateKey: customPrivateKey,
    keysFile,
    quiet = false,
    cwd = process.cwd(),
  } = options

  const paths = Array.isArray(envPaths) ? envPaths : [envPaths]
  const errors: string[] = []
  let loaded = 0

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
      const { parsed, errors: parseErrors } = parse(content, {
        privateKey,
        processEnv: process.env,
      })

      errors.push(...parseErrors)

      // Inject parsed values into process.env
      for (const [key, value] of Object.entries(parsed)) {
        // Skip DOTENV_PUBLIC_KEY
        if (key === 'DOTENV_PUBLIC_KEY') {
          continue
        }

        // Only set if not already set (unless overload is true)
        if (overload || process.env[key] === undefined) {
          process.env[key] = value
          loaded++
        }
      }

      // Only log once per process to avoid duplicate messages
      if (!quiet && !process.env.__ENV_LOADED__) {
        console.log(`[env] loaded ${Object.keys(parsed).length} variables from ${envPath}`)
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
  const env = options.env || process.env.NODE_ENV || process.env.DOTENV_ENV || 'development'
  const cwd = options.cwd || process.cwd()

  // Determine which .env files to load based on environment
  const paths: string[] = []

  // Check for environment-specific files
  const envFile = `.env.${env}`
  const envLocalFile = `.env.${env}.local`

  if (existsSync(resolve(cwd, envLocalFile))) {
    paths.push(envLocalFile)
  }

  if (existsSync(resolve(cwd, envFile))) {
    paths.push(envFile)
  }

  // Always try to load .env.local and .env
  if (existsSync(resolve(cwd, '.env.local'))) {
    paths.push('.env.local')
  }

  if (existsSync(resolve(cwd, '.env'))) {
    paths.push('.env')
  }

  return loadEnv({
    ...options,
    path: paths,
    env,
  })
}

// Default export for easy usage
export default envPlugin
