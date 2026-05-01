/**
 * Lightweight runtime validation for `~/config/*.ts` so a typo in user
 * config (e.g. `ports: { api: '8000' }` as a string, or
 * `database: { default: 'mysq' }`) surfaces with a readable error at boot
 * instead of trickling into a confusing runtime failure later.
 *
 * Implementation note: we deliberately do NOT depend on
 * `@stacksjs/validation` here — that package imports `@stacksjs/config`
 * transitively, which would create the same static cycle the
 * `overridesReady` plumbing exists to avoid. The handful of checks we
 * need are easy enough to express by hand.
 */

import type { StacksConfig } from '@stacksjs/types'

export interface ConfigValidationIssue {
  path: string
  message: string
}

// eslint-disable-next-line pickier/no-unused-vars
type Check = (value: unknown, path: string) => ConfigValidationIssue[]

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function checkInteger(min: number, max: number): Check {
  return (value, path) => {
    if (value == null) return []
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return [{ path, message: `expected integer, got ${typeof value} (${JSON.stringify(value)})` }]
    }
    if (value < min || value > max) {
      return [{ path, message: `expected integer in [${min}, ${max}], got ${value}` }]
    }
    return []
  }
}

function checkOneOf(values: readonly string[]): Check {
  return (value, path) => {
    if (value == null) return []
    if (typeof value !== 'string' || !values.includes(value)) {
      return [{ path, message: `expected one of [${values.join(', ')}], got ${JSON.stringify(value)}` }]
    }
    return []
  }
}

function checkString(): Check {
  return (value, path) => {
    if (value == null) return []
    return typeof value === 'string'
      ? []
      : [{ path, message: `expected string, got ${typeof value}` }]
  }
}

function checkBoolean(): Check {
  return (value, path) => {
    if (value == null) return []
    return typeof value === 'boolean'
      ? []
      : [{ path, message: `expected boolean, got ${typeof value}` }]
  }
}

interface SchemaSection {
  /** Each entry: dot-path under the section, plus the check to apply. */
  rules: Record<string, Check>
}

const PORT_CHECK = checkInteger(1, 65535)

/**
 * Section-by-section schema. Only the fields we want to lock down are
 * listed — anything else is allowed through unchanged. This keeps the
 * surface low-maintenance: when a new config field shows up that the
 * framework doesn't care about strictly, no schema update is needed.
 */
const SCHEMA: Partial<Record<keyof StacksConfig, SchemaSection>> = {
  app: {
    rules: {
      'name': checkString(),
      'env': checkOneOf(['local', 'development', 'staging', 'production', 'test']),
      'debug': checkBoolean(),
      'url': checkString(),
    },
  },
  ports: {
    rules: {
      'frontend': PORT_CHECK,
      'api': PORT_CHECK,
      'admin': PORT_CHECK,
      'docs': PORT_CHECK,
      'systemTray': PORT_CHECK,
      'desktop': PORT_CHECK,
    },
  },
  database: {
    rules: {
      'default': checkOneOf(['sqlite', 'mysql', 'postgres', 'dynamodb']),
    },
  },
  cache: {
    rules: {
      'driver': checkOneOf(['memory', 'redis']),
    },
  },
  queue: {
    rules: {
      'default': checkOneOf(['sync', 'database', 'redis']),
    },
  },
  logging: {
    rules: {
      'level': checkOneOf(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
    },
  },
  email: {
    rules: {
      'default': checkOneOf(['ses', 'sendgrid', 'mailgun', 'mailtrap', 'smtp', 'log']),
    },
  },
}

/**
 * Validate a config snapshot. Returns the list of issues — caller decides
 * whether to throw, log, or just print a summary. Returns an empty array
 * when everything checks out.
 */
export function validateConfig(config: Partial<StacksConfig>): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = []

  for (const [section, schema] of Object.entries(SCHEMA) as Array<[keyof StacksConfig, SchemaSection]>) {
    const sectionValue = (config as Record<string, unknown>)[section]
    if (sectionValue == null) continue
    if (!isPlainObject(sectionValue)) {
      issues.push({ path: section, message: `expected object, got ${typeof sectionValue}` })
      continue
    }
    for (const [field, check] of Object.entries(schema.rules)) {
      const v = sectionValue[field]
      issues.push(...check(v, `${section}.${field}`))
    }
  }

  return issues
}

/**
 * Convenience: validate and pretty-print to stderr. Returns true when
 * the config is clean. Used by the boot path so users see issues
 * immediately on startup rather than digging into a stack trace later.
 */
export function reportConfigIssues(config: Partial<StacksConfig>): boolean {
  const issues = validateConfig(config)
  if (issues.length === 0) return true
  // eslint-disable-next-line no-console
  console.warn('[config] Configuration issues detected:')
  for (const issue of issues) {
    // eslint-disable-next-line no-console
    console.warn(`  • ${issue.path}: ${issue.message}`)
  }
  return false
}
