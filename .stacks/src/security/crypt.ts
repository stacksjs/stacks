import { AES, enc } from 'crypto-js'

function encryptString(message: string): string {
  return AES.encrypt(message, getPassphrase()).toString()
}

function decryptString(encrypted: string): string {
  return AES.decrypt(encrypted, getPassphrase()).toString(enc.Utf8)
}

function getPassphrase(): string {
  return import.meta.env.APP_KEY
}

export default { encryptString, decryptString }
