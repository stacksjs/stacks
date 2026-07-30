/**
 * .env file parser
 * Parses .env files and handles encrypted values
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { arch, hostname, platform, release, userInfo } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { decryptValue } from './crypto'

export interface ParseOptions {
  privateKey?: string
  processEnv?: Record<string, string>
}

export interface ParseResult {
  parsed: Record<string, string>
  errors: string[]
  /**
   * Keys holding encrypted values that were skipped because no private
   * key was available to decrypt them. Surfaced so callers can warn and
   * scrub stale ciphertext from process.env.
   */
  skippedEncrypted: string[]
}

/**
 * Parse a .env file content
 */
export function parse(src: string, options: ParseOptions = {}): ParseResult {
  const parsed: Record<string, string> = {}
  const errors: string[] = []
  const skippedEncrypted: string[] = []
  const lines = src.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue
    }

    // Handle DOTENV_PUBLIC_KEY specially
    if (line.startsWith('DOTENV_PUBLIC_KEY=')) {
      const match = line.match(/^DOTENV_PUBLIC_KEY=["']?([^"'\n]+)["']?/)
      if (match && match[1] !== undefined) {
        parsed.DOTENV_PUBLIC_KEY = match[1]
      }
      continue
    }

    // Parse key=value
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match || match[1] === undefined || match[2] === undefined) {
      continue
    }

    const key = match[1].trim()
    let value = match[2].trim()

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith(`'`) && value.endsWith(`'`))) {
      value = value.slice(1, -1)

      // Handle multiline values
      if (value.includes('\\n')) {
        value = value.replace(/\\n/g, '\n')
      }
    }

    // Handle encrypted values. Both prefixes are accepted:
    //   - `encrypted:<b64>` (verbose, mirrors dotenvx)
    //   - `enc:<b64>` (short alias for ergonomics in long .env files)
    // Without a privateKey the entry is SKIPPED entirely: injecting raw
    // ciphertext is never useful — every consumer treats it as a literal
    // string, so it fails config validation with opaque errors
    // (`expected integer, got string ("encrypted:...")`) or, worse,
    // silently connects to the wrong endpoint. Plaintext values are
    // unaffected, so dev workflows on plaintext .env files keep working.
    if (value.startsWith('encrypted:') || value.startsWith('enc:')) {
      if (!options.privateKey) {
        skippedEncrypted.push(key)
        continue
      }

      try {
        const normalized = value.startsWith('enc:')
          ? `encrypted:${value.slice(4)}`
          : value
        value = decryptValue(normalized, options.privateKey)
      }
      catch (error) {
        errors.push(`Failed to decrypt ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Handle variable expansion ${VAR}
    value = expandVariables(value, { ...(options.processEnv || process.env), ...parsed })

    // Handle command substitution $(command)
    value = expandCommands(value)

    parsed[key] = value
  }

  return { parsed, errors, skippedEncrypted }
}

/**
 * Expand variables in a value string
 * Supports: ${VAR}, ${VAR:-default}, ${VAR-default}, ${VAR:+alternate}, ${VAR+alternate}
 */
function expandVariables(value: string, env: Record<string, string | undefined>): string {
  // Match ${...} patterns
  return value.replace(/\$\{([^}]+)\}/g, (match, expression) => {
    // Handle default value syntax: ${VAR:-default} or ${VAR-default}
    const defaultMatch = expression.match(/^([^:\-+]+)(:-|-)(.+)$/)
    if (defaultMatch) {
      const [, varName, operator, defaultValue] = defaultMatch
      const varValue = env[varName]

      if (operator === ':-') {
        // Use default if unset or empty
        return varValue || defaultValue
      }
      else {
        // Use default if unset (empty is ok)
        return varValue !== undefined ? varValue : defaultValue
      }
    }

    // Handle alternate value syntax: ${VAR:+alternate} or ${VAR+alternate}
    const alternateMatch = expression.match(/^([^:\-+]+)(:?\+)(.+)$/)
    if (alternateMatch) {
      const [, varName, operator, alternateValue] = alternateMatch
      const varValue = env[varName]

      if (operator === ':+') {
        // Use alternate if set and non-empty
        return varValue ? alternateValue : ''
      }
      else {
        // Use alternate if set (empty is ok)
        return varValue !== undefined ? alternateValue : ''
      }
    }

    // Simple variable expansion
    return env[expression] || ''
  })
}

/**
 * Expand command substitutions in a value string
 * Supports: $(command)
 *
 * Only a small set of safe commands are allowed to prevent
 * arbitrary code execution from tampered .env files.
 */
const ALLOWED_ENV_COMMANDS = new Set(['date', 'hostname', 'whoami', 'uname', 'pwd', 'echo', 'printf', 'cat', 'basename', 'dirname'])

function splitCommand(command: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | '\'' | null = null
  let escaped = false

  for (const character of command.trim()) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === '\\' && quote !== '\'') {
      escaped = true
      continue
    }

    if (quote) {
      if (character === quote)
        quote = null
      else
        current += character
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (/\s/.test(character)) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }

    current += character
  }

  if (escaped || quote)
    throw new Error('Command substitution contains an unterminated escape or quote')
  if (current)
    parts.push(current)

  return parts
}

/**
 * Resolve simple allowlisted commands without starting a subprocess.
 *
 * This keeps environment loading portable in restricted runtimes, including
 * Bun's test runner, while complex command flags continue through spawnSync.
 */
function portableCommand(parts: string[]): string | undefined {
  const [executable, ...args] = parts
  const hasFlags = args.some(argument => argument.startsWith('-'))

  if (executable === 'echo' && !hasFlags)
    return args.join(' ')
  if (executable === 'printf' && args.length === 1 && !args[0]?.includes('%'))
    return args[0]
  if (executable === 'hostname' && args.length === 0)
    return hostname()
  if (executable === 'whoami' && args.length === 0)
    return userInfo().username
  if (executable === 'pwd' && args.length === 0)
    return process.cwd()
  if (executable === 'basename' && args.length === 1)
    return basename(args[0] ?? '')
  if (executable === 'dirname' && args.length === 1)
    return dirname(args[0] ?? '')
  if (executable === 'cat' && args.length > 0 && !hasFlags) {
    return args
      .map(path => readFileSync(resolve(process.cwd(), path), 'utf8'))
      .join('')
  }
  if (executable === 'uname') {
    const flag = args[0] ?? '-s'
    if (args.length <= 1 && flag === '-m')
      return arch()
    if (args.length <= 1 && flag === '-r')
      return release()
    if (args.length <= 1 && flag === '-s') {
      const platformNames: Record<string, string> = {
        aix: 'AIX',
        android: 'Android',
        cygwin: 'CYGWIN',
        darwin: 'Darwin',
        freebsd: 'FreeBSD',
        haiku: 'Haiku',
        linux: 'Linux',
        netbsd: 'NetBSD',
        openbsd: 'OpenBSD',
        sunos: 'SunOS',
        win32: 'Windows_NT',
      }

      return platformNames[platform()] ?? platform()
    }
  }

  return undefined
}

function expandCommands(value: string): string {
  // Match $(command) patterns
  return value.replace(/\$\(([^)]+)\)/g, (_match, command) => {
    try {
      const parts = splitCommand(command)
      const executable = parts[0]

      if (!executable || !ALLOWED_ENV_COMMANDS.has(executable)) {
        console.warn(`[env] Blocked command substitution for disallowed command: ${executable}`)
        return ''
      }

      const portableResult = portableCommand(parts)
      if (portableResult !== undefined)
        return portableResult.trim()

      const result = spawnSync(executable, parts.slice(1), {
        encoding: 'utf8',
        env: process.env,
      })

      if (result.status === 0) {
        return result.stdout.trim()
      }

      const detail = result.stderr.trim()
      console.warn(`[env] Command substitution failed (exit code ${result.status ?? 'unknown'}): ${executable}${detail ? `: ${detail}` : ''}`)
    }
    catch (error) {
      console.warn(`[env] Command substitution error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return ''
  })
}

/**
 * Load and parse multiple .env files
 */
export async function loadEnvFiles(
  files: string[],
  options: ParseOptions & { overload?: boolean } = {},
): Promise<ParseResult> {
  const allParsed: Record<string, string> = {}
  const allErrors: string[] = []
  const allSkipped: string[] = []

  for (const file of files) {
    try {
      const content = Bun.file(file)
      if (!content.size) {
        continue
      }

      const src = await content.text()
      const { parsed, errors, skippedEncrypted } = parse(src, options)

      allErrors.push(...errors)
      allSkipped.push(...skippedEncrypted)

      // Merge parsed values
      for (const [key, value] of Object.entries(parsed)) {
        // Skip if already set (unless overload is true)
        if (!options.overload && allParsed[key] !== undefined) {
          continue
        }

        allParsed[key] = value
      }
    }
    catch (error: any) {
      if (error?.code === 'ENOENT') {
        continue
      }
      allErrors.push(`Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { parsed: allParsed, errors: allErrors, skippedEncrypted: allSkipped }
}
