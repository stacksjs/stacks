import { hashing } from '@stacksjs/config'
import md5 from 'crypto-js/md5'
import { Base64 } from 'js-base64'

interface MakeOptions {
  algorithm?: 'bcrypt' | 'base64' | 'argon2'
  type?: 'argon2id' | 'argon2i' | 'argon2d'
}

async function make(password: string, options?: MakeOptions): Promise<string> {
  if (options?.algorithm === 'argon2')
    return await argon2Encode(password, { type: 'argon2id' })
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

  const bcryptHash = await Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: hashing.bcrypt.cost,
  })

  return bcryptHash
}

export async function argon2Encode(
  password: string,
  options?: { type: 'argon2id' | 'argon2i' | 'argon2d' },
): Promise<string> {
  if (!hashing.argon2)
    throw new Error('Argon2 hashing is not configured')

  const argon2Hash = await Bun.password.hash(password, {
    algorithm: options?.type || 'argon2id',
    memoryCost: hashing.argon2.memory,
    timeCost: hashing.argon2.time,
  })

  return argon2Hash
}

export async function argon2Verify(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}

export async function bcryptVerify(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash)
}

export function base64Encode(password: string): string {
  return Base64.encode(password)
}

export function base64Verify(password: string, hash: string): boolean {
  return Base64.decode(hash) === password
}

export function md5Encode(password: string): CryptoJS.lib.WordArray {
  return md5(password)
}

export { make as makeHash, verify as verifyHash }
