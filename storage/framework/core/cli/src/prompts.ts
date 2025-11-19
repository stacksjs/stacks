/**
 * Prompts module for CLI interactions
 */

import { createInterface } from 'node:readline'

interface ConfirmOptions {
  message: string
  initial?: boolean
}

interface TextOptions {
  message: string
  initial?: string
  placeholder?: string
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
  const suffix = defaultValue ? ' (Y/n)' : ' (y/N)'

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`${opts.message}${suffix} `, (answer) => {
      rl.close()

      const normalized = answer.toLowerCase().trim()
      if (!normalized) {
        resolve(defaultValue)
      }
      else if (normalized === 'y' || normalized === 'yes') {
        resolve(true)
      }
      else if (normalized === 'n' || normalized === 'no') {
        resolve(false)
      }
      else {
        resolve(defaultValue)
      }
    })
  })
}

/**
 * Simple text prompt
 */
async function text(options: TextOptions | string): Promise<string> {
  const opts = typeof options === 'string' ? { message: options } : options
  const placeholder = opts.placeholder || opts.initial || ''
  const suffix = placeholder ? ` (${placeholder})` : ''

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`${opts.message}${suffix}: `, (answer) => {
      rl.close()
      resolve(answer.trim() || opts.initial || '')
    })
  })
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

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('Select (number): ', (answer) => {
      rl.close()
      const index = Number.parseInt(answer.trim()) - 1
      if (index >= 0 && index < options.choices.length) {
        resolve(options.choices[index].value)
      }
      else {
        resolve(options.choices[options.initial ?? 0].value)
      }
    })
  })
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

  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('Select (e.g., 1,3,4): ', (answer) => {
      rl.close()
      const indices = answer.split(',').map(s => Number.parseInt(s.trim()) - 1)
      const selected = indices
        .filter(i => i >= 0 && i < options.choices.length)
        .map(i => options.choices[i].value)
      resolve(selected)
    })
  })
}

export const prompts = {
  text,
  confirm,
  select,
  multiselect,
}

// Also export individual functions
export { confirm, text, select, multiselect }
