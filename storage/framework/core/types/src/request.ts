import type { UserModelType } from '@stacksjs/orm'
import type { AuthToken, RouteParam, VineType } from '@stacksjs/types'
import type { UploadedFile } from '../../router/src/uploaded-file'

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

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'

export interface RequestInstance {
  query: RequestData
  params: RouteParams
  headers: any
  files: Record<string, UploadedFile | UploadedFile[]>

  addQuery: (url: URL) => void
  addBodies: (params: any) => void
  addParam: (param: RouteParam) => void
  addHeaders: (headerParams: Headers) => void
  addFiles: (files: Record<string, File | File[]>) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  file: (key: string) => UploadedFile | null
  getFiles: (key: string) => UploadedFile[]
  hasFile: (key: string) => boolean
  allFiles: () => Record<string, UploadedFile | UploadedFile[]>
  header: (element: string) => string | number | boolean | null
  Header: (element: string) => string | number | boolean | null
  getHeaders: () => any
  all: () => RequestData
  validate: (attributes?: CustomAttributes) => Promise<void>
  has: (element: string) => boolean
  isEmpty: () => boolean
  extractParamsFromRoute: (routePattern: string, pathname: string) => void
  getParam: <K extends string>(key: K) => K extends NumericField ? number : string
  route: (key: string) => number | string | null
  bearerToken: () => string | null | AuthToken
  getParams: () => RouteParams
  getParamAsInt: (key: string) => number | null
  browser: () => string | null
  ip: () => string | null
  ipForRateLimit: () => string | null
  getMethod: () => HttpMethod
  user: () => Promise<UserModelType | undefined>
}
