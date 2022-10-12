import AES from 'crypto-js/aes'
import encUtf8 from 'crypto-js/enc-utf8'

const passphrase = import.meta.env.APP_KEY as string

function encrypt(message: string): string {
  return AES.encrypt(message, passphrase).toString()
}

function decrypt(encrypted: string): string {
  return AES.decrypt(encrypted, passphrase).toString(encUtf8)
}

export { encrypt, decrypt }
