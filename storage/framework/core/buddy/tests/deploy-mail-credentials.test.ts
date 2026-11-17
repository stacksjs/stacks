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
import { canRevealSecrets, mailDomainOwner, mailProjectSlug, reportMailboxCredentials, reportRecoveryReconcile, resolveMailboxesWithSkipped, resolveMailboxRecoveries } from '../src/commands/deploy'

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
 * Pull one block of the mail script out (from the line starting `startsWith`
 * up to the one starting `endsWith`), with escapes resolved the way the JS
 * engine resolves them before the script reaches the shell. The default is the
 * mailbox block, `# 3)` up to `# 3b)`.
 */
function mailboxBlock(startsWith = '# 3) ', endsWith = '# 3b)'): string {
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
  const start = lines.findIndex(line => line.startsWith(startsWith))
  const end = lines.findIndex((line, index) => index > start && line.startsWith(endsWith))

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
    # A server from before --force rejects the option; a current one refuses
    # to replace a password without it.
    if [ "$5" = "--force" ] && [ -f "$DB/old-server" ]; then echo "Error: Unknown option '--force'" >&2; exit 1; fi
    if [ "$5" != "--force" ] && [ ! -f "$DB/old-server" ]; then echo "Error: refusing to replace the password of '$user' without --force." >&2; exit 1; fi
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

function runMailboxes(seed: Record<string, Seed>, declared: Record<string, string>, policy: 'initial' | 'managed' = 'initial', options: { oldServer?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-mailboxes-'))
  try {
    fs.mkdirSync(path.join(dir, 'users'))
    if (options.oldServer)
      fs.writeFileSync(path.join(dir, 'old-server'), '')
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

  it('asks a current server to replace a managed password with --force', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'leaked-old' } }, { 'hello@example.com': 'rotated-new' }, 'managed')
    const change = run.argv.split('\n').filter(line => line.includes('change-password'))
    expect(change).toEqual(['user:local change-password hello@example.com --password-stdin --force'])
  })

  it('still rotates a managed password on a server from before --force', () => {
    const run = runMailboxes({ 'hello@example.com': { password: 'leaked-old' } }, { 'hello@example.com': 'rotated-new' }, 'managed', { oldServer: true })
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

describe('a generated mailbox password and the release that needs it', () => {
  const quiet = { info: () => {}, warn: () => {} }
  const KEY = 'MAIL_PASSWORD_HELLOEARLY'

  it('is saved before the environment ships, and the mail step then finds it declared', async () => {
    const { ensureMailboxPasswords } = await import('../src/commands/deploy')
    delete process.env[KEY]
    const saved: Array<[string, string, string]> = []
    try {
      const written = await ensureMailboxPasswords(quiet, '.env.production', {
        hasConfig: true,
        config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { enabled: true, generatePasswords: true } },
        save: (key, value, file) => { saved.push([key, value, file]) },
      })
      expect(written).toEqual([KEY])
      expect(saved).toHaveLength(1)
      expect(saved[0]![0]).toBe(KEY)
      expect(saved[0]![2]).toBe('.env.production')
      expect(saved[0]![1].length).toBeGreaterThan(20)
      // Later in the same deploy it is a declared password, not a second one.
      const again = resolveMailboxesWithSkipped(['helloearly'], 'votescape.org', true)
      expect(again.boxes[0]).toMatchObject({ address: 'helloearly@votescape.org', generated: false, password: saved[0]![1] })
    }
    finally {
      delete process.env[KEY]
    }
  })

  it('writes nothing for an app that did not ask, has mail off, or already has its password', async () => {
    const { ensureMailboxPasswords } = await import('../src/commands/deploy')
    const save = () => { throw new Error('nothing should be saved') }
    delete process.env[KEY]
    expect(await ensureMailboxPasswords(quiet, '.env.production', { hasConfig: true, save, config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { enabled: true } } })).toEqual([])
    expect(await ensureMailboxPasswords(quiet, '.env.production', { hasConfig: true, save, config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { enabled: false, generatePasswords: true } } })).toEqual([])
    expect(await ensureMailboxPasswords(quiet, '.env.production', { hasConfig: false, save, config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { generatePasswords: true } } })).toEqual([])
    process.env[KEY] = 'already-declared-password'
    try {
      expect(await ensureMailboxPasswords(quiet, '.env.production', { hasConfig: true, save, config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { enabled: true, generatePasswords: true } } })).toEqual([])
    }
    finally {
      delete process.env[KEY]
    }
  })

  it('leaves a password it could not save to the mail step, and says so', async () => {
    const { ensureMailboxPasswords } = await import('../src/commands/deploy')
    delete process.env[KEY]
    const warned: string[] = []
    const written = await ensureMailboxPasswords({ info: () => {}, warn: (m: string) => { warned.push(m) } }, '.env.production', {
      hasConfig: true,
      config: { domain: 'votescape.org', mailboxes: ['helloearly'], server: { enabled: true, generatePasswords: true } },
      save: () => { throw new Error('read-only') },
    })
    expect(written).toEqual([])
    expect(process.env[KEY]).toBeUndefined()
    expect(warned[0]).toContain('helloearly@votescape.org')
  })
})

describe('a sending service and the account it relays through', () => {
  const declared = ['no-reply@commshq.org']

  it('is its own sender, when that is a declared mailbox on its domain', async () => {
    const { relayAccountFromConfig } = await import('../src/commands/deploy')
    expect(relayAccountFromConfig({ from: { address: 'No-Reply@commshq.org' }, server: { relay: true } }, 'commshq.org', declared)).toEqual({ account: 'no-reply@commshq.org' })
  })

  it('or the mailbox it names, whatever from.address is in this environment', async () => {
    const { relayAccountFromConfig } = await import('../src/commands/deploy')
    expect(relayAccountFromConfig({ from: { address: 'hello@commshq.org' }, server: { relay: 'no-reply' } }, 'commshq.org', declared)).toEqual({ account: 'no-reply@commshq.org' })
    expect(relayAccountFromConfig({ from: { address: 'hello@commshq.org' }, server: { relay: 'no-reply@commshq.org' } }, 'commshq.org', declared)).toEqual({ account: 'no-reply@commshq.org' })
    expect(relayAccountFromConfig({ server: { relay: 'no-reply@elsewhere.org' } }, 'commshq.org', declared).account).toBeUndefined()
  })

  it('is nobody unless the app asked', async () => {
    const { relayAccountFromConfig } = await import('../src/commands/deploy')
    expect(relayAccountFromConfig({ from: { address: 'no-reply@commshq.org' }, server: {} }, 'commshq.org', declared)).toEqual({})
    expect(relayAccountFromConfig({ from: { address: 'no-reply@commshq.org' } }, 'commshq.org', declared)).toEqual({})
  })

  it('is refused, with the reason, for another domain, an undeclared mailbox, or anything that is not plainly an address', async () => {
    const { relayAccountFromConfig } = await import('../src/commands/deploy')
    const on = { relay: true }
    expect(relayAccountFromConfig({ from: { address: 'no-reply@elsewhere.org' }, server: on }, 'commshq.org', declared).account).toBeUndefined()
    expect(relayAccountFromConfig({ from: { address: 'hello@commshq.org' }, server: on }, 'commshq.org', declared).problem).toContain('not one of the declared mailboxes')
    expect(relayAccountFromConfig({ from: { address: 'x@commshq.org,root@commshq.org' }, server: on }, 'commshq.org', declared).account).toBeUndefined()
    expect(relayAccountFromConfig({ from: { address: 'a|b\'$(id)@commshq.org' }, server: on }, 'commshq.org', declared).account).toBeUndefined()
    expect(relayAccountFromConfig({ from: {}, server: on }, 'commshq.org', declared).problem).toContain('unset')
  })
})

/**
 * Step 0 of the mail script: a mail domain belongs to one project.
 *
 * PredictHQ kept the stacks site's config/email.ts (`stacksjs.com`, with
 * chris/blake/glenn and their MAIL_PASSWORD_* values). Its deploy, attached to
 * the stacks box, reconciled stacksjs.com's mailboxes from its own environment
 * and replaced two people's passwords. The step runs here against a scratch
 * owner list and gateway directory in place of /etc.
 */
const OWNER_BLOCK = mailboxBlock('# 0) ', '# 1) ')

function runOwnerCheck(options: { slug: string, domain: string, owners?: string, fragments?: Record<string, string[]> }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-mail-owner-'))
  try {
    const sites = path.join(dir, 'sites.d')
    fs.mkdirSync(sites)
    for (const [slug, hosts] of Object.entries(options.fragments ?? {})) {
      const proxies = hosts.map(host => ({ to: host, from: 'localhost:3000', id: host }))
      fs.writeFileSync(path.join(sites, `${slug}.json`), JSON.stringify({ slug, proxies, onDemandTls: { allowedSuffixes: hosts } }, null, 2))
    }
    const owners = path.join(dir, 'mail', 'domain-owners')
    if (options.owners !== undefined) {
      fs.mkdirSync(path.dirname(owners), { recursive: true })
      fs.writeFileSync(owners, options.owners)
    }

    const block = OWNER_BLOCK
      .replace('__INTERPOLATION__', `'${options.slug}'`)
      .replaceAll('/etc/mail/domain-owners', owners)
      .replaceAll('/etc/rpx/sites.d', sites)
    const script = ['set -e', `DOMAIN='${options.domain}'`, block, 'echo REACHED_STEP_1'].join('\n')

    const out = Bun.spawnSync(['bash', '-c', script])
    expect(out.exitCode).toBe(0)
    return {
      stdout: out.stdout.toString(),
      owners: fs.existsSync(owners) ? fs.readFileSync(owners, 'utf8') : '',
    }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('the mail domain owner check', () => {
  it('refuses a domain another project serves on the box, before touching anything', () => {
    const run = runOwnerCheck({ slug: 'predicthq', domain: 'stacksjs.com', fragments: { stacks: ['stacksjs.com', 'docs.stacksjs.com'], predicthq: ['predicthq.org'] } })
    expect(run.stdout).toContain('DOMAINOWNER:stacks')
    expect(run.stdout).not.toContain('REACHED_STEP_1')
    expect(run.owners).toBe('')
  })

  it('lets the project that serves the domain reconcile it, and records the claim', () => {
    const run = runOwnerCheck({ slug: 'stacks', domain: 'stacksjs.com', fragments: { stacks: ['stacksjs.com'], erbamarkets: ['erba.stacksjs.com'] } })
    expect(run.stdout).toContain('REACHED_STEP_1')
    expect(run.stdout).toContain('DOMAINCLAIMED:stacksjs.com')
    expect(run.owners).toBe('stacksjs.com stacks\n')
  })

  it('does not take a subdomain route as ownership of the apex', () => {
    // erbamarkets serves erba.stacksjs.com; that says nothing about stacksjs.com.
    const run = runOwnerCheck({ slug: 'reportshq', domain: 'stacksjs.com', fragments: { erbamarkets: ['erba.stacksjs.com'] } })
    expect(run.stdout).toContain('REACHED_STEP_1')
  })

  it('does not read a dot in the domain as any character', () => {
    const run = runOwnerCheck({ slug: 'mine', domain: 'stacksjs.com', fragments: { other: ['stacksjsXcom'] } })
    expect(run.stdout).toContain('REACHED_STEP_1')
  })

  it('honours an earlier claim over the gateway routes', () => {
    const run = runOwnerCheck({ slug: 'newcomer', domain: 'mail-only.org', owners: 'mail-only.org commshq\n' })
    expect(run.stdout).toContain('DOMAINOWNER:commshq')
    expect(run.stdout).not.toContain('REACHED_STEP_1')
  })

  it('lets the claimant come back without claiming twice', () => {
    const run = runOwnerCheck({ slug: 'commshq', domain: 'commshq.org', owners: 'commshq.org commshq\n' })
    expect(run.stdout).toContain('REACHED_STEP_1')
    expect(run.stdout).not.toContain('DOMAINCLAIMED')
    expect(run.owners).toBe('commshq.org commshq\n')
  })

  it('first claim wins for a domain nobody serves', () => {
    const run = runOwnerCheck({ slug: 'commshq', domain: 'commshq.org', fragments: { stacks: ['stacksjs.com'] } })
    expect(run.stdout).toContain('DOMAINCLAIMED:commshq.org')
    expect(run.owners).toBe('commshq.org commshq\n')
  })

  it('is skipped when the deploy names no project', () => {
    const run = runOwnerCheck({ slug: '', domain: 'stacksjs.com', fragments: { stacks: ['stacksjs.com'] } })
    expect(run.stdout).toContain('REACHED_STEP_1')
    expect(run.owners).toBe('')
  })
})

describe('mailDomainOwner / mailProjectSlug', () => {
  it('reads the owner the server reported', () => {
    expect(mailDomainOwner('MAILHOST:mail.stacksjs.com\nDOMAINOWNER:stacks\n')).toBe('stacks')
    expect(mailDomainOwner('MAILHOST:mail.stacksjs.com\nMAILTENANT:current\n')).toBeUndefined()
  })

  it('keeps a slug inside a single-quoted shell string', () => {
    expect(mailProjectSlug('predicthq')).toBe('predicthq')
    expect(mailProjectSlug('a\'; rm -rf / #')).toMatch(/^[\w.-]+$/)
    expect(mailProjectSlug(undefined)).toBe('')
  })
})
