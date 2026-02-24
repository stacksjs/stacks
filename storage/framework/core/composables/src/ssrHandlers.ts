type SSRHandler = (..._args: any[]) => any

const handlers = new Map<string, SSRHandler>()

/**
 * Get an SSR handler by key.
 */
export function getSSRHandler(key: string): SSRHandler | undefined {
  return handlers.get(key)
}

/**
 * Set an SSR handler by key.
 */
export function setSSRHandler(key: string, handler: SSRHandler): void {
  handlers.set(key, handler)
}

/**
 * Custom event name for storage events.
 */
export const customStorageEventName = 'stx-storage'
