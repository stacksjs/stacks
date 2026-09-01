/**
 * Production code must not hand-parse an env file.
 *
 * A project's `.env.production` is normally ENCRYPTED — `buddy env:encrypt` is
 * the documented way to commit one — so reading it with `readFileSync` and a
 * regex yields ciphertext, not a value:
 *
 *     APP_URL="encrypted:v2:eyJ2IjoyLCJlcGsiOiJNQ293QlFZ…"
 *
 * The deploy did exactly that to resolve its domain, and used the capture in
 * preference to the correctly-decrypted `env.APP_URL` on the next line. Result:
 * `Deploying to "encrypted:v2:eyJ2Ijoy…"`, handed to `configureDomain` — the
 * DNS and TLS path. Even a plaintext value came through with its quotes
 * attached. stacksjs/stacks#2407.
 *
 * `resolveDeployEnvValues()` is the answer and already existed in the same
 * file: it decrypts, returns clean values, and reports loudly when a value
 * cannot be decrypted. This test keeps a hand-rolled parse from coming back.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const srcDir = join(import.meta.dir, '../src')

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir))
    return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist'].includes(entry.name))
        sourceFiles(path, out)
    }
    else if (entry.name.endsWith('.ts')) {
      out.push(path)
    }
  }

  return out
}

/**
 * Reading an env file to WRITE it back is legitimate — `env:encrypt` and
 * `env:set` have to. What this catches is reading one to pull a VALUE out,
 * which is where decryption gets skipped.
 */
const READS_AN_ENV_FILE = /readFileSync\(\s*[^)]*\.env(?:\.\w+)?['"`]?[^)]*\)[\s\S]{0,200}?\.match\(/

describe('env files in buddy source', () => {
  const files = sourceFiles(srcDir)

  it('finds the source', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('never regex-matches a value out of an env file', () => {
    const offenders = files
      .filter(file => READS_AN_ENV_FILE.test(readFileSync(file, 'utf8')))
      .map(file => file.slice(srcDir.length + 1))

    // If this fails, the value you want is almost certainly already available
    // from `resolveDeployEnvValues(environment)` (deploy.ts) or the `env`
    // proxy — both of which decrypt.
    expect(offenders).toEqual([])
  })
})
