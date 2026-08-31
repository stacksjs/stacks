/**
 * `config/logging.ts` vs. whoever logs first.
 *
 * `@stacksjs/config` loads the project's config files asynchronously, so the
 * read this package does during its own lazy init can predate them. That used
 * to be permanent - the init was memoized, transports were registered only
 * inside it - so whichever code logged first decided whether `config/logging.ts`
 * counted at all, and `LOG_LEVEL=debug` made losing that race routine because
 * it makes boot-time `log.debug()` calls actually fire. Turning on debug
 * logging to investigate a problem switched off the transports you would have
 * read it in (stacksjs/stacks#2397).
 *
 * These run in child processes on purpose. The thing under test is what the
 * module does on the way up, once per process, and no amount of in-process
 * setup can rewind that.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const SRC = new URL('../src/index.ts', import.meta.url).pathname

interface ChildResult {
  attached: string[]
  seen: string[]
  level: string
}

/**
 * Run `body` in a fresh process with the logging source imported as `lg`, and
 * return what it printed.
 *
 * The child runs from a temp directory so it picks up no `bunfig.toml`, and
 * therefore no preload that would import the real config layer and install an
 * anchor of its own. `@stacksjs/*` still resolves: those imports are resolved
 * relative to the source file, not the working directory.
 */
async function inChildProcess(body: string, env: Record<string, string> = {}): Promise<ChildResult> {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-logging-race-'))
  const script = join(directory, 'child.ts')

  await writeFile(script, `
    const KEY = Symbol.for('@stacksjs/config:overridesReady')
    const seen: string[] = []

    /**
     * Stand in for the config layer: installs the readiness anchor and hands
     * back the resolver, so a test says exactly when the config lands rather
     * than racing a timer against the logger's own startup.
     */
    function pendingConfig(): (section: unknown) => void {
      let land: (value: unknown) => void = () => {}
      ;(globalThis as any)[KEY] = new Promise((resolve) => { land = resolve })
      return (section: unknown) => land({ logging: section })
    }

    /** A transport shaped like one declared in \`config/logging.ts\`. */
    function declaredTransport(name = 'declared') {
      return { name, log: (record: any) => { seen.push(record.level + ':' + record.message) } }
    }

    const lg = await import(${JSON.stringify(SRC)})
    const { log } = lg

    ${body}

    console.log('__RESULT__' + JSON.stringify({
      attached: lg.transports().map((t: any) => t.name),
      seen,
      level: lg.currentLevel(),
    }))
  `)

  try {
    const child = Bun.spawn(['bun', 'run', script], {
      cwd: directory,
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
    const marker = stdout.split('__RESULT__')[1]
    if (code !== 0 || !marker) {
      const stderr = await new Response(child.stderr).text()
      throw new Error(`child exited ${code}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`)
    }
    return JSON.parse(marker.trim()) as ChildResult
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('transports declared in config/logging.ts', () => {
  it('attaches them even when something logged before the config loaded', async () => {
    // The reported failure, start to finish: a boot-time debug line initializes
    // the logger against a config that has not landed, and the transport
    // declared in `config/logging.ts` is dropped for the life of the process.
    const result = await inChildProcess(`
      const land = pendingConfig()
      await log.debug('logged during boot, before the config lands')
      land({ transports: [declaredTransport()] })
      await lg.logger()
      await log.info('after the config landed')
    `, { LOG_LEVEL: 'debug' })

    expect(result.attached).toEqual(['declared'])
    // The boot line is genuinely not deliverable - the transport did not exist
    // when it was emitted. Everything from the config landing onwards is.
    expect(result.seen).toEqual(['info:after the config landed'])
  })

  it('attaches them when nothing logged first', async () => {
    // The control. This path always worked, and has to keep working: the fix
    // must not trade one ordering for the other.
    const result = await inChildProcess(`
      const land = pendingConfig()
      land({ transports: [declaredTransport()] })
      await lg.logger()
      await log.info('first line of the process')
    `)

    expect(result.attached).toEqual(['declared'])
    expect(result.seen).toEqual(['info:first line of the process'])
  })

  it('attaches each declared transport exactly once', async () => {
    // The config is read in two places now - the init's snapshot and the
    // refresh - and several call sites can ask for the refresh. A transport
    // attached twice would deliver every record twice.
    const result = await inChildProcess(`
      const land = pendingConfig()
      land({ transports: [declaredTransport()] })
      await lg.logger()
      await log.info('one')
      await log.info('two')
    `)

    expect(result.attached).toEqual(['declared'])
    expect(result.seen).toEqual(['info:one', 'info:two'])
  })

  it('reaches a transport that wants the debug records the console suppresses', async () => {
    // A transport is allowed to be more verbose than the terminal. That relies
    // on `log.debug`'s fast path not bailing out before the config has been
    // read - which is what it did, because "no transports attached" looked
    // like a settled fact while `config/logging.ts` was still loading.
    const result = await inChildProcess(`
      const land = pendingConfig()
      await log.debug('too early to be delivered anywhere')
      land({ transports: [declaredTransport()] })
      await lg.logger()
      await log.debug('shipped to the transport, not to the console')
    `, { LOG_LEVEL: 'info' })

    expect(result.attached).toEqual(['declared'])
    expect(result.seen).toEqual(['debug:shipped to the transport, not to the console'])
  })
})

describe('level declared in config/logging.ts', () => {
  it('enables debug output on its own, with no LOG_LEVEL set', async () => {
    // `log.debug` used to consult `process.env.LOG_LEVEL` directly, so
    // `level: 'debug'` in the config file never enabled a single debug line.
    const result = await inChildProcess(`
      const land = pendingConfig()
      land({ level: 'debug', transports: [declaredTransport()] })
      await lg.logger()
      await log.debug('enabled by the config file alone')
    `, { LOG_LEVEL: '' })

    expect(result.level).toBe('debug')
    expect(result.seen).toEqual(['debug:enabled by the config file alone'])
  })

  it('still loses to LOG_LEVEL, which outranks it', async () => {
    // Precedence is env > config > default, and stays that way.
    const result = await inChildProcess(`
      const land = pendingConfig()
      land({ level: 'debug', transports: [declaredTransport()] })
      await lg.logger()
      await log.debug('below the console threshold')
      await log.warn('kept')
    `, { LOG_LEVEL: 'warning' })

    expect(result.level).toBe('warning')
    // The transport still sees the debug record: an unfiltered transport is
    // allowed to be more verbose than the terminal, and `level` here is about
    // what the console prints. Asserted rather than assumed, because the fix
    // touches the same fast path that decides it.
    expect(result.seen).toEqual(['debug:below the console threshold', 'warning:kept'])
  })
})

describe('without a config layer', () => {
  it('logs against env and defaults rather than waiting for one', async () => {
    // A compiled binary skips config loading entirely, so nothing ever anchors
    // a readiness Promise. Waiting on one that will not arrive would hang every
    // log call in the process.
    const result = await inChildProcess(`
      await log.info('no config in this process')
      await lg.logger()
      await log.debug('still nothing to wait for')
    `, { LOG_LEVEL: 'debug' })

    expect(result.attached).toEqual([])
    expect(result.level).toBe('debug')
  })
})
