// What `buddy new` leaves in a package-based app, measured against this
// repository's real files: the app is a download of this repository, so a
// script, preload or import added here later is exactly what a new app gets.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  adoptPackagedDefaults,
  appPackageScripts,
  defaultsSpecifier,
  FRAMEWORK_ONLY_PATHS,
  ignoreDefaults,
  rewriteDefaultsImports,
  rewriteDefaultsModulePaths,
  unignoreDefaults,
} from '../src/scaffold-package-app'

const REPO = join(import.meta.dir, '../../../../..')

let app: string

beforeEach(() => {
  app = mkdtempSync(join(tmpdir(), 'stacks-scaffold-package-app-'))
})

afterEach(() => {
  rmSync(app, { recursive: true, force: true })
})

function copy(path: string): void {
  cpSync(join(REPO, path), join(app, path), { recursive: true })
}

function write(path: string, contents: string): void {
  mkdirSync(join(app, path, '..'), { recursive: true })
  writeFileSync(join(app, path), contents)
}

describe('framework-only files', () => {
  test('every listed path still exists in the repository', () => {
    // A path that moved would silently start shipping to apps again.
    expect(FRAMEWORK_ONLY_PATHS.filter(path => !existsSync(join(REPO, path)))).toEqual([])
  })

  test('the scripts an app keeps do not reach into what it no longer has', () => {
    const { scripts } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
    const { scripts: kept, removed } = appPackageScripts(scripts)

    expect(removed.length).toBeGreaterThan(0)
    const broken = Object.entries(kept).filter(([, command]) =>
      /\bbench\/|\.github\/scripts|tsconfig\.(?:framework|defaults|type-tests)\.json|storage\/framework\/(?:core|defaults|scripts\/publish)/.test(command))
    expect(broken).toEqual([])

    expect(kept.typecheck).toBe('bun run typecheck:app')
    expect(kept.dev).toBe(scripts.dev)
    expect(kept.test).toBe(scripts.test)
    expect(Object.keys(kept).some(name => name.startsWith('docs:') || name.startsWith('bench'))).toBe(false)
  })
})

describe('the framework defaults', () => {
  test('the app\'s own imports of the tree become package specifiers', () => {
    copy('app/Routes.ts')
    copy('config/remote.ts')
    const has = (path: string) => existsSync(join(REPO, 'storage/framework/defaults', path))

    const touched = rewriteDefaultsImports(app, has)

    expect(touched.sort()).toEqual(['app/Routes.ts', 'config/remote.ts'])
    const routes = readFileSync(join(app, 'app/Routes.ts'), 'utf8')
    expect(routes).toContain('from \'@stacksjs/defaults/app/Routes.ts\'')
    expect(routes).not.toContain('storage/framework/defaults/app/Routes\'')
    expect(readFileSync(join(app, 'config/remote.ts'), 'utf8'))
      .toContain('from \'@stacksjs/defaults/app/Actions/Dashboard/Remote/remote-commands.ts\'')
  })

  test('a path in a comment or a glob is not an import, and is left alone', () => {
    write('config/css.ts', [
      '// see storage/framework/defaults/resources/views',
      'export default { content: [\'./storage/framework/defaults/resources/views/**/*.stx\'] }',
      'import x from \'~/storage/framework/defaults/functions/toasts\'',
    ].join('\n'))

    rewriteDefaultsImports(app, path => path === 'functions/toasts.ts')

    expect(readFileSync(join(app, 'config/css.ts'), 'utf8').split('\n')).toEqual([
      '// see storage/framework/defaults/resources/views',
      'export default { content: [\'./storage/framework/defaults/resources/views/**/*.stx\'] }',
      'import x from \'@stacksjs/defaults/functions/toasts.ts\'',
    ])
  })

  test('adds .ts only where the package has that file', () => {
    expect(defaultsSpecifier('app/Routes', () => true)).toBe('@stacksjs/defaults/app/Routes.ts')
    expect(defaultsSpecifier('app/Routes.ts', () => true)).toBe('@stacksjs/defaults/app/Routes.ts')
    expect(defaultsSpecifier('resources/plugins/preloader', () => false)).toBe('@stacksjs/defaults/resources/plugins/preloader')
  })

  test('the preloader and the stx plugin are named by package', () => {
    copy('bunfig.toml')
    copy('config/ui.ts')

    // Fails if either file stops naming the tree the way the rewrite expects.
    expect(rewriteDefaultsModulePaths(app).sort()).toEqual(['bunfig.toml', 'config/ui.ts'])
    expect(readFileSync(join(app, 'bunfig.toml'), 'utf8')).toContain('"@stacksjs/defaults/resources/plugins/preloader"')
    expect(readFileSync(join(app, 'bunfig.toml'), 'utf8')).not.toContain('storage/framework/defaults')
    expect(readFileSync(join(app, 'config/ui.ts'), 'utf8')).toContain('\'@stacksjs/defaults/stx-components-plugin.ts\'')
  })

  test('the gitignore entry is added once and can be taken back out', () => {
    write('.gitignore', 'node_modules\n')

    expect(ignoreDefaults(app)).toBe(true)
    expect(ignoreDefaults(app)).toBe(false)
    expect(readFileSync(join(app, '.gitignore'), 'utf8').match(/^\/storage\/framework\/defaults$/gm)).toHaveLength(1)

    expect(unignoreDefaults(app)).toBe(true)
    expect(readFileSync(join(app, '.gitignore'), 'utf8')).not.toContain('storage/framework/defaults')
    expect(readFileSync(join(app, '.gitignore'), 'utf8')).toContain('node_modules')
  })

  test('the vendored tree is replaced by a link to the installed package', () => {
    write('package.json', '{"name":"app"}')
    write('node_modules/@stacksjs/defaults/package.json', '{"name":"@stacksjs/defaults","version":"1.0.0"}')
    write('node_modules/@stacksjs/defaults/app/Routes.ts', 'export default {}\n')
    write('storage/framework/defaults/app/Routes.ts', 'export default {}\n')
    write('app/Routes.ts', 'export { default } from \'../storage/framework/defaults/app/Routes\'\n')
    write('.gitignore', '')

    const adopted = adoptPackagedDefaults(app)

    const link = join(app, 'storage/framework/defaults')
    expect(adopted.removedTree).toBe(true)
    expect(adopted.linked).toBe(true)
    expect(lstatSync(link).isSymbolicLink()).toBe(true)
    expect(readlinkSync(link)).toBe('../../node_modules/@stacksjs/defaults')
    expect(readFileSync(join(app, 'app/Routes.ts'), 'utf8')).toContain('\'@stacksjs/defaults/app/Routes.ts\'')
    expect(readFileSync(join(app, '.gitignore'), 'utf8')).toContain('/storage/framework/defaults')
    // The package itself is untouched.
    expect(existsSync(join(app, 'node_modules/@stacksjs/defaults/app/Routes.ts'))).toBe(true)
  })

  test('nothing in the defaults tree imports it through the project root', () => {
    // `~/storage/framework/defaults/...` exists only while the tree or its link
    // does. `@stacksjs/defaults/...` resolves in every layout.
    const offenders = Bun.spawnSync(['grep', '-rln', '~/storage/framework/defaults/', join(REPO, 'storage/framework/defaults'), '--include=*.ts', '--include=*.stx'])
      .stdout.toString().trim().split('\n').filter(Boolean)
    expect(offenders).toEqual([])
  })
})
