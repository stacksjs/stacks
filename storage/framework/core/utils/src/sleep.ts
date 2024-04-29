/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Pauses execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to pause execution.
 * @returns A promise that resolves after the specified delay.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Pauses execution until a specified condition is met.
 * @param condition The condition to wait for.
 * @param interval The interval at which to check the condition, in milliseconds. Defaults to 1000.
 * @returns A promise that resolves when the condition is met.
 */
export function waitUntil(
  condition: () => boolean,
  interval = 1000,
): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (condition()) {
        clearInterval(check)
        resolve()
      }
    }, interval)
  })
}

/**
 * Pauses execution while a specified condition is met.
 * @param condition The condition to wait while.
 * @param interval The interval at which to check the condition, in milliseconds. Defaults to 1000.
 * @returns A promise that resolves when the condition is no longer met.
 */
export function waitWhile(
  condition: () => boolean,
  interval = 1000,
): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (!condition()) {
        clearInterval(check)
        resolve()
      }
    }, interval)
  })
}
