import { expect, test } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../storage/framework/core/actions/tests/helpers/publication-environment'

test('the shipped validation messages load the ESM provider without application aliases', async () => {
  const checkout = resolve(import.meta.dir, '../..')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-validation-package-'))
  try {
    await symlink(join(checkout, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }))
    await writeFile(join(directory, 'consumer.ts'), `
import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'
const resolved = Bun.resolveSync('@stacksjs/validation/messages', import.meta.dir)
assert.equal(basename(resolved), 'messages.js')
assert.equal(basename(dirname(resolved)), 'dist')
const { schema } = await import('@stacksjs/validation/runtime')
const { validateRule, fieldErrorMessages } = await import('@stacksjs/validation/messages')
const rule = schema.string().required().min(3)
const result = validateRule(rule, 'a')
assert.equal(result.valid, false)
const errors = Array.isArray(result.errors) ? result.errors : Object.values(result.errors).flat()
assert.deepEqual(fieldErrorMessages(rule, 'a', errors, { min: 'Use at least three letters' }, 'name'), ['Use at least three letters'])
assert.equal(validateRule(rule, 'Ava').valid, true)
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
