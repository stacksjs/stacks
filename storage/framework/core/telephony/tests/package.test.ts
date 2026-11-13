import { expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('built public exports run and typecheck in an isolated consumer without workspace aliases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-telephony-consumer-'))
  try {
    const installed = join(dir, 'node_modules/@stacksjs/telephony')
    mkdirSync(installed, { recursive: true })
    cpSync(resolve(import.meta.dir, '../package.json'), join(installed, 'package.json'))
    cpSync(resolve(import.meta.dir, '../dist'), join(installed, 'dist'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
    writeFileSync(join(dir, 'bunfig.toml'), '[test]\npreload = []\n')
    writeFileSync(join(dir, 'consumer.ts'), `
      import { MemoryOperationJournal, TwilioTelephony, voiceResponse, parseMediaEvent, mediaMessage } from '@stacksjs/telephony'
      import type { Telephony, Call } from '@stacksjs/telephony'
      import { FakeTelephony } from '@stacksjs/telephony/testing'
      const provider: Telephony = new TwilioTelephony({ accountSid: 'AC' + 'a'.repeat(32), authToken: 'test', journal: new MemoryOperationJournal(), fetch: async () => { throw new Error('No network permitted') } })
      const fake: Telephony = new FakeTelephony()
      const candidate = (await fake.searchNumbers({country: 'CA'}))[0]!
      if (candidate.country !== 'CA') throw new Error('Country missing')
      const number = await fake.provisionNumber({phoneNumber: candidate.phoneNumber, voiceUrl:'https://app.example/voice'}, {operationKey:'purchase'})
      const call: Call = await fake.createCall({from: number.phoneNumber, to:'+14155550100', twiml: voiceResponse([{type:'hangup'}])}, {operationKey:'outbound'})
      if (call.status !== 'queued') throw new Error('Call missing')
      if (parseMediaEvent('{"event":"connected","protocol":"Call","version":"1.0.0"}').event !== 'connected') throw new Error('Parser missing')
      mediaMessage('MZ' + 'c'.repeat(32), new Uint8Array([255]))
      void provider
    `)
    const env = { PATH: process.env.PATH ?? '' }
    const runtime = Bun.spawnSync({ cmd: [process.execPath, '--no-env-file', '--config', join(dir, 'bunfig.toml'), 'run', join(dir, 'consumer.ts')], cwd: dir, env, stdout: 'pipe', stderr: 'pipe' })
    expect(runtime.stderr.toString()).toBe('')
    expect(runtime.exitCode).toBe(0)
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', noEmit: true, types: [], lib: ['ESNext', 'DOM', 'DOM.Iterable'] }, include: ['consumer.ts'] }))
    const types = Bun.spawnSync({ cmd: [process.execPath, resolve(import.meta.dir, '../../../../../node_modules/typescript/bin/tsc'), '--project', join(dir, 'tsconfig.json')], cwd: dir, env, stdout: 'pipe', stderr: 'pipe' })
    expect(types.stdout.toString() + types.stderr.toString()).toBe('')
    expect(types.exitCode).toBe(0)
  }
  finally { rmSync(dir, { recursive: true, force: true }) }
})
