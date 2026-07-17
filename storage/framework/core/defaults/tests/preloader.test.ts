import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

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
    await Bun.write(isolatedPreloader, Bun.file(resolve(defaultsRoot, 'resources/plugins/preloader.ts')))
    await Promise.all(['plugin.ts', 'crypto.ts', 'parser.ts'].map(file =>
      Bun.write(resolve(isolatedEnvRoot, file), Bun.file(resolve(envRoot, file))),
    ))
    await Bun.write(
      resolve(isolatedPathRoot, 'index.ts'),
      Bun.file(resolve(import.meta.dir, '../../path/src/index.ts')),
    )
    await Bun.write(isolatedRunner, `await import('./storage/framework/defaults/resources/plugins/preloader.ts')\n`)

    const child = Bun.spawn([process.execPath, isolatedRunner], {
      cwd: tempDir,
      env: { ...process.env },
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
