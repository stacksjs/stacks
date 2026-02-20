import type { Ref } from '@stacksjs/stx'
import { useStorage } from './useStorage'

interface UseLocalStorageSerializer<T> {
  read: (raw: string) => T
  write: (value: T) => string
}

interface UseLocalStorageOptions<T> {
  serializer?: UseLocalStorageSerializer<T>
}

/**
 * Reactive localStorage wrapper.
 * Convenience composable that delegates to useStorage with localStorage.
 *
 * @param key - Storage key
 * @param defaultValue - Default value when key doesn't exist
 * @param options - Serializer options
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options?: UseLocalStorageOptions<T>,
): Ref<T> {
  const storage = typeof localStorage !== 'undefined' ? localStorage : undefined
  return useStorage<T>(key, defaultValue, storage, options)
}
