/**
 * .env file parser
 * Parses .env files and handles encrypted values
 */

import { decryptValue } from './crypto'

export interface ParseOptions {
  privateKey?: string
  processEnv?: Record<string, string>
}

export interface ParseResult {
  parsed: Record<string, string>
  errors: string[]
}

/**
 * Parse a .env file content
 */
export function parse(src: string, options: ParseOptions = {}): ParseResult {
  const parsed: Record<string, string> = {}
  const errors: string[] = []
  const lines = src.split('\n')

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      continue
    }

    // Handle DOTENV_PUBLIC_KEY specially
    if (line.startsWith('DOTENV_PUBLIC_KEY=')) {
      const match = line.match(/^DOTENV_PUBLIC_KEY=["']?([^"'\n]+)["']?/)
      if (match) {
        parsed.DOTENV_PUBLIC_KEY = match[1]
      }
      continue
    }

    // Parse key=value
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match) {
      continue
    }

    let key = match[1].trim()
    let value = match[2].trim()

    // Handle quoted values
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)

      // Handle multiline values
      if (value.includes('\\n')) {
        value = value.replace(/\\n/g, '\n')
      }
    }

    // Handle encrypted values
    if (value.startsWith('encrypted:') && options.privateKey) {
      try {
        value = decryptValue(value, options.privateKey)
      }
      catch (error) {
        errors.push(`Failed to decrypt ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Handle variable expansion ${VAR}
    value = expandVariables(value, { ...parsed, ...(options.processEnv || process.env) })

    // Handle command substitution $(command)
    value = expandCommands(value)

    parsed[key] = value
  }

  return { parsed, errors }
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
 */
function expandCommands(value: string): string {
  // Match $(command) patterns
  return value.replace(/\$\(([^)]+)\)/g, (match, command) => {
    try {
      const result = Bun.spawnSync(command.split(' '), {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      if (result.exitCode === 0) {
        return new TextDecoder().decode(result.stdout).trim()
      }
    }
    catch {
      // Command execution failed, return empty string
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

  for (const file of files) {
    try {
      const content = Bun.file(file)
      if (!content.size) {
        continue
      }

      const src = await content.text()
      const { parsed, errors } = parse(src, options)

      allErrors.push(...errors)

      // Merge parsed values
      for (const [key, value] of Object.entries(parsed)) {
        // Skip if already set (unless overload is true)
        if (!options.overload && allParsed[key] !== undefined) {
          continue
        }

        allParsed[key] = value
      }
    }
    catch (error) {
      // File doesn't exist or can't be read
      continue
    }
  }

  return { parsed: allParsed, errors: allErrors }
}
