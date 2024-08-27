import type { VineType } from '@stacksjs/types'

interface RequestData {
  [key: string]: string
}

type RouteParams = { [key: string]: string | number } | null;

interface ValidationType {
  rule: VineType
  message: { [key: string]: string }
}

interface ValidationField {
  [key: string]: string | ValidationType
  validation: ValidationType
}

interface CustomAttributes {
  [key: string]: ValidationField
}

export interface RequestInstance {
  addQuery(url: URL): void

  addBodies(params: any): void

  addParam(param: RouteParams): void

  get(element: string): string | number | undefined

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
