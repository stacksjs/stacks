import type { RequestInstance } from '@stacksjs/types'

/** Reads one scalar dashboard input value through the native request bag. */
export function dashboardRequestValue(
  request: RequestInstance,
  key: string,
  fallback = '',
): string {
  const value = request.get<unknown>(key, fallback)
  if (Array.isArray(value))
    return value.length > 0 ? String(value[0]).trim() : fallback
  return value == null ? fallback : String(value).trim()
}
