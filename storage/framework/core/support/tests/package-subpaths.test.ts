import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('the built server, browser and testing exports work from an isolated consumer', async () => {
  const root = join(import.meta.dir, '..')
  const build = Bun.spawn([process.execPath, '--no-env-file', join(root, 'build.ts')], { cwd: tmpdir(), stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
  expect(code, `${stdout}\n${stderr}`).toBe(0)
  const consumer = mkdtempSync(join(tmpdir(), 'support-consumer-'))
  try {
    mkdirSync(join(consumer, 'node_modules/@stacksjs'), { recursive: true })
    symlinkSync(root, join(consumer, 'node_modules/@stacksjs/support'))
    writeFileSync(join(consumer, 'probe.ts'), `
      import { createSupportClient } from '@stacksjs/support'
      import { SupportError } from '@stacksjs/support/server'
      import { createSupportBrowser } from '@stacksjs/support/browser'
      import { createFakeSupportService } from '@stacksjs/support/testing'
      const fake = createFakeSupportService()
      const client = createSupportClient({ key: fake.key, project: fake.project, fetch: fake.fetch })
      const session = await client.createSession({ externalId: 'isolated' })
      console.log(session.contact.externalId, typeof createSupportBrowser, new SupportError('network').code)
    `)
    const child = Bun.spawn([process.execPath, '--no-env-file', join(consumer, 'probe.ts')], { cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
    const [result, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(result, error).toBe(0)
    expect(output.trim()).toBe('isolated function network')
  }
  finally { rmSync(consumer, { recursive: true, force: true }) }
}, 60000)
