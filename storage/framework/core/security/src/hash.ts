import { hashing } from '@stacksjs/config'
import { base64Decode, base64Encode, hashPassword, md5, verifyPassword } from 'ts-security-crypto'

interface MakeOptions {
  algorithm?: 'bcrypt' | 'base64' | 'argon2'
  type?: 'argon2id' | 'argon2i' | 'argon2d'
}

async function make(password: string, options?: MakeOptions): Promise<string> {
  if (options?.algorithm === 'argon2')
    return await argon2Encode(password, { type: options.type || 'argon2id' })
  if (options?.algorithm === 'bcrypt')
    return await bcryptEncode(password)
  if (options?.algorithm === 'base64')
    return base64Encode(password)

  throw new Error('Unsupported algorithm')
}

type Algorithm = 'bcrypt' | 'base64' | 'argon2'

async function verify(password: string, hash: string, algorithm?: Algorithm): Promise<boolean> {
  if (algorithm === 'argon2')
    return await argon2Verify(password, hash)
  if (algorithm === 'bcrypt')
    return await bcryptVerify(password, hash)
  if (algorithm === 'base64')
    return base64Verify(password, hash)

  throw new Error('Unsupported algorithm')
}

export async function bcryptEncode(password: string): Promise<string> {
  if (!hashing.bcrypt)
    throw new Error('Bcrypt hashing is not configured')

  return await hashPassword(password, {
    algorithm: 'bcrypt',
    cost: hashing.bcrypt.cost,
  })
}

export async function argon2Encode(
  password: string,
  options?: { type: 'argon2id' | 'argon2i' | 'argon2d' },
): Promise<string> {
  if (!hashing.argon2)
    throw new Error('Argon2 hashing is not configured')

  return await hashPassword(password, {
    algorithm: options?.type || 'argon2id',
    memoryCost: hashing.argon2.memory,
    timeCost: hashing.argon2.time,
  })
}

export async function argon2Verify(password: string, hash: string): Promise<boolean> {
  return await verifyPassword(password, hash)
}

export async function bcryptVerify(password: string, hash: string): Promise<boolean> {
  return await verifyPassword(password, hash)
}

export function base64Verify(password: string, hash: string): boolean {
  return base64Decode(hash) === password
}

export function md5Encode(password: string): string {
  return md5(password)
}

export { make as makeHash, verify as verifyHash, base64Encode }
