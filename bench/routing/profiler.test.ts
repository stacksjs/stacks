import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startProfileWorker } from './profiler'
import { assertParity, assertStableParity, PORT } from './runtime'
import { SCENARIOS } from './scenarios'
import { targetById } from './targets'

test('captures real production HTTP work only after the start handshake', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-http-profile-'))
  const output = join(directory, 'capture.json')
  const target = targetById('stacks')!
  const scenario = SCENARIOS.find(scenario => scenario.id === 'path-param')!
  const worker = startProfileWorker(target, scenario, output, 10_000)
  try {
    await worker.ready()
    const before = await assertParity(target, scenario)
    expect(await Bun.file(output).exists()).toBe(false)
    await worker.start()
    for (let i = 0; i < 100; i++) {
      const response = await fetch(`http://127.0.0.1:${PORT}${scenario.path}`)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-request-id')).toBeTruthy()
      expect(response.headers.get('set-cookie')).toContain('X-CSRF-Token=')
      expect(await response.text()).toBe('{"id":"42"}')
    }
    expect(await Bun.file(output).exists()).toBe(false)
    await worker.capture()
    const captured = await Bun.file(output).json()
    expect(typeof captured.functions).toBe('string')
    expect(typeof captured.bytecodes).toBe('string')
    expect(Array.isArray(captured.stackTraces.traces)).toBe(true)
    assertStableParity(target, scenario, before, await assertParity(target, scenario))
  }
  finally {
    const logs = await worker.close()
    expect(logs.stderr).toContain('stacks (secure) listening')
    rmSync(directory, { recursive: true, force: true })
  }
}, 20_000)

test('reports failed worker startup instead of waiting for the whole deadline', async () => {
  const worker = startProfileWorker(targetById('stacks')!, SCENARIOS[0]!, '', 10_000)
  try {
    await expect(worker.ready()).rejects.toThrow('requires an output path and IPC parent')
  }
  finally {
    await worker.close()
  }
}, 15_000)
