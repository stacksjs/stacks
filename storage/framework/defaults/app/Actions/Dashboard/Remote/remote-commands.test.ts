// Running a known operation on a configured host (stacksjs/stacks#960).
//
// What is tested here is the security model, not SSH. The transport is
// injected, so every rule below is asserted without a network: which hosts can
// be reached, who may reach them, what is recorded, and what happens when any
// of that is not configured.
//
// The properties worth stating up front, because each is a way this surface
// becomes remote code execution if it is wrong:
//
//   - a request cannot name a host, only a key in the registry
//   - a request cannot name a command, only a key in the registry
//   - a host without a pinned key is refused rather than trusted
//   - authorization fails CLOSED when no gate is configured
//   - a run is recorded before it starts, not only when it finishes

import type { UserModel } from '@stacksjs/orm'
import type { RemoteAuditSink, RemoteCommand, RemoteHost } from './remote-commands'
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  authorize,
  clampOutput,
  normalizeTimeout,
  RemoteCommandError,
  resolveCommand,
  resolveHost,
  runRemoteCommand,
  sshArgv,
} from './remote-commands'

const host: RemoteHost = {
  key: 'app',
  host: 'app.example.com',
  user: 'deploy',
  knownHosts: 'app.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIexample',
}

const hosts: RemoteHost[] = [
  host,
  { key: 'db', host: 'db.example.com', user: 'deploy', port: 2222, identityFile: '/keys/db', knownHosts: 'db.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIdb' },
  { key: 'unpinned', host: 'new.example.com', user: 'deploy', knownHosts: '' },
]

const commands: RemoteCommand[] = [
  { key: 'disk', description: 'Free space', argv: ['df', '-h'] },
  { key: 'restart-api', description: 'Restart the API', argv: ['systemctl', 'restart', 'api'], hosts: ['app'] },
]

const user = { id: 1, email: 'ops@example.com' } as unknown as UserModel

let recorded: string[] = []
const audit: RemoteAuditSink = {
  async started(entry) {
    recorded.push(`started:${entry.user}:${entry.hostKey}:${entry.commandKey}`)
  },
  async finished(entry) {
    recorded.push(`finished:${entry.hostKey}:${entry.commandKey}:${entry.exitCode}:${entry.timedOut}`)
  },
}

beforeEach(() => {
  recorded = []
})

const ok = async (): Promise<{ exitCode: number, stdout: string, stderr: string, timedOut: boolean }> =>
  ({ exitCode: 0, stdout: 'out', stderr: '', timedOut: false })

describe('resolveHost', () => {
  it('resolves a declared host by key', () => {
    expect(resolveHost(hosts, 'app')).toBe(host)
  })

  it('404s a key nobody declared', () => {
    // The property that matters: a request names a KEY, and a key that is not
    // in config reaches nothing. There is no path from the request to a
    // hostname.
    expect(() => resolveHost(hosts, 'evil.example.com')).toThrow(/No configured host/)
    try {
      resolveHost(hosts, 'nope')
    }
    catch (error) {
      expect((error as RemoteCommandError).status).toBe(404)
    }
  })

  it('refuses a host with no pinned key rather than trusting one on first contact', () => {
    // Accepting a key on first contact is what makes a session into a
    // long-lived box MITM-open. `sshExec` in ts-cloud does exactly that, on
    // purpose, for boxes a minute old - which is why this does not reuse it.
    expect(() => resolveHost(hosts, 'unpinned')).toThrow(/no pinned host key/)
  })

  it('rejects a non-string key', () => {
    for (const key of [undefined, null, 42, {}, ''])
      expect(() => resolveHost(hosts, key)).toThrow(RemoteCommandError)
  })
})

describe('resolveCommand', () => {
  it('resolves a declared command', () => {
    expect(resolveCommand(commands, 'disk', host).argv).toEqual(['df', '-h'])
  })

  it('404s a command nobody declared', () => {
    // No request carries a command, so there is nothing to escape and no shell
    // to reach.
    expect(() => resolveCommand(commands, 'rm -rf /', host)).toThrow(/No configured command/)
  })

  it('403s a command that is scoped away from this host', () => {
    // 403 rather than 404: the command exists, this host is not one of its
    // targets. Scoping `restart-api` to the app box is a deliberate
    // restriction, and reporting it as "not found" would read as a typo.
    const db = resolveHost(hosts, 'db')
    expect(() => resolveCommand(commands, 'restart-api', db)).toThrow(/not permitted on host/)
    try {
      resolveCommand(commands, 'restart-api', db)
    }
    catch (error) {
      expect((error as RemoteCommandError).status).toBe(403)
    }
  })

  it('lets an unscoped command run anywhere', () => {
    expect(resolveCommand(commands, 'disk', resolveHost(hosts, 'db')).key).toBe('disk')
  })
})

describe('sshArgv', () => {
  it('verifies the host key against the pinned file', () => {
    const argv = sshArgv(host, commands[0]!, '/tmp/known_hosts')
    expect(argv).toContain('StrictHostKeyChecking=yes')
    expect(argv).toContain('UserKnownHostsFile=/tmp/known_hosts')
  })

  it('fails rather than prompting for a password', () => {
    // A prompt on a server has nobody to answer it, so the request would hang
    // until it timed out with no useful message.
    expect(sshArgv(host, commands[0]!, '/tmp/kh')).toContain('BatchMode=yes')
  })

  it('passes the remote argv after `--`, as separate arguments', () => {
    // Never joined into a string. A joined command is a shell command, and a
    // shell command is where an injection would live if one could reach it.
    const argv = sshArgv(host, commands[1]!, '/tmp/kh')
    expect(argv.slice(argv.indexOf('--'))).toEqual(['--', 'systemctl', 'restart', 'api'])
  })

  it('carries the port and identity when the host declares them', () => {
    const argv = sshArgv(hosts[1]!, commands[0]!, '/tmp/kh')
    expect(argv).toContain('-p')
    expect(argv[argv.indexOf('-p') + 1]).toBe('2222')
    expect(argv[argv.indexOf('-i') + 1]).toBe('/keys/db')
    // Without this ssh may offer an agent key instead of the configured one.
    expect(argv).toContain('IdentitiesOnly=yes')
  })

  it('addresses the host as user@host', () => {
    expect(sshArgv(host, commands[0]!, '/tmp/kh')).toContain('deploy@app.example.com')
  })
})

describe('authorize', () => {
  it('401s without a user', async () => {
    expect(authorize(() => true, null, host, commands[0]!)).rejects.toThrow(/Authentication is required/)
  })

  it('fails CLOSED when no authorizer is configured', async () => {
    // The opposite of the websocket authenticator next door, which proceeds
    // when none is installed. For a surface that runs commands on a server, an
    // app that has not defined the gate must get a refusal rather than a shell.
    expect(authorize(undefined, user, host, commands[0]!)).rejects.toThrow(/not authorized on this application/)
  })

  it('403s when the gate says no', async () => {
    expect(authorize(() => false, user, host, commands[0]!)).rejects.toThrow(/not permitted to run/)
  })

  it('passes both keys to the gate, so an app can scope by either', async () => {
    const seen: string[] = []
    await authorize((_user, hostKey, commandKey) => {
      seen.push(hostKey, commandKey)
      return true
    }, user, host, commands[1]!)

    expect(seen).toEqual(['app', 'restart-api'])
  })
})

describe('runRemoteCommand', () => {
  const context = {
    user,
    hosts,
    commands,
    authorizer: () => true,
    run: ok,
    audit,
  }

  it('records the run before it starts and again when it ends', async () => {
    // A run recorded only on completion loses the two worth having: the command
    // that hung, and the one whose process died with the box.
    await runRemoteCommand({ hostKey: 'app', commandKey: 'disk' }, context)

    expect(recorded).toEqual([
      'started:ops@example.com:app:disk',
      'finished:app:disk:0:false',
    ])
  })

  it('records nothing for a run that was refused', async () => {
    // Authorization happens before the audit entry, so a refusal is not an
    // audit record saying somebody ran something they did not.
    expect(runRemoteCommand({ hostKey: 'app', commandKey: 'disk' }, { ...context, authorizer: () => false }))
      .rejects.toThrow(/not permitted/)

    await Bun.sleep(0)
    expect(recorded).toEqual([])
  })

  it('records nothing for a host that does not exist', async () => {
    expect(runRemoteCommand({ hostKey: 'ghost', commandKey: 'disk' }, context)).rejects.toThrow(/No configured host/)
    await Bun.sleep(0)
    expect(recorded).toEqual([])
  })

  it('reports the outcome, including a timeout', async () => {
    const result = await runRemoteCommand({ hostKey: 'app', commandKey: 'disk' }, {
      ...context,
      run: async () => ({ exitCode: 143, stdout: 'partial', stderr: 'killed', timedOut: true }),
    })

    expect(result.timedOut).toBeTrue()
    expect(result.exitCode).toBe(143)
    expect(recorded.at(-1)).toBe('finished:app:disk:143:true')
  })

  it('reports a non-zero exit as a result rather than an error', async () => {
    // `systemctl restart` failing is information the operator wants, not an
    // exception - the run happened and the audit record says what it did.
    const result = await runRemoteCommand({ hostKey: 'app', commandKey: 'disk' }, {
      ...context,
      run: async () => ({ exitCode: 1, stdout: '', stderr: 'no such unit', timedOut: false }),
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe('no such unit')
  })
})

describe('output and timeout bounds', () => {
  it('truncates with a marker rather than cutting silently', () => {
    const clamped = clampOutput('x'.repeat(100), 10)
    expect(clamped).toStartWith('xxxxxxxxxx')
    expect(clamped).toContain('truncated at 10 characters')
  })

  it('leaves output within the limit alone', () => {
    expect(clampOutput('short', 10)).toBe('short')
  })

  it('caps a timeout rather than honouring an unbounded one', () => {
    expect(normalizeTimeout(undefined)).toBe(30_000)
    expect(normalizeTimeout(5_000)).toBe(5_000)
    expect(normalizeTimeout(10_000_000)).toBe(300_000)
  })

  it('rejects a timeout that is not a positive number', () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => normalizeTimeout(value)).toThrow(RemoteCommandError)
  })
})
