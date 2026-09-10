import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * `buddy deploy` must read the cloud config through `loadTsCloudConfig`, never
 * through the statically imported `cloud` section (stacksjs/stacks#685).
 *
 * Two different problems make the static import unable to answer:
 *
 * 1. **It is a snapshot.** `@stacksjs/config` exports each section as a `let`
 *    refreshed ONCE when the user's config files finish loading at CLI boot.
 *    `buddy deploy` loads the target environment's decrypted secrets into
 *    `process.env` long after that, and `config/cloud.ts` reads `env.*` at
 *    module scope - so the section still describes the environment the CLI
 *    happened to start in.
 *
 * 2. **It is not the same shape.** The merged section carries `infrastructure`,
 *    `sites` and `tenants`, and `infrastructure.dns.hostedZoneId` is undefined
 *    even when `config/cloud.ts` sets it. There is no `mode` key at all.
 *
 * Both reads that existed failed silently rather than loudly: `fallbackMode`
 * was always `'server'`, and `hostedZoneId` fell through to a hardcoded literal
 * that is stacksjs.com's zone - writing another project's DNS zone into this
 * project's CloudFormation template.
 *
 * `loadTsCloudConfig` cache-busts the import so the module re-evaluates against
 * the environment that was just loaded. It is the only correct way in.
 */

const deploySource = readFileSync(join(dirname(import.meta.dir), 'src/commands/deploy.ts'), 'utf8')

/** Source with comments removed, so prose about a symbol is not read as a use. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

describe('deploy reads the cloud config freshly', () => {
  const code = withoutComments(deploySource)

  it('does not import the `cloud` section from @stacksjs/config', () => {
    // The import is the whole risk: with the binding in scope, reaching for it
    // is the obvious thing to do and gives a wrong answer that never throws.
    const configImports = code.match(/import \{[^}]*\} from '@stacksjs\/config'/g) ?? []
    expect(configImports.length).toBeGreaterThan(0)

    for (const line of configImports)
      expect(line).not.toMatch(/\bcloud\b/)
  })

  it('never falls back to a hardcoded hosted zone id', () => {
    // A wrong zone id does not fail. CloudFormation writes records into
    // whatever zone it is handed, so a guess is discovered from someone else's
    // DNS rather than from an error.
    expect(code).not.toMatch(/Z[A-Z0-9]{10,}/)
  })

  it('still uses loadTsCloudConfig, which is what makes the read fresh', () => {
    expect(code).toMatch(/loadTsCloudConfig\(/)
  })
})
