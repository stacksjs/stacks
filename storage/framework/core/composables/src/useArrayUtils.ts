import type { Ref } from '@stacksjs/stx'
import { computed, ref, watch } from '@stacksjs/stx'
import type { MaybeRef } from './_shared'
import { isRef, unref } from './_shared'

function watchSource<T>(source: MaybeRef<T[]>, cb: () => void): void {
  if (isRef(source))
    watch(source as Ref<T[]>, cb)
}

function getArray<T>(source: MaybeRef<T[]>): T[] {
  return unref(source) as T[]
}

/**
 * Reactive array difference: items in list but not in other.
 */
export function useArrayDifference<T>(
  list: MaybeRef<T[]>,
  other: MaybeRef<T[]>,
  compareFn?: (a: T, b: T) => boolean,
): Ref<T[]> {
  const result = ref<T[]>([]) as Ref<T[]>

  function update(): void {
    const arr = getArray(list)
    const otherArr = getArray(other)
    if (compareFn)
      result.value = arr.filter(item => !otherArr.some(o => compareFn(item, o)))
    else
      result.value = arr.filter(item => !otherArr.includes(item))
  }

  update()
  watchSource(list, update)
  watchSource(other, update)

  return result
}

/**
 * Reactive Array.every.
 */
export function useArrayEvery<T>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => boolean,
): Ref<boolean> {
  const result = ref(false)

  function update(): void {
    result.value = getArray(list).every(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.filter.
 */
export function useArrayFilter<T>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => boolean,
): Ref<T[]> {
  const result = ref<T[]>([]) as Ref<T[]>

  function update(): void {
    result.value = getArray(list).filter(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.find.
 */
export function useArrayFind<T>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => boolean,
): Ref<T | undefined> {
  const result = ref<T | undefined>(undefined) as Ref<T | undefined>

  function update(): void {
    result.value = getArray(list).find(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.findIndex.
 */
export function useArrayFindIndex<T>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => boolean,
): Ref<number> {
  const result = ref(-1)

  function update(): void {
    result.value = getArray(list).findIndex(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.includes.
 */
export function useArrayIncludes<T>(
  list: MaybeRef<T[]>,
  value: MaybeRef<T>,
  compareFn?: (a: T, b: T) => boolean,
): Ref<boolean> {
  const result = ref(false)

  function update(): void {
    const arr = getArray(list)
    const v = unref(value) as T
    if (compareFn)
      result.value = arr.some(item => compareFn(item, v))
    else
      result.value = arr.includes(v)
  }

  update()
  watchSource(list, update)
  if (isRef(value))
    watch(value as Ref<T>, update)

  return result
}

/**
 * Reactive Array.map.
 */
export function useArrayMap<T, U>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => U,
): Ref<U[]> {
  const result = ref<U[]>([]) as Ref<U[]>

  function update(): void {
    result.value = getArray(list).map(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.reduce.
 */
export function useArrayReduce<T, U>(
  list: MaybeRef<T[]>,
  fn: (accumulator: U, current: T, index: number, array: T[]) => U,
  initialValue: U,
): Ref<U> {
  const result = ref<U>(initialValue) as Ref<U>

  function update(): void {
    result.value = getArray(list).reduce(fn, initialValue)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive Array.some.
 */
export function useArraySome<T>(
  list: MaybeRef<T[]>,
  fn: (element: T, index: number, array: T[]) => boolean,
): Ref<boolean> {
  const result = ref(false)

  function update(): void {
    result.value = getArray(list).some(fn)
  }

  update()
  watchSource(list, update)

  return result
}

/**
 * Reactive unique array values.
 */
export function useArrayUnique<T>(
  list: MaybeRef<T[]>,
  compareFn?: (a: T, b: T) => boolean,
): Ref<T[]> {
  const result = ref<T[]>([]) as Ref<T[]>

  function update(): void {
    const arr = getArray(list)
    if (compareFn)
      result.value = arr.filter((item, index) => arr.findIndex(other => compareFn(item, other)) === index)
    else
      result.value = [...new Set(arr)]
  }

  update()
  watchSource(list, update)

  return result
}
