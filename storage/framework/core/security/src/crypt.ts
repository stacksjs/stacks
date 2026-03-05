import { config } from '@stacksjs/config'
import { decrypt as cryptoDecrypt, encrypt as cryptoEncrypt } from 'ts-security-crypto'

async function encrypt(message: string, customPassphrase?: string): Promise<string> {
  if (!message && message !== '') {
    throw new Error('encrypt() requires a string message')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  const result = await cryptoEncrypt(message, passphrase)
  return result.encrypted
}

async function decrypt(encrypted: string, customPassphrase?: string): Promise<string> {
  if (!encrypted) {
    throw new Error('decrypt() requires a non-empty encrypted string')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  return await cryptoDecrypt(encrypted, passphrase)
}

export { decrypt, encrypt }
