import { getTypeName, toString } from './base'

export const isDef = <T = any>(val?: T): val is T => typeof val !== 'undefined'
export const isBoolean = (val: any): val is boolean => typeof val === 'boolean'
export const isFunction = <T extends Function> (val: any): val is T => typeof val === 'function'
export const isNumber = (val: any): val is number => typeof val === 'number'
export const isString = (val: unknown): val is string => typeof val === 'string'
export const isObject = (val: any): val is object => toString(val) === '[object Object]'
export const isWindow = (val: any): boolean => typeof window !== 'undefined' && toString(val) === '[object Window]'
export const isBrowser = typeof window !== 'undefined'
export const isServer = typeof document === 'undefined' // https://remix.run/docs/en/v1/pages/gotchas#typeof-window-checks
export const isMap = (val: any): val is Map<any, any> => toString(val) === '[object Map]'
export const isSet = (val: any): val is Set<any> => toString(val) === '[object Set]'
export const isPromise = <T = any>(val: any): val is Promise<T> => toString(val) === '[object Promise]'
export const isUndefined = (v: any) => getTypeName(v) === 'undefined'
export const isNull = (v: any) => getTypeName(v) === 'null'
export const isSymbol = (v: any) => getTypeName(v) === 'symbol'
export const isDate = (v: any) => getTypeName(v) === 'date'
export const isRegExp = (v: any) => getTypeName(v) === 'regexp'
export const isArray = (v: any) => getTypeName(v) === 'array'
export const isPrimitive = (v: any) => {
  const type = getTypeName(v)
  return type === 'null' || type === 'undefined' || type === 'string' || type === 'number' || type === 'boolean' || type === 'symbol'
}
export const isInteger = (v: any) => isNumber(v) && Number.isInteger(v)
export const isFloat = (v: any) => isNumber(v) && !Number.isInteger(v)
export const isPositive = (v: any) => isNumber(v) && v > 0
export const isNegative = (v: any) => isNumber(v) && v < 0
export const isEven = (v: any) => isNumber(v) && v % 2 === 0
export const isOdd = (v: any) => isNumber(v) && v % 2 !== 0
export const isEvenOrOdd = (v: any) => isNumber(v) && (v % 2 === 0 ? 'even' : 'odd')
export const isPositiveOrNegative = (v: any) => isNumber(v) && (v > 0 ? 'positive' : 'negative')
export const isIntegerOrFloat = (v: any) => isNumber(v) && (Number.isInteger(v) ? 'integer' : 'float')
