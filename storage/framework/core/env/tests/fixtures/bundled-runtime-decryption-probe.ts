const [entry, ciphertext, privateKey] = process.argv.slice(2)
if (!entry || !ciphertext || !privateKey)
  throw new Error('entry, ciphertext, and private key are required')

const runtime = await import(entry)
process.env.DOTENV_PRIVATE_KEY = privateKey
process.env.RUNTIME_BUNDLED_SECRET = ciphertext
const decrypted = (runtime.env as unknown as Record<string, unknown>).RUNTIME_BUNDLED_SECRET

console.log(JSON.stringify({ decrypted }))
