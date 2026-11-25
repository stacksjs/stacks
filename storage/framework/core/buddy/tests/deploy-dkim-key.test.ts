/**
 * Which DKIM key the mail reconcile registers, generates, and publishes.
 *
 * This block ships to the box as shell inside a template literal, so it is
 * tested by running it: the script is extracted from deploy.ts, pointed at a
 * temporary /etc/mail/mail.env and key directory, and executed.
 *
 * Native Mail refuses to start when the primary signing domain is also in
 * DKIM_EXTRA_KEYS. Verify the rendered deploy keeps one registration for
 * each domain and publishes the same primary key and selector it already uses.
 */
import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SOURCE = path.resolve(import.meta.dir, '../src/commands/deploy.ts')

/**
 * Pull the DKIM section out of the mail script.
 *
 * Escapes are resolved the way the JS engine resolves them before the script
 * ever reaches the shell - `\n` is a newline, not the letter n - because an
 * extractor that gets that wrong runs a different program than production does.
 */
function mailScript(): string[] {
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
        // Interpolations are inert here: the block under test reads its inputs
        // from shell variables the prelude sets.
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

  return (bodies.sort((a, b) => b.length - a.length)[0] ?? '').split('\n')
}

function mailScriptBlock(first: string, next: string): string {
  const lines = mailScript()
  const start = lines.findIndex(line => line.startsWith(first))
  const end = lines.findIndex((line, index) => index > start && line.startsWith(next))

  expect(start, `Mail script section missing: ${first}`).toBeGreaterThan(-1)
  expect(end, `Mail script section missing: ${next}`).toBeGreaterThan(start)
  return lines.slice(start, end).join('\n')
}

const BLOCK = mailScriptBlock('# 2) DKIM', '# 2a)')
// Bridge BSD sed on macOS while keeping the rendered GNU sed command intact.
const sedShim = process.platform === 'darwin'
  ? `sed() { if [ "$1" = "-i" ]; then shift; command sed -i '' "$@"; else command sed "$@"; fi; }`
  : ''

interface RunResult {
  keys: Record<string, string>
  extraKeys: string
  files: string[]
  envChanged: boolean
}

function runDkim(env: Record<string, string>, options: { staleKey?: boolean, sharedKey?: boolean, runs?: number } = {}): RunResult[] {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-dkim-'))

  try {
    const dkimDir = path.join(dir, 'dkim')
    fs.mkdirSync(dkimDir)
    const globalKey = path.join(dkimDir, 'mail.private')
    const envFile = path.join(dir, 'mail.env')

    const generate = (file: string): void => {
      const out = Bun.spawnSync(['openssl', 'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:2048', '-out', file])
      expect(out.exitCode, 'openssl must be available to run this test').toBe(0)
    }

    if (env.DKIM_PRIVATE_KEY_PATH)
      generate(globalKey)
    if (options.staleKey)
      generate(path.join(dkimDir, 'example.com.private'))
    if (options.sharedKey)
      fs.linkSync(globalKey, path.join(dkimDir, 'example.com.private'))

    const resolved = Object.entries(env)
      .map(([key, value]) => `${key}=${value.replaceAll('/opt/mail/dkim/mail.private', globalKey)}`)
      .join('\n')
    fs.writeFileSync(envFile, `${resolved}\n`)

    const script = [
      'set -e',
      sedShim,
      `DOMAIN='example.com'`,
      `ENVF='${envFile}'`,
      `DKIMDIR='${dkimDir}'`,
      'ENV_CHANGED=0',
      BLOCK,
      'echo "ENVCHANGED:$ENV_CHANGED"',
    ].join('\n')

    const results: RunResult[] = []
    for (let run = 0; run < (options.runs ?? 1); run++) {
      const out = Bun.spawnSync(['bash', '-c', script])
      expect(out.stderr.toString(), 'the shell block must not error').toBe('')
      expect(out.exitCode).toBe(0)

      const keys: Record<string, string> = {}
      for (const line of out.stdout.toString().split('\n')) {
        const match = line.match(/^(DKIM[A-Z]+):(.*)$/)
        if (match)
          keys[match[1]] = match[2].trim()
      }

      results.push({
        keys,
        extraKeys: (fs.readFileSync(envFile, 'utf8').split('\n').find(line => line.startsWith('DKIM_EXTRA_KEYS=')) ?? '').replace('DKIM_EXTRA_KEYS=', '').replaceAll(dkimDir, '<dkim>'),
        files: fs.readdirSync(dkimDir).sort(),
        envChanged: out.stdout.toString().includes('ENVCHANGED:1'),
      })
    }

    return results
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function runEnvironmentReconcile(mode: 'reject' | 'accept' | 'concurrent-change' | 'restart-fails') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stacks-mail-env-'))
  try {
    const liveFile = path.join(dir, 'mail.env')
    const original = 'SMTP_LOCAL_DOMAINS=existing.example\nSMTP_HOSTNAME=mail.existing.example\n'
    fs.writeFileSync(liveFile, original, { mode: 0o600 })
    fs.writeFileSync(path.join(dir, 'before.env'), original)
    const script = [
      'set -e',
      sedShim,
      `cd '${dir}'`,
      `ENVF='${liveFile}' LIVE_MAIL_ENV='${liveFile}' MAIL_ENV_LOCK='${dir}/test.lock'`,
      `MODE='${mode}' DOMAIN='new.example' RELAY_ACCOUNT='' DKIMDIR='${dir}/dkim' MS='${process.execPath}'`,
      'ENV_CHANGED=0',
      'flock() { :; }',
      'sleep() { :; }',
      `systemd-run() {
        local argument candidate=''
        for argument; do
          case "$argument" in EnvironmentFile=*) candidate="\${argument#EnvironmentFile=}";; esac
        done
        cmp -s before.env "$LIVE_MAIL_ENV" || return 3
        [ -n "$candidate" ] && [ "$candidate" != "$LIVE_MAIL_ENV" ] || return 4
        grep -q '^SMTP_LOCAL_DOMAINS=existing.example,new.example$' "$candidate" || return 5
        grep -q '^DKIM_EXTRA_KEYS=new.example:mail:' "$candidate" || return 6
        printf 'validate\\n' >> trace
        if [ "$MODE" = concurrent-change ]; then
          printf '# external update\\n' >> "$LIVE_MAIL_ENV"
        fi
        [ "$MODE" != reject ]
      }`,
      `systemctl() {
        case "$1" in
          restart)
            if cmp -s before.env "$LIVE_MAIL_ENV"; then
              printf 'restart-original\\n' >> trace
            else
              printf 'restart-candidate\\n' >> trace
              [ "$MODE" != restart-fails ] || return 1
            fi ;;
          show) echo 42 ;;
          is-active|reset-failed) : ;;
          *) return 1 ;;
        esac
      }`,
      mailScriptBlock('# 1) Register', '# 3)'),
    ].join('\n')
    const out = Bun.spawnSync(['bash', '-c', script])
    const installed = fs.readFileSync(liveFile, 'utf8')
    return {
      ok: out.exitCode === 0,
      unchanged: installed === original,
      externalUpdatePreserved: installed === `${original}# external update\n`,
      mode: fs.statSync(liveFile).mode & 0o777,
      trace: fs.existsSync(path.join(dir, 'trace')) ? fs.readFileSync(path.join(dir, 'trace'), 'utf8').trim().split('\n') : [],
      candidates: fs.readdirSync(dir).filter(name => name.startsWith('.mail-env.')),
    }
  }
  finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('Mail environment activation', () => {
  it('leaves live settings and service alone when native validation rejects the candidate', () => {
    expect(runEnvironmentReconcile('reject')).toEqual({
      ok: false, unchanged: true, externalUpdatePreserved: false, mode: 0o600, trace: ['validate'], candidates: [],
    })
  })

  it('validates the candidate before installing it and restarting once', () => {
    expect(runEnvironmentReconcile('accept')).toEqual({
      ok: true, unchanged: false, externalUpdatePreserved: false, mode: 0o600, trace: ['validate', 'restart-candidate'], candidates: [],
    })
  })

  it('preserves an intervening live edit and leaves the service running', () => {
    expect(runEnvironmentReconcile('concurrent-change')).toEqual({
      ok: false, unchanged: false, externalUpdatePreserved: true, mode: 0o600, trace: ['validate'], candidates: [],
    })
  })

  it('restores the original settings and service if the new service fails to start', () => {
    expect(runEnvironmentReconcile('restart-fails')).toEqual({
      ok: false, unchanged: true, externalUpdatePreserved: false, mode: 0o600, trace: ['validate', 'restart-candidate', 'restart-original'], candidates: [],
    })
  })
})

describe('a domain with no global DKIM signer', () => {
  const [result] = runDkim({ SMTP_DB_PATH: '/opt/mail/smtp.db' })

  it('generates its own key and registers it under the mail selector', () => {
    expect(result.files).toEqual(['example.com.private'])
    expect(result.extraKeys).toBe('example.com:mail:<dkim>/example.com.private')
    expect(result.keys.DKIMSEL).toBe('mail')
    expect(result.keys.DKIMPUB.length).toBeGreaterThan(100)
  })
})

describe('the primary signing domain without an extra registration', () => {
  it('publishes the existing key without changing the Mail environment on repeat deploys', () => {
    const runs = runDkim({
      DKIM_DOMAIN: 'example.com',
      DKIM_SELECTOR: 'sel9',
      DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
      DKIM_EXTRA_KEYS: 'other.com:mail:/opt/mail/dkim/other.private',
    }, { runs: 2 })

    for (const run of runs) {
      expect(run.extraKeys).toBe('other.com:mail:/opt/mail/dkim/other.private')
      expect(run.envChanged).toBe(false)
      expect(run.keys.DKIMSEL).toBe('sel9')
      expect(run.keys.DKIMPUB.length).toBeGreaterThan(100)
    }
  })

  it('does not report the active key as stale when both filenames name it', () => {
    const [run] = runDkim({
      DKIM_DOMAIN: 'EXAMPLE.COM',
      DKIM_SELECTOR: 'sel9',
      DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    }, { sharedKey: true })
    expect(run.keys.DKIMGLOBAL).toContain('mail.private')
    expect(run.keys.DKIMSTALE).toBeUndefined()
    expect(run.envChanged).toBe(false)
  })
})

describe('the domain that IS the global DKIM_DOMAIN', () => {
  const runs = runDkim({
    DKIM_DOMAIN: 'example.com',
    DKIM_SELECTOR: 'mail',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'example.com:mail:/opt/mail/dkim/example.com.private',
  }, { staleKey: true, runs: 2 })

  it('removes the redundant extra registration and uses the configured signer', () => {
    expect(runs[0].extraKeys).toBe('')
    expect(runs[0].keys.DKIMGLOBAL).toContain('mail.private')
  })

  it('publishes the global key, since that is what signs', () => {
    expect(runs[0].keys.DKIMPUB.length).toBeGreaterThan(100)
    expect(runs[0].keys.DKIMSEL).toBe('mail')
  })

  it('reports the leftover per-domain key instead of deleting it', () => {
    // Removing a private key from a mail server is the operator's call.
    expect(runs[0].keys.DKIMSTALE).toContain('example.com.private')
    expect(runs[0].files).toContain('example.com.private')
  })

  it('settles: the second run changes nothing', () => {
    // The old code warned on every deploy forever and never converged.
    expect(runs[0].envChanged).toBe(true)
    expect(runs[1].envChanged).toBe(false)
    expect(runs[1].extraKeys).toBe(runs[0].extraKeys)
  })
})

describe('the global DKIM_DOMAIN after the leftover key is gone', () => {
  const runs = runDkim({
    DKIM_DOMAIN: 'example.com',
    DKIM_SELECTOR: 'mail',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'example.com:mail:/opt/mail/dkim/mail.private',
  }, { runs: 2 })

  it('never mints the per-domain key again', () => {
    // The state a box is in once the operator removes the dead key. A deploy
    // that quietly recreated it would put the warning back forever.
    expect(runs[0].files).toEqual(['mail.private'])
    expect(runs[0].keys.DKIMSTALE).toBeUndefined()
    expect(runs[0].envChanged).toBe(true)
    expect(runs[0].extraKeys).toBe('')
    expect(runs[1].files).toEqual(['mail.private'])
    expect(runs[1].envChanged).toBe(false)
  })
})

describe('a domain when another domain holds the global signer', () => {
  const runs = runDkim({
    DKIM_DOMAIN: 'other.com',
    DKIM_SELECTOR: 'mail',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'another.com:mail:/opt/mail/dkim/another.private,other.com:mail:/opt/mail/dkim/other.private',
  }, { runs: 2 })

  it('adds the tenant key, drops the extra primary, and preserves unrelated keys', () => {
    expect(runs[0].extraKeys).toBe('another.com:mail:/opt/mail/dkim/another.private,example.com:mail:<dkim>/example.com.private')
    expect(runs[0].keys.DKIMGLOBAL).toBeUndefined()
    expect(runs[1].envChanged).toBe(false)
  })

  it('replaces a tenant registration in place and leaves the next deploy unchanged', () => {
    const [first, second] = runDkim({
      DKIM_DOMAIN: 'other.com',
      DKIM_SELECTOR: 'mail',
      DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
      DKIM_EXTRA_KEYS: 'a.com:mail:/opt/mail/dkim/a.private,example.com:old:/opt/mail/dkim/old.private,b.com:mail:/opt/mail/dkim/b.private',
    }, { runs: 2 })

    expect(first.extraKeys).toBe('a.com:mail:/opt/mail/dkim/a.private,example.com:mail:<dkim>/example.com.private,b.com:mail:/opt/mail/dkim/b.private')
    expect(first.envChanged).toBe(true)
    expect(second.extraKeys).toBe(first.extraKeys)
    expect(second.envChanged).toBe(false)
  })
})

describe('a box with several tenants registered', () => {
  const [result] = runDkim({
    DKIM_DOMAIN: 'example.com',
    DKIM_SELECTOR: 'sel9',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'a.com:mail:/opt/mail/dkim/a.com.private,example.com:mail:/opt/mail/dkim/example.com.private,b.com:mail:/opt/mail/dkim/b.com.private',
  }, { staleKey: true })

  it('removes the extra primary entry and preserves the other tenants in order', () => {
    expect(result.extraKeys).toBe('a.com:mail:/opt/mail/dkim/a.com.private,b.com:mail:/opt/mail/dkim/b.com.private')
  })

  it('uses the server\'s own selector, not a hardcoded one', () => {
    expect(result.keys.DKIMSEL).toBe('sel9')
  })
})
