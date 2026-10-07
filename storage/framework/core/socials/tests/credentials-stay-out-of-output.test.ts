import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * No credential value reaches a log line, a console line or an error message.
 *
 * One of stacksjs/stacks#2873's acceptance conditions, and the kind that is
 * true until somebody adds one debug line while chasing a failing post. A
 * token in a log file outlives the incident it was printed for, and a Bluesky
 * app password printed once is one an operator has to go and revoke.
 *
 * Scanned rather than asserted per call site: the point is that a new call
 * site cannot be the exception.
 */

const src = join(import.meta.dir, '..', 'src')
const command = join(import.meta.dir, '..', '..', 'buddy', 'src', 'commands', 'socials.ts')

/** The names a credential VALUE travels under in this package. */
const SECRETS = [
  'password',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'codeVerifier',
  'accessJwt',
  'refreshJwt',
  'access_token',
  'refresh_token',
  'client_secret',
  'code_verifier',
]

function sources(dir: string): Array<[string, string]> {
  const files: Array<[string, string]> = []
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push([path, readFileSync(path, 'utf8')])
    }
  }
  walk(dir)
  return files
}

/**
 * Every `log.*`, `console.*` and `new *Error(...)` argument list, as text.
 *
 * Crude on purpose: a scan that over-reports is one somebody reads, while a
 * precise one that misses a template literal is a scan that proves nothing.
 */
function outputCalls(source: string): string[] {
  return [...source.matchAll(/(?:log\.\w+|console\.\w+|new [A-Za-z]*Error)\(([\s\S]{0,400}?)\)\s*[,;)\n]/g)]
    .map(match => match[1]!)
}

describe('credentials stay out of the output', () => {
  const files = [...sources(src), [command, readFileSync(command, 'utf8')] as [string, string]]

  it('has sources to scan', () => {
    expect(files.length).toBeGreaterThan(8)
    expect(files.some(([path]) => path.endsWith('identities.ts'))).toBe(true)
    expect(files.some(([path]) => path.endsWith('socials.ts'))).toBe(true)
  })

  it('interpolates no credential into a log line, a console line or an error', () => {
    const leaks: string[] = []

    for (const [path, source] of files) {
      for (const call of outputCalls(source)) {
        // Only an INTERPOLATION can carry a value. `envName(..., 'password')`
        // and the string `'password'` are names, which is exactly what these
        // messages are supposed to carry instead.
        for (const interpolation of [...call.matchAll(/\$\{([^}]*)\}/g)].map(match => match[1]!)) {
          for (const secret of SECRETS) {
            if (new RegExp(`\\b${secret}\\b`).test(interpolation))
              leaks.push(`${path.split('/socials/')[1]}: \${${interpolation.trim()}}`)
          }
        }
      }
    }

    expect(leaks.sort()).toEqual([])
  })

  it('prints a token to stdout and only from the command that produces one', () => {
    // `buddy socials:authorize` has to hand the operator the token it just
    // obtained, and does it with `process.stdout.write` rather than `log`,
    // which writes to a file in production. Nothing else in the package may
    // write a credential anywhere.
    const writers = files.filter(([, source]) => source.includes('process.stdout.write'))
    expect(writers.map(([path]) => path.split('/').pop())).toEqual(['socials.ts'])
  })

  it('refuses a missing credential by naming the variable, not the value', () => {
    // The whole reason the error is safe to paste into an issue.
    const identities = readFileSync(join(src, 'identities.ts'), 'utf8')
    expect(identities).toContain('missing.map(field => envName(name, platform, field))')
    expect(identities).not.toMatch(/\$\{resolved\[/)
  })
})
