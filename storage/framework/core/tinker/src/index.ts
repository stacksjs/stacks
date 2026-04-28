import type { Subprocess } from 'bun'
import { existsSync, readFileSync, writeFileSync, appendFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

export interface TinkerConfig {
  /** Additional modules to preload into the REPL session */
  preload?: string[]
  /** Custom history file path (default: ~/.stacks_tinker_history) */
  historyFile?: string
  /** Maximum history entries to persist (default: 5000) */
  historySize?: number
  /** Working directory for the REPL (default: process.cwd()) */
  cwd?: string
  /** Whether to show the welcome banner (default: true) */
  banner?: boolean
  /** Whether to preload Stacks framework modules (default: true) */
  stacksPreload?: boolean
  /** Evaluate a single expression and exit */
  eval?: string
  /** Evaluate and print a single expression, then exit */
  print?: string
  /** Enable verbose/debug output */
  verbose?: boolean
}

/**
 * Generate the preload script that makes all Stacks framework
 * modules available in the REPL session.
 */
function generatePreloadScript(config: TinkerConfig): string {
  const lines: string[] = []

  if (config.stacksPreload !== false) {
    lines.push(`
// ---- Stacks Framework Preload ----
// ORM & Database
try {
  const { db } = await import('@stacksjs/database')
  globalThis.db = db
} catch {}

try {
  const orm = await import('@stacksjs/orm')
  // Expose all ORM exports globally (User, Post, etc.)
  for (const [key, value] of Object.entries(orm)) {
    if (key !== 'default' && key !== 'db') {
      globalThis[key] = value
    }
  }
} catch {}

// Config
try {
  const config = await import('@stacksjs/config')
  globalThis.config = config
} catch {}

// Path utilities
try {
  const path = await import('@stacksjs/path')
  globalThis.path = path
} catch {}

// Storage
try {
  const storage = await import('@stacksjs/storage')
  globalThis.storage = storage
} catch {}

// Validation
try {
  const validation = await import('@stacksjs/validation')
  globalThis.validation = validation
} catch {}

// Logging
try {
  const { log } = await import('@stacksjs/cli')
  globalThis.log = log
} catch {}

// Collections
try {
  const collections = await import('@stacksjs/collections')
  globalThis.collect = collections.collect ?? collections.default
} catch {}

// Strings
try {
  const strings = await import('@stacksjs/strings')
  globalThis.Str = strings
} catch {}

// Cache
try {
  const cache = await import('@stacksjs/cache')
  globalThis.cache = cache
} catch {}

// Queue / Jobs
try {
  const queue = await import('@stacksjs/queue')
  globalThis.queue = queue
} catch {}

// Events
try {
  const events = await import('@stacksjs/events')
  globalThis.events = events
} catch {}

// Router
try {
  const router = await import('@stacksjs/router')
  globalThis.router = router
} catch {}

// Auth
try {
  const auth = await import('@stacksjs/auth')
  globalThis.auth = auth
} catch {}

// Notifications
try {
  const notifications = await import('@stacksjs/notifications')
  globalThis.notifications = notifications
} catch {}

// Env / environment helpers
try {
  const env = await import('@stacksjs/env')
  globalThis.env = env
} catch {}
`)
  }

  // Add custom preload modules
  if (config.preload?.length) {
    for (const mod of config.preload) {
      const varName = mod.replace(/[@/\-\.]/g, '_').replace(/^_+/, '')
      lines.push(`try { globalThis.${varName} = await import('${mod}') } catch {}`)
    }
  }

  return lines.join('\n')
}

/**
 * Get the path to the tinker history file.
 */
export function getHistoryPath(config?: TinkerConfig): string {
  return config?.historyFile ?? join(homedir(), '.stacks_tinker_history')
}

/**
 * Read history entries from file.
 */
export function readHistory(config?: TinkerConfig): string[] {
  const historyPath = getHistoryPath(config)

  if (!existsSync(historyPath)) {
    return []
  }

  const content = readFileSync(historyPath, 'utf-8')
  return content.split('\n').filter(Boolean)
}

/**
 * Append a single entry to the history file.
 *
 * The history file lives at `~/.stacks_tinker_history` and accumulates
 * every expression a developer types — including any one-off pasted
 * tokens, API keys, or DB credentials. Forcing 0600 permissions keeps
 * the file readable only by the file's owner so other users on a shared
 * machine can't grep it for accidentally-committed secrets.
 */
export function appendHistory(entry: string, config?: TinkerConfig): void {
  const historyPath = getHistoryPath(config)
  const isNew = !existsSync(historyPath)
  appendFileSync(historyPath, `${entry}\n`)
  if (isNew) {
    try { chmodSync(historyPath, 0o600) } catch { /* best-effort */ }
  }

  // Trim history if it exceeds max size
  const maxSize = config?.historySize ?? 5000
  const entries = readHistory(config)

  if (entries.length > maxSize) {
    const trimmed = entries.slice(entries.length - maxSize)
    writeFileSync(historyPath, trimmed.join('\n') + '\n')
    try { chmodSync(historyPath, 0o600) } catch { /* best-effort */ }
  }
}

/**
 * Clear the tinker history file.
 */
export function clearHistory(config?: TinkerConfig): void {
  const historyPath = getHistoryPath(config)
  writeFileSync(historyPath, '')
}

/**
 * Build the welcome banner string.
 */
function buildBanner(): string {
  const bunVersion = typeof Bun !== 'undefined' ? Bun.version : 'unknown'

  return [
    '',
    `  \x1b[36mStacks Tinker\x1b[0m (Bun v${bunVersion})`,
    '  Interactive REPL with Stacks framework preloaded.',
    '',
    '  \x1b[2mAvailable globals: db, config, path, storage, log, Str,',
    '  cache, queue, events, router, auth, collect, env',
    '  + all ORM models (User, Post, etc.)\x1b[0m',
    '',
    '  \x1b[2mType .help for REPL commands. Press Ctrl+D to exit.\x1b[0m',
    '',
  ].join('\n')
}

/**
 * Start an interactive Stacks tinker session.
 *
 * Launches Bun's built-in REPL with all Stacks framework modules
 * preloaded into the global scope. ORM models, database, config,
 * logging, and other framework utilities are immediately available.
 *
 * @example
 * ```ts
 * import { startTinker } from '@stacksjs/tinker'
 *
 * await startTinker()
 * ```
 *
 * @example
 * ```ts
 * // Evaluate a single expression
 * await startTinker({ eval: 'await User.count()' })
 * ```
 *
 * @example
 * ```ts
 * // Evaluate and print
 * await startTinker({ print: 'await User.all()' })
 * ```
 */
export async function startTinker(config: TinkerConfig = {}): Promise<{ exitCode: number }> {
  const cwd = config.cwd ?? process.cwd()

  // Handle --eval / --print (non-interactive) mode
  if (config.eval || config.print) {
    return runNonInteractive(config, cwd)
  }

  // Interactive mode — show banner
  if (config.banner !== false) {
    process.stdout.write(buildBanner())
  }

  // Write a temporary preload script
  const preloadScript = generatePreloadScript(config)
  const preloadPath = join(cwd, '.tinker-preload.ts')
  writeFileSync(preloadPath, preloadScript)

  const args = ['repl']

  const proc: Subprocess = Bun.spawn(['bun', ...args], {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      BUN_PRELOAD: preloadPath,
    },
  })

  const exitCode = await proc.exited

  // Cleanup temp preload file
  try {
    const { unlinkSync } = await import('node:fs')
    unlinkSync(preloadPath)
  }
  catch {}

  return { exitCode }
}

/**
 * Run tinker in non-interactive mode (eval/print).
 */
async function runNonInteractive(config: TinkerConfig, cwd: string): Promise<{ exitCode: number }> {
  const preloadScript = generatePreloadScript(config)
  const expression = config.print ?? config.eval ?? ''

  // Build a script that preloads modules then evaluates the expression
  const script = `${preloadScript}\n\nconst __result__ = await (async () => { return ${expression} })()\n${config.print ? 'console.log(__result__)' : ''}`

  const tmpPath = join(cwd, '.tinker-eval.ts')
  writeFileSync(tmpPath, script)

  const proc = Bun.spawn(['bun', 'run', tmpPath], {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })

  const exitCode = await proc.exited

  try {
    const { unlinkSync } = await import('node:fs')
    unlinkSync(tmpPath)
  }
  catch {}

  return { exitCode }
}

/**
 * Convenience function to evaluate a single expression in tinker context
 * and return the result.
 */
export async function tinkerEval(expression: string, config: TinkerConfig = {}): Promise<{ exitCode: number }> {
  return startTinker({ ...config, eval: expression })
}

/**
 * Convenience function to evaluate and print a single expression.
 */
export async function tinkerPrint(expression: string, config: TinkerConfig = {}): Promise<{ exitCode: number }> {
  return startTinker({ ...config, print: expression })
}

export type { Subprocess }
