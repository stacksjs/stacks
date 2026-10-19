/**
 * App files that shadow a framework security default.
 *
 * `app/` wins resolution over `storage/framework/defaults/app/`, so a copied
 * `Middleware/Csrf.ts` keeps running the code it was copied from after the
 * framework fixes the default. These tests pin the check that says so at boot.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import {
  defaultFingerprint,
  describeShadowedSecurityDefaults,
  findShadowedSecurityDefaults,
  SECURITY_DEFAULT_FILES,
  SHADOWED_DEFAULT_REVIEW_MARKER,
  SHADOWED_DEFAULTS_ENV,
  warnShadowedSecurityDefaults,
} from '../src/shadowed-defaults'

let root: string
let appDir: string
let defaultsDir: string

function write(base: string, relative: string, contents: string): void {
  const file = join(base, relative)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

const CSRF = `export default new Middleware({ name: 'Csrf', handle() {} })\n`

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-shadowed-'))
  appDir = join(root, 'app')
  defaultsDir = join(root, 'defaults', 'app')
  mkdirSync(appDir, { recursive: true })
  mkdirSync(defaultsDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  delete process.env[SHADOWED_DEFAULTS_ENV]
})

describe('findShadowedSecurityDefaults', () => {
  test('an app without overrides has nothing to report', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([])
  })

  test('a byte-identical copy is reported as identical', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)
    write(appDir, 'Middleware/Csrf.ts', CSRF)

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([{
      path: 'Middleware/Csrf.ts',
      kind: 'identical',
      appFile: join(appDir, 'Middleware/Csrf.ts'),
      defaultFile: join(defaultsDir, 'Middleware/Csrf.ts'),
      fingerprint: defaultFingerprint(CSRF),
    }])
  })

  test('a differing copy is reported as modified', () => {
    write(defaultsDir, 'Actions/Auth/LoginAction.ts', 'export default { fixed: true }\n')
    write(appDir, 'Actions/Auth/LoginAction.ts', 'export default { fixed: false }\n')

    const [entry] = findShadowedSecurityDefaults(appDir, defaultsDir)
    expect(entry?.path).toBe('Actions/Auth/LoginAction.ts')
    expect(entry?.kind).toBe('modified')
  })

  test('a whitespace-only difference still counts as modified', () => {
    write(defaultsDir, 'Middleware/Auth.ts', CSRF)
    write(appDir, 'Middleware/Auth.ts', CSRF.replace('\n', '\r\n'))

    expect(findShadowedSecurityDefaults(appDir, defaultsDir).map(e => e.kind)).toEqual(['modified'])
  })

  test('a reviewed override is left out until the default changes', () => {
    const current = 'export default { version: 2 }\n'
    write(defaultsDir, 'Middleware/Cors.ts', current)
    write(appDir, 'Middleware/Cors.ts', `// ${SHADOWED_DEFAULT_REVIEW_MARKER} ${defaultFingerprint(current)}\nexport default { custom: true }\n`)

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([])

    // The framework fixes the default: the review no longer covers it.
    write(defaultsDir, 'Middleware/Cors.ts', 'export default { version: 3 }\n')
    expect(findShadowedSecurityDefaults(appDir, defaultsDir).map(e => e.kind)).toEqual(['modified'])
  })

  test('a file the framework does not ship is not a shadow', () => {
    write(appDir, 'Middleware/Csrf.ts', CSRF)

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([])
  })

  test('non-security overrides are ignored', () => {
    write(defaultsDir, 'Actions/Cms/PostIndexAction.ts', CSRF)
    write(appDir, 'Actions/Cms/PostIndexAction.ts', CSRF)

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([])
  })

  test('a directory where a file is expected is skipped, not thrown on', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)
    mkdirSync(join(appDir, 'Middleware/Csrf.ts'), { recursive: true })

    expect(findShadowedSecurityDefaults(appDir, defaultsDir)).toEqual([])
  })

  test('missing directories are not an error', () => {
    expect(findShadowedSecurityDefaults(join(root, 'nope'), join(root, 'nothing'))).toEqual([])
  })

  test('the security list names real framework defaults', async () => {
    const { existsSync } = await import('node:fs')
    const frameworkDefaults = join(import.meta.dir, '../../../defaults/app')
    // Helpers that may not exist on every release are allowed to be absent;
    // everything else in the list has to be a file the framework ships.
    const optional = new Set(['Actions/Auth/social-flow.ts'])
    const missing = SECURITY_DEFAULT_FILES.filter(file => !optional.has(file) && !existsSync(join(frameworkDefaults, file)))

    expect(missing).toEqual([])
    expect(new Set(SECURITY_DEFAULT_FILES).size).toBe(SECURITY_DEFAULT_FILES.length)
  })
})

describe('warnShadowedSecurityDefaults', () => {
  test('warns once with both kinds described', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)
    write(appDir, 'Middleware/Csrf.ts', CSRF)
    write(defaultsDir, 'Actions/Auth/LoginAction.ts', 'a\n')
    write(appDir, 'Actions/Auth/LoginAction.ts', 'b\n')
    const messages: string[] = []

    const found = warnShadowedSecurityDefaults({ appDir, defaultsDir, warn: m => messages.push(m), force: true })

    expect(found.map(e => [e.path, e.kind])).toEqual([
      ['Middleware/Csrf.ts', 'identical'],
      ['Actions/Auth/LoginAction.ts', 'modified'],
    ])
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('app/Middleware/Csrf.ts is an unchanged copy')
    expect(messages[0]).toContain(`${SHADOWED_DEFAULT_REVIEW_MARKER} ${defaultFingerprint('a\n')}`)
    expect(messages[0]).toContain(`${SHADOWED_DEFAULTS_ENV}=false`)

    // Once per process: a second call without `force` says nothing.
    expect(warnShadowedSecurityDefaults({ appDir, defaultsDir, warn: m => messages.push(m) })).toEqual([])
    expect(messages).toHaveLength(1)
  })

  test('is silenced by the environment variable', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)
    write(appDir, 'Middleware/Csrf.ts', CSRF)
    process.env[SHADOWED_DEFAULTS_ENV] = 'false'
    const messages: string[] = []

    expect(warnShadowedSecurityDefaults({ appDir, defaultsDir, warn: m => messages.push(m), force: true })).toEqual([])
    expect(messages).toEqual([])
  })

  test('a throwing logger does not escape', () => {
    write(defaultsDir, 'Middleware/Csrf.ts', CSRF)
    write(appDir, 'Middleware/Csrf.ts', CSRF)

    expect(() => warnShadowedSecurityDefaults({
      appDir,
      defaultsDir,
      force: true,
      warn: () => { throw new Error('logger down') },
    })).not.toThrow()
  })

  test('the description pluralises', () => {
    const one = describeShadowedSecurityDefaults([{ path: 'Middleware/Csrf.ts', kind: 'identical', appFile: '', defaultFile: '', fingerprint: 'x' }])
    expect(one).toContain('1 app/ file shadows a framework security default')
  })
})
