import { AES, enc } from 'crypto-js'

function encryptString(message: string): string {
  return AES.encrypt(message, passphrase()).toString()
}

function decryptString(encrypted: string): string {
  return AES.decrypt(encrypted, passphrase()).toString(enc.Utf8)
}

function passphrase(): string {
  return import.meta.env.APP_KEY
}

export default { encryptString, decryptString }
