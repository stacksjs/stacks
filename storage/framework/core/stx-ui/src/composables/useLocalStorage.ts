/**
 * useLocalStorage Composable
 * Reactive localStorage with automatic serialization.
 */
import { ref, watch, onMounted } from 'vue'

export interface UseLocalStorageOptions<T> {
  /**
   * Custom serializer.
   */
  serializer?: {
    read: (raw: string) => T
    write: (value: T) => string
  }
  /**
   * Watch deep changes for objects/arrays.
   */
  deep?: boolean
  /**
   * Write initial value if key doesn't exist.
   */
  writeDefaults?: boolean
}

export interface UseLocalStorageReturn<T> {
  /**
   * Reactive state synced with localStorage.
   */
  state: ReturnType<typeof ref<T>>
  /**
   * Remove the item from localStorage and reset to default.
   */
  remove: () => void
}

const defaultSerializer = {
  read: <T>(raw: string): T => JSON.parse(raw),
  write: <T>(value: T): string => JSON.stringify(value),
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  options: UseLocalStorageOptions<T> = {}
): UseLocalStorageReturn<T> {
  const {
    serializer = defaultSerializer as UseLocalStorageOptions<T>['serializer'],
    deep = true,
    writeDefaults = true,
  } = options

  const state = ref<T>(defaultValue) as ReturnType<typeof ref<T>>

  function read(): T | null {
    if (typeof localStorage === 'undefined') return null

    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return null
      return serializer!.read(raw)
    } catch (err) {
      console.warn(`Failed to read localStorage key "${key}":`, err)
      return null
    }
  }

  function write(value: T) {
    if (typeof localStorage === 'undefined') return

    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, serializer!.write(value))
      }
    } catch (err) {
      console.warn(`Failed to write localStorage key "${key}":`, err)
    }
  }

  function remove() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
    state.value = defaultValue
  }

  // Watch for changes and sync to storage
  watch(
    state,
    (newValue) => {
      write(newValue)
    },
    { deep }
  )

  // Initialize on mount
  onMounted(() => {
    const stored = read()
    if (stored !== null) {
      state.value = stored
    } else if (writeDefaults) {
      write(defaultValue)
    }

    // Listen for storage events from other tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === key && e.newValue !== null) {
          try {
            state.value = serializer!.read(e.newValue)
          } catch {
            // Ignore parse errors
          }
        } else if (e.key === key && e.newValue === null) {
          state.value = defaultValue
        }
      })
    }
  })

  return {
    state,
    remove,
  }
}

// Convenience wrapper for simple string values
export function useLocalStorageString(key: string, defaultValue = '') {
  return useLocalStorage(key, defaultValue, {
    serializer: {
      read: (raw) => raw,
      write: (value) => value,
    },
  })
}

// Convenience wrapper for boolean values
export function useLocalStorageBoolean(key: string, defaultValue = false) {
  return useLocalStorage(key, defaultValue, {
    serializer: {
      read: (raw) => raw === 'true',
      write: (value) => String(value),
    },
  })
}

// Convenience wrapper for number values
export function useLocalStorageNumber(key: string, defaultValue = 0) {
  return useLocalStorage(key, defaultValue, {
    serializer: {
      read: (raw) => Number(raw),
      write: (value) => String(value),
    },
  })
}
