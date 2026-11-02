import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startTestService } from '../src/service'

const fixture = join(import.meta.dir, 'fixtures/service')
const command = (script: string) => [process.execPath, '--no-env-file', `--config=${join(fixture, 'bunfig.toml')}`, '-e', script]

test('an HTTP response does not mark an owned service ready', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-service-'))
  await writeFile(join(directory, 'noop.ts'), '')
  await writeFile(join(directory, 'bunfig.toml'), `preload = [${JSON.stringify(join(directory, 'noop.ts'))}]`)
  await writeFile(join(directory, 'server.ts'), `
    import { notifyTestServiceReady } from ${JSON.stringify(join(import.meta.dir, '../src/service.ts'))}
    const server = Bun.serve({ port: 0, fetch(request) {
      if (new URL(request.url).pathname === '/ready') notifyTestServiceReady({ origin: server.url.origin })
      return new Response('listening')
    } })
    console.log(server.url.origin)
  `)
  const service = startTestService([process.execPath, '--no-env-file', `--config=${join(directory, 'bunfig.toml')}`, join(directory, 'server.ts')], { cwd: directory, startupTimeoutMs: 5000 })
  try {
    const reader = service.stdout!.getReader()
    const { value } = await reader.read()
    reader.releaseLock()
    const origin = new TextDecoder().decode(value).trim()
    let ready = false
    void service.ready.then(() => { ready = true }, () => {})
    expect((await fetch(origin)).status).toBe(200)
    expect(ready).toBe(false)
    await fetch(`${origin}/ready`)
    expect(await service.ready).toEqual({ origin })
  }
  finally {
    await service.stop()
    await rm(directory, { recursive: true, force: true })
  }
})

test('a ready service exit aborts work with the exit status', async () => {
  const service = startTestService(command(`
    import { notifyTestServiceReady } from ${JSON.stringify(join(import.meta.dir, '../src/service.ts'))}
    notifyTestServiceReady()
    setTimeout(() => process.exit(7), 80)
  `), { cwd: fixture })
  try {
    await service.ready
    await service.exited
    expect(service.signal.aborted).toBe(true)
    expect(service.signal.reason.message).toContain('exited 7')
  }
  finally { await service.stop() }
})

test('an exit before readiness rejects immediately with the child status', async () => {
  const service = startTestService(command('process.exit(9)'), { cwd: fixture, startupTimeoutMs: 5000 })
  try {
    await expect(service.ready).rejects.toThrow('exited 9')
    expect(await service.exited).toBe(9)
    expect(service.signal.aborted).toBe(true)
  }
  finally { await service.stop() }
})

test('a readiness deadline stops a stubborn child and leaves other servers alone', async () => {
  const unrelated = Bun.serve({ port: 0, fetch: () => new Response('unrelated') })
  const service = startTestService(command("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"), { cwd: fixture, startupTimeoutMs: 250, stopGraceMs: 50 })
  try {
    await expect(service.ready).rejects.toThrow('readiness timed out')
    await Promise.all([service.stop(), service.stop()])
    expect(service.signal.aborted).toBe(true)
    expect(await fetch(unrelated.url).then(response => response.text())).toBe('unrelated')
  }
  finally {
    await service.stop()
    unrelated.stop(true)
  }
})


test('a service can flush its readiness notification before immediately exiting', async () => {
  const service = startTestService(command(`
    import { notifyTestServiceReady } from ${JSON.stringify(join(import.meta.dir, '../src/service.ts'))}
    notifyTestServiceReady({ flushed: true }, (error) => {
      if (error) throw error
      console.log('readiness notification flushed')
      process.exit(7)
    })
    setTimeout(() => process.exit(9), 1000)
  `), { cwd: fixture, startupTimeoutMs: 5000 })
  const output = new Response(service.stdout).text()
  try {
    expect(await service.ready).toEqual({ flushed: true })
    expect(await service.exited).toBe(7)
    expect(await output).toBe('readiness notification flushed\n')
    expect(service.signal.aborted).toBe(true)
  }
  finally { await service.stop() }
})
