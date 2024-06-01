import { toString } from '@stacksjs/strings'
import { getTypeName } from '@stacksjs/types'

export function isDef<T = any>(val?: T): val is T {
  return typeof val !== 'undefined'
}

export function isBoolean(val: any): val is boolean {
  return typeof val === 'boolean'
}

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

export const isBrowser = typeof window !== 'undefined'

export const isServer = typeof document === 'undefined' // https://remix.run/docs/en/v1/pages/gotchas#typeof-window-checks

export function isMap(val: any): val is Map<any, any> {
  return toString(val) === '[object Map]'
}

export function isSet(val: any): val is Set<any> {
  return toString(val) === '[object Set]'
}

export function isPromise<T = any>(val: any): val is Promise<T> {
  return toString(val) === '[object Promise]'
}

export function isUndefined(v: any) {
  return getTypeName(v) === 'undefined'
}

export function isNull(v: any) {
  return getTypeName(v) === 'null'
}

export function isSymbol(v: any) {
  return getTypeName(v) === 'symbol'
}

export function isDate(v: any) {
  return getTypeName(v) === 'date'
}

export function isRegExp(v: any) {
  return getTypeName(v) === 'regexp'
}

export function isArray(v: any) {
  return getTypeName(v) === 'array'
}

export function isPrimitive(v: any) {
  const type = getTypeName(v)
  return (
    type === 'null' ||
    type === 'undefined' ||
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'symbol'
  )
}

export function isInteger(v: any) {
  return isNumber(v) && Number.isInteger(v)
}

export function isFloat(v: any) {
  return isNumber(v) && !Number.isInteger(v)
}

export function isPositive(v: any) {
  return isNumber(v) && v > 0
}

export function isNegative(v: any) {
  return isNumber(v) && v < 0
}

export function isEven(v: any) {
  return isNumber(v) && v % 2 === 0
}

export function isOdd(v: any) {
  return isNumber(v) && v % 2 !== 0
}

export function isEvenOrOdd(v: any) {
  return isNumber(v) && (v % 2 === 0 ? 'even' : 'odd')
}

export function isPositiveOrNegative(v: any) {
  return isNumber(v) && (v > 0 ? 'positive' : 'negative')
}

export function isIntegerOrFloat(v: any) {
  return isNumber(v) && (Number.isInteger(v) ? 'integer' : 'float')
}
