import type { Ref } from '@stacksjs/stx'
import { useStorage } from './useStorage'

interface UseSessionStorageSerializer<T> {
  read: (raw: string) => T
  write: (value: T) => string
}

interface UseSessionStorageOptions<T> {
  serializer?: UseSessionStorageSerializer<T>
}

/**
 * Reactive sessionStorage wrapper.
 * Convenience composable that delegates to useStorage with sessionStorage.
 *
 * @param key - Storage key
 * @param defaultValue - Default value when key doesn't exist
 * @param options - Serializer options
 */
export function useSessionStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseSessionStorageOptions<T>,
): Ref<T> {
  const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined
  return useStorage<T>(key, defaultValue, storage, options)
}
