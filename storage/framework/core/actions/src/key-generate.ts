import { readFileSync } from 'node:fs'
import { runCommand } from '@stacksjs/cli'
import { generateKeypair } from '@stacksjs/env'
import { projectPath } from '@stacksjs/path'
import { generateAppKey } from '@stacksjs/security'
import { existsSync } from '@stacksjs/storage'
import { setEnvValue } from '@stacksjs/utils'

// Bootstrap a `.env` from `.env.example` if the user hasn't created one yet —
// the rest of the action writes the freshly-generated keys into that file.
if (!existsSync('.env'))
  await runCommand('cp .env.example .env', { cwd: projectPath() })

// `APP_KEY` is the framework-wide symmetric secret (sessions, signed URLs,
// encrypted cookie payloads). Always regenerate when this action runs —
// callers invoke it explicitly via `buddy key:generate`.
await (setEnvValue as any)('APP_KEY', generateAppKey())

// `.env` encryption keypair (stacksjs/stacks#1053). dotenvx-style:
//   - DOTENV_PUBLIC_KEY  → embedded in .env, used by `env:set` / `env:encrypt`
//     to encrypt new values
//   - DOTENV_PRIVATE_KEY → kept in .env.keys (or platform secret manager in
//     serverless) and used by the runtime parser to decrypt at boot
//
// Idempotent — skip regeneration when both keys already exist so callers can
// run `key:generate` to refresh APP_KEY without invalidating their encrypted
// .env values (which would lose every secret on the file).
const envText = (() => {
  try { return readFileSync(projectPath('.env'), 'utf-8') }
  catch { return '' }
})()

const hasPublic = /^DOTENV_PUBLIC_KEY=.+$/m.test(envText)
const hasPrivate = /^DOTENV_PRIVATE_KEY=.+$/m.test(envText)
if (!hasPublic || !hasPrivate) {
  const { publicKey, privateKey } = generateKeypair()
  if (!hasPublic) await (setEnvValue as any)('DOTENV_PUBLIC_KEY', publicKey)
  if (!hasPrivate) await (setEnvValue as any)('DOTENV_PRIVATE_KEY', privateKey)
}
