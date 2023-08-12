import bcryptjs from 'bcryptjs'
import { Base64 } from 'js-base64'
import md5 from 'crypto-js/md5'
import { hashing } from '@stacksjs/config'

async function make(password: string, algorithm = 'bcrypt') {
  if (algorithm === 'bcrypt')
    return bcryptEncode(password)

  if (algorithm === 'base64')
    return base64Encode(password)

  throw new Error('Unsupported algorithm')
}

async function verify(password: string, hash: string, algorithm = 'bcrypt') {
  if (algorithm === 'bcrypt')
    return bcryptVerify(password, hash)

  if (algorithm === 'base64')
    return base64Verify(password, hash)

  throw new Error('Unsupported algorithm')
}

async function bcryptEncode(password: string) {
  if (!hashing.bcrypt)
    throw new Error('Bcrypt hashing is not configured')

  const salt = bcryptjs.genSaltSync(hashing.bcrypt.rounds)
  const hash = await bcryptjs.hash(password, salt)

  return hash
}

async function bcryptVerify(password: string, hash: string) {
  return await bcryptjs.compare(password, hash)
}

function base64Encode(password: string) {
  return Base64.encode(password)
}

function base64Verify(password: string, hash: string) {
  return Base64.decode(hash) === password
}

function md5Encode(password: string) {
  return md5(password)
}

export { make as makeHash, verify as verifyHash, base64Encode, base64Verify, bcryptEncode, bcryptVerify, md5Encode }
