import { getRandomValues } from 'node:crypto'
import base64 from 'crypto-js/enc-base64'
import utf8 from 'crypto-js/enc-utf8'

export function generateAppKey(): string {
  const random = getRandomValues(new Uint8Array(32))
  const encodedWord = utf8.parse(random.toString())
  const key = base64.stringify(encodedWord)

  return `base64:${key}`
}
