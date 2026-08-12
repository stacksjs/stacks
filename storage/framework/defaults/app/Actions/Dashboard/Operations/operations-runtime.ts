import process from 'node:process'
import { AlertStore, ReleaseStore, resolveAuthEncryptionKey } from '@stacksjs/ts-cloud'
import { operationsControlPlane } from './control-plane'

export function releaseStore(): ReleaseStore {
  return new ReleaseStore(operationsControlPlane().store)
}

export function alertStore(): AlertStore {
  return new AlertStore(operationsControlPlane().store, { encryptionKey: resolveAuthEncryptionKey(process.cwd()) })
}
