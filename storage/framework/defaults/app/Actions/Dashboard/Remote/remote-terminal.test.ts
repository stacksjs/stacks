import type { UserModel } from '@stacksjs/orm'
import type { RemoteHost } from './remote-commands'
import type { TerminalAuditSink, TerminalEvent, TerminalProcess, TerminalSessionOptions } from './remote-terminal'
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { sshTerminalArgv } from './remote-commands'
import { TerminalSessions } from './remote-terminal'
import { createPtySpawner } from './ssh-runner'
import { encodeTerminalEvent, terminalEventStream } from './terminal-sessions'

/**
 * Interactive terminal sessions (stacksjs/stacks#960). Every rule is asserted
 * against an injected process, then the real PTY spawner is exercised with a
 * local shell standing in for ssh.
 */

const alice = { id: 1, email: 'alice@example.com' } as unknown as UserModel
const bob = { id: 2, email: 'bob@example.com' } as unknown as UserModel

const shellHost: RemoteHost = { key: 'app', host: 'app.example.com', user: 'deploy', knownHosts: 'app.example.com ssh-ed25519 AAAA', terminal: true }
const commandOnlyHost: RemoteHost = { key: 'db', host: 'db.example.com', user: 'deploy', knownHosts: 'db.example.com ssh-ed25519 AAAA' }
const hosts = [shellHost, commandOnlyHost]

const allowAll = () => true

interface Fake {
  process: TerminalProcess
  written: string[]
  sizes: Array<[number, number]>
  killed: boolean
  emit: (text: string) => void
  exit: (code: number) => void
}

function fakeProcess(): Fake {
  let emit: (bytes: Uint8Array) => void = () => {}
  let resolveExit!: (code: number) => void
  const fake: Fake = {
    written: [],
    sizes: [],
    killed: false,
    emit: text => emit(new TextEncoder().encode(text)),
    exit: code => resolveExit(code),
    process: undefined as unknown as TerminalProcess,
  }
  fake.process = {
    write: data => fake.written.push(data),
    resize: (cols, rows) => fake.sizes.push([cols, rows]),
    kill: () => {
      fake.killed = true
      resolveExit(-1)
    },
    exited: new Promise<number>((resolve) => { resolveExit = resolve }),
  }
  ;(fake as { bind: (fn: (bytes: Uint8Array) => void) => void } & Fake).bind = (fn) => { emit = fn }
  return fake
}

function recordingAudit(): TerminalAuditSink & { log: string[] } {
  const log: string[] = []
  return {
    log,
    opened: entry => void log.push(`opened ${entry.user} ${entry.hostKey}`),
    input: entry => void log.push(`input ${entry.line}`),
    closed: entry => void log.push(`closed ${entry.reason} in=${entry.bytesIn} out=${entry.bytesOut}`),
  }
}

function sessions(overrides: Partial<TerminalSessionOptions> = {}) {
  const fakes: Fake[] = []
  const audit = recordingAudit()
  const manager = new TerminalSessions({
    spawn: (_host, size, onOutput) => {
      const fake = fakeProcess()
      ;(fake as unknown as { bind: (fn: (bytes: Uint8Array) => void) => void }).bind(onOutput)
      fake.sizes.push([size.cols, size.rows])
      fakes.push(fake)
      return fake.process
    },
    audit,
    ...overrides,
  })
  return { manager, fakes, audit }
}

async function take(events: AsyncIterable<TerminalEvent>, count: number): Promise<TerminalEvent[]> {
  const out: TerminalEvent[] = []
  for await (const event of events) {
    out.push(event)
    if (out.length === count)
      break
  }
  return out
}

const text = (event: TerminalEvent) => (event.type === 'output' ? new TextDecoder().decode(event.data) : `<${event.reason}>`)

describe('opening a terminal', () => {
  it('refuses when the app has not defined the gate - closed, not open', async () => {
    const { manager, fakes } = sessions()
    await expect(manager.open({ user: alice, hosts, hostKey: 'app', cols: 80, rows: 24 })).rejects.toThrow('not authorized on this application')
    expect(fakes).toHaveLength(0)
  })

  it('refuses a host that only allows named commands', async () => {
    const { manager } = sessions()
    await expect(manager.open({ user: alice, hosts, hostKey: 'db', authorizer: allowAll, cols: 80, rows: 24 })).rejects.toThrow('does not allow terminal sessions')
  })

  it('asks the gate about the host, and honours a refusal', async () => {
    const { manager } = sessions()
    const asked: string[] = []
    await expect(manager.open({
      user: alice,
      hosts,
      hostKey: 'app',
      authorizer: (_user, hostKey) => {
        asked.push(hostKey)
        return false
      },
      cols: 80,
      rows: 24,
    })).rejects.toThrow('not permitted to open a terminal on "app"')
    expect(asked).toEqual(['app'])
  })

  it('refuses an unauthenticated request, an unknown host and an unpinned one', async () => {
    const { manager } = sessions()
    await expect(manager.open({ user: null, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })).rejects.toThrow('Authentication is required')
    await expect(manager.open({ user: alice, hosts, hostKey: 'nope', authorizer: allowAll, cols: 80, rows: 24 })).rejects.toThrow('No configured host')
    const unpinned = [{ ...shellHost, knownHosts: '' }]
    await expect(manager.open({ user: alice, hosts: unpinned, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })).rejects.toThrow('no pinned host key')
  })

  it('records the session before the process starts, at the size asked for', async () => {
    const { manager, fakes, audit } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 120, rows: 40 })
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(audit.log[0]).toBe('opened alice@example.com app')
    expect(fakes[0]!.sizes).toEqual([[120, 40]])
  })

  it('caps the sessions one user may hold', async () => {
    const { manager } = sessions({ maxSessionsPerUser: 1 })
    await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    await expect(manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })).rejects.toThrow('already have 1 terminal sessions open')
    // Another user is not affected.
    await manager.open({ user: bob, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
  })

  it('refuses a size no terminal has', async () => {
    const { manager } = sessions()
    await expect(manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 0, rows: 24 })).rejects.toThrow('whole columns and rows')
    await expect(manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: '80; rm', rows: 24 })).rejects.toThrow('whole columns and rows')
  })
})

describe('a session belongs to whoever opened it', () => {
  it('answers another user exactly as it answers an id that never existed', async () => {
    const { manager, fakes } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })

    const missing = await manager.input('0'.repeat(32), bob, 'ls\r').catch((error: Error) => error.message)
    const notTheirs = await manager.input(id, bob, 'ls\r').catch((error: Error) => error.message)
    expect(notTheirs).toBe(missing)
    expect(() => manager.watch(id, bob)).toThrow('No such terminal session')
    expect(() => manager.resize(id, bob, 100, 30)).toThrow('No such terminal session')
    await expect(manager.close(id, bob)).rejects.toThrow('No such terminal session')
    expect(fakes[0]!.written).toEqual([])
  })
})

describe('input, output and resize', () => {
  it('writes input, resizes, and records each typed line', async () => {
    const { manager, fakes, audit } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })

    await manager.input(id, alice, 'uptime\r')
    await manager.input(id, alice, 'tail -f ')
    await manager.input(id, alice, 'app.log\r')
    manager.resize(id, alice, 132, 40)

    expect(fakes[0]!.written.join('')).toBe('uptime\rtail -f app.log\r')
    expect(fakes[0]!.sizes.at(-1)).toEqual([132, 40])
    expect(audit.log.filter(line => line.startsWith('input'))).toEqual(['input uptime', 'input tail -f app.log'])
  })

  it('refuses an empty or oversized input', async () => {
    const { manager } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    await expect(manager.input(id, alice, '')).rejects.toThrow('non-empty string')
    await expect(manager.input(id, alice, 'x'.repeat(64 * 1024 + 1))).rejects.toThrow('at most')
  })

  it('replays what a reconnecting viewer missed, and nothing it already saw', async () => {
    const { manager, fakes } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    fakes[0]!.emit('one ')
    fakes[0]!.emit('two ')
    fakes[0]!.emit('three')

    expect((await take(manager.watch(id, alice), 3)).map(text)).toEqual(['one ', 'two ', 'three'])
    const resumed = await take(manager.watch(id, alice, 2), 1)
    expect(resumed.map(text)).toEqual(['three'])
  })

  it('keeps the replay buffer bounded', async () => {
    const { manager, fakes } = sessions({ replayBytes: 10 })
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    for (const chunk of ['aaaa', 'bbbb', 'cccc', 'dddd'])
      fakes[0]!.emit(chunk)
    expect((await take(manager.watch(id, alice), 2)).map(text)).toEqual(['cccc', 'dddd'])
  })

  it('delivers live output to a watching viewer, then the end', async () => {
    const { manager, fakes } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    const watching = take(manager.watch(id, alice), 3)
    fakes[0]!.emit('$ ')
    fakes[0]!.emit('bye\r\n')
    fakes[0]!.exit(0)
    expect((await watching).map(text)).toEqual(['$ ', 'bye\r\n', '<exited>'])
  })
})

describe('a session does not outlive its purpose', () => {
  it('ends after the idle timeout, kills the shell, and says why', async () => {
    const { manager, fakes, audit } = sessions({ idleTimeoutMs: 20, detachGraceMs: 10_000 })
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    const watching = take(manager.watch(id, alice), 1)
    expect((await watching).map(text)).toEqual(['<idle>'])
    expect(fakes[0]!.killed).toBe(true)
    expect(audit.log.at(-1)).toStartWith('closed idle')
    expect(manager.size).toBe(0)
  })

  it('input keeps it alive; the max duration ends it regardless', async () => {
    const { manager, fakes, audit } = sessions({ idleTimeoutMs: 40, maxDurationMs: 120, detachGraceMs: 10_000 })
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    for (let i = 0; i < 4; i++) {
      await Bun.sleep(25)
      await manager.input(id, alice, 'x')
    }
    expect(fakes[0]!.killed).toBe(false)
    await Bun.sleep(60)
    expect(fakes[0]!.killed).toBe(true)
    expect(audit.log.at(-1)).toStartWith('closed max-duration')
  })

  it('ends when nobody attaches, and a grace period after the last viewer leaves', async () => {
    const { manager, fakes, audit } = sessions({ detachGraceMs: 30 })
    await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    await Bun.sleep(60)
    expect(fakes[0]!.killed).toBe(true)
    expect(audit.log.at(-1)).toStartWith('closed detached')

    const second = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    const viewer = manager.watch(second.id, alice)[Symbol.asyncIterator]()
    await Bun.sleep(60)
    expect(fakes[1]!.killed).toBe(false)
    await viewer.return!()
    await Bun.sleep(60)
    expect(fakes[1]!.killed).toBe(true)
  })

  it('records the partial line still pending when the session closes, and closes once', async () => {
    const { manager, audit } = sessions()
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    await manager.input(id, alice, 'rm -rf /tmp/build')
    await manager.close(id, alice)
    await expect(manager.close(id, alice)).rejects.toThrow('No such terminal session')
    expect(audit.log.slice(1)).toEqual(['input rm -rf /tmp/build', 'closed closed in=17 out=0'])
  })
})

describe('the event stream', () => {
  it('sends output as base64 with its sequence number, so split characters survive', () => {
    // "é" is two bytes; a PTY may deliver them in different chunks.
    const firstHalf = new Uint8Array([0xC3])
    expect(encodeTerminalEvent({ type: 'output', seq: 7, data: firstHalf })).toBe('id: 7\nevent: output\ndata: ww==\n\n')
    expect(encodeTerminalEvent({ type: 'exit', reason: 'idle', exitCode: null })).toBe('event: exit\ndata: {"reason":"idle","exitCode":null}\n\n')
  })

  it('stops watching when the browser goes away', async () => {
    const { manager, fakes } = sessions({ detachGraceMs: 20 })
    const { id } = await manager.open({ user: alice, hosts, hostKey: 'app', authorizer: allowAll, cols: 80, rows: 24 })
    const body = terminalEventStream(manager.watch(id, alice), 1_000)
    const reader = body.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(': connected\n\n')
    await reader.cancel()
    await Bun.sleep(50)
    expect(fakes[0]!.killed).toBe(true)
  })
})

describe('the PTY spawner', () => {
  it('runs ssh with a forced remote PTY and the pinned-key options before the destination', () => {
    const argv = sshTerminalArgv({ ...shellHost, port: 2222 }, '/tmp/kh')
    expect(argv.slice(-4)).toEqual(['-tt', '-o', 'ServerAliveInterval=30', 'deploy@app.example.com'])
    expect(argv).toContain('StrictHostKeyChecking=yes')
    expect(argv).toContain('UserKnownHostsFile=/tmp/kh')
    expect(argv).not.toContain('--')
  })

  it('carries output, input and a window resize through a real PTY, and cleans up', async () => {
    const before = readdirSync(tmpdir()).filter(name => name.startsWith('stacks-terminal-')).length
    let knownHosts = ''
    const spawn = createPtySpawner((_host, path) => {
      knownHosts = path
      return ['sh', '-c', 'stty size; read line; stty size; echo "got:$line"']
    })

    let output = ''
    const process = await spawn(shellHost, { cols: 100, rows: 30 }, (bytes) => { output += new TextDecoder().decode(bytes) })
    expect(existsSync(knownHosts)).toBe(true)

    await Bun.sleep(150)
    process.resize(132, 40)
    process.write('hello\r')
    expect(await process.exited).toBe(0)
    await Bun.sleep(20)

    expect(output).toContain('30 100')
    expect(output).toContain('40 132')
    expect(output).toContain('got:hello')
    expect(existsSync(knownHosts)).toBe(false)
    expect(readdirSync(tmpdir()).filter(name => name.startsWith('stacks-terminal-')).length).toBe(before)
  })
})

/**
 * End to end through a real sshd: the production spawner, ssh with the pinned
 * key, a remote PTY. The test starts its own sshd on a loopback port with a
 * throwaway host key and authorized key, so it needs no system SSH server and
 * changes nothing outside a temp directory. Skipped where there is no sshd.
 */
const SSHD = ['/usr/sbin/sshd', '/usr/bin/sshd'].find(path => existsSync(path))

describe.if(Boolean(SSHD))('a terminal session over real SSH', () => {
  async function startSshd() {
    const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { userInfo } = await import('node:os')
    const dir = mkdtempSync(join(tmpdir(), 'stacks-sshd-'))
    for (const name of ['host_key', 'client_key'])
      Bun.spawnSync(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', join(dir, name)])
    writeFileSync(join(dir, 'authorized_keys'), readFileSync(join(dir, 'client_key.pub')), { mode: 0o600 })
    const port = 20000 + Math.floor(Math.random() * 20000)
    writeFileSync(join(dir, 'sshd_config'), [
      `Port ${port}`,
      'ListenAddress 127.0.0.1',
      `HostKey ${join(dir, 'host_key')}`,
      `AuthorizedKeysFile ${join(dir, 'authorized_keys')}`,
      `PidFile ${join(dir, 'sshd.pid')}`,
      'UsePAM no',
      'StrictModes no',
      'PasswordAuthentication no',
      'KbdInteractiveAuthentication no',
      'LogLevel ERROR',
      // The same shell whoever runs this, rather than their login shell -
      // some report 0 for `exit 7`, which would make the exit status untestable.
      'ForceCommand /bin/sh -i',
    ].join('\n'))
    const daemon = Bun.spawn([SSHD!, '-D', '-f', join(dir, 'sshd_config'), '-E', join(dir, 'sshd.log')])
    for (let i = 0; i < 50; i++) {
      if (Bun.spawnSync(['nc', '-z', '127.0.0.1', String(port)]).exitCode === 0)
        break
      await Bun.sleep(100)
    }
    const hostKey = readFileSync(join(dir, 'host_key.pub'), 'utf8').split(' ').slice(0, 2).join(' ')
    const host: RemoteHost = {
      key: 'local',
      host: '127.0.0.1',
      port,
      user: userInfo().username,
      identityFile: join(dir, 'client_key'),
      knownHosts: `[127.0.0.1]:${port} ${hostKey}`,
      terminal: true,
    }
    return {
      host,
      stop: () => {
        daemon.kill()
        rmSync(dir, { force: true, recursive: true })
      },
    }
  }

  async function readUntil(events: AsyncIterator<TerminalEvent>, pattern: RegExp, sink: { text: string }): Promise<TerminalEvent | undefined> {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      const next = await Promise.race([events.next(), Bun.sleep(deadline - Date.now()).then(() => null)])
      if (!next || next.done)
        return undefined
      if (next.value.type === 'exit')
        return next.value
      sink.text += new TextDecoder().decode(next.value.data)
      if (pattern.test(sink.text))
        return next.value
    }
    return undefined
  }

  it('runs a shell on the host, resizes it, and records what was typed', async () => {
    const sshd = await startSshd()
    const audit = recordingAudit()
    const manager = new TerminalSessions({ spawn: createPtySpawner(), audit })
    try {
      const { id } = await manager.open({ user: alice, hosts: [sshd.host], hostKey: 'local', authorizer: allowAll, cols: 90, rows: 25 })
      const events = manager.watch(id, alice)[Symbol.asyncIterator]()
      const screen = { text: '' }

      await manager.input(id, alice, 'echo answer=$((6*7)); stty size\r')
      await readUntil(events, /answer=42[\s\S]*25 90/, screen)
      expect(screen.text).toContain('answer=42')
      expect(screen.text).toMatch(/25 90/)

      manager.resize(id, alice, 120, 33)
      await Bun.sleep(200)
      await manager.input(id, alice, 'stty size; exit 7\r')
      // Reads to the end: no pattern matches, so this returns the exit event.
      const end = await readUntil(events, /(?!)/, screen)
      expect(screen.text).toMatch(/33 120/)
      expect(end).toEqual({ type: 'exit', reason: 'exited', exitCode: 7 })

      for (let i = 0; i < 50 && manager.size > 0; i++)
        await Bun.sleep(100)
      expect(manager.size).toBe(0)
      expect(audit.log).toContain('input echo answer=$((6*7)); stty size')
      expect(audit.log.at(-1)).toMatch(/^closed exited/)
    }
    finally {
      await manager.closeAll()
      sshd.stop()
    }
  }, 30_000)

  it('refuses a host whose key does not match the pinned one', async () => {
    const { rmSync } = await import('node:fs')
    const sshd = await startSshd()
    const manager = new TerminalSessions({ spawn: createPtySpawner(), audit: recordingAudit() })
    const forgedPath = `${tmpdir()}/stacks-forged-${process.pid}`
    try {
      // A key the server does not have, pinned as if it were the host's: the
      // man-in-the-middle case, from the client's side.
      Bun.spawnSync(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', forgedPath])
      const forgedKey = (await Bun.file(`${forgedPath}.pub`).text()).split(' ').slice(0, 2).join(' ')
      const pinnedWrong = { ...sshd.host, knownHosts: `[127.0.0.1]:${sshd.host.port} ${forgedKey}` }

      const { id } = await manager.open({ user: alice, hosts: [pinnedWrong], hostKey: 'local', authorizer: allowAll, cols: 80, rows: 24 })
      const screen = { text: '' }
      await readUntil(manager.watch(id, alice)[Symbol.asyncIterator](), /Host key verification failed/, screen)
      expect(screen.text).toContain('Host key verification failed')
    }
    finally {
      await manager.closeAll()
      sshd.stop()
      rmSync(forgedPath, { force: true })
      rmSync(`${forgedPath}.pub`, { force: true })
    }
  }, 30_000)
})
