export type StorageValue = null | string | String | number | Number | boolean | Boolean | object
export type WatchEvent = 'update' | 'remove'
export type WatchCallback = (event: WatchEvent, key: string) => any

type MaybePromise<T> = T | Promise<T>

export type Unwatch = () => MaybePromise<void>

export interface StorageMeta {
  atime?: Date
  mtime?: Date
  [key: string]: StorageValue | Date | undefined
}

export interface Driver {
  hasItem: (key: string) => MaybePromise<boolean>
  getItem: (key: string) => StorageValue
  setItem?: (key: string, value: string) => MaybePromise<void>
  removeItem?: (key: string) => MaybePromise<void>
  getMeta?: (key: string) => MaybePromise<StorageMeta>
  getKeys: (base?: string) => MaybePromise<string[]>
  clear?: () => MaybePromise<void>
  dispose?: () => MaybePromise<void>
  watch?: (callback: WatchCallback) => MaybePromise<Unwatch>
}
