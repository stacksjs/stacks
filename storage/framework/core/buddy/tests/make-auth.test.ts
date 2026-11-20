import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { AUTH_ACTIONS, AUTH_COMPONENTS, AUTH_PAGES, makeAuth } from '../src/make-auth'

// The real defaults tree: the set has to name files the framework ships.
const defaultsRoot = join(import.meta.dir, '../../../defaults')

let projectRoot: string
beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), 'stacks-make-auth-'))
})
afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true })
})

/** Every `from '.x'` in a file names a file that exists. */
function unresolvedRelativeImports(file: string): string[] {
  const source = readFileSync(file, 'utf-8')
  return [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)]
    .map(match => match[1]!)
    .filter(specifier => ![`${specifier}`, `${specifier}.ts`, `${specifier}/index.ts`]
      .some(candidate => existsSync(resolve(dirname(file), candidate))))
}

describe('buddy make:auth', () => {
  test('copies the sign-in pages and actions to the paths the framework reads first', async () => {
    const result = await makeAuth({ projectRoot, defaultsRoot })

    expect(result.missing).toEqual([])
    expect(result.written).toEqual([
      ...AUTH_PAGES.map(page => `resources/views/${page}.stx`),
      ...AUTH_COMPONENTS.map(component => `resources/components/${component}.stx`),
      ...AUTH_ACTIONS.map(action => `app/Actions/${action}.ts`),
    ])
    for (const file of result.written)
      expect(existsSync(join(projectRoot, file))).toBeTrue()
  })

  test('a copied action runs where it lands: what it imports by relative path comes along', async () => {
    const result = await makeAuth({ projectRoot, defaultsRoot })

    expect(result.carried).toContain('app/password-policy.ts')
    for (const file of [...result.written, ...result.carried].filter(file => file.endsWith('.ts')))
      expect({ file, unresolved: unresolvedRelativeImports(join(projectRoot, file)) }).toEqual({ file, unresolved: [] })
  })

  test('the components keep using the framework helpers they imported by relative path', async () => {
    await makeAuth({ projectRoot, defaultsRoot })
    const loginDashboard = readFileSync(join(projectRoot, 'resources/components/Dashboard/Auth/LoginDashboard.stx'), 'utf-8')

    expect(loginDashboard).toContain("from '@stacksjs/defaults/functions/auth'")
    expect(loginDashboard).not.toContain('../../../../functions/auth')
  })

  test('running it again keeps what the app has, edits included', async () => {
    await makeAuth({ projectRoot, defaultsRoot })
    const login = join(projectRoot, 'resources/views/login.stx')
    writeFileSync(login, '<p>our own login</p>\n')

    const again = await makeAuth({ projectRoot, defaultsRoot })

    expect(again.written).toEqual([])
    expect(again.kept.length).toBe(AUTH_PAGES.length + AUTH_COMPONENTS.length + AUTH_ACTIONS.length)
    expect(readFileSync(login, 'utf-8')).toBe('<p>our own login</p>\n')
  })

  test('force writes the framework copy over the app one', async () => {
    await makeAuth({ projectRoot, defaultsRoot })
    const login = join(projectRoot, 'resources/views/login.stx')
    writeFileSync(login, '<p>our own login</p>\n')

    const forced = await makeAuth({ projectRoot, defaultsRoot, force: true })

    expect(forced.written).toContain('resources/views/login.stx')
    expect(readFileSync(login, 'utf-8')).toBe(readFileSync(join(defaultsRoot, 'resources/views/login.stx'), 'utf-8'))
  })

  test('api copies the actions and no pages', async () => {
    const result = await makeAuth({ projectRoot, defaultsRoot, api: true })

    expect(result.written).toEqual(AUTH_ACTIONS.map(action => `app/Actions/${action}.ts`))
    expect(existsSync(join(projectRoot, 'resources'))).toBeFalse()
  })

  test('a dry run names the files and writes none', async () => {
    const result = await makeAuth({ projectRoot, defaultsRoot, dryRun: true })

    expect(result.written.length).toBe(AUTH_PAGES.length + AUTH_COMPONENTS.length + AUTH_ACTIONS.length)
    expect(existsSync(join(projectRoot, 'app'))).toBeFalse()
    expect(existsSync(join(projectRoot, 'resources'))).toBeFalse()
  })
})
