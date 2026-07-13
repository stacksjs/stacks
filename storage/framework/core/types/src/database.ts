import type { SupportedDialect } from 'bun-query-builder'
export interface DatabaseOptions {
  default: SupportedDialect
  logging?: boolean
  connections: {
    mysql?: {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }

    // SingleStore is MySQL wire-compatible (port 3306); it shares MySQL's
    // connection shape and adds an optional `ssl` flag for managed (Helios)
    // endpoints, which require TLS.
    singlestore?: {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
      ssl?: boolean
    }

    sqlite: {
      url?: string
      database?: string
      prefix?: string
    }

    dynamodb?: {
      key?: string
      secret?: string
      region?: string
      prefix?: string
      endpoint?: string
    }

    postgres?: {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }
  }

  migrations: string
  migrationLocks: string

  /**
   * Safety guards for the destructive migration commands.
   *
   * These gate `buddy migrate` and `buddy migrate:fresh` behind explicit
   * human confirmation so an absent-minded command can't silently wipe or
   * reshape a database. Every value can be overridden per-run by an env
   * var (see each field) so CI/automation has an escape hatch.
   */
  safety?: {
    /**
     * Require an interactive confirmation before `buddy migrate` applies
     * anything. Bypass a single run with `--force`; automation without a
     * TTY (CI) proceeds without prompting. Env override: `DB_MIGRATE_CONFIRM`.
     *
     * @default true
     */
    confirmMigrate?: boolean

    /**
     * Guard level for `buddy migrate:fresh`, which DROPS every table before
     * re-migrating (total data loss):
     *   - `'allow'`    run after a typed confirmation; `--force` bypasses it
     *   - `'confirm'`  always require the typed confirmation; `--force` does NOT bypass
     *   - `'disabled'` refuse to run at all (the hard kill-switch)
     *
     * Env override: `DB_MIGRATE_FRESH` (`allow` | `confirm` | `disabled`).
     *
     * @default 'allow' in local/dev, 'disabled' when APP_ENV is production
     */
    migrateFresh?: 'allow' | 'confirm' | 'disabled'
  }

  // Query logging configuration
  queryLogging?: {
    enabled: boolean
    slowThreshold: number // in milliseconds
    retention: number // in days
    pruneFrequency: number // in hours
    excludedQueries?: string[] // patterns to exclude
    analysis?: {
      enabled: boolean
      analyzeAll: boolean // analyze all queries, not just slow ones
      explainPlan: boolean // collect EXPLAIN plans
      suggestions: boolean // generate optimization suggestions
    }
  }
}

export type DatabaseConfig = Partial<DatabaseOptions>

export interface FactoryOptions {
  name: string
  count?: number
  items: object
  columns: object
}

export interface SchemaOptions {
  database: string
}
