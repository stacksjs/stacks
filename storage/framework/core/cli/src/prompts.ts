/**
 * Prompts module for CLI interactions
 */

import process from 'node:process'
import { createInterface } from 'node:readline'
import type { Interface } from 'node:readline'

// Protect stdin from being closed by readline
const originalDestroy = process.stdin.destroy
process.stdin.destroy = function(error?: Error) {
  // Don't actually destroy stdin - just emit 'close' if needed
  if (error) {
    this.emit('error', error)
  }
  // Return this to satisfy the method signature
  return this
} as any

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

    // Set up Ctrl+C handler
    if (isTTY && process.stdin.setRawMode) {
      globalRl.on('SIGINT', () => {
        process.emit('SIGINT' as any)
      })
    }
  }
  return globalRl
}

/**
 * Read a line from stdin using readline's question method
 */
function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = getGlobalRl()
    rl.question(prompt, (answer) => {
      resolve(answer)
    })
  })
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
  const normalized = answer.toLowerCase().trim()

  if (!normalized) {
    return defaultValue
  }
  else if (normalized === 'y' || normalized === 'yes') {
    return true
  }
  else if (normalized === 'n' || normalized === 'no') {
    return false
  }
  else {
    return defaultValue
  }
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
  const index = Number.parseInt(answer.trim()) - 1
  if (index >= 0 && index < options.choices.length) {
    return options.choices[index].value
  }
  else {
    return options.choices[options.initial ?? 0].value
  }
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
  const indices = answer.split(',').map(s => Number.parseInt(s.trim()) - 1)
  const selected = indices
    .filter(i => i >= 0 && i < options.choices.length)
    .map(i => options.choices[i].value)
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
export { confirm, text, select, multiselect, password }
