/**
 * Prompts module for CLI interactions
 */

import process from 'node:process'
import { createInterface } from 'node:readline'
import type { Interface } from 'node:readline'

// Protect stdin from being closed by readline
const _originalDestroy = process.stdin.destroy
process.stdin.destroy = function(this: any, error?: Error) {
  if (error) {
    this.emit('error', error)
  }
  return this
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n')
  process.exit(130) // Standard exit code for SIGINT
})

// Single global readline interface that we reuse
let globalRl: Interface | null = null

function getGlobalRl(): Interface {
  if (!globalRl) {
    // Detect if we're in a TTY
    const isTTY = process.stdin.isTTY && process.stdout.isTTY

    globalRl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: isTTY,
    })

    // Set up Ctrl+C handler (only attach when stdin is a TTY)
    if (isTTY && typeof process.stdin.setRawMode === 'function') {
      globalRl.on('SIGINT', () => {
        process.emit('SIGINT')
      })
    }

    // Drop the cached interface once it closes. It was previously kept
    // forever, so the SECOND prompt in a process whose stdin had reached EOF
    // called question() on a closed interface and threw ERR_USE_AFTER_CLOSE
    // from deep inside node:readline. Commands that ask more than one
    // question (migrate asks about a missing database, then about applying
    // destructive changes) hit this as soon as input ran out. Letting the
    // next call build a fresh interface turns that into a clean EOF, which
    // the close handler in readLine() resolves as an empty answer.
    globalRl.once('close', () => {
      globalRl = null
    })
  }
  return globalRl
}

/**
 * Sentinel for "stdin ended before an answer arrived".
 *
 * This has to be distinguishable from an empty line. A confirm with
 * `initial: true` maps an empty answer to YES, so collapsing EOF into `''`
 * would make an unattended process silently answer yes to a question it never
 * displayed to anybody. That is fine for "press enter to accept the default"
 * and very much not fine for "shall I create this database?".
 */
const EOF = Symbol('stdin-eof')

function readLineOrEof(prompt: string): Promise<string | typeof EOF> {
  return new Promise((resolve) => {
    const rl = getGlobalRl()
    let settled = false

    const finish = (answer: string | typeof EOF) => {
      if (settled)
        return
      settled = true
      rl.off('close', onClose)
      resolve(answer)
    }

    // Without this, a question that is pending when stdin reaches EOF never
    // settles and the process hangs forever: `rl.question`'s callback is only
    // invoked for a completed line, and `process.stdin.destroy` is neutered
    // above. That bites whenever stdin is a TTY at guard time but closes
    // afterwards, e.g. an SSH connection dropping, the terminal window being
    // closed, or a parent process exiting. Treat EOF as an empty answer, which
    // every caller already handles as "take the default / cancel".
    const onClose = () => finish(EOF)

    rl.once('close', onClose)

    try {
      rl.question(prompt, finish)
    }
    catch {
      // The interface was already closed (stdin at EOF). Report EOF rather
      // than propagating ERR_USE_AFTER_CLOSE up through every caller.
      finish(EOF)
    }
  })
}

/**
 * Read a line, treating EOF as an empty answer. Existing behaviour: callers
 * that only ever wanted "the default" on end-of-input keep getting it.
 */
async function readLine(prompt: string): Promise<string> {
  const answer = await readLineOrEof(prompt)
  return answer === EOF ? '' : answer
}

/** Interpret a raw confirm answer. Empty means "take the default". */
function normalizeConfirm(answer: string, defaultValue: boolean): boolean {
  const normalized = answer.toLowerCase().trim()
  if (!normalized)
    return defaultValue
  if (normalized === 'y' || normalized === 'yes')
    return true
  if (normalized === 'n' || normalized === 'no')
    return false
  return defaultValue
}

/**
 * Confirm that reports `null` when stdin ended without an answer, instead of
 * silently returning the default. Use this for any question whose "yes" has
 * side effects the user cannot easily undo.
 */
async function confirmOrNull(options: ConfirmOptions | string): Promise<boolean | null> {
  const opts = typeof options === 'string' ? { message: options } : options
  const defaultValue = opts.initial ?? false
  const suffix = defaultValue ? ' (Y/n) ' : ' (y/N) '

  const answer = await readLineOrEof(`${opts.message}${suffix}`)
  if (answer === EOF)
    return null

  return normalizeConfirm(answer, defaultValue)
}

interface ConfirmOptions {
  message: string
  initial?: boolean
}

interface TextOptions {
  message: string
  initial?: string
  placeholder?: string
  validate?: (value: string) => boolean | string
}

interface PasswordOptions {
  message: string
  validate?: (value: string) => boolean | string
}

interface SelectOptions {
  message: string
  choices: Array<{ value: any, label: string }>
  initial?: number
}

/**
 * Simple confirm prompt
 */
async function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { message: options } : options
  const defaultValue = opts.initial ?? false
  const suffix = defaultValue ? ' (Y/n) ' : ' (y/N) '

  const answer = await readLine(`${opts.message}${suffix}`)
  return normalizeConfirm(answer, defaultValue)
}

/**
 * Simple text prompt
 */
async function text(options: TextOptions | string): Promise<string> {
  const opts = typeof options === 'string' ? { message: options } : options
  const placeholder = opts.placeholder || opts.initial || ''
  const suffix = placeholder ? ` (${placeholder}) ` : ' '

  const answer = await readLine(`${opts.message}${suffix}`)
  return answer.trim() || opts.initial || ''
}

/**
 * Simple select prompt (basic implementation)
 */
async function select(options: SelectOptions): Promise<any> {
  console.log(options.message)
  options.choices.forEach((choice, index) => {
    const marker = index === (options.initial ?? 0) ? '>' : ' '
    console.log(`${marker} ${index + 1}. ${choice.label}`)
  })

  const answer = await readLine('Select (number): ')
  const index = Number.parseInt(answer.trim(), 10) - 1
  const chosen = options.choices[index] ?? options.choices[options.initial ?? 0]
  if (!chosen) throw new Error('select prompt: no choices available')
  return chosen.value
}

/**
 * Multiselect prompt (basic implementation)
 */
async function multiselect(options: SelectOptions): Promise<any[]> {
  console.log(options.message)
  console.log('(Enter numbers separated by commas)')
  options.choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`)
  })

  const answer = await readLine('Select (e.g., 1,3,4): ')
  const indices = answer.split(',').map(s => Number.parseInt(s.trim(), 10) - 1)
  const selected: any[] = []
  for (const i of indices) {
    const choice = options.choices[i]
    if (choice) selected.push(choice.value)
  }
  return selected
}

/**
 * Password prompt (hidden input)
 */
async function password(options: PasswordOptions | string): Promise<string> {
  const opts = typeof options === 'string' ? { message: options } : options

  const answer = await readLine(`${opts.message} `)
  return answer.trim()
}

export const prompts = {
  text,
  confirm,
  select,
  multiselect,
  password,
}

// Also export individual functions
export { confirm, confirmOrNull, text, select, multiselect, password }
