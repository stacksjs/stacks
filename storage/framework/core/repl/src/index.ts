import type { TinkerConfig } from '@stacksjs/tinker'

// Re-export everything from tinker
export {
  startTinker,
  tinkerEval,
  tinkerPrint,
  getHistoryPath,
  readHistory,
  appendHistory,
  clearHistory,
} from '@stacksjs/tinker'

export type { TinkerConfig } from '@stacksjs/tinker'

export interface ReplConfig extends TinkerConfig {
  /** Load a file into the session before starting */
  loadFile?: string
  /**
   * Extra script appended to the preload after Stacks globals — useful
   * for app-specific scaffolding (e.g. binding a default user, opening
   * a shared transaction). Runs before the prompt appears.
   */
  bootstrap?: string
  /**
   * When true, dump the list of registered routes on session start.
   * Defaults to `false` because most REPL sessions don't need it; flip
   * on for "I'm exploring the app" sessions.
   */
  showRoutes?: boolean
}

/**
 * Start a Stacks REPL session.
 *
 * This is the main entry point for `buddy tinker` and `buddy repl`.
 * It launches Bun's official REPL (`bun repl`) with all Stacks framework
 * modules preloaded as globals — `db`, `config`, every ORM model,
 * `cache`, `queue`, etc. all available without imports.
 *
 * @example
 * ```ts
 * import { startRepl } from '@stacksjs/repl'
 *
 * // Interactive session
 * await startRepl()
 *
 * // With custom preloaded modules
 * await startRepl({
 *   preload: ['lodash', 'dayjs'],
 * })
 *
 * // Evaluate and exit
 * await startRepl({ print: 'await User.count()' })
 *
 * // Show registered routes when the session opens
 * await startRepl({ showRoutes: true })
 *
 * // App-specific bootstrap — runs before the prompt
 * await startRepl({
 *   bootstrap: `globalThis.me = await User.firstOrFail({ email: 'me@example.com' })`,
 * })
 * ```
 */
export async function startRepl(config: ReplConfig = {}): Promise<{ exitCode: number }> {
  const { startTinker } = await import('@stacksjs/tinker')

  // Build a chained eval string from loadFile + bootstrap + caller's
  // `eval`. Only the original `eval` exits the REPL after running;
  // bootstrap runs in interactive mode too (it just lands as setup).
  let chainedEval = ''
  if (config.loadFile) {
    const { readFileSync } = await import('node:fs')
    try {
      chainedEval += `${readFileSync(config.loadFile, 'utf-8')}\n`
    }
    catch (err) {
      console.error(`Failed to load file: ${config.loadFile}`, err)
    }
  }
  if (config.bootstrap) chainedEval += `${config.bootstrap}\n`
  if (config.showRoutes) {
    // Print the route table once the REPL globals are wired up.
    chainedEval += `try {
      const { listRegisteredRoutes } = await import('@stacksjs/router')
      const rows = listRegisteredRoutes()
      if (rows.length === 0) {
        console.log('  (no routes registered yet — call route.importRoutes() first)')
      } else {
        console.log('  Routes:')
        for (const r of rows) console.log('    ' + r.method.padEnd(6) + ' ' + r.path + (r.name ? ' (' + r.name + ')' : ''))
      }
    } catch (e) { console.warn('  (route introspection unavailable: ' + e.message + ')') }\n`
  }
  if (config.eval) chainedEval += config.eval

  const tinkerConfig: TinkerConfig = {
    ...config,
    eval: chainedEval || undefined,
  }

  // Wrap startTinker so we always restore the terminal to cooked mode if
  // the inner REPL throws — without this, an uncaught error from a user
  // expression leaves stdin in raw mode and the parent shell becomes
  // unresponsive (every keystroke shows up as a control sequence).
  try {
    return await startTinker(tinkerConfig)
  }
  finally {
    try {
      const { stdin } = await import('node:process')
      if (stdin.isTTY && typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false)
      }
    }
    catch { /* ignore — best-effort restore */ }
  }
}

/**
 * Lower-level entry that bypasses the bootstrap / route printing
 * conveniences and forwards straight to `bun repl`. Use this if you
 * need the bare wrapper (e.g. when scripting your own REPL launcher).
 */
export async function startBunRepl(config: TinkerConfig = {}): Promise<{ exitCode: number }> {
  const { startTinker } = await import('@stacksjs/tinker')
  return startTinker(config)
}
