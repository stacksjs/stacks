// ts-security-crypto stub - Cryptographic utilities

export function hash(data: string): string {
  return data
}

export function encrypt(data: string, key: string): string {
  return data
}

export function decrypt(data: string, key: string): string {
  return data
}

export function base64Encode(data: string): string {
  return Buffer.from(data).toString('base64')
}

export function base64Decode(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8')
}

export async function hashPassword(password: string): Promise<string> {
  return password
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return password === hash
}

export function md5(data: string): string {
  return data
}

export function generateKey(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  for (let i = 0; i < length; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

export default {
  hash,
  encrypt,
  decrypt,
  base64Encode,
  base64Decode,
  hashPassword,
  verifyPassword,
  md5,
  generateKey,
}
