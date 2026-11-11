import type { TinkerValue } from './serialize'
import type { TinkerEvaluation, TinkerFrame, TinkerSessionInfo } from './session'
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync, writeSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { serveTinker } from './protocol'
import { compileSnippet, createTinkerSession } from './session'

export * from './protocol'
export * from './serialize'
export * from './session'

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
  /** Boot the Stacks app into the session: config, models, jobs, framework helpers (default: true) */
  stacksPreload?: boolean
  /**
   * Speak the frame protocol on stdio instead of a prompt: requests in as JSON
   * lines, frames out. With `eval` or `print`, evaluate that once and exit.
   */
  serve?: boolean
  /** Evaluate a single expression and exit */
  eval?: string
  /** Evaluate and print a single expression, then exit */
  print?: string
  /** Also show the queries and log lines each line produced */
  verbose?: boolean
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

function buildBanner(info: TinkerSessionInfo): string {
  const lines = [
    '',
    `  \x1B[36mStacks Tinker\x1B[0m (Bun v${info.bun})`,
    info.booted
      ? '  Your app is booted: models, jobs, config and framework helpers are globals.'
      : '  Bare session: the app context is not booted.',
  ]
  for (const warning of info.warnings)
    lines.push(`  \x1B[33m${warning}\x1B[0m`)
  lines.push(
    '',
    '  \x1B[2mDeclarations persist between lines. dump(value) inspects, dd(value) inspects and stops.',
    '  .help for commands, .exit or Ctrl+D to leave.\x1B[0m',
    '',
    '',
  )
  return lines.join('\n')
}

/** Write to the terminal directly. The session captures `process.stdout`, so the REPL's own output must not go through it. */
function terminal(text: string, fd: 1 | 2 = 1): void {
  writeSync(fd, text)
}

/** Print a described value for a terminal. The inverse of `serialize`, lossy on purpose. */
export function renderValue(value: TinkerValue, indent = ''): string {
  const inner = `${indent}  `
  switch (value.t) {
    case 'undefined': return 'undefined'
    case 'null': return 'null'
    case 'boolean': return String(value.v)
    case 'number': return String(value.v)
    case 'bigint': return `${value.v}n`
    case 'string': return JSON.stringify(value.v) + (value.truncated ? ` ... ${value.truncated} more characters` : '')
    case 'symbol': return `Symbol(${value.v})`
    case 'function': return `[${value.kind === 'class' ? 'class' : 'Function'}: ${value.name}]`
    case 'date': return value.v ?? 'Invalid Date'
    case 'regexp': return value.v
    case 'url': return value.v
    case 'promise': return 'Promise {}'
    case 'bytes': return `${value.ctor}(${value.length}) <${value.hex}${value.length > 64 ? ' ...' : ''}>`
    case 'ref': return `[Circular *${value.id}]`
    case 'cut': return `[${value.ctor ?? 'Object'}]`
    case 'error': return value.stack ?? `${value.name}: ${value.message}`
    case 'array': {
      if (!value.items.length && !value.more)
        return `${value.ctor ? `${value.ctor} ` : ''}[]`
      const items = value.items.map(item => `${inner}${renderValue(item, inner)}`)
      if (value.more)
        items.push(`${inner}... ${value.more} more`)
      return `${value.ctor ? `${value.ctor} ` : ''}[\n${items.join(',\n')}\n${indent}]`
    }
    case 'set': {
      const items = value.items.map(item => `${inner}${renderValue(item, inner)}`)
      if (value.more)
        items.push(`${inner}... ${value.more} more`)
      return items.length ? `Set(${value.size}) {\n${items.join(',\n')}\n${indent}}` : 'Set(0) {}'
    }
    case 'map': {
      const entries = value.entries.map(([key, item]) => `${inner}${renderValue(key, inner)} => ${renderValue(item, inner)}`)
      if (value.more)
        entries.push(`${inner}... ${value.more} more`)
      return entries.length ? `Map(${value.size}) {\n${entries.join(',\n')}\n${indent}}` : 'Map(0) {}'
    }
    case 'object': {
      if (!value.entries.length && !value.more)
        return `${value.ctor ? `${value.ctor} ` : ''}{}`
      const entries = value.entries.map(([key, item]) => `${inner}${key}: ${renderValue(item, inner)}`)
      if (value.more)
        entries.push(`${inner}... ${value.more} more`)
      return `${value.ctor ? `${value.ctor} ` : ''}{\n${entries.join(',\n')}\n${indent}}`
    }
  }
}

function printFrame(frame: TinkerFrame, verbose: boolean): void {
  switch (frame.type) {
    case 'stdout':
      terminal(frame.text)
      break
    case 'stderr':
      terminal(frame.text, 2)
      break
    case 'dump':
      terminal(`${renderValue(frame.value)}\n`)
      break
    case 'query':
      if (verbose)
        terminal(`\x1B[2m  ${frame.durationMs ?? '?'}ms  ${frame.sql}\x1B[0m\n`, 2)
      break
    case 'log':
      if (verbose)
        terminal(`\x1B[2m  [${frame.level}] ${frame.message}\x1B[0m\n`, 2)
      break
  }
}

async function loadPreloads(modules: string[] | undefined, cwd: string): Promise<string[]> {
  const failed: string[] = []
  for (const mod of modules ?? []) {
    const name = mod.replace(/[@/\-.]/g, '_').replace(/^_+/, '')
    try {
      const specifier = mod.startsWith('.') ? resolve(cwd, mod) : mod
      ;(globalThis as Record<string, unknown>)[name] = await import(specifier)
    }
    catch (error) {
      failed.push(`${mod}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return failed
}

const INCOMPLETE = /Unexpected end of file|Unterminated|Expected "\}" but found end of file|Expected "\)" but found end of file|Expected "\]" but found end of file/

/** Whether a parse failure means "keep typing" rather than "this is wrong". */
export function isIncompleteSnippet(code: string, cwd: string): boolean {
  try {
    compileSnippet(code, cwd)
    return false
  }
  catch (error) {
    const messages = error instanceof AggregateError
      ? error.errors.map(item => String((item as { message?: unknown })?.message ?? item))
      : [String((error as { message?: unknown })?.message ?? error)]
    return messages.some(message => INCOMPLETE.test(message))
  }
}

/**
 * Start a Stacks tinker session.
 *
 * Boots the app in this process (config overrides, then models, jobs and
 * framework helpers as globals) and evaluates TypeScript against it. Without
 * `eval`, `print` or `serve` it is an interactive prompt whose declarations
 * persist from line to line.
 *
 * @example
 * ```ts
 * import { startTinker } from '@stacksjs/tinker'
 *
 * await startTinker()                                  // interactive
 * await startTinker({ print: 'await User.count()' })   // evaluate, print, exit
 * await startTinker({ serve: true })                   // speak the frame protocol on stdio
 * ```
 */
export async function startTinker(config: TinkerConfig = {}): Promise<{ exitCode: number }> {
  const cwd = config.cwd ?? process.cwd()
  const boot = config.stacksPreload !== false

  if (config.serve) {
    const once = config.eval ?? config.print
    const { ok } = await serveTinker({ cwd, boot, ...(once !== undefined ? { once } : {}) })
    return { exitCode: ok ? 0 : 1 }
  }

  const verbose = config.verbose === true
  const session = await createTinkerSession({ cwd, boot, onFrame: frame => printFrame(frame, verbose) })
  for (const failure of await loadPreloads(config.preload, session.info.cwd))
    terminal(`\x1B[33mpreload failed: ${failure}\x1B[0m\n`, 2)

  const report = (evaluation: TinkerEvaluation, print: boolean): void => {
    if (!evaluation.ok) {
      const thrown = evaluation.thrown
      terminal(`${thrown instanceof Error ? Bun.inspect(thrown, { colors: Boolean(process.stderr.isTTY) }) : `Uncaught ${Bun.inspect(thrown)}`}\n`, 2)
      return
    }
    if (print && evaluation.value !== undefined)
      terminal(`${Bun.inspect(evaluation.value, { colors: Boolean(process.stdout.isTTY), depth: 6 })}\n`)
  }

  if (config.eval !== undefined || config.print !== undefined) {
    for (const warning of session.info.warnings)
      terminal(`\x1B[33m${warning}\x1B[0m\n`, 2)
    const evaluation = await session.evaluate(config.print ?? config.eval ?? '')
    report(evaluation, config.print !== undefined)
    session.dispose()
    return { exitCode: evaluation.ok ? 0 : 1 }
  }

  if (config.banner !== false)
    terminal(buildBanner(session.info))

  const { createInterface } = await import('node:readline')
  const { Writable } = await import('node:stream')
  const output = new Writable({
    write(chunk, _encoding, callback) {
      terminal(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
      callback()
    },
  })
  const historySize = config.historySize ?? 5000
  const reader = createInterface({
    input: process.stdin,
    output,
    terminal: Boolean(process.stdin.isTTY),
    // readline wants newest first; the file is oldest first.
    history: readHistory(config).slice(-historySize).reverse(),
    historySize,
    prompt: '> ',
  })

  let buffer = ''
  let exitCode = 0
  reader.prompt()
  try {
    for await (const line of reader) {
      const trimmed = line.trim()
      if (!buffer && trimmed.startsWith('.')) {
        if (trimmed === '.exit')
          break
        if (trimmed === '.help')
          terminal('  .exit           leave\n  .clear          forget the history file\n  .help           this list\n  dump(v), dd(v)  inspect a value; dd also stops the line\n')
        else if (trimmed === '.clear')
          clearHistory(config)
        else
          terminal(`  unknown command ${trimmed}\n`)
        reader.prompt()
        continue
      }

      buffer = buffer ? `${buffer}\n${line}` : line
      if (!buffer.trim()) {
        buffer = ''
        reader.prompt()
        continue
      }
      if (isIncompleteSnippet(buffer, session.info.cwd)) {
        reader.setPrompt('... ')
        reader.prompt()
        continue
      }

      const code = buffer
      buffer = ''
      try {
        appendHistory(code.replace(/\n/g, ' '), config)
      }
      catch {
        // An unwritable history file is not a reason to refuse the line.
      }
      const evaluation = await session.evaluate(code)
      report(evaluation, true)
      exitCode = evaluation.ok ? 0 : exitCode
      reader.setPrompt('> ')
      reader.prompt()
    }
  }
  finally {
    reader.close()
    session.dispose()
  }

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
