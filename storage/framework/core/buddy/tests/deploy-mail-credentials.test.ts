/**
 * Mailbox passwords and the deploy log.
 *
 * The shared-mail reconcile used to print `<address>  <password>` for every
 * mailbox it created. On a GitHub Actions deploy that put a live mailbox
 * password in the run log in plain text - one that came from the encrypted
 * .env.production, so the operator already had it and printing it served
 * nobody. The rules pinned here:
 *
 *   - a password from config/email.ts or the environment is never printed;
 *   - a generated one is printed only to an interactive terminal outside CI,
 *     and otherwise the log says where the encrypted copy went;
 *   - rotating managed MAIL_PASSWORD_<LOCALPART> reaches an existing mailbox.
 *     The reconcile used to report an existing mailbox as current without
 *     looking, so rotating a leaked password changed the env file and nothing
 *     else.
 */
import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { canRevealSecrets, reportMailboxCredentials, reportRecoveryReconcile, resolveMailboxesWithSkipped, resolveMailboxRecoveries } from '../src/commands/deploy'

const SOURCE = path.resolve(import.meta.dir, '../src/commands/deploy.ts')

describe('canRevealSecrets', () => {
  const tty = { isTTY: true }

  it('allows a terminal outside CI', () => {
    expect(canRevealSecrets({}, tty)).toBe(true)
  })

  it('refuses CI, even with a terminal attached', () => {
    expect(canRevealSecrets({ CI: 'true' }, tty)).toBe(false)
    expect(canRevealSecrets({ GITHUB_ACTIONS: 'true' }, tty)).toBe(false)
    expect(canRevealSecrets({ CONTINUOUS_INTEGRATION: '1' }, tty)).toBe(false)
  })

  it('refuses a piped stdout', () => {
    expect(canRevealSecrets({}, { isTTY: false })).toBe(false)
    expect(canRevealSecrets({}, {})).toBe(false)
  })
})

describe('reportMailboxCredentials', () => {
  const declared = { address: 'hello@example.com', localPart: 'HELLO', password: 'declared-secret-1', generated: false, passwordPolicy: 'initial' as const }
  const generated = { address: 'ops.team@example.com', localPart: 'OPS.TEAM', password: 'generated-secret-2', generated: true, passwordPolicy: 'initial' as const }

  function report(options: { interactive: boolean, persisted: boolean }): string {
    const lines: string[] = []
    const logger = { info: (m: string) => { lines.push(m) }, warn: (m: string) => { lines.push(m) } } as any
    reportMailboxCredentials(logger, [declared, generated], options)
    return lines.join('\n')
  }

  it('never prints a declared password, in any mode', () => {
    for (const interactive of [true, false]) {
      for (const persisted of [true, false]) {
        const out = report({ interactive, persisted })
        expect(out).toContain('hello@example.com')
        expect(out).not.toContain('declared-secret-1')
      }
    }
  })

  it('does not print a generated password to a non-interactive log, and says where it is', () => {
    const out = report({ interactive: false, persisted: true })
    expect(out).not.toContain('generated-secret-2')
    expect(out).toContain('buddy env:get MAIL_PASSWORD_OPS_TEAM --file .env.production')
  })

  it('does not print an unsaved generated password to a non-interactive log either', () => {
    const out = report({ interactive: false, persisted: false })
    expect(out).not.toContain('generated-secret-2')
    expect(out).toContain('MAIL_PASSWORD_OPS_TEAM')
  })

  it('shows a generated password once to an interactive terminal', () => {
    const out = report({ interactive: true, persisted: true })
    expect(out).toContain('ops.team@example.com  generated-secret-2')
    expect(out).not.toContain('declared-secret-1')
  })
})

/**
 * Pull the mailbox block (`# 3)` up to `# 3b)`) out of the mail script, with
 * escapes resolved the way the JS engine resolves them before the script
 * reaches the shell.
 */
function mailboxBlock(): string {
  const src = fs.readFileSync(SOURCE, 'utf8')
  const marker = 'const script = `'
  const bodies: string[] = []

  let from = 0
  for (;;) {
    const open = src.indexOf(marker, from)
    if (open === -1)
      break

    const out: string[] = []
    let i = open + marker.length
    for (; i < src.length; i++) {
      const ch = src[i]

      if (ch === '\\') {
        const next = src[i + 1] ?? ''
        out.push(next === 'n' ? '\n' : next === 't' ? '\t' : next)
        i++
        continue
      }
      if (ch === '`')
        break
      if (ch === '$' && src[i + 1] === '{') {
        let depth = 1
        let j = i + 2
        for (; j < src.length && depth > 0; j++) {
          const c = src[j]
          if (c === '\\') { j++; continue }
          if (c === '{') depth++
          else if (c === '}') depth--
        }
        out.push('__INTERPOLATION__')
        i = j - 1
        continue
      }

      out.push(ch)
    }

    bodies.push(out.join(''))
    from = i + 1
  }

  const body = bodies.sort((a, b) => b.length - a.length)[0] ?? ''
  const lines = body.split('\n')
  const start = lines.findIndex(line => line.startsWith('# 3) '))
  const end = lines.findIndex((line, index) => index > start && line.startsWith('# 3b)'))

  expect(start, 'mailbox block not found in deploy.ts').toBeGreaterThan(-1)
  expect(end, 'end of mailbox block not found').toBeGreaterThan(start)

  return lines.slice(start, end).join('\n')
}

const BLOCK = mailboxBlock()

/**
 * A stand-in for the mail server's `user:local` CLI, backed by one file per
 * user holding `<password>\n<enabled>`. Output mirrors the real one, which
 * prints everything to stderr and exits 0 whatever happened. Every argv is
 * logged so the test can check what reached the process list.
 */
const FAKE_MS = `#!/bin/bash
DB="$SMTP_DB_PATH"
printf '%s\\n' "$*" >> "$DB/argv.log"
[ "$1" = "user:local" ] || exit 2
cmd="$2"; user="$3"; f="$DB/users/$user"
case "$cmd" in
  info)
    if [ -f "$f" ]; then echo "User Information:" >&2; echo "  Username: $user" >&2; echo "  Enabled: $(sed -n 2p "$f")" >&2
    else echo "User '$user' not found" >&2; fi ;;
  verify)
    if [ -f "$f" ] && [ "$(sed -n 2p "$f")" = true ] && [ "$(sed -n 1p "$f")" = "$4" ]; then echo "Credentials valid" >&2
    else echo "Credentials invalid" >&2; fi ;;
  create)
    printf '%s\\ntrue\\n' "$4" > "$f" ;;
  change-password)
    [ "$4" = "--password-stdin" ] || exit 3
    IFS= read -r pw
    enabled="$(sed -n 2p "$f")"
    printf '%s\\n%s\\n' "$pw" "$enabled" > "$f" ;;
  recovery)
    # A server from before recovery addresses: zig-cli rejects the option.
    if [ -f "$DB/old-server" ]; then echo "Error: Unknown option '--policy'" >&2; exit 1; fi
    [ -f "$f" ] || { echo "Error: user '$user' not found" >&2; exit 1; }
    [ "$5" = "--policy" ] || exit 4
    r="$DB/recovery/$user"; mkdir -p "$DB/recovery"
    if [ -f "$r" ] && [ "$(sed -n 1p "$r")" = "$4" ]; then echo "Recovery: unchanged" >&2
    elif [ "$6" = initial ] && [ -f "$r" ] && [ "$(sed -n 2p "$r")" = user ]; then echo "Recovery: kept (the mailbox owner set their own)" >&2
    else printf '%s\\noperator\\n' "$4" > "$r"; echo "Recovery: updated" >&2; fi ;;
esac
exit 0
`

interface Seed { password: string, enabled?: boolean }

function runMailboxes(seed: Record<string, Seed>, declared: Record<string, string>, policy: 'initial' | 'managed' = 'initial') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-mailboxes-'))
  try {
    fs.mkdirSync(path.join(dir, 'users'))
    for (const [user, s] of Object.entries(seed))
      fs.writeFileSync(path.join(dir, 'users', user), `${s.password}\n${s.enabled === false ? 'false' : 'true'}\n`)

    const ms = path.join(dir, 'mail-server')
    fs.writeFileSync(ms, FAKE_MS, { mode: 0o755 })

    const boxes = Object.entries(declared).map(([addr, pw]) => `${addr}\t${pw}\t${policy}`).join('\n')
    const script = [
      'set -e',
      `BOXES_B64='${Buffer.from(`${boxes}\n`).toString('base64')}'`,
      `MS='${ms}'`,
      `MAIL_DB_PATH='${dir}'`,
      BLOCK,
    ].join('\n')

    const out = Bun.spawnSync(['bash', '-c', script])
    expect(out.exitCode).toBe(0)

    const stdout = out.stdout.toString()
    const users = Object.fromEntries(fs.readdirSync(path.join(dir, 'users')).map(user => [user, fs.readFileSync(path.join(dir, 'users', user), 'utf8').split('\n')[0] ?? '']))
    const passwordOf = (user: string): string | undefined => users[user]
    const argv = fs.readFileSync(path.join(dir, 'argv.log'), 'utf8')
    return { stdout, passwordOf, argv }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('the mailbox reconcile on the server', () => {
  it('preserves a user password change despite a different configured initial password', () => {
    const run = runMailboxes({ 'pawel@example.com': { password: 'user-changed-password' } }, { 'pawel@example.com': 'initial-password' })
    expect(run.stdout).toContain('EXISTS:pawel@example.com')
    expect(run.passwordOf('pawel@example.com')).toBe('user-changed-password')
    expect(run.argv).not.toContain('change-password')
    expect(run.argv).not.toContain('verify')
  })

  it('sets a rotated password on an existing mailbox', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'leaked-old' } }, { 'hello@example.com': 'rotated-new' }, 'managed')
    expect(run.stdout).toContain('UPDATED:hello@example.com')
    expect(run.passwordOf('hello@example.com')).toBe('rotated-new')
  })

  it('passes the new password on stdin, not the command line', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'leaked-old' } }, { 'hello@example.com': 'rotated-new' }, 'managed')
    const change = run.argv.split('\n').filter(line => line.includes('change-password'))
    expect(change.length).toBe(1)
    expect(change[0]).not.toContain('rotated-new')
  })

  it('leaves a mailbox whose password already matches alone', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'same' } }, { 'hello@example.com': 'same' })
    expect(run.stdout).toContain('EXISTS:hello@example.com')
    expect(run.stdout).not.toContain('UPDATED:')
    expect(run.argv).not.toContain('change-password')
  })

  it('does not rewrite a disabled mailbox', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'old', enabled: false } }, { 'hello@example.com': 'new' })
    expect(run.stdout).toContain('EXISTS:hello@example.com')
    expect(run.passwordOf('hello@example.com')).toBe('old')
  })

  it('still creates a mailbox that does not exist', () => {
    const run = runMailboxes({}, { 'new@example.com': 'fresh' })
    expect(run.stdout).toContain('MADE:new@example.com')
    expect(run.passwordOf('new@example.com')).toBe('fresh')
  })
})

describe('resolveMailboxesWithSkipped', () => {
  it('defaults mixed user mailboxes to initial and preserves explicit service management', () => {
    const { boxes } = resolveMailboxesWithSkipped([
      { email: 'user@example.com', password: 'user-initial' },
      { email: 'service@example.com', password: 'service-secret', passwordPolicy: 'managed' },
      { email: 'generated@example.com', generate: true },
    ], 'example.com')
    expect(boxes.map(box => [box.address, box.passwordPolicy])).toEqual([
      ['user@example.com', 'initial'],
      ['service@example.com', 'managed'],
      ['generated@example.com', 'initial'],
    ])
  })

  const KEY = 'MAIL_PASSWORD_CIPHERTEXTCHECK'

  function withEnv(value: string | undefined, fn: () => void): void {
    const before = process.env[KEY]
    if (value === undefined)
      delete process.env[KEY]
    else
      process.env[KEY] = value
    try {
      fn()
    }
    finally {
      if (before === undefined)
        delete process.env[KEY]
      else
        process.env[KEY] = before
    }
  }

  // A production deploy read .env.development's ciphertext for this key (Bun
  // preloads that file natively) and made it the live password on three
  // mailboxes. An undecrypted value is not a declared password.
  for (const prefix of ['encrypted:', 'encrypted:v2:', 'enc:']) {
    it(`does not take ${prefix} ciphertext as a password`, () => {
      withEnv(`${prefix}ZlillOP1YzOZdcP65S3X6b7sxqZsldTDuGsh`, () => {
        const { boxes, skipped } = resolveMailboxesWithSkipped(['ciphertextcheck'], 'example.com')
        expect(boxes).toEqual([])
        expect(skipped).toEqual(['ciphertextcheck@example.com'])
      })
    })
  }

  it('still takes a plaintext password from the environment', () => {
    withEnv('real-password', () => {
      const { boxes } = resolveMailboxesWithSkipped(['ciphertextcheck'], 'example.com')
      expect(boxes.map(b => [b.address, b.password])).toEqual([['ciphertextcheck@example.com', 'real-password']])
    })
  })
})

interface RecoverySeed { address: string, setBy: 'user' | 'operator' }

function runRecoveries(options: { users: string[], current?: Record<string, RecoverySeed>, declared: Array<[string, string, 'initial' | 'managed']>, oldServer?: boolean }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-recovery-'))
  try {
    fs.mkdirSync(path.join(dir, 'users'))
    fs.mkdirSync(path.join(dir, 'recovery'))
    for (const user of options.users)
      fs.writeFileSync(path.join(dir, 'users', user), 'pw\ntrue\n')
    for (const [user, r] of Object.entries(options.current ?? {}))
      fs.writeFileSync(path.join(dir, 'recovery', user), `${r.address}\n${r.setBy}\n`)
    if (options.oldServer)
      fs.writeFileSync(path.join(dir, 'old-server'), '')

    const ms = path.join(dir, 'mail-server')
    fs.writeFileSync(ms, FAKE_MS, { mode: 0o755 })
    const lines = options.declared.map(([addr, recovery, policy]) => `${addr}\t${recovery}\t${policy}`).join('\n')
    const script = [
      'set -e',
      `RECOVERY_B64='${Buffer.from(`${lines}\n`).toString('base64')}'`,
      `MS='${ms}'`,
      `MAIL_DB_PATH='${dir}'`,
      BLOCK,
    ].join('\n')

    const out = Bun.spawnSync(['bash', '-c', script])
    expect(out.exitCode).toBe(0)
    const stored = Object.fromEntries(fs.readdirSync(path.join(dir, 'recovery')).map(user => [user, fs.readFileSync(path.join(dir, 'recovery', user), 'utf8').split('\n')[0] ?? '']))
    const recoveryOf = (user: string): string | undefined => stored[user]
    return { stdout: out.stdout.toString(), recoveryOf }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('the recovery address reconcile on the server', () => {
  it('sets a declared recovery address on an existing mailbox, then leaves it be', () => {
    const run = runRecoveries({ users: ['pawel@example.com'], declared: [['pawel@example.com', 'pawel@elsewhere.test', 'initial']] })
    expect(run.stdout).toContain('RECOVERY_SET:pawel@example.com')
    expect(run.recoveryOf('pawel@example.com')).toBe('pawel@elsewhere.test')

    const again = runRecoveries({ users: ['pawel@example.com'], current: { 'pawel@example.com': { address: 'pawel@elsewhere.test', setBy: 'operator' } }, declared: [['pawel@example.com', 'pawel@elsewhere.test', 'initial']] })
    expect(again.stdout).toContain('RECOVERY_SAME:pawel@example.com')
  })

  it("keeps the owner's own choice under 'initial' and replaces it under 'managed'", () => {
    const current = { 'chris@example.com': { address: 'own@choice.test', setBy: 'user' as const } }
    const initial = runRecoveries({ users: ['chris@example.com'], current, declared: [['chris@example.com', 'chris@config.test', 'initial']] })
    expect(initial.stdout).toContain('RECOVERY_KEPT:chris@example.com')
    expect(initial.recoveryOf('chris@example.com')).toBe('own@choice.test')

    const managed = runRecoveries({ users: ['chris@example.com'], current, declared: [['chris@example.com', 'chris@config.test', 'managed']] })
    expect(managed.stdout).toContain('RECOVERY_SET:chris@example.com')
    expect(managed.recoveryOf('chris@example.com')).toBe('chris@config.test')
  })

  it('reconciles every line, including the last, and reports a missing mailbox', () => {
    const run = runRecoveries({
      users: ['a@example.com', 'b@example.com'],
      declared: [['a@example.com', 'a@elsewhere.test', 'initial'], ['ghost@example.com', 'g@elsewhere.test', 'initial'], ['b@example.com', 'b@elsewhere.test', 'initial']],
    })
    expect(run.stdout).toContain('RECOVERY_SET:a@example.com')
    expect(run.stdout).toContain('RECOVERY_NOBOX:ghost@example.com')
    expect(run.stdout).toContain('RECOVERY_SET:b@example.com')
  })

  it('names an old mail server instead of failing the deploy', () => {
    const run = runRecoveries({ users: ['pawel@example.com'], oldServer: true, declared: [['pawel@example.com', 'pawel@elsewhere.test', 'initial']] })
    expect(run.stdout).toContain('RECOVERY_OLDSERVER:pawel@example.com')
  })

  it('emits no keys the mailbox step parses', () => {
    const run = runRecoveries({ users: ['pawel@example.com'], declared: [['pawel@example.com', 'pawel@elsewhere.test', 'initial']] })
    expect(run.stdout).not.toMatch(/(?:^|[^_])(?:MADE|EXISTS|MIGRATED):/m)
    expect(run.stdout).not.toMatch(/^(?:UPDATED|UPDATEFAIL|FAIL):/m)
  })
})

describe('resolveMailboxRecoveries', () => {
  it('reads recovery and recoveryPolicy from object entries, independent of passwords', () => {
    const { recoveries, invalid } = resolveMailboxRecoveries([
      { email: 'hello', passwordPolicy: 'managed' },
      'chris',
      { email: 'pawel', recovery: ' pawel@outlook.test ' },
      { email: 'chris@other-domain.test', recovery: 'chris@gmail.test', recoveryPolicy: 'managed' },
    ], 'hq.test')
    expect(invalid).toEqual([])
    expect(recoveries).toEqual([
      { address: 'pawel@hq.test', recovery: 'pawel@outlook.test', policy: 'initial' },
      { address: 'chris@hq.test', recovery: 'chris@gmail.test', policy: 'managed' },
    ])
  })

  it('refuses the mailbox itself and anything that is not a plain address', () => {
    const { recoveries, invalid } = resolveMailboxRecoveries([
      { email: 'self', recovery: 'SELF@hq.test' },
      { email: 'nodot', recovery: 'x@localhost' },
      { email: 'shell', recovery: "x@y.test'; rm -rf /" },
      { email: 'header', recovery: 'x@y.test\nBcc: z@w.test' },
      { email: 'blank', recovery: '' },
    ], 'hq.test')
    expect(recoveries).toEqual([])
    expect(invalid).toEqual(['self@hq.test', 'nodot@hq.test', 'shell@hq.test', 'header@hq.test'])
  })
})

describe('reportRecoveryReconcile', () => {
  function report(out: string, declared: string[]): string {
    const lines: string[] = []
    const logger = { info: (m: string) => { lines.push(m) }, warn: (m: string) => { lines.push(`WARN ${m}`) }, success: (m: string) => { lines.push(m) } } as any
    reportRecoveryReconcile(logger, out, declared.map(address => ({ address })))
    return lines.join('\n')
  }

  it('says what changed without printing the recovery addresses', () => {
    const out = report('RECOVERY_SET:pawel@hq.test\nRECOVERY_KEPT:chris@hq.test\nRECOVERY_OLDSERVER:glenn@hq.test\n', ['pawel@hq.test', 'chris@hq.test', 'glenn@hq.test', 'lost@hq.test'])
    expect(out).toContain('set the recovery address of pawel@hq.test')
    expect(out).toContain('kept the recovery address the owner chose in webmail for chris@hq.test')
    expect(out).toContain('WARN Mail: the mail server is too old for recovery addresses, so none was set for glenn@hq.test')
    expect(out).toContain('WARN Mail: the recovery address of lost@hq.test was not reconciled')
  })

  it('is quiet when nothing changed', () => {
    expect(report('RECOVERY_SAME:pawel@hq.test\n', ['pawel@hq.test'])).toBe('')
  })
})
