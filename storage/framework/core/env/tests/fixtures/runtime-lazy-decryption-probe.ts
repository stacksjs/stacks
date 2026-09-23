const [entry, ciphertext, privateKey] = process.argv.slice(2)
if (!entry || !ciphertext || !privateKey)
  throw new Error('entry, ciphertext, and private key are required')

const runtime = await import(entry)
const supportLoaded = () => Object.keys(import.meta.require.cache).some(modulePath =>
  /\/core\/env\/(?:src|dist)\/(?:crypto|parser|plaintext-env|plugin)\.(?:ts|js)$/.test(modulePath),
)
const supportLoadedBeforeRead = supportLoaded()

process.env.DOTENV_PRIVATE_KEY = privateKey
process.env.RUNTIME_LAZY_SECRET = ciphertext
const decrypted = (runtime.env as unknown as Record<string, unknown>).RUNTIME_LAZY_SECRET

console.log(JSON.stringify({
  supportLoadedBeforeRead,
  supportLoadedAfterRead: supportLoaded(),
  decrypted,
}))
