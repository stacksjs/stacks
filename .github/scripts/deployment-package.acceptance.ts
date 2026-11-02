import { expect, test } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'

test('the shipped deployment module resolves through its public package without application aliases', async () => {
  const checkout = resolve(import.meta.dir, '../..')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-deployment-package-'))
  try {
    await symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }))
    await writeFile(join(directory, 'consumer.ts'), `
import assert from 'node:assert/strict'
const resolved = Bun.resolveSync('@stacksjs/actions/deploy/stack', import.meta.dir)
assert.match(resolved.replaceAll('\\\\', '/'), /\\/dist\\/deploy\\/stack\\.js$/)
const deployment = await import('@stacksjs/actions/deploy/stack')
for (const name of ['deployStack', 'deployFrontend', 'getDeploymentStatus', 'undeployStack'])
  assert.equal(typeof deployment[name], 'function', name)
`)
    const child = Bun.spawn([process.execPath, '--no-env-file', '--tsconfig-override', join(directory, 'tsconfig.json'), 'consumer.ts'], {
      cwd: directory, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 10_000,
    })
    const [code, out, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, out + error).toBe(0)
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 15_000)
