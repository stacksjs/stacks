import { toString } from '@stacksjs/strings'
import { getTypeName } from '@stacksjs/types'

export function isDef<T = any>(val?: T): val is T {
  return typeof val !== 'undefined'
}

export function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean'
}

// eslint-disable-next-line ts/no-unsafe-function-type
export function isFunction<T extends Function>(val: unknown): val is T {
  return typeof val === 'function'
}

export function isNumber(val: unknown): val is number {
  return typeof val === 'number'
}

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function isObject(val: unknown): val is object {
  return toString(val) === '[object Object]'
}

export function isWindow(val: unknown): boolean {
  return typeof window !== 'undefined' && toString(val) === '[object Window]'
}

export const isBrowser: boolean = typeof window !== 'undefined'

export const isServer: boolean = typeof document === 'undefined' // https://remix.run/docs/en/v1/pages/gotchas#typeof-window-checks

export function isMap(val: unknown): val is Map<any, any> {
  return toString(val) === '[object Map]'
}

export function isSet(val: unknown): val is Set<any> {
  return toString(val) === '[object Set]'
}

export function isPromise<T = any>(val: unknown): val is Promise<T> {
  return toString(val) === '[object Promise]'
}

export function isUndefined(v: unknown): boolean {
  return getTypeName(v) === 'undefined'
}

export function isNull(v: unknown): boolean {
  return getTypeName(v) === 'null'
}

export function isSymbol(v: unknown): boolean {
  return getTypeName(v) === 'symbol'
}

export function isDate(v: unknown): boolean {
  return getTypeName(v) === 'date'
}

export function isRegExp(v: unknown): boolean {
  return getTypeName(v) === 'regexp'
}

export function isArray(v: unknown): boolean {
  return getTypeName(v) === 'array'
}

export function isPrimitive(v: unknown): boolean {
  const type = getTypeName(v)
  return (
    type === 'null'
    || type === 'undefined'
    || type === 'string'
    || type === 'number'
    || type === 'boolean'
    || type === 'symbol'
  )
}

export function isInteger(v: unknown): boolean {
  return isNumber(v) && Number.isInteger(v)
}

export function isFloat(v: unknown): boolean {
  return isNumber(v) && !Number.isInteger(v)
}

export function isPositive(v: unknown): boolean {
  return isNumber(v) && v > 0
}

export function isNegative(v: unknown): boolean {
  return isNumber(v) && v < 0
}

export function isEven(v: unknown): boolean {
  return isNumber(v) && v % 2 === 0
}

export function isOdd(v: unknown): boolean {
  return isNumber(v) && v % 2 !== 0
}

export function isEvenOrOdd(v: unknown): 'even' | 'odd' {
  return isNumber(v) ? (v % 2 === 0 ? 'even' : 'odd') : 'odd'
}

export function isPositiveOrNegative(v: unknown): 'positive' | 'negative' {
  return isNumber(v) ? (v > 0 ? 'positive' : 'negative') : 'negative'
}

export function isIntegerOrFloat(v: unknown): 'integer' | 'float' {
  return isNumber(v) ? (Number.isInteger(v) ? 'integer' : 'float') : 'float'
}
