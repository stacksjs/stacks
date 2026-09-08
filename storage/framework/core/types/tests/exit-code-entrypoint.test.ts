import { expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Build the real package in isolation. Source aliases alone cannot establish
// that the advertised public subpath has executable JavaScript in a release.
test('the built types root and exit-code entrypoint share the same enum', async () => {
  const source = join(import.meta.dir, '..')
  const runtime = join(import.meta.dir, '../../../runtime')
  await mkdir(runtime, { recursive: true })
  const directory = await mkdtemp(join(runtime, 'types-exit-code-'))
  try {
    const workspace = join(directory, 'workspace')
    await mkdir(workspace, { recursive: true })
    await symlink(join(source, '../build'), join(workspace, 'build'), 'dir')
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler' },
    }))
    // The types root imports strings at runtime. Build and install it here so
    // a developer's existing strings/dist cannot hide a missing dependency.
    for (const name of ['strings', 'types']) {
      const packageSource = join(source, '..', name)
      const pkg = join(workspace, name)
      await mkdir(pkg, { recursive: true })
      await cp(join(packageSource, 'src'), join(pkg, 'src'), { recursive: true })
      await cp(join(packageSource, 'package.json'), join(pkg, 'package.json'))
      await cp(join(packageSource, 'build.ts'), join(pkg, 'build.ts'))
      const build = Bun.spawn([process.execPath, 'run', 'build'], {
        cwd: pkg,
        env: { ...process.env, APP_ENV: 'test' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const buildWatchdog = setTimeout(() => build.kill(), 15_000)
      try {
        const [code, out, error] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
        expect(code, out + error).toBe(0)
      }
      finally {
        clearTimeout(buildWatchdog)
      }
      const installed = join(directory, 'node_modules/@stacksjs', name)
      await mkdir(installed, { recursive: true })
      await cp(join(pkg, 'package.json'), join(installed, 'package.json'))
      await cp(join(pkg, 'dist'), join(installed, 'dist'), { recursive: true })
    }
    await writeFile(join(directory, 'consumer.ts'), `
import assert from 'node:assert/strict'
assert.equal(Bun.resolveSync('@stacksjs/strings', import.meta.dir), import.meta.dir + '/node_modules/@stacksjs/strings/dist/index.js')
assert.equal(Bun.resolveSync('@stacksjs/types', import.meta.dir), import.meta.dir + '/node_modules/@stacksjs/types/dist/index.js')
assert.equal(Bun.resolveSync('@stacksjs/types/exit-code', import.meta.dir), import.meta.dir + '/node_modules/@stacksjs/types/dist/exit-code.js')
const narrow = await import('@stacksjs/types/exit-code')
const root = await import('@stacksjs/types')
assert.equal(root.ExitCode, narrow.ExitCode)
assert.deepEqual(narrow.ExitCode, { Success: 0, FatalError: 1, InvalidArgument: 9, 0: 'Success', 1: 'FatalError', 9: 'InvalidArgument' })
assert.equal(typeof root.defineModel, 'function')
assert.equal(root.getTypeName({}), 'object')
assert.equal(root.getTypeName(new Date()), 'date')
console.log('PASS shipped enum values, identity, and existing root exports')
`)
    const consumer = Bun.spawn([process.execPath, 'consumer.ts'], {
      cwd: directory,
      env: { ...process.env, APP_ENV: 'test' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const consumerWatchdog = setTimeout(() => consumer.kill(), 10_000)
    try {
      const [code, out, error] = await Promise.all([consumer.exited, new Response(consumer.stdout).text(), new Response(consumer.stderr).text()])
      expect(code, out + error).toBe(0)
    }
    finally {
      clearTimeout(consumerWatchdog)
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
