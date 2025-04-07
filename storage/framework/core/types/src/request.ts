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

export interface RequestInstance {
  addQuery: (url: URL) => void

  addBodies: (params: any) => void

  addParam: (param: RouteParam) => void

  get: <T>(element: string, defaultValue?: T) => T

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
