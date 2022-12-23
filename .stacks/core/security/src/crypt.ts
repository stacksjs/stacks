import aes from 'crypto-js/aes'
import utf8 from 'crypto-js/enc-utf8'

function encrypt(message: string): string {
  const passphrase = import.meta.env.APP_KEY as string
  return aes.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string): string {
  const passphrase = import.meta.env.APP_KEY as string
  return aes.decrypt(encrypted, passphrase).toString(utf8)
}

export { encrypt, decrypt }
