import type { VineType } from '@stacksjs/types'

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
  addQuery(url: URL): void

  addBodies(params: any): void

  addParam(param: RouteParams): void

  get<T>(element: T): string | undefined

  header(element: string): string | number | boolean | null

  Header(element: string): string | number | boolean | null

  all(): RequestData

  validate(attributes: CustomAttributes): void

  has(element: string): boolean

  isEmpty(): boolean

  extractParamsFromRoute(routePattern: string, pathname: string): void

  getParam(key: string): number | string | null

  getParams(): RouteParams

  getParamAsInt(key: string): number | null
}
