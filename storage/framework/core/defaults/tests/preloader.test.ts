import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { isProtectedGlobal } from '../../../defaults/resources/plugins/preloader'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('default preloader', () => {
  it('stays inert while a package postinstall script is running', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'stacks-preloader-'))
    tempDirs.push(tempDir)

    const sourcePath = resolve(import.meta.dir, '../../../defaults/resources/plugins/preloader.ts')
    const isolatedPreloader = resolve(tempDir, 'preloader.ts')
    await Bun.write(isolatedPreloader, Bun.file(sourcePath))

    const child = Bun.spawn([process.execPath, isolatedPreloader], {
      cwd: tempDir,
      env: {
        ...process.env,
        npm_lifecycle_event: 'postinstall',
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const stderr = await new Response(child.stderr).text()
    expect(await child.exited).toBe(0)
    expect(stderr).toBe('')
  })

  it('loads without workspace packages being linked', async () => {
    const tempDir = await mkdtemp(resolve(tmpdir(), 'stacks-preloader-'))
    tempDirs.push(tempDir)

    const defaultsRoot = resolve(import.meta.dir, '../../../defaults')
    const envRoot = resolve(import.meta.dir, '../../env/src')
    const isolatedRunner = resolve(tempDir, 'run.ts')
    const isolatedPreloader = resolve(tempDir, 'storage/framework/defaults/resources/plugins/preloader.ts')
    const isolatedEnvRoot = resolve(tempDir, 'storage/framework/core/env/src')
    const isolatedPathRoot = resolve(tempDir, 'storage/framework/core/path/src')

    await mkdir(resolve(isolatedPreloader, '..'), { recursive: true })
    await mkdir(isolatedEnvRoot, { recursive: true })
    await mkdir(isolatedPathRoot, { recursive: true })
    await Promise.all([
      'resources/functions',
      'app/Models',
      'app/Jobs',
      'app/Controllers',
      'storage/framework/defaults/app/Models',
      'storage/framework/defaults/app/Controllers',
    ].map(path => mkdir(resolve(tempDir, path), { recursive: true })))
    // Every source file beside it, for the third time in this fixture and for
    // the same reason as `env` and `path` below: the plugins directory is a
    // source graph, not one entry. `preloader.ts` imports `./user-functions`,
    // and copying the entry alone left the isolated tree unable to resolve it.
    const pluginsSrc = resolve(defaultsRoot, 'resources/plugins')
    await Promise.all(
      (await readdir(pluginsSrc))
        .filter(file => file.endsWith('.ts'))
        .map(file => Bun.write(resolve(isolatedPreloader, '..', file), Bun.file(resolve(pluginsSrc, file)))),
    )
    // Like path below, env is a source graph, not a frozen three-file bundle.
    // Missing plaintext-env.ts made this fixture load a cached npm package
    // instead of the vendored source it was meant to exercise.
    await Promise.all(
      (await readdir(envRoot))
        .filter(file => file.endsWith('.ts'))
        .map(file => Bun.write(resolve(isolatedEnvRoot, file), Bun.file(resolve(envRoot, file)))),
    )
    // Every source file, not just `index.ts`. The package was one file when
    // this fixture was written; `index.ts` now imports `./project`, and copying
    // the entry alone left the isolated tree unable to resolve
    // `@stacksjs/path` at all. Copying the directory means the next split does
    // not break this test either.
    const pathSrc = resolve(import.meta.dir, '../../path/src')
    await Promise.all(
      (await readdir(pathSrc))
        .filter(file => file.endsWith('.ts'))
        .map(file => Bun.write(resolve(isolatedPathRoot, file), Bun.file(resolve(pathSrc, file)))),
    )
    await Bun.write(resolve(tempDir, '.env'), 'STACKS_PRELOADER_FIXTURE=vendored-source\n')
    await Bun.write(isolatedRunner, `
      import assert from 'node:assert/strict'
      await import('./storage/framework/defaults/resources/plugins/preloader.ts')
      assert.equal(process.env.STACKS_PRELOADER_FIXTURE, 'vendored-source')
    `)

    // A curated environment rather than the developer's. This test is about
    // whether the preloader resolves with nothing linked, and it asserts on
    // empty stdout/stderr, so inheriting the ambient environment made it
    // assert on whatever database the machine running it happened to have
    // configured: a local `DB_CONNECTION=postgres` is enough to put a
    // bun-query-builder dialect warning on stderr and fail a test that has
    // nothing to do with databases.
    // No automatic npm fallback and no native dotenv loading: the vendored
    // preloader must load the fixture env itself, without a global cache.
    const child = Bun.spawn([process.execPath, '--no-install', '--no-env-file', isolatedRunner], {
      cwd: tempDir,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? tempDir,
        BUN_INSTALL_CACHE_DIR: resolve(tempDir, 'bun-cache'),
        // Passed through deliberately. Code in this graph gates on it, and a
        // child that believes it is interactive can sit on a prompt instead of
        // exiting, which reads as a hang rather than a failure.
        ...(process.env.CI ? { CI: process.env.CI } : {}),
      },
      stderr: 'pipe',
      stdout: 'pipe',
    })

    const [stderr, stdout] = await Promise.all([
      new Response(child.stderr).text(),
      new Response(child.stdout).text(),
    ])
    expect(stderr).toBe('')
    expect(stdout).toBe('')
    expect(await child.exited).toBe(0)
  })
})

// Auto-imports write framework exports onto globalThis. A name the runtime
// already owns must survive that: `@stacksjs/queue` exports a queue `Worker`,
// and it replaced Bun's Web Worker in every Stacks process, so `new Worker(url)`
// built a queue worker. stx's image warm-up failed silently on it and an app's
// own highlighter worker broke. `reportError` from `@stacksjs/validation` was
// overwriting the web `reportError` the same way.
describe('auto-imports leave host globals alone', () => {
  it('protects whatever the runtime defined, not only a hand-kept list', () => {
    expect(isProtectedGlobal('Worker')).toBeTrue()
    expect(isProtectedGlobal('reportError')).toBeTrue()
    expect(isProtectedGlobal('structuredClone')).toBeTrue()
    expect(isProtectedGlobal('EventTarget')).toBeTrue()
  })

  it('still protects reserved names the runtime does not define', () => {
    expect(isProtectedGlobal('window', new Set())).toBeTrue()
    expect(isProtectedGlobal('Deno', new Set())).toBeTrue()
  })

  it('lets framework names through', () => {
    expect(isProtectedGlobal('collect')).toBeFalse()
    expect(isProtectedGlobal('Post')).toBeFalse()
    expect(isProtectedGlobal('Worker', new Set())).toBeFalse()
  })

  it('the real preloader keeps the Web Worker and reportError', async () => {
    // From the repository root, so bunfig.toml preloads the real preloader
    // with the full auto-import graph, the way a Stacks process starts.
    const tempDir = await mkdtemp(resolve(tmpdir(), 'stacks-preloader-globals-'))
    tempDirs.push(tempDir)
    const probe = resolve(tempDir, 'probe.ts')
    await Bun.write(probe, `
      console.log(JSON.stringify({
        workerIsWeb: typeof Worker === 'function' && typeof Worker.prototype.addEventListener === 'function',
        reportErrorIsNative: String(globalThis.reportError).includes('[native code]'),
        autoImported: typeof (globalThis as any).collect === 'function',
      }))
    `)
    const child = Bun.spawn([process.execPath, probe], {
      cwd: resolve(import.meta.dir, '../../../../..'),
      stderr: 'pipe',
      stdout: 'pipe',
    })
    const stdout = await new Response(child.stdout).text()
    expect(await child.exited).toBe(0)
    const line = stdout.trim().split('\n').filter(l => l.startsWith('{')).at(-1)!
    expect(JSON.parse(line)).toEqual({ workerIsWeb: true, reportErrorIsNative: true, autoImported: true })
  }, 60_000)
})
