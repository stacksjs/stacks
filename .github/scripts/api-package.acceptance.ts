import { expect, test } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'

test('shipped API generators import as libraries without executing their command entrypoints', async () => {
  const checkout = resolve(import.meta.dir, '../..')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-api-package-'))
  try {
    await symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const config = join(directory, 'tsconfig.json')
    await writeFile(config, JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }))
    await writeFile(join(directory, 'consumer.ts'), `
import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'
import { renderOpenApiTypes } from '@stacksjs/api/generate-types'
import { renderApiClient } from '@stacksjs/api/generate-client'
for (const module of ['generate-types', 'generate-client']) {
  const resolved = Bun.resolveSync('@stacksjs/api/' + module, import.meta.dir)
  assert.equal(basename(resolved), module + '.js')
  assert.equal(basename(dirname(resolved)), 'dist')
}
const document = { openapi: '3.0.3', info: { title: 'Fixture', version: '1' }, paths: { '/health': { get: { operationId: 'health', responses: { 200: { description: 'Healthy' } } } } } }
assert.ok(renderOpenApiTypes(document).includes('/health'))
assert.ok(renderApiClient(document).includes('/health'))
console.log('API library imports verified')
`)
    const child = Bun.spawn([process.execPath, '--no-env-file', '--tsconfig-override', config, 'consumer.ts', 'generate'], {
      cwd: directory, env: publicationEnvironment(), stdout: 'pipe', stderr: 'pipe', timeout: 10000,
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, stdout + stderr).toBe(0)
    expect(stdout.trim()).toBe('API library imports verified')
  }
  finally { await rm(directory, { recursive: true }) }
}, 15000)
