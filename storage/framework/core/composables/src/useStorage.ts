import type { Ref } from '@stacksjs/stx'
import { ref, watch } from '@stacksjs/stx'

interface UseStorageSerializer<T> {
  read: (raw: string) => T
  write: (value: T) => string
}

interface UseStorageOptions<T> {
  serializer?: UseStorageSerializer<T>
}

/**
 * Reactive localStorage/sessionStorage wrapper.
 * Creates a stx ref that syncs with browser storage.
 *
 * @param key - Storage key
 * @param defaultValue - Default value when key doesn't exist
 * @param storage - Storage backend (defaults to localStorage)
 * @param options - Serializer options
 */
export function useStorage<T>(
  key: string,
  defaultValue: T,
  storage?: Storage,
  options?: UseStorageOptions<T>,
): Ref<T> {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)

  const serializer: UseStorageSerializer<T> = options?.serializer ?? {
    read: (raw: string): T => {
      try {
        return JSON.parse(raw) as T
      }
      catch {
        return raw as unknown as T
      }
    },
    write: (value: T): string => JSON.stringify(value),
  }

  // Read initial value from storage
  let initialValue = defaultValue
  if (store) {
    try {
      const raw = store.getItem(key)
      if (raw !== null) {
        initialValue = serializer.read(raw)
      }
    }
    catch {
      // Storage access may fail (e.g. private browsing)
    }
  }

  const data = ref<T>(initialValue)

  // Persist changes to storage
  watch(data, (val) => {
    if (!store) return
    try {
      if (val === null || val === undefined) {
        store.removeItem(key)
      }
      else {
        store.setItem(key, serializer.write(val))
      }
    }
    catch {
      // Storage write may fail (quota exceeded, private browsing)
    }
  })

  // Listen for storage events from other tabs
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== key || e.storageArea !== store) return
      if (e.newValue === null) {
        data.value = defaultValue
      }
      else {
        try {
          data.value = serializer.read(e.newValue)
        }
        catch {
          data.value = defaultValue
        }
      }
    })
  }

  return data
}
