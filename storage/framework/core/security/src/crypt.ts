import { config } from '@stacksjs/config'
import { decrypt as cryptoDecrypt, encrypt as cryptoEncrypt } from 'ts-security-crypto'

/**
 * Strip the `base64:` prefix that `./buddy key:generate` writes into
 * APP_KEY. The prefix is a Laravel-compat marker — every passphrase
 * Stacks generates looks like `base64:<32 random bytes, base64-encoded>`.
 * The underlying `ts-security-crypto` passphrase is a string of any
 * shape, so passing the marker through verbatim worked but baked an
 * 8-byte fixed prefix into every PBKDF2 derivation and made
 * passphrases inconsistent with what other tooling (and the docs)
 * call the "key" (stacksjs/stacks#1861 M-10).
 */
function normalizePassphrase(passphrase: string): string {
  return passphrase.startsWith('base64:') ? passphrase.slice('base64:'.length) : passphrase
}

async function encrypt(message: string, customPassphrase?: string): Promise<string> {
  if (!message && message !== '') {
    throw new Error('encrypt() requires a string message')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  const result = await cryptoEncrypt(message, normalizePassphrase(passphrase))
  return result.encrypted
}

async function decrypt(encrypted: string, customPassphrase?: string): Promise<string> {
  if (!encrypted) {
    throw new Error('decrypt() requires a non-empty encrypted string')
  }

  const passphrase = customPassphrase || config.app.key

  if (!passphrase)
    throw new Error('APP_KEY is not defined')

  const normalized = normalizePassphrase(passphrase)
  try {
    return await cryptoDecrypt(encrypted, normalized)
  }
  catch (firstErr) {
    // Backward-compat: rows encrypted before stacksjs/stacks#1861 M-10
    // used the raw `base64:…` passphrase (prefix included), so fall
    // back to the un-normalized form once before giving up. Re-encrypting
    // those values from the application layer will silently migrate
    // them onto the new derivation.
    if (normalized !== passphrase) {
      try {
        return await cryptoDecrypt(encrypted, passphrase)
      }
      catch { /* fall through to the original error */ }
    }
    throw firstErr
  }
}

export { decrypt, encrypt }
