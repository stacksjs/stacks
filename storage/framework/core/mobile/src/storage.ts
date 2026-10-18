/** The named SDK storage adapter; conditional writes never use a web fallback. */
import { storage as craftStorage } from 'craft-native/mobile'
import { afterBridge, craftRoot } from './bridge'
import type { StorageApi } from './types'

function supportsCompareAndSet(): boolean {
  return craftRoot()?.capabilities?.storageCompareAndSet === true && craftStorage.supportsCompareAndSet?.() === true
}

function supportsSetIfAbsent(): boolean {
  return craftRoot()?.capabilities?.storageSetIfAbsent === true && craftStorage.supportsSetIfAbsent?.() === true
}

export const storage: StorageApi = {
  supportsCompareAndSet,
  supportsSetIfAbsent,
  get: <T = unknown>(key: string) => afterBridge(() => craftStorage.get<T>(key)),
  set: (key, value) => afterBridge(() => craftStorage.set(key, value)),
  remove: key => afterBridge(() => craftStorage.remove(key)),
  clear: () => afterBridge(() => craftStorage.clear()),
  keys: () => afterBridge(() => craftStorage.keys()),
  setIfAbsent: (key, value) => afterBridge(() => {
    if (!supportsSetIfAbsent())
      throw Object.assign(new Error('This host or adapter cannot create storage atomically'), { code: 'STORAGE_SET_IF_ABSENT_UNSUPPORTED' })
    return craftStorage.setIfAbsent(key, value)
  }),
  compareAndSet: (key, expectedValue, nextValue) => afterBridge(() => {
    if (!supportsCompareAndSet())
      throw Object.assign(new Error('This host or adapter cannot compare storage atomically'), { code: 'STORAGE_COMPARE_AND_SET_UNSUPPORTED' })
    return craftStorage.compareAndSet(key, expectedValue, nextValue)
  }),
}
