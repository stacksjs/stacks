import { toString } from '@stacksjs/strings'
import { getTypeName } from '@stacksjs/types'

export function isDef<T = any>(val?: T): val is T {
  return typeof val !== 'undefined'
}

export function isBoolean(val: any): val is boolean {
  return typeof val === 'boolean'
}

// eslint-disable-next-line ts/no-unsafe-function-type
export function isFunction<T extends Function>(val: any): val is T {
  return typeof val === 'function'
}

export function isNumber(val: any): val is number {
  return typeof val === 'number'
}

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function isObject(val: any): val is object {
  return toString(val) === '[object Object]'
}

export function isWindow(val: any): boolean {
  return typeof window !== 'undefined' && toString(val) === '[object Window]'
}

export const isBrowser: boolean = typeof window !== 'undefined'

export const isServer: boolean = typeof document === 'undefined' // https://remix.run/docs/en/v1/pages/gotchas#typeof-window-checks

export function isMap(val: any): val is Map<any, any> {
  return toString(val) === '[object Map]'
}

export function isSet(val: any): val is Set<any> {
  return toString(val) === '[object Set]'
}

export function isPromise<T = any>(val: any): val is Promise<T> {
  return toString(val) === '[object Promise]'
}

export function isUndefined(v: any): boolean {
  return getTypeName(v) === 'undefined'
}

export function isNull(v: any): boolean {
  return getTypeName(v) === 'null'
}

export function isSymbol(v: any): boolean {
  return getTypeName(v) === 'symbol'
}

export function isDate(v: any): boolean {
  return getTypeName(v) === 'date'
}

export function isRegExp(v: any): boolean {
  return getTypeName(v) === 'regexp'
}

export function isArray(v: any): boolean {
  return getTypeName(v) === 'array'
}

export function isPrimitive(v: any): boolean {
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

export function isInteger(v: any): boolean {
  return isNumber(v) && Number.isInteger(v)
}

export function isFloat(v: any): boolean {
  return isNumber(v) && !Number.isInteger(v)
}

export function isPositive(v: any): boolean {
  return isNumber(v) && v > 0
}

export function isNegative(v: any): boolean {
  return isNumber(v) && v < 0
}

export function isEven(v: any): boolean {
  return isNumber(v) && v % 2 === 0
}

export function isOdd(v: any): boolean {
  return isNumber(v) && v % 2 !== 0
}

export function isEvenOrOdd(v: any): 'even' | 'odd' {
  return isNumber(v) ? (v % 2 === 0 ? 'even' : 'odd') : 'odd'
}

export function isPositiveOrNegative(v: any): 'positive' | 'negative' {
  return isNumber(v) ? (v > 0 ? 'positive' : 'negative') : 'negative'
}

export function isIntegerOrFloat(v: any): 'integer' | 'float' {
  return isNumber(v) ? (Number.isInteger(v) ? 'integer' : 'float') : 'float'
}
