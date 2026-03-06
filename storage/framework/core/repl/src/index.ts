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
}

/**
 * Start a Stacks REPL session.
 *
 * This is the main entry point for `buddy tinker` and `buddy repl`.
 * It launches Bun's REPL with all Stacks framework modules preloaded.
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
 * ```
 */
export async function startRepl(config: ReplConfig = {}): Promise<{ exitCode: number }> {
  const { startTinker } = await import('@stacksjs/tinker')

  // If loadFile is specified, read it and prepend to preload
  if (config.loadFile) {
    const { readFileSync } = await import('node:fs')
    try {
      const content = readFileSync(config.loadFile, 'utf-8')
      // Evaluate the file content before starting the REPL
      config.eval = config.eval
        ? `${content}\n${config.eval}`
        : undefined

      // Add file's directory imports to preload
      config.preload = config.preload ?? []
    }
    catch (err) {
      console.error(`Failed to load file: ${config.loadFile}`, err)
    }
  }

  return startTinker(config)
}
