import aes from 'crypto-js/aes'
import utf8 from 'crypto-js/enc-utf8'

const passphrase = import.meta.env.APP_KEY as string

function encrypt(message: string): string {
  return aes.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string): string {
  return aes.decrypt(encrypted, passphrase).toString(utf8)
}

export { encrypt, decrypt }
