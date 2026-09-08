import type { StacksSourceModules } from './provenance'
import { describe, expect, it } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { REPO_ROOT } from './runtime'
import { resolveStacksRuntimeDependencies, resolveStacksSourceModules, STACKS_BENCHMARK_MODULES, STACKS_FIXTURE_MODULES, stacksSourceIssues } from './provenance'

describe('Stacks benchmark source provenance', () => {
  it('resolves every framework dependency through the server config to source', () => {
    const modules = resolveStacksSourceModules(REPO_ROOT)
    expect(Object.keys(modules).sort()).toEqual([...STACKS_BENCHMARK_MODULES].sort())
    for (const [specifier, path] of Object.entries(modules)) {
      const packageName = specifier.slice('@stacksjs/'.length).split('/', 1)[0]!
      expect(path).toStartWith(`storage/framework/core/${packageName}/src/`)
    }
  })

  it('rejects built packages and another package source tree', () => {
    const modules = Object.fromEntries(STACKS_BENCHMARK_MODULES.map(specifier => [
      specifier,
      join(REPO_ROOT, 'storage', 'framework', 'core', specifier.slice('@stacksjs/'.length).split('/', 1)[0]!, 'src', 'index.ts'),
    ])) as StacksSourceModules
    modules['@stacksjs/router'] = join(REPO_ROOT, 'node_modules', '@stacksjs', 'router', 'dist', 'index.js')
    modules['@stacksjs/database'] = join(REPO_ROOT, 'storage', 'framework', 'core', 'router', 'src', 'index.ts')

    expect(stacksSourceIssues(REPO_ROOT, modules)).toHaveLength(2)
  })

  it('records the exact published router runtime used by Stacks source', () => {
    const dependencies = resolveStacksRuntimeDependencies(REPO_ROOT)
    expect(dependencies['@stacksjs/bun-router'].version).toMatch(/^\d+\.\d+\.\d+/)
    expect(dependencies['@stacksjs/bun-router'].path).toEndWith('/@stacksjs/bun-router/dist/index.js')
  })

  for (const rootCopy of [false, true]) {
    it(`records the importing package's runtime with root copy=${rootCopy}`, () => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'stacks-provenance-')))
      const write = (path: string, contents: string) => {
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, contents)
      }
      const runtime = (parent: string, version: string) => {
        const directory = join(parent, 'node_modules/@stacksjs/bun-router')
        write(join(directory, 'package.json'), JSON.stringify({
          name: '@stacksjs/bun-router', version, type: 'module',
          exports: { '.': './dist/index.js', './package.json': './package.json' },
        }))
        write(join(directory, 'dist/index.js'), `export const version = '${version}'; export const path = import.meta.filename`)
      }
      try {
        write(join(root, 'bench/routing/bunfig.toml'), '# Isolated resolution fixture\n')
        write(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
          baseUrl: '.', paths: { '@stacksjs/router': ['./storage/framework/core/router/src/index.ts'] },
        } }))
        const importer = join(root, 'storage/framework/core/router')
        runtime(importer, '1.2.3')
        if (rootCopy) runtime(root, '9.8.7')
        write(join(importer, 'src/index.ts'), "export { version, path } from '@stacksjs/bun-router'")
        const probe = join(root, 'bench/routing/fixtures/source-probe.ts')
        mkdirSync(dirname(probe), { recursive: true })
        copyFileSync(join(import.meta.dir, 'fixtures/source-probe.ts'), probe)
        const observed = join(root, 'bench/routing/fixtures/observed-runtime.ts')
        write(observed, "import { version, path } from '@stacksjs/router'; console.log(JSON.stringify({ version, path }))")
        const actual = Bun.spawnSync([process.execPath, `--config=${join(root, 'bench/routing/bunfig.toml')}`, observed], { cwd: root })
        expect(actual.exitCode).toBe(0)
        const loaded = JSON.parse(actual.stdout.toString()) as { version: string, path: string }
        expect(loaded.version).toBe('1.2.3')
        expect(resolveStacksRuntimeDependencies(root)['@stacksjs/bun-router']).toEqual({
          version: loaded.version,
          path: relative(root, loaded.path),
        })
      }
      finally {
        rmSync(root, { recursive: true, force: true })
      }
    })
  }

  it('keeps benchmark-only implementations out of the Stacks fixture', () => {
    const source = readFileSync(join(import.meta.dir, 'servers', 'stacks.ts'), 'utf8')
    const specifiers = [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]!)
    const stacksSpecifiers = [...new Set(specifiers.filter(specifier => specifier.startsWith('@stacksjs/')))].sort()

    expect(stacksSpecifiers).toEqual([...STACKS_FIXTURE_MODULES].sort())
    expect(specifiers).not.toContain('bun:sqlite')
    expect(source).not.toMatch(/@stacksjs\/[^'"]+\/src(?:\/|['"])/)
    expect(source).not.toContain('storage/framework/core')
    expect(source).not.toMatch(/\bBun\.serve\s*\(/)
    expect(source).not.toMatch(/\bnew\s+Response\s*\(/)
    expect(source).not.toMatch(/\bResponse\.json\s*\(/)
    expect(source).not.toMatch(/\bJSON\.stringify\s*\(/)
    expect(source).not.toMatch(/return\s+request\.getValidated\(\)/)
    expect(source).toContain('return { name: validated.name, count: validated.count }')
    expect(source).toContain('autoDiscoverRoutes: false')
    expect(source).toContain('disableViewRouting(router.bunRouter)')
    expect(source).not.toContain('._apiRoutesInitialized')
    expect(source).not.toContain('.routesFrom(')
  })

  it('keeps benchmark selectors out of framework source', () => {
    const filesWithBenchmarkSelectors: string[] = []
    const sourceGlob = new Bun.Glob('**/*.ts')

    for (const specifier of STACKS_BENCHMARK_MODULES) {
      const packageName = specifier.slice('@stacksjs/'.length).split('/', 1)[0]!
      const sourceRoot = join(REPO_ROOT, 'storage', 'framework', 'core', packageName, 'src')
      for (const file of sourceGlob.scanSync({ cwd: sourceRoot })) {
        const source = readFileSync(join(sourceRoot, file), 'utf8')
        if (/\bBENCH_[A-Z0-9_]+\b/.test(source))
          filesWithBenchmarkSelectors.push(`${packageName}/src/${file}`)
      }
    }

    expect(filesWithBenchmarkSelectors).toEqual([])
  })

  it('keeps peer database statements and result shaping equivalent', () => {
    const stacksSource = readFileSync(join(import.meta.dir, 'servers', 'stacks.ts'), 'utf8')
    const readme = readFileSync(join(import.meta.dir, 'README.md'), 'utf8')
    expect(stacksSource).toContain('selectItem.executeTakeFirstSync()')
    expect(readme).toContain('`executeTakeFirstSync()` terminal')

    for (const server of ['bun-raw.ts', 'elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain('SELECT id, name FROM bench_items WHERE id = ? LIMIT 1')
      expect(source).toContain('selectItem.get(1)')
      expect(source).toContain('id: row.id')
      expect(source).toContain('name: row.name')
    }
  })

  it('binds every benchmark server to the same loopback interface', () => {
    for (const server of ['bun-raw.ts', 'elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts', 'stacks.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain("const hostname = '127.0.0.1'")
      expect(source.match(/\bhostname\b/g)?.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('directs every peer fixture to the frozen comparison set', () => {
    for (const server of ['elysia.ts', 'express.ts', 'fastify.ts', 'hono.ts']) {
      const source = readFileSync(join(import.meta.dir, 'servers', server), 'utf8')
      expect(source).toContain('bun install --cwd bench/routing --frozen-lockfile')
      expect(source).not.toContain('bun add')
    }
  })
})
