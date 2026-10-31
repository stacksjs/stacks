import type { Finding } from './types'

const ENV_FILE = /(^|\/)\.env(?:\.[\w.-]+)?$/
const ENV_TEMPLATE = /\.(?:example|sample|template|dist|defaults?)$|^\.env\.(?:example|sample|template)/
const KEY_FILE = /\.(?:pem|p12|pfx|jks|keystore|p8|mobileprovision|key)$|(^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$|(^|\/)(?:serviceaccount|service-account|credentials)[\w.-]*\.json$/i
/** Public halves and vendor-published material. */
const PUBLIC_KEY_FILE = /(\.pub|\.crt|\.cer)$|(^|\/)(?:fixtures?|tests?|examples?|__tests__)\//i

const SENSITIVE_NAME = /secret|passw(?:or)?d|passwd|token|api[_-]?key|private[_-]?key|access[_-]?key|auth[_-]?key|credentials?|dsn|signing|salt|(?:^|_)key$/i
const OBVIOUS_PLACEHOLDER = /^(?:|true|false|null|none|changeme|change-me|example|your[\w-]*|x+|\*+|<[^>]*>|\$\{[^}]*\})$|example|placeholder|dummy|your[_-]/i

/**
 * Names of the values in an env file that are readable secrets. Stacks encrypts
 * env values (`encrypted:v2:…`, the DOTENV_PUBLIC_KEY line is public), so an
 * encrypted `.env.production` is meant to be committed; a plaintext password
 * in one is not.
 */
export function plaintextSecrets(envText: string): string[] {
  const names: string[] = []
  for (const line of envText.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][\w.]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match || line.trimStart().startsWith('#')) continue
    const [, name, raw] = match
    const value = (raw ?? '').replace(/^(['"])(.*)\1$/, '$2')
    if (/^DOTENV_PUBLIC_KEY/.test(name!) || /^(?:encrypted:|enc:|x25519-public:)/i.test(value)) continue
    if (SENSITIVE_NAME.test(name!) && value.length >= 8 && !OBVIOUS_PLACEHOLDER.test(value)) names.push(name!)
  }
  return names
}

/**
 * What the repository holds that it should not. `tracked` are the paths git
 * tracks; `gitignore` is the root .gitignore's text, when there is one. Pure.
 */
export function scanHygiene(tracked: readonly string[], gitignore: string | null, hasPackageManifest: boolean, envContents: Readonly<Record<string, string>> = {}): Finding[] {
  const findings: Finding[] = []
  for (const path of tracked) {
    const name = path.split('/').pop() ?? path
    if (ENV_FILE.test(path) && !ENV_TEMPLATE.test(name)) {
      // Contents known: only readable secrets count. Unknown: assume the worst.
      const plain = path in envContents ? plaintextSecrets(envContents[path]!) : null
      if (plain && !plain.length) continue
      findings.push({ rule: 'hygiene/tracked-env', check: 'hygiene', severity: 'high', title: 'An environment file with readable secrets is committed', file: path, detail: plain ? `Readable values: ${plain.slice(0, 6).join(', ')}${plain.length > 6 ? ` and ${plain.length - 6} more` : ''}` : 'Real values in .env files end up in git history for everyone with access.', fix: `Encrypt the values (buddy env:encrypt), or git rm --cached ${path}, ignore it, and rotate every value it held.` })
    }
    else if (KEY_FILE.test(path) && !PUBLIC_KEY_FILE.test(path)) {
      findings.push({ rule: 'hygiene/tracked-key-material', check: 'hygiene', severity: 'high', title: 'Key or credential material is committed', file: path, fix: 'Remove it from git and its history, rotate the key, and load it from a secret store or the environment.' })
    }
  }
  if (gitignore !== null && !gitignore.split('\n').some(line => /^\/?\.env(?:\*|\.\*)?\/?$/.test(line.trim())))
    findings.push({ rule: 'hygiene/gitignore-env', check: 'hygiene', severity: 'medium', title: '.gitignore does not ignore .env', file: '.gitignore', fix: 'Add a `.env` line (and `.env.*` with a `!.env.example` exception).' })
  if (hasPackageManifest && !tracked.some(path => /^(?:bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(path)))
    findings.push({ rule: 'hygiene/no-lockfile', check: 'hygiene', severity: 'low', title: 'No lockfile is committed, so installs are not reproducible', fix: 'Commit bun.lock.' })
  return findings
}
