/**
 * Which DKIM key the mail reconcile registers, generates, and publishes.
 *
 * This block ships to the box as shell inside a template literal, so it is
 * tested by running it: the script is extracted from deploy.ts, pointed at a
 * temporary /etc/mail/mail.env and key directory, and executed.
 *
 * The behaviour it pins comes from a real deploy that warned, on every single
 * run, that stacksjs.com's per-domain DKIM key was unused. It was: mail's
 * `configureDkim` registers the global DKIM_DOMAIN signer first and silently
 * drops a DKIM_EXTRA_KEYS entry for a domain that already has one. The script
 * generated a 2048-bit key anyway, registered it anyway, and warned about it
 * forever - a warning no action could clear, which is how a log teaches people
 * to skip it.
 *
 * The dead file was the visible half. The dangerous half was that the entry
 * named a key whose public half was never published: if DKIM_DOMAIN ever moved
 * to another domain, this entry would start signing with a key no DNS record
 * matched, and every message would fail DKIM with nothing in the logs to say
 * why. Registering the key that actually signs makes that handover a no-op.
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
function dkimBlock(): string {
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

  const body = bodies.sort((a, b) => b.length - a.length)[0] ?? ''
  const lines = body.split('\n')
  const start = lines.findIndex(line => line.startsWith('# 2) DKIM'))
  const end = lines.findIndex((line, index) => index > start && line.startsWith('# 3)'))

  expect(start, 'DKIM block not found in deploy.ts').toBeGreaterThan(-1)
  expect(end, 'end of DKIM block not found').toBeGreaterThan(start)

  return lines.slice(start, end).join('\n')
}

const BLOCK = dkimBlock()

interface RunResult {
  keys: Record<string, string>
  extraKeys: string
  files: string[]
  envChanged: boolean
}

function runDkim(env: Record<string, string>, options: { staleKey?: boolean, runs?: number } = {}): RunResult[] {
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

    const resolved = Object.entries(env)
      .map(([key, value]) => `${key}=${value.replaceAll('/opt/mail/dkim/mail.private', globalKey)}`)
      .join('\n')
    fs.writeFileSync(envFile, `${resolved}\n`)

    // macOS ships BSD sed, whose -i wants an explicit backup suffix; the box
    // runs GNU sed. Bridging just that difference keeps the line under test
    // the real one.
    const sedShim = `sed() { if [ "$1" = "-i" ]; then shift; command sed -i '' "$@"; else command sed "$@"; fi; }`
    const script = [
      'set -e',
      process.platform === 'darwin' ? sedShim : '',
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

describe('a domain with no global DKIM signer', () => {
  const [result] = runDkim({ SMTP_DB_PATH: '/opt/mail/smtp.db' })

  it('generates its own key and registers it under the mail selector', () => {
    expect(result.files).toEqual(['example.com.private'])
    expect(result.extraKeys).toBe('example.com:mail:<dkim>/example.com.private')
    expect(result.keys.DKIMSEL).toBe('mail')
    expect(result.keys.DKIMPUB.length).toBeGreaterThan(100)
  })
})

describe('the domain that IS the global DKIM_DOMAIN', () => {
  const runs = runDkim({
    DKIM_DOMAIN: 'example.com',
    DKIM_SELECTOR: 'mail',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'example.com:mail:/opt/mail/dkim/example.com.private',
  }, { staleKey: true, runs: 2 })

  it('registers the key that actually signs, replacing the entry that never applied', () => {
    // Not the per-domain file: the global one, under the global selector.
    expect(runs[0].extraKeys).toBe('example.com:mail:<dkim>/mail.private')
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
    expect(runs[0].envChanged).toBe(false)
    expect(runs[1].files).toEqual(['mail.private'])
  })
})

describe('a domain when another domain holds the global signer', () => {
  const runs = runDkim({
    DKIM_DOMAIN: 'other.com',
    DKIM_SELECTOR: 'mail',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'other.com:mail:/opt/mail/dkim/other.private',
  }, { runs: 2 })

  it('keeps its own key and leaves the other tenant alone', () => {
    expect(runs[0].extraKeys).toBe('other.com:mail:/opt/mail/dkim/other.private,example.com:mail:<dkim>/example.com.private')
    expect(runs[0].keys.DKIMGLOBAL).toBeUndefined()
    expect(runs[1].envChanged).toBe(false)
  })
})

describe('a box with several tenants registered', () => {
  const [result] = runDkim({
    DKIM_DOMAIN: 'example.com',
    DKIM_SELECTOR: 'sel9',
    DKIM_PRIVATE_KEY_PATH: '/opt/mail/dkim/mail.private',
    DKIM_EXTRA_KEYS: 'a.com:mail:/opt/mail/dkim/a.com.private,example.com:mail:/opt/mail/dkim/example.com.private,b.com:mail:/opt/mail/dkim/b.com.private',
  }, { staleKey: true })

  it('rewrites only this domain and preserves the rest, in order', () => {
    // The list is rebuilt rather than appended to, so one domain can never end
    // up with two entries - which is what an append would have produced here.
    expect(result.extraKeys).toBe('a.com:mail:/opt/mail/dkim/a.com.private,b.com:mail:/opt/mail/dkim/b.com.private,example.com:sel9:<dkim>/mail.private')
  })

  it('uses the server\'s own selector, not a hardcoded one', () => {
    expect(result.keys.DKIMSEL).toBe('sel9')
  })
})
