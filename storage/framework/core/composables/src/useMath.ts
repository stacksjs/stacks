import type { Ref } from '@stacksjs/stx'
import { computed, ref } from '@stacksjs/stx'

type MaybeRef<T> = T | Ref<T>

function unref<T>(val: MaybeRef<T>): T {
  if (val && typeof val === 'object' && 'value' in val && 'subscribe' in val) {
    return (val as Ref<T>).value
  }
  return val as T
}

export function useAbs(value: MaybeRef<number>): Ref<number> {
  return computed(() => Math.abs(unref(value)))
}

export function useAverage(...args: MaybeRef<number>[]): Ref<number> {
  return computed(() => {
    const values = args.map(unref)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
  })
}

export function useCeil(value: MaybeRef<number>): Ref<number> {
  return computed(() => Math.ceil(unref(value)))
}

export function useClamp(value: MaybeRef<number>, min: MaybeRef<number>, max: MaybeRef<number>): Ref<number> {
  return computed(() => Math.min(unref(max), Math.max(unref(min), unref(value))))
}

export function useFloor(value: MaybeRef<number>): Ref<number> {
  return computed(() => Math.floor(unref(value)))
}

export function useMax(...args: MaybeRef<number>[]): Ref<number> {
  return computed(() => Math.max(...args.map(unref)))
}

export function useMin(...args: MaybeRef<number>[]): Ref<number> {
  return computed(() => Math.min(...args.map(unref)))
}

export function usePrecision(value: MaybeRef<number>, digits: MaybeRef<number> = 0): Ref<number> {
  return computed(() => Number(unref(value).toFixed(unref(digits))))
}

export function useRound(value: MaybeRef<number>): Ref<number> {
  return computed(() => Math.round(unref(value)))
}

export function useSum(...args: MaybeRef<number>[]): Ref<number> {
  return computed(() => args.map(unref).reduce((a, b) => a + b, 0))
}

export function useTrunc(value: MaybeRef<number>): Ref<number> {
  return computed(() => Math.trunc(unref(value)))
}

export function logicNot(value: MaybeRef<boolean>): Ref<boolean> {
  return computed(() => !unref(value))
}

export function logicOr(...args: MaybeRef<boolean>[]): Ref<boolean> {
  return computed(() => args.some(a => unref(a)))
}

export const or = logicOr

export function and(...args: MaybeRef<boolean>[]): Ref<boolean> {
  return computed(() => args.every(a => unref(a)))
}
