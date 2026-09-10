/**
 * Terminal primitives the CLI docs have described for a long time and this
 * package did not have: `table`, `progress`, `tasks`, `note`, `dump` / `dd`,
 * `echo`, `getTerminalSize` and `isInteractive` (stacksjs/stacks#2581).
 *
 * They are built rather than removed because each one is small, each one has an
 * obvious right answer, and a CLI framework that cannot print a table sends
 * every command author to write their own - which is how twelve slightly
 * different table renderers end up in one repository.
 *
 * Everything here degrades when stdout is not a TTY. A progress bar redrawing
 * itself into a CI log is unreadable, so it prints one line per meaningful step
 * instead.
 */

import process from 'node:process'
import { box, stripAnsi } from './utils'

/** Return to the start of the line and erase it. */
const CLEAR_LINE = '\r\u001B[2K'

/** The terminal's size, with the fallback a pipe or a CI runner gets. */
export function getTerminalSize(): { columns: number, rows: number } {
  // 80x24 is the VT100 default, and the size every tool assumes when it cannot
  // ask. `process.stdout.columns` is `undefined` when stdout is a pipe.
  return {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  }
}

/**
 * Whether it is worth prompting or animating.
 *
 * `CI` is checked as well as `isTTY`: some CI providers allocate a TTY, and a
 * spinner still has nobody watching it.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.CI
}

/** A short boxed aside. Sugar over `box`, which is what it should look like. */
export function note(message: string, title?: string): void {
  console.log(box(message, title === undefined ? {} : { title }))
}

/** JSON where it round-trips, `String()` otherwise (a Map, a circular ref). */
function format(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  }
  catch {
    return String(value)
  }
}

/** Print a value: strings as-is, everything else pretty-printed. */
export function echo(value: unknown): void {
  console.log(typeof value === 'string' ? value : format(value))
}

/**
 * Print a value with its label, for debugging.
 *
 * Goes to stderr, so a command whose stdout is being piped into something can
 * still be debugged without corrupting what the pipe receives.
 */
export function dump(value: unknown, label?: string): void {
  console.error(label === undefined ? format(value) : `${label}: ${format(value)}`)
}

/** `dump`, then exit non-zero. "Dump and die". */
export function dd(value: unknown, label?: string): never {
  dump(value, label)
  process.exit(1)
}

export interface TableColumn {
  /** Key to read from each row. */
  key: string
  /** Header text. Defaults to the key. */
  header?: string
  /** Column alignment. Defaults to left. */
  align?: 'left' | 'right'
}

export interface TableOptions {
  /** Columns to render, in order. Defaults to the union of every row's keys. */
  columns?: Array<TableColumn | string>
  /** Print the header row. Defaults to true. */
  header?: boolean
}

/**
 * Render rows as an aligned text table.
 *
 * Widths are measured with ANSI stripped, so a colored cell does not push its
 * column out by the length of the escape sequence - which is the bug every
 * hand-rolled table renderer has.
 */
export function table(rows: Array<Record<string, unknown>>, options: TableOptions = {}): string {
  const declared = options.columns ?? [...new Set(rows.flatMap(row => Object.keys(row)))]
  const columns: TableColumn[] = declared.map(entry => (typeof entry === 'string' ? { key: entry } : entry))

  if (columns.length === 0)
    return ''

  const cell = (row: Record<string, unknown>, column: TableColumn): string => {
    const value = row[column.key]
    return value === undefined || value === null ? '' : String(value)
  }

  const widths = columns.map((column) => {
    const header = options.header === false ? '' : column.header ?? column.key
    return Math.max(stripAnsi(header).length, ...rows.map(row => stripAnsi(cell(row, column)).length))
  })

  const pad = (text: string, width: number, align: TableColumn['align']): string => {
    const spare = Math.max(0, width - stripAnsi(text).length)
    return align === 'right' ? ' '.repeat(spare) + text : text + ' '.repeat(spare)
  }

  const lines: string[] = []
  if (options.header !== false) {
    lines.push(columns.map((column, i) => pad(column.header ?? column.key, widths[i]!, column.align)).join('  ').trimEnd())
    lines.push(columns.map((_, i) => '-'.repeat(widths[i]!)).join('  '))
  }
  for (const row of rows)
    lines.push(columns.map((column, i) => pad(cell(row, column), widths[i]!, column.align)).join('  ').trimEnd())

  return lines.join('\n')
}

export interface ProgressBar {
  /** Set the current value and redraw. */
  update: (value: number, tokens?: Record<string, string | number>) => void
  /** Add to the current value and redraw. */
  increment: (by?: number) => void
  /** Finish, leaving the cursor on a fresh line. */
  stop: (message?: string) => void
  readonly value: number
  readonly total: number
}

export interface ProgressOptions {
  total: number
  /** `{bar} {percentage} {value} {total}` plus any token passed to `update`. */
  format?: string
  /** Bar width in characters. Defaults to a third of the terminal. */
  width?: number
}

/**
 * A single-line progress bar.
 *
 * Non-interactive output does not redraw: it prints a line each time the
 * percentage crosses a whole 10%, so a CI log gets ten lines rather than one
 * per update or a screenful of escape codes.
 */
export function progress(options: ProgressOptions): ProgressBar {
  if (!Number.isFinite(options.total) || options.total <= 0)
    throw new TypeError(`progress() needs a positive total; got ${options.total}`)

  const format = options.format ?? '|{bar}| {percentage}% | {value}/{total}'
  const width = options.width ?? Math.max(10, Math.floor(getTerminalSize().columns / 3))
  const interactive = isInteractive()

  let current = 0
  let lastDecile = -1

  const render = (tokens: Record<string, string | number>): void => {
    const ratio = Math.min(1, current / options.total)
    const filled = Math.round(ratio * width)
    const values: Record<string, string | number> = {
      bar: '█'.repeat(filled) + '░'.repeat(width - filled),
      percentage: Math.round(ratio * 100),
      value: current,
      total: options.total,
      ...tokens,
    }
    const line = format.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match))

    if (interactive) {
      process.stdout.write(`${CLEAR_LINE}${line}`)
      return
    }

    // Ten lines in a CI log, not one per update.
    const decile = Math.floor(ratio * 10)
    if (decile > lastDecile) {
      lastDecile = decile
      console.log(line)
    }
  }

  const bar: ProgressBar = {
    update(value, tokens = {}) {
      current = Math.max(0, Math.min(options.total, value))
      render(tokens)
    },
    increment(by = 1) {
      bar.update(current + by)
    },
    stop(message) {
      if (interactive)
        process.stdout.write(CLEAR_LINE)
      if (message)
        console.log(message)
      else if (interactive)
        process.stdout.write('\n')
    },
    get value() {
      return current
    },
    get total() {
      return options.total
    },
  }

  return bar
}

export interface TaskDefinition {
  title: string
  task: () => unknown | Promise<unknown>
  /** Skip this task, optionally saying why. */
  skip?: () => boolean | string
}

export interface TaskOutcome {
  title: string
  status: 'done' | 'skipped' | 'failed'
  /** Present only for `failed`. */
  error?: Error
  durationMs: number
}

/**
 * Run tasks in order, printing each one's outcome.
 *
 * Sequential on purpose: the titles are a narration, and a narration whose
 * lines arrive out of order is worse than no narration. Something that wants
 * concurrency wants `Promise.all` and its own reporting.
 *
 * Stops at the first failure and rethrows, because a task list is a procedure -
 * "build" after a failed "install" would fail differently and confusingly.
 */
export async function tasks(definitions: TaskDefinition[]): Promise<TaskOutcome[]> {
  const outcomes: TaskOutcome[] = []

  for (const definition of definitions) {
    const startedAt = Date.now()
    const skip = definition.skip?.()

    if (skip) {
      console.log(`- ${definition.title}${typeof skip === 'string' ? ` (${skip})` : ''}`)
      outcomes.push({ title: definition.title, status: 'skipped', durationMs: 0 })
      continue
    }

    try {
      await definition.task()
      console.log(`✓ ${definition.title}`)
      outcomes.push({ title: definition.title, status: 'done', durationMs: Date.now() - startedAt })
    }
    catch (error) {
      console.log(`✗ ${definition.title}`)
      outcomes.push({
        title: definition.title,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - startedAt,
      })
      throw error
    }
  }

  return outcomes
}
