/**
 * STX Runtime Globals
 *
 * These functions are injected by the stx runtime into <script client> blocks.
 * This declaration file provides TypeScript types for them.
 */

// Signals
declare function state<T>(initial: T): {
  (): T
  set(value: T): void
  update(fn: (current: T) => T): void
  subscribe(cb: (value: T) => void): () => void
  _isSignal: true
}
declare function derived<T>(compute: () => T): { (): T, _isSignal: true }
declare function effect(fn: () => void | (() => void)): () => void
declare function batch(fn: () => void): void

// Lifecycle
declare function onMount(fn: () => void | (() => void)): void
declare function onDestroy(fn: () => void): void

// Stores
declare function defineStore<T>(id: string, setup: () => T, options?: { persist?: boolean | { pick?: string[], storage?: string, key?: string } }): () => T
declare function useStore<T = any>(id: string): T

// Composables
declare function useRef<T = HTMLElement>(name: string): { current: T | null }
declare function useLocalStorage<T>(key: string, defaultValue: T): { (): T, set(value: T): void }
declare function useWebSocket(url: string, options?: any): any
declare function useQuery<T>(url: string, options?: any): { data: any, loading: any, error: any, refetch: () => void }
declare function useMutation<T>(url: string, options?: any): { data: any, loading: any, error: any, mutate: (body: any) => Promise<T> }
declare function navigate(url: string): void
declare function useRoute(): { path: string, params: Record<string, string> }

// Vue compat
declare function ref<T>(value: T): { value: T }
declare function computed<T>(getter: () => T): { value: T }
declare function watch(source: any, callback: any): void

// Globals
declare const stx: { helpers: Record<string, any>, [key: string]: any }
