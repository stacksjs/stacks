import { config } from '@stacksjs/config'
import { decrypt as cryptoDecrypt, encrypt as cryptoEncrypt } from 'ts-security-crypto'

async function encrypt(message: string, customPassphrase?: string): Promise<string> {
  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  const result = await cryptoEncrypt(message, passphrase)
  return result.encrypted
}

async function decrypt(encrypted: string, customPassphrase?: string): Promise<string> {
  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  return await cryptoDecrypt(encrypted, passphrase)
}

export { decrypt, encrypt }
