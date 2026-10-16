import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

test('the built API package ships JavaScript for its public subpaths and runs outside the source workspace', async () => {
  const build = Bun.spawnSync([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  expect(build.exitCode, build.stderr.toString()).toBe(0)
  for (const source of await readdir(join(root, 'src'))) {
    if (!source.endsWith('.ts') || source.endsWith('.d.ts')) continue
    const entry = source.replace(/\.ts$/, '.js')
    expect(await Bun.file(join(root, 'dist', entry)).exists(), `Missing published JavaScript: ${entry}`).toBe(true)
  }
  const consumer = await mkdtemp(join(tmpdir(), 'stacks-api-consumer-'))
  try {
    await mkdir(join(consumer, 'node_modules', '@stacksjs'), { recursive: true })
    await symlink(root, join(consumer, 'node_modules', '@stacksjs', 'api'), 'dir')
    await writeFile(join(consumer, 'package.json'), '{"type":"module"}')
    const child = Bun.spawnSync([process.execPath, '-e', `
      import { defineApiOperation } from '@stacksjs/api/operation'
      import { JsonResource } from '@stacksjs/api/resource'
      if (typeof JsonResource !== 'function') throw new Error('Missing resource export')
      let writes = 0
      const operation = defineApiOperation({
        authorize: context => { if (!context.allowed) throw new Error('Forbidden') },
        handle: () => ++writes,
      })
      try { await operation.execute({ allowed: false }) } catch {}
      if (writes !== 0) throw new Error('Unauthorized operation ran')
      if (await operation.execute({ allowed: true }) !== 1) throw new Error('Operation did not run')
    `], { cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
  }
  finally { await rm(consumer, { recursive: true, force: true }) }
}, 30000)
