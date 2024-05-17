import { env } from '@stacksjs/env'
import aes from 'crypto-js/aes'
import utf8 from 'crypto-js/enc-utf8'

function encrypt(message: string): string {
  const passphrase = env.APP_KEY

  if (!passphrase) throw new Error('APP_KEY is not defined')

  return aes.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string): string {
  const passphrase = env.APP_KEY

  if (!passphrase) throw new Error('APP_KEY is not defined')

  return aes.decrypt(encrypted, passphrase).toString(utf8)
}

export { encrypt, decrypt }
