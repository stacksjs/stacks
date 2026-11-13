import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('a built hq package ships the JavaScript behind every public subpath', async () => {
  const root = join(import.meta.dir, '..')
  const build = Bun.spawn([process.execPath, 'run', 'build'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([build.exited, new Response(build.stdout).text(), new Response(build.stderr).text()])
  expect(code, `${stdout}\n${stderr}`).toBe(0)

  const consumer = mkdtempSync(join(tmpdir(), 'hq-consumer-'))
  try {
    const manifest = await Bun.file(join(root, 'package.json')).json()
    for (const subpath of ['meter', 'service', 'client', 'testing']) {
      for (const condition of ['bun', 'types'])
        expect(await Bun.file(join(root, manifest.exports['./*'][condition].replace('*', subpath))).exists(), `${subpath} (${condition})`).toBe(true)
    }

    // Import through package exports from a consumer, not workspace aliases,
    // and prove the built entrypoints run with nothing else installed.
    mkdirSync(join(consumer, 'node_modules/@stacksjs'), { recursive: true })
    symlinkSync(root, join(consumer, 'node_modules/@stacksjs/hq'))
    writeFileSync(join(consumer, 'probe.ts'), `
      import { evaluate, formatUsageHeader, reserveUsage } from '@stacksjs/hq/meter'
      import { createHqService } from '@stacksjs/hq/service'
      import { createHqClient } from '@stacksjs/hq/client'
      import * as root from '@stacksjs/hq'
      const support = await createHqClient({ services: {} }).support.conversations()
      if (support.ok) throw new Error('unconfigured support reader should be unavailable')
      console.log([support.service, support.reason, evaluate(601, 500).state, formatUsageHeader({ meter: 'm', used: 1, limit: 2, state: 'ok', upgradeUrl: null }), typeof reserveUsage, typeof createHqService, typeof createHqClient, typeof root.createCounter].join(' '))
    `)
    const child = Bun.spawn([process.execPath, '--no-env-file', join(consumer, 'probe.ts')], { cwd: consumer, stdout: 'pipe', stderr: 'pipe' })
    const [result, output, error] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(result, error).toBe(0)
    expect(output.trim()).toBe('supporthq not_configured sampled m;1;2;ok function function function function')
  }
  finally {
    rmSync(consumer, { recursive: true, force: true })
  }
}, 60000)
