/** Secure native UUIDs through the named, browser-safe SDK adapter. */
import { crypto as craftCrypto } from 'craft-native/mobile'
import { afterBridge } from './bridge'
import type { CryptoApi } from './types'

export const crypto: CryptoApi = {
  randomUUID: () => afterBridge(() => craftCrypto.randomUUID()),
}
