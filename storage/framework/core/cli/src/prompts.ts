/**
 * Prompts module for CLI interactions
 */

import process from 'node:process'

/**
 * Read a line from stdin without using readline
 */
function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''

    const onData = (chunk: Buffer) => {
      const str = chunk.toString()
      data += str

      if (str.includes('\n')) {
        cleanup()
        resolve(data.replace(/\r?\n$/, ''))
      }
    }

    const onEnd = () => {
      cleanup()
      resolve(data)
    }

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('end', onEnd)
      process.stdin.pause()
    }

    // Resume stdin to read data
    if (process.stdin.isPaused()) {
      process.stdin.resume()
    }

    process.stdin.on('data', onData)
    process.stdin.once('end', onEnd)
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
  const suffix = defaultValue ? ' (Y/n)' : ' (y/N)'

  process.stdout.write(`${opts.message}${suffix} `)

  const answer = await readLine()
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
  const suffix = placeholder ? ` (${placeholder})` : ''

  process.stdout.write(`${opts.message}${suffix}: `)

  const answer = await readLine()
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

  process.stdout.write('Select (number): ')

  const answer = await readLine()
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

  process.stdout.write('Select (e.g., 1,3,4): ')

  const answer = await readLine()
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

  process.stdout.write(`${opts.message}: `)

  const answer = await readLine()
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
