import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { entropy, failsScan, formatScan, loadIgnores, matchingIgnore, parseBunAudit, plaintextSecrets, runSecurityScan, scanCode, scanHygiene, scanSecrets, scanWorkflow } from '../src/scan'

// Built from pieces so this file is not itself a finding.
const AWS = `AKIA${'IOSFODNN7EXAMPLQ'}`
const STRIPE = `sk_${'live'}_${'4eC39HqLyjWDarjtT1zdp7dc'}`
const GITHUB = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'}`

describe('secrets', () => {
  test('finds provider-shaped credentials and redacts them', () => {
    const findings = scanSecrets('app/pay.ts', `const a = '${AWS}'\nconst b = "${STRIPE}"\nconst c = '${GITHUB}'\n`)
    expect(findings.map(finding => finding.rule)).toEqual(['secret/aws-access-key', 'secret/stripe-live-key', 'secret/github-token'])
    expect(findings.every(finding => finding.severity === 'critical')).toBe(true)
    for (const finding of findings) {
      expect(finding.detail).not.toContain(AWS)
      expect(finding.detail).not.toContain(STRIPE)
      expect(finding.detail).not.toContain(GITHUB)
      expect(finding.line).toBeGreaterThan(0)
    }
  })

  test('finds a private key block', () => {
    const [finding] = scanSecrets('certs/server.ts', 'const key = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA7vbqajDw4o6gJy8UtmIbkcpnkO3Kwc4qsEnSZp/TR+fQi62F\n-----END RSA PRIVATE KEY-----`')
    expect(finding).toMatchObject({ rule: 'secret/private-key', severity: 'critical', line: 1 })
  })

  test('a PEM header in code that handles PEM is not a key; a key body is', () => {
    expect(scanSecrets('app/pem.ts', "const HEADER = '-----BEGIN PRIVATE KEY-----'\nconst FOOTER = '-----END PRIVATE KEY-----'")).toEqual([])
    expect(scanSecrets('app/pem.ts', "if (!pem.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('not a key')")).toEqual([])
    const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7'
    expect(scanSecrets('creds/sa.json', `{ "private_key": "-----BEGIN PRIVATE KEY-----\\n${body}\\n-----END PRIVATE KEY-----\\n" }`)).toMatchObject([{ rule: 'secret/private-key' }])
  })

  test('ignores placeholders, env reads and test mode keys', () => {
    const text = [
      `const a = "sk_${'live'}_${'x'.repeat(24)}"`,
      'const b = process.env.STRIPE_SECRET_KEY',
      `const c = "sk_${'test'}_4eC39HqLyjWDarjtT1zdp7dc"`,
      'const apiKey = "your-api-key-goes-here-please"',
      'const token = "${TOKEN_FROM_VAULT_ABCDEFGH}"',
      'const password = "correct-horse-battery-staple"',
      '// const secret = "9fA8s7D6f5G4h3J2k1L0pOiUyTrE"',
    ].join('\n')
    expect(scanSecrets('app/x.ts', text)).toEqual([])
  })

  test('flags a high-entropy assignment under a credential name, but not in tests or docs', () => {
    const line = 'const clientSecret = "q8Zx3Vn7Lk2Pw9Rt5Yb1Hc4Jd6Fg0Sa"'
    expect(scanSecrets('app/auth.ts', line)).toMatchObject([{ rule: 'secret/hardcoded-credential', severity: 'medium' }])
    expect(scanSecrets('tests/auth.test.ts', line)).toEqual([])
    expect(scanSecrets('docs/setup.md', line)).toEqual([])
  })

  test('reports the real shapes at low severity in tests and docs', () => {
    expect(scanSecrets('tests/fixtures/keys.ts', `const key = '${AWS}'`)).toMatchObject([{ severity: 'low' }])
    expect(scanSecrets('docs/aws.md', `use ${AWS}`)).toMatchObject([{ severity: 'low' }])
  })

  test('finds a database URL with a real password and not a local or templated one', () => {
    expect(scanSecrets('app/db.ts', 'const url = "postgres://admin:Zp9xQ2mL7vK4@db.internal.example.org:5432/app"').map(finding => finding.rule)).toEqual([])
    expect(scanSecrets('app/db.ts', 'const url = "postgres://admin:Zp9xQ2mL7vK4@prod-db-7.eu-west-1.rds.amazonaws.com:5432/app"').map(finding => finding.rule)).toEqual(['secret/database-url'])
    expect(scanSecrets('app/db.ts', 'const url = "postgres://user:password@localhost:5432/app"')).toEqual([])
    expect(scanSecrets('app/db.ts', 'const url = `postgres://${user}:${pass}@${host}/app`')).toEqual([])
  })

  test('does not mistake a file path, a name\'s own label or Firebase client config for a credential', () => {
    expect(scanSecrets('resources/mobile.ts', "export const FORGOT_PASSWORD_VIEW = 'resources/views/forgot-password.stx'")).toEqual([])
    expect(scanSecrets('resources/mobile.ts', "const tokenHeader = 'x-hq-session-header-name-value'")).toEqual([])
    expect(scanSecrets('android/google-services.json', `"current_key": "AIza${'SyA1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q'}"`)).toEqual([])
    expect(scanSecrets('app/maps.ts', `const key = 'AIza${'SyA1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q'}'`)).toMatchObject([{ rule: 'secret/google-api-key' }])
  })

  test('entropy tells random from words', () => {
    expect(entropy('aaaaaaaaaaaaaaaa')).toBe(0)
    expect(entropy('q8Zx3Vn7Lk2Pw9Rt5Yb1Hc4Jd6Fg0Sa')).toBeGreaterThan(4.5)
    expect(entropy('')).toBe(0)
  })
})

describe('code', () => {
  const rules = (text: string, path = 'app/x.ts') => scanCode(path, text).map(finding => finding.rule)

  test('flags the dangerous call, not the lookalike', () => {
    expect(rules('const out = eval(input)')).toEqual(['code/eval'])
    expect(rules('const f = new Function("a", body)')).toEqual(['code/eval'])
    expect(rules('const m = /a/.exec(text)\nconst r = obj.eval(x)\nconst retrieval = 1')).toEqual([])
    expect(rules('execSync(`git checkout ${branch}`)')).toEqual(['code/command-injection'])
    expect(rules('exec("ls " + dir)')).toEqual(['code/command-injection'])
    expect(rules('child_process.exec(`rm -rf ${dir}`)')).toEqual(['code/command-injection'])
    expect(rules('execSync("git status")')).toEqual([])
    expect(rules('const match = pattern.exec(`${text}`)')).toEqual([])
    expect(rules('await db.unsafe(`select * from t where id = ${id}`)')).toEqual(['code/sql-interpolation'])
    expect(rules('await db.unsafe("select 1")')).toEqual([])
    expect(rules('const agent = { rejectUnauthorized: false }')).toEqual(['code/insecure-tls'])
    expect(rules('el.innerHTML = html')).toEqual(['code/inner-html'])
    expect(rules('if (a.innerHTML === b) {}')).toEqual([])
    expect(rules('const token = Math.random().toString(36)')).toEqual(['code/random-token'])
    expect(rules('const jitter = Math.random() * 100')).toEqual([])
    expect(rules('createHash("md5")')).toEqual(['code/weak-hash'])
    expect(rules('const opts = { algorithms: ["none"] }')).toEqual(['code/jwt-none'])
  })

  test('skips comments, tests and non-source files', () => {
    expect(rules('// eval(x)\n * eval(y)')).toEqual([])
    expect(rules('eval(x)', 'tests/x.test.ts')).toEqual([])
    expect(rules('eval(x)', 'README.md')).toEqual([])
    expect(rules('<div onclick="x"></div>', 'public/page.html')).toEqual([])
    expect(rules('el.innerHTML = x', 'resources/views/a.stx')).toEqual(['code/inner-html'])
  })

  test('calibration: fixed strings, placeholders and delays are not findings', () => {
    expect(rules("el.innerHTML = ''")).toEqual([])
    expect(rules("el.innerHTML = 'Unlimited<br>Support'")).toEqual([])
    expect(rules("el.innerHTML = 'Lifetime - $179'")).toEqual([])
    expect(rules('db.unsafe(`UPDATE t SET a = ${sql().param(1)}`)')).toEqual([])
    expect(rules('el.innerHTML = `<b>${name}</b>`')).toEqual(['code/inner-html'])
    expect(rules("el.innerHTML = '<b>' + name")).toEqual(['code/inner-html'])
    expect(rules('db.unsafe(`UPDATE t SET a = ${sql.param(1)} WHERE id = ${param(2)}`)')).toEqual([])
    expect(rules('db.unsafe(`DELETE FROM t WHERE id IN (${placeholders})`)')).toEqual([])
    expect(rules('db.unsafe(`UPDATE t SET n = n - 1 WHERE id = ${p(1)}`)')).toEqual([])
    expect(rules('db.unsafe(`DROP TABLE IF EXISTS ${q}${table}${q}`)')).toEqual([])
    expect(rules('db.unsafe(`select * from users where email = \'${email}\'`)')).toEqual(['code/sql-interpolation'])
    expect(scanCode('app/x.ts', 'db.unsafe(`select ${email}`)')[0]!.severity).toBe('medium')
    expect(rules('setTimeout(run, Math.random() * token.delay)')).toEqual([])
    expect(rules('const sessionJitter = Math.random() * 100')).toEqual([])
    expect(rules('const token = Math.random().toString(36)')).toEqual(['code/random-token'])
    expect(rules('const opts = { csrf: false }', 'bench/startup/a.ts')).toEqual([])
  })

  test('reports the line and a fix', () => {
    const [finding] = scanCode('app/x.ts', 'a\nb\neval(c)')
    expect(finding).toMatchObject({ line: 3, severity: 'high', check: 'code', file: 'app/x.ts' })
    expect(finding!.fix).toBeTruthy()
  })
})

describe('workflows', () => {
  const rules = (yaml: string) => scanWorkflow('.github/workflows/ci.yml', yaml).map(finding => finding.rule)

  test('flags untrusted text in a shell command, inline and in a block', () => {
    expect(rules('permissions: read-all\njobs:\n  a:\n    steps:\n      - run: echo "${{ github.event.pull_request.title }}"\n')).toEqual(['workflow/script-injection'])
    expect(rules('permissions: read-all\njobs:\n  a:\n    steps:\n      - run: |\n          echo hi\n          git checkout ${{ github.head_ref }}\n')).toEqual(['workflow/script-injection'])
  })

  test('accepts the same text passed through env', () => {
    const yaml = 'permissions: read-all\njobs:\n  a:\n    steps:\n      - name: x\n        env:\n          TITLE: ${{ github.event.pull_request.title }}\n        run: echo "$TITLE"\n'
    expect(rules(yaml)).toEqual([])
  })

  test('flags a pull_request_target that checks out the pull request', () => {
    const yaml = 'on: pull_request_target\npermissions: read-all\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n'
    expect(rules(yaml)).toEqual(['workflow/pull-request-target-checkout'])
    expect(rules(yaml.replace('pull_request_target', 'pull_request'))).toEqual([])
  })

  test('flags echoed secrets, branch-following actions and missing permissions', () => {
    expect(rules('permissions: read-all\njobs:\n  a:\n    steps:\n      - run: echo ${{ secrets.TOKEN }}\n')).toEqual(['workflow/secret-echo'])
    // Piping a secret into a login command is the standard idiom, not a print.
    expect(rules('permissions: read-all\njobs:\n  a:\n    steps:\n      - run: echo "${{ secrets.TOKEN }}" | gh auth login --with-token\n')).toEqual([])
    expect(rules('permissions: read-all\njobs:\n  a:\n    steps:\n      - uses: someone/deploy@main\n      - uses: actions/checkout@v4\n')).toEqual(['workflow/moving-action-ref'])
    expect(rules('jobs:\n  a:\n    steps:\n      - run: ls\n')).toEqual(['workflow/default-permissions'])
  })
})

describe('hygiene', () => {
  test('flags committed env files and key material, not templates or public keys', () => {
    const tracked = ['.env', '.env.production', '.env.example', 'apps/api/.env.local', 'certs/server.pem', 'certs/server.pub', 'tests/fixtures/dev.pem', 'keys/id_rsa', 'android/release.keystore', 'bun.lock', 'src/a.ts']
    const findings = scanHygiene(tracked, '.env\n', true)
    expect(findings.map(finding => finding.file)).toEqual(['.env', '.env.production', 'apps/api/.env.local', 'certs/server.pem', 'keys/id_rsa', 'android/release.keystore'])
  })

  test('a committed env file with only encrypted or harmless values is fine', () => {
    const encrypted = 'DOTENV_PUBLIC_KEY_PRODUCTION="x25519-public:MCow"\nAPP_NAME="encrypted:v2:abc"\nDB_PASSWORD="encrypted:v2:def"\nDEBUG=false\nAPP_URL=https://hq.training\nSTRIPE_SECRET_KEY=\n'
    expect(plaintextSecrets(encrypted)).toEqual([])
    expect(scanHygiene(['.env.production', 'bun.lock'], '.env\n', true, { '.env.production': encrypted })).toEqual([])
    const leaky = `${encrypted}MAIL_PASSWORD="hunter2-hunter2"\nAPI_TOKEN=abcdef1234567890\n# SECRET_KEY=commented-out-value\n`
    expect(plaintextSecrets(leaky)).toEqual(['MAIL_PASSWORD', 'API_TOKEN'])
    const [finding] = scanHygiene(['.env.production', 'bun.lock'], '.env\n', true, { '.env.production': leaky })
    expect(finding).toMatchObject({ rule: 'hygiene/tracked-env', severity: 'high' })
    expect(finding!.detail).toContain('MAIL_PASSWORD, API_TOKEN')
    expect(finding!.detail).not.toContain('hunter2')
  })

  test('wants .env ignored and a lockfile', () => {
    expect(scanHygiene(['a.ts'], 'node_modules\n', true).map(finding => finding.rule)).toEqual(['hygiene/gitignore-env', 'hygiene/no-lockfile'])
    expect(scanHygiene(['bun.lock'], '/.env\n', true)).toEqual([])
    expect(scanHygiene(['bun.lock'], '.env*\n', true)).toEqual([])
    expect(scanHygiene([], null, false)).toEqual([])
  })
})

describe('dependencies', () => {
  test('parses bun audit output, most severe first', () => {
    const json = JSON.stringify({
      zeta: [{ id: 1, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', title: 'Bad', severity: 'low', vulnerable_versions: '<1.2.3', cvss: { score: 3.1 } }],
      alpha: [{ id: 2, url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff', title: 'Worse', severity: 'critical', vulnerable_versions: '<2' }, { id: 3, url: 'x', title: 'Mid', severity: 'moderate', vulnerable_versions: '*' }],
    })
    const findings = parseBunAudit(json)!
    expect(findings.map(finding => [finding.package, finding.severity, finding.reference])).toEqual([
      ['alpha', 'critical', 'GHSA-dddd-eeee-ffff'],
      ['alpha', 'medium', 'x'],
      ['zeta', 'low', 'GHSA-aaaa-bbbb-cccc'],
    ])
    expect(findings[2]!.detail).toContain('CVSS 3.1')
    expect(parseBunAudit('{}')).toEqual([])
    expect(parseBunAudit('not json')).toBeNull()
    expect(parseBunAudit('[]')).toBeNull()
  })
})

describe('exceptions', () => {
  let root = ''
  afterEach(() => root && rmSync(root, { recursive: true, force: true }))

  function project(files: Record<string, string>): string {
    root = mkdtempSync(join(tmpdir(), 'stacks-scan-'))
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }

  test('an entry needs a reason; an expired one stops applying and says so', async () => {
    const cwd = project({ '.security-ignore.json': JSON.stringify({ ignore: [
      { rule: 'code/eval', path: 'app/a.ts', reason: 'the sandbox evaluates admin-written formulas' },
      { rule: 'code/eval', path: 'app/b.ts' },
      { rule: 'code/eval', path: 'app/c.ts', reason: 'was needed for a migration', expires: '2026-01-01' },
      { rule: 'code/eval', path: 'app/d.ts', reason: 'fine until we remove it', expires: 'soon' },
    ] }) })
    const { entries, problems } = await loadIgnores(cwd, '2026-10-30')
    expect(entries.map(entry => entry.path)).toEqual(['app/a.ts'])
    expect(problems).toHaveLength(3)
    expect(problems.join('\n')).toContain('needs a reason')
    expect(problems.join('\n')).toContain('expired on 2026-01-01')
    expect(problems.join('\n')).toContain('not YYYY-MM-DD')
  })

  test('matches by rule pattern, path or directory, and advisory or package', () => {
    const finding = { rule: 'code/eval', check: 'code' as const, severity: 'high' as const, title: 't', file: 'app/jobs/x.ts' }
    const entry = (extra: object) => ({ rule: 'code/eval', reason: 'because of reasons', ...extra })
    expect(matchingIgnore(finding, [entry({})])).toBeDefined()
    expect(matchingIgnore(finding, [entry({ rule: 'code/*' })])).toBeDefined()
    expect(matchingIgnore(finding, [entry({ rule: 'secret/*' })])).toBeUndefined()
    expect(matchingIgnore(finding, [entry({ path: 'app/jobs/' })])).toBeDefined()
    expect(matchingIgnore(finding, [entry({ path: 'app/job' })])).toBeUndefined()
    const advisory = { rule: 'dependency/advisory', check: 'dependencies' as const, severity: 'medium' as const, title: 't', package: 'fast-uri', reference: 'GHSA-1' }
    expect(matchingIgnore(advisory, [{ rule: 'dependency/advisory', reference: 'GHSA-1', reason: 'not reachable here' }])).toBeDefined()
    expect(matchingIgnore(advisory, [{ rule: 'dependency/advisory', reference: 'fast-uri', reason: 'not reachable here' }])).toBeDefined()
    expect(matchingIgnore(advisory, [{ rule: 'dependency/advisory', reference: 'other', reason: 'not reachable here' }])).toBeUndefined()
  })

  test('a whole scan: findings, inline and file exceptions, and the exit decision', async () => {
    const cwd = project({
      'app/a.ts': 'eval(one)\n',
      'app/b.ts': '// security-ignore: code/eval formulas are written by admins only\neval(two)\n',
      'app/c.ts': 'eval(three) // security-ignore\n',
      'app/d.ts': 'eval(four)\n',
      'app/secret.ts': `const key = '${AWS}'\n`,
      'tests/a.test.ts': 'eval(five)\n',
      'README.md': 'eval(six)\n',
      '.security-ignore.json': JSON.stringify({ ignore: [{ rule: 'code/eval', path: 'app/d.ts', reason: 'reviewed on 2026-10-30' }] }),
      '.gitignore': '.env\n',
    })
    const report = await runSecurityScan({ cwd, offline: true, today: '2026-10-30' })
    expect(report.checks).toEqual(['dependencies', 'secrets', 'code', 'workflows', 'hygiene'])
    expect(report.skipped.map(skip => skip.check)).toEqual(['dependencies', 'hygiene'])
    expect(report.findings.map(finding => `${finding.rule} ${finding.file}:${finding.line}`)).toEqual([
      'secret/aws-access-key app/secret.ts:1',
      'code/eval app/a.ts:1',
      'code/eval app/c.ts:1',
    ])
    expect(report.ignored.map(finding => finding.file)).toEqual(['app/b.ts', 'app/d.ts'])
    expect(report.ignoreProblems).toHaveLength(1)
    expect(report.ignoreProblems[0]).toContain('app/c.ts:1')
    expect(failsScan(report, 'high')).toBe(true)
    expect(failsScan(report, 'none')).toBe(false)

    const text = formatScan(report, { showIgnored: true })
    expect(text).toContain('CRITICAL (1)')
    expect(text).toContain('HIGH (2)')
    expect(text).toContain('app/secret.ts:1')
    expect(text).not.toContain(AWS)
    expect(text).toContain('SET ASIDE (2)')
    expect(text).toContain('dependencies not checked: offline')
  })

  test('a clean project passes, and a skipped check is still said', async () => {
    const cwd = project({ 'app/a.ts': 'export const a = 1\n', '.gitignore': '.env\n', 'package.json': '{}', 'bun.lock': '' })
    const report = await runSecurityScan({ cwd, offline: true, only: ['secrets', 'code', 'dependencies'] })
    expect(report.findings).toEqual([])
    expect(report.filesScanned).toBeGreaterThan(0)
    expect(failsScan(report, 'low')).toBe(false)
    expect(formatScan(report)).toContain('No security findings.')
    expect(formatScan(report)).toContain('dependencies not checked')
  })

  test('thresholds', async () => {
    const cwd = project({ 'app/a.ts': 'el.innerHTML = x\n' })
    const report = await runSecurityScan({ cwd, offline: true, only: ['code'] })
    expect(report.findings.map(finding => finding.severity)).toEqual(['medium'])
    expect(failsScan(report, 'high')).toBe(false)
    expect(failsScan(report, 'medium')).toBe(true)
    expect(failsScan(report, 'low')).toBe(true)
  })
})
