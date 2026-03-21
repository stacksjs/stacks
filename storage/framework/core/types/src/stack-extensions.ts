/**
 * Known top-level directories in a Stacks project that a stack extension can provide.
 * Uses `(string & {})` to allow custom directories while still providing autocomplete.
 */
export type StackDirectory =
  | 'app'
  | 'config'
  | 'database'
  | 'resources'
  | 'routes'
  | 'public'
  | 'locales'
  | 'docs'
  | (string & {})

/**
 * Metadata for a stack extension, defined in the `stacks` field of a stack's package.json.
 *
 * @example
 * ```json
 * {
 *   "name": "@stacksjs/blog",
 *   "stacks": {
 *     "name": "blog",
 *     "description": "Blog functionality for Stacks",
 *     "directories": ["app", "config", "database", "resources"]
 *   }
 * }
 * ```
 */
export interface StackMeta {
  /** Short identifier for the stack (e.g. 'blog', 'commerce') */
  name: string
  /** Human-readable description of what this stack provides */
  description?: string
  /** Semver version of the stack */
  version?: string
  /** Which top-level directories this stack provides. Defaults to all known directories if omitted. */
  directories?: StackDirectory[]
  /** Lifecycle hooks that run during install/uninstall */
  hooks?: {
    preInstall?: string
    postInstall?: string
    preUninstall?: string
    postUninstall?: string
  }
}

export type ConflictStrategy = 'skip' | 'overwrite' | 'backup'

/** Tracks a single installed stack in the lock file */
export interface StackManifestEntry {
  /** The npm package name (e.g. '@stacksjs/blog') */
  packageName: string
  /** The stack's short name */
  name: string
  /** Installed version */
  version: string
  /** ISO timestamp of when this stack was installed */
  installedAt: string
  /** All files that were copied into the project, relative to project root */
  files: string[]
  /** Files that were skipped due to conflicts */
  skipped: string[]
  /** The conflict strategy used during this install */
  conflictStrategy: ConflictStrategy
}

/** The stacks.lock.json file format */
export interface StackLock {
  version: 1
  generatedAt: string
  stacks: Record<string, StackManifestEntry>
}

export interface StackInstallOptions {
  /** The stack name or package name to install */
  name: string
  /** How to handle file conflicts. Defaults to 'skip'. */
  conflict?: ConflictStrategy
  /** Force overwrite all files (shorthand for conflict: 'overwrite') */
  force?: boolean
  /** Show what would happen without making changes */
  dryRun?: boolean
  /** Enable verbose output */
  verbose?: boolean
}

export interface StackUninstallOptions {
  /** The stack name or package name to uninstall */
  name: string
  /** Force removal even if files were modified after install */
  force?: boolean
  /** Enable verbose output */
  verbose?: boolean
}

/** Display format for the `stack:list` command */
export interface StackListEntry {
  name: string
  packageName: string
  version: string
  description?: string
  installed: boolean
  installedAt?: string
  fileCount?: number
}

/**
 * Known stack extension names. Uses `(string & {})` to allow any string
 * while providing autocomplete for well-known/first-party stacks.
 */
export type KnownStackName =
  | 'blog'
  | 'commerce'
  | 'analytics'
  | 'auth'
  | 'cms'
  | 'api'
  | 'email'
  | 'notifications'
  | 'payments'
  | 'search'
  | 'realtime'
  | 'calendar'
  | 'table'
  | (string & {})

/**
 * A stack extension entry in the registry (`config/stacks.ts`).
 *
 * Can be either:
 * - A string (the stack name or package name)
 * - A full object with name, URL, and GitHub repository
 *
 * @example
 * ```ts
 * export default [
 *   'blog',                                    // shorthand
 *   '@stacksjs/commerce',                      // scoped package shorthand
 *   { name: 'analytics', github: 'stacksjs/analytics-stack' },
 * ] satisfies StackExtensionRegistry
 * ```
 */
export interface StackExtensionEntry {
  /** The stack name or package name */
  name: KnownStackName
  /** The stack's website URL */
  url?: string
  /** GitHub repository (e.g. 'stacksjs/blog-stack') */
  github?: string
  /** npm package name if different from the name */
  package?: string
}

/**
 * The registry type for `config/stacks.ts`.
 * Accepts both string shorthands and full objects.
 */
export type StackExtensionRegistry = (KnownStackName | StackExtensionEntry)[]
