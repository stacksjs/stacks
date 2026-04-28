import type { Ref } from '@stacksjs/stx'
import { onUnmounted, ref, watch } from '@stacksjs/stx'

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
    catch (err: unknown) {
      // Quota-exceeded and private-browsing errors are expected; log them
      // at warn level so the developer can spot persistent persistence
      // failures (e.g. an over-aggressive useStorage usage filling the
      // 5MB localStorage budget) without crashing the SPA. Other errors
      // (security violations, missing storage on SSR) used to fail
      // silently and leave the ref in inconsistent state.
      const name = (err as { name?: string })?.name ?? ''
      const msg = (err as { message?: string })?.message ?? String(err)
      if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.warn(`[useStorage] ${key}: storage quota exceeded — value not persisted.`)
      }
      else {
        // eslint-disable-next-line no-console
        console.warn(`[useStorage] ${key}: failed to persist value — ${msg}`)
      }
    }
  })

  // Listen for storage events from other tabs
  if (typeof window !== 'undefined') {
    const onStorageChange = (e: StorageEvent) => {
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
    }

    window.addEventListener('storage', onStorageChange)
    onUnmounted(() => window.removeEventListener('storage', onStorageChange))
  }

  return data
}
