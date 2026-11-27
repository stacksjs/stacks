import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runIsolated } from '@stacksjs/testing/isolated'

test('Buddy installs a targeted project with a frozen Bun lockfile and optional lifecycle scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buddy-install-'))
  try {
    const project = join(root, 'consumer')
    const dependency = join(root, 'dependency')
    await mkdir(join(project, 'config'), { recursive: true })
    await mkdir(dependency)
    await Bun.write(join(project, 'config/app.ts'), 'export default {}')
    await Bun.write(join(dependency, 'package.json'), JSON.stringify({ name: 'install-fixture', version: '1.0.0' }))
    const manifest = {
      name: 'buddy-install-consumer',
      private: true,
      dependencies: { 'install-fixture': 'file:../dependency' },
      scripts: { postinstall: 'bun lifecycle.ts' },
    }
    const packageFile = join(project, 'package.json')
    const lockFile = join(project, 'bun.lock')
    const marker = join(project, 'lifecycle-ran')
    await Bun.write(packageFile, JSON.stringify(manifest))
    await Bun.write(join(project, 'lifecycle.ts'), "await Bun.write('lifecycle-ran', 'yes')")
    const lock = Bun.spawnSync([process.execPath, '--no-env-file', 'install', '--lockfile-only', '--ignore-scripts'], { cwd: project })
    expect(lock.exitCode, lock.stderr.toString()).toBe(0)
    const originalLock = await Bun.file(lockFile).text()

    const buddy = (options: string[]) => runIsolated(join(import.meta.dir, '../src/cli.ts'), {
      cwd: root, args: ['install', '--project', project, ...options], envFile: false, preload: [], timeoutMs: 15_000,
    })
    const install = await buddy(['--frozen-lockfile', '--ignore-scripts'])
    expect(install.code, install.stdout + install.stderr).toBe(0)
    expect(await Bun.file(join(project, 'node_modules/install-fixture/package.json')).exists()).toBe(true)
    expect(await Bun.file(marker).exists()).toBe(false)
    expect(await Bun.file(lockFile).text()).toBe(originalLock)

    await Bun.write(packageFile, JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, 'extra-fixture': 'file:../dependency' } }))
    const mismatch = await buddy(['--frozen-lockfile', '--ignore-scripts'])
    expect(mismatch.code).not.toBe(0)
    expect(mismatch.stderr + mismatch.stdout).toMatch(/lockfile had changes.*frozen/i)
    expect(await Bun.file(lockFile).text()).toBe(originalLock)
    expect(await Bun.file(marker).exists()).toBe(false)

    await Bun.write(packageFile, JSON.stringify(manifest))
    const defaultInstall = await buddy([])
    expect(defaultInstall.code, defaultInstall.stdout + defaultInstall.stderr).toBe(0)
    expect(await readFile(marker, 'utf8')).toBe('yes')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
}, 50_000)
