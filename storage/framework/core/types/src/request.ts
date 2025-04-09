import type { RouteParam, VineType } from '@stacksjs/types'

export type * from '../../../types/requests'
interface RequestData {
  [key: string]: any
}

type RouteParams = { [key: string]: string | number } | null

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

type NumericField = 'id' | 'age' | 'count' | 'quantity' | 'amount' | 'price' | 'total' | 'score' | 'rating' | 'duration' | 'size' | 'weight' | 'height' | 'width' | 'length' | 'distance' | 'speed' | 'temperature' | 'volume' | 'capacity' | 'density' | 'pressure' | 'force' | 'energy' | 'power' | 'frequency' | 'voltage' | 'current' | 'resistance' | 'time' | 'date' | 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond' | 'microsecond' | 'nanosecond'

export interface RequestInstance {
  addQuery: (url: URL) => void

  addBodies: (params: any) => void

  addParam: (param: RouteParam) => void

  get: <K extends any>(element: string, defaultValue?: K extends NumericField ? number : K) => K extends NumericField ? number : K

  header: (element: string) => string | number | boolean | null

  Header: (element: string) => string | number | boolean | null

  all: () => RequestData

  validate: (attributes: CustomAttributes) => void

  has: (element: string) => boolean

  isEmpty: () => boolean

  extractParamsFromRoute: (routePattern: string, pathname: string) => void

  getParam: <T>(key: string) => T

  route: (key: string) => number | string | null

  getParams: () => RouteParams

  getParamAsInt: (key: string) => number | null

  browser: () => string | null

  ip: () => string | null

  ipForRateLimit: () => string | null
}
