import { generateKey } from 'ts-security-crypto'

export function generateAppKey(): string {
  return generateKey(32)
}
