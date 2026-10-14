import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_IOS_DEPENDENCIES,
  findPantryProgram,
  generateXcodeProject,
  IosToolchainError,
  loadIosDependencies,
  pantryExecutable,
  pantryInstallArgs,
  pantryPackageRoots,
  resolveXcodegen,
  XCODEGEN_PACKAGE,
} from '../src/build/ios-toolchain'

let root: string
let project: string
let data: string

function install(base: string, version: string): string {
  const bin = join(base, XCODEGEN_PACKAGE, `v${version}`, 'bin')
  mkdirSync(bin, { recursive: true })
  const program = join(bin, 'xcodegen')
  // Records how it was called, so the generation test can check it.
  writeFileSync(program, `#!/bin/sh\necho "$@" > "$PWD/xcodegen-args"\necho ${version} >> "$PWD/xcodegen-args"\n`)
  chmodSync(program, 0o755)
  return program
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-ios-toolchain-'))
  project = join(root, 'app')
  data = join(root, 'data')
  mkdirSync(join(project, 'config'), { recursive: true })
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('the iOS toolchain', () => {
  it('looks in the project, then the user install, then the system one', () => {
    expect(pantryPackageRoots('/app', { HOME: '/home/c' })).toEqual(['/app/pantry', '/home/c/.local/share/pantry/global/packages', '/usr/local/packages'])
    expect(pantryPackageRoots('/app', { HOME: '/home/c', XDG_DATA_HOME: '/xdg' })[1]).toBe('/xdg/pantry/global/packages')
  })

  it('picks the highest installed version the constraint allows, from the first root that has one', () => {
    const user = join(data, 'pantry', 'global', 'packages')
    install(user, '2.45.4')
    const newest = install(user, '2.46.0')
    install(user, '3.0.0')
    expect(findPantryProgram(XCODEGEN_PACKAGE, '^2.45.0', 'xcodegen', [join(project, 'pantry'), user])).toEqual({ pkg: XCODEGEN_PACKAGE, constraint: '^2.45.0', version: '2.46.0', path: newest })
    expect(findPantryProgram(XCODEGEN_PACKAGE, '2.45.4', 'xcodegen', [user])?.version).toBe('2.45.4')
    expect(findPantryProgram(XCODEGEN_PACKAGE, '^4.0.0', 'xcodegen', [user])).toBeNull()

    const local = install(join(project, 'pantry'), '2.46.0')
    expect(findPantryProgram(XCODEGEN_PACKAGE, '^2.45.0', 'xcodegen', [join(project, 'pantry'), user])?.path).toBe(local)
    rmSync(join(project, 'pantry'), { recursive: true, force: true })
  })

  it('ignores a version directory without the program', () => {
    const empty = join(root, 'empty')
    mkdirSync(join(empty, XCODEGEN_PACKAGE, 'v2.47.0'), { recursive: true })
    expect(findPantryProgram(XCODEGEN_PACKAGE, '^2.46.0', 'xcodegen', [empty])).toBeNull()
  })

  it('reads iosDependencies from config/deps.ts over the framework default', async () => {
    expect(await loadIosDependencies(join(root, 'no-such-app'))).toEqual({ ...DEFAULT_IOS_DEPENDENCIES })
    writeFileSync(join(project, 'config', 'deps.ts'), `export const iosDependencies = { '${XCODEGEN_PACKAGE}': '2.45.4' }\nexport const config = {}\n`)
    expect(await loadIosDependencies(project)).toEqual({ [XCODEGEN_PACKAGE]: '2.45.4' })
    expect(pantryInstallArgs({ [XCODEGEN_PACKAGE]: '2.45.4' })).toEqual(['install', '--user', '--no-save', `${XCODEGEN_PACKAGE}@2.45.4`])
  })

  it('resolves xcodegen at the pinned version, never from PATH', async () => {
    const env = { HOME: root, XDG_DATA_HOME: data }
    expect((await resolveXcodegen(project, { env })).version).toBe('2.45.4')

    const bare = join(root, 'bare')
    mkdirSync(join(bare, 'config'), { recursive: true })
    writeFileSync(join(bare, 'config', 'deps.ts'), `export const iosDependencies = { '${XCODEGEN_PACKAGE}': '9.9.9' }\n`)
    const error = await resolveXcodegen(bare, { env }).catch(e => e)
    expect(error).toBeInstanceOf(IosToolchainError)
    expect(error.message).toContain('buddy setup:ios')
    expect(error.message).toContain(`pantry install --user ${XCODEGEN_PACKAGE}@9.9.9`)
    expect(error.message).toContain('Xcode itself does not come from Pantry')
  })

  it('runs the resolved xcodegen in the project directory', async () => {
    const output = join(root, 'ios')
    mkdirSync(output, { recursive: true })
    const tool = await resolveXcodegen(project, { env: { HOME: root, XDG_DATA_HOME: data } })
    generateXcodeProject(tool, output)
    expect(readFileSync(join(output, 'xcodegen-args'), 'utf8')).toBe('generate --quiet\n2.45.4\n')

    const failing = join(root, 'failing')
    writeFileSync(failing, '#!/bin/sh\necho "spec is invalid" >&2\nexit 1\n')
    chmodSync(failing, 0o755)
    expect(() => generateXcodeProject({ ...tool, path: failing }, output)).toThrow('spec is invalid')
  })

  it('finds the Pantry executable PANTRY_BIN names first', () => {
    const exists = (path: string) => path === '/opt/pantry' || path === '/home/c/.local/bin/pantry'
    expect(pantryExecutable('/app', { HOME: '/home/c', PANTRY_BIN: '/opt/pantry' }, exists)).toBe('/opt/pantry')
    expect(pantryExecutable('/app', { HOME: '/home/c' }, exists)).toBe('/home/c/.local/bin/pantry')
    expect(pantryExecutable('/app', { HOME: '/nowhere' }, () => false)).toBe('pantry')
  })
})
