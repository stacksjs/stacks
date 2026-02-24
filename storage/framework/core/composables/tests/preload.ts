import { mock } from 'bun:test'

/**
 * Minimal but functional ref implementation for testing composables.
 * Supports subscribe/watch so composables that depend on reactivity work in tests.
 */
type Subscriber<T> = (_newVal: T, _oldVal: T) => void

function ref<T>(initial: T) {
  let _value = initial
  const subscribers = new Set<Subscriber<T>>()

  const r = {
    get value() {
      return _value
    },
    set value(newVal: T) {
      const oldVal = _value
      _value = newVal
      for (const sub of subscribers) {
        sub(newVal, oldVal)
      }
    },
    subscribe(fn: Subscriber<T>) {
      subscribers.add(fn)
      return () => { subscribers.delete(fn) }
    },
  }

  return r
}

function watch(source: any, cb: (newVal: any, oldVal: any) => void) {
  if (source && typeof source === 'object' && 'subscribe' in source) {
    const unsub = source.subscribe((newVal: any, oldVal: any) => {
      cb(newVal, oldVal)
    })
    return unsub
  }
  return () => {}
}

function computed(fn: () => any) {
  const r = ref(fn())
  return {
    get value() {
      return fn()
    },
    set value(_v: any) {
      // computed refs are read-only
    },
    subscribe: r.subscribe,
  }
}

// Mock @stacksjs/desktop to avoid the broken openDevWindow import
mock.module('@stacksjs/desktop', () => ({
  desktop: {},
  openDevWindow: () => {},
}))

// Mock @stacksjs/httx to avoid import issues
mock.module('@stacksjs/httx', () => ({
  HttxClient: class {
    request() { return Promise.resolve({ isOk: true, value: { data: null } }) }
  },
}))

// Mock @stacksjs/datetime to avoid import issues
mock.module('@stacksjs/datetime', () => ({
  format: (date: Date, _fmt: string) => date.toISOString(),
}))

// Mock @stacksjs/stx with functional reactivity primitives
mock.module('@stacksjs/stx', () => ({
  ref,
  watch,
  computed,
  onUnmounted: (_cb: () => void) => {},
}))
