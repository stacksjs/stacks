/**
 * Spinner utilities for CLI with reactive terminal output
 */

export interface Spinner {
  start: (message?: string) => void
  stop: (message?: string) => void
  succeed: (message?: string) => void
  fail: (message?: string) => void
  update: (message: string) => void
  text: string
  isSpinning: boolean
}

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const isInteractive = process.stdout.isTTY && !process.env.CI

export function spinner(message?: string): Spinner {
  let currentMessage = message || ''
  let frameIndex = 0
  let intervalId: ReturnType<typeof setInterval> | null = null
  let isSpinning = false

  const clearLine = () => {
    if (isInteractive) {
      process.stdout.write('\r\x1b[K')
    }
  }

  const render = () => {
    if (!isInteractive) return
    clearLine()
    const frame = spinnerFrames[frameIndex]
    process.stdout.write(`${frame} ${currentMessage}`)
    frameIndex = (frameIndex + 1) % spinnerFrames.length
  }

  return {
    start(msg?: string) {
      if (msg) currentMessage = msg
      if (isSpinning) return

      isSpinning = true
      if (isInteractive) {
        render()
        intervalId = setInterval(render, 80)
      } else {
        // Non-interactive mode: just print the message
        if (currentMessage) console.log(`  ${currentMessage}`)
      }
    },

    stop(msg?: string) {
      isSpinning = false
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      clearLine()
      if (msg) console.log(msg)
    },

    update(msg: string) {
      currentMessage = msg
      if (!isInteractive && isSpinning) {
        console.log(`  ${msg}`)
      }
    },

    succeed(msg?: string) {
      const finalMsg = msg || currentMessage
      isSpinning = false
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      clearLine()
      console.log(`✓ ${finalMsg}`)
    },

    fail(msg?: string) {
      const finalMsg = msg || currentMessage
      isSpinning = false
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      clearLine()
      console.error(`✗ ${finalMsg}`)
    },

    get text() {
      return currentMessage
    },

    set text(value: string) {
      currentMessage = value
      if (isInteractive && isSpinning) {
        render()
      }
    },

    get isSpinning() {
      return isSpinning
    },
  }
}

/**
 * Run an async operation with a spinner
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  options?: { successMessage?: string; failMessage?: string }
): Promise<T> {
  const s = spinner(message)
  s.start()

  try {
    const result = await operation()
    s.succeed(options?.successMessage || message)
    return result
  } catch (error) {
    s.fail(options?.failMessage || `Failed: ${message}`)
    throw error
  }
}
