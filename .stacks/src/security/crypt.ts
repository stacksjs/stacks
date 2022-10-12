import { AES, enc } from 'crypto-js'

const passphrase = import.meta.env.APP_KEY as string

function encrypt(message: string): string {
  return AES.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string): string {
  return AES.decrypt(encrypted, passphrase).toString(enc.Utf8)
}

export { encrypt, decrypt }
