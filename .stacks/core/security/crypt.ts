import { AES, enc } from 'crypto-js'

const passphrase = 'test'
// const passphrase = process.env.APP_KEY as string

function encryptString(message: string): string {
  return AES.encrypt(message, passphrase).toString()
}

function decryptString(encrypted: string): string {
  return AES.decrypt(encrypted, passphrase).toString(enc.Utf8)
}

export { encryptString, decryptString }
