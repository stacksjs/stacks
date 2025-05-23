import { config } from '@stacksjs/config'
import aes from 'crypto-js/aes'
import utf8 from 'crypto-js/enc-utf8'

function encrypt(message: string, customPassphrase?: string): string {
  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  return aes.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string, customPassphrase?: string): string {
  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  return aes.decrypt(encrypted, passphrase).toString(utf8)
}

export { decrypt, encrypt }
