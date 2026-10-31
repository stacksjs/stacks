import type { Finding, Severity } from './types'
import { isDocPath, isTestPath } from './files'

interface SecretRule {
  rule: string
  title: string
  pattern: RegExp
  severity: Severity
  /** Reported only when the matched value looks random (see `entropy`). */
  minEntropy?: number
}

/**
 * Credentials with a recognisable shape. Each pattern is anchored to the
 * provider's own prefix, so a match is a credential and not a long string.
 */
const SECRET_RULES: SecretRule[] = [
  { rule: 'secret/private-key', title: 'Private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/, severity: 'critical' },
  { rule: 'secret/aws-access-key', title: 'AWS access key id', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, severity: 'critical' },
  { rule: 'secret/stripe-live-key', title: 'Stripe live secret key', pattern: /\b[rs]k_live_[0-9A-Za-z]{20,}\b/, severity: 'critical' },
  { rule: 'secret/github-token', title: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/, severity: 'critical' },
  { rule: 'secret/anthropic-key', title: 'Anthropic API key', pattern: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/, severity: 'critical' },
  { rule: 'secret/openai-key', title: 'OpenAI API key', pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}\b/, severity: 'critical', minEntropy: 3.6 },
  { rule: 'secret/slack-token', title: 'Slack token', pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/, severity: 'critical' },
  { rule: 'secret/slack-webhook', title: 'Slack webhook URL', pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}/, severity: 'high' },
  { rule: 'secret/google-api-key', title: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: 'high' },
  { rule: 'secret/sendgrid-key', title: 'SendGrid API key', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/, severity: 'critical' },
  { rule: 'secret/twilio-key', title: 'Twilio API key', pattern: /\bSK[0-9a-f]{32}\b/, severity: 'high', minEntropy: 3 },
  { rule: 'secret/npm-token', title: 'npm access token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/, severity: 'critical' },
  { rule: 'secret/database-url', title: 'Database URL with a password', pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/'"`]+:(?!\$|\{|%7B|<|\*|\.\.\.|password|pass|secret|changeme|example|user|xxx)[^\s@/'"`]{6,}@(?!localhost\b|127\.0\.0\.1\b|\[::1\]|host\b|example\.|db\b|postgres\b)[\w.-]+/i, severity: 'high' },
]

/** Client configuration files whose keys identify the app and are not secrets. */
const PUBLIC_CLIENT_CONFIG = /(^|\/)(?:google-services\.json|GoogleService-Info\.plist)$/

/** A key = "value" assignment whose name says it is a credential. */
const ASSIGNMENT = /\b([A-Za-z0-9_]*(?:secret|passw(?:or)?d|passwd|token|api[_-]?key|private[_-]?key|access[_-]?key|auth[_-]?key|credentials?)[A-Za-z0-9_]*)\s*[:=]\s*(['"`])([^'"`\s]{20,})\2/i

/** A provider-prefixed key is real unless it says otherwise. */
const OBVIOUS_PLACEHOLDER = /example|placeholder|xxxx|your[_-]|dummy|redacted|fake|\*{4}|0{8}|<[^>]+>/i

const PLACEHOLDER = /example|placeholder|changeme|change-me|your[_-]|<[^>]+>|xxxx|\*{4,}|dummy|sample|redacted|fake|todo|replace|insert|test|demo|foo|bar|0{6,}|1234|abcd|\$\{|\{\{|process\.env|env\(|import\.meta|config\(|%s|%d|undefined|null/i

/** Shannon entropy in bits per character. */
export function entropy(value: string): number {
  if (!value) return 0
  const counts = new Map<string, number>()
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1)
  let total = 0
  for (const count of counts.values()) {
    const p = count / value.length
    total -= p * Math.log2(p)
  }
  return total
}

/** `AKIA…Q7XZ`: enough to find it, never enough to use it. */
export function redact(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 2)}…`
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} characters)`
}

/**
 * A key header followed by a key body: base64 on the same line (a JSON string
 * with \n escapes) or on the next. A bare '-----BEGIN PRIVATE KEY-----' in
 * code that parses or writes PEM files is a constant, not a key.
 */
function hasKeyBody(lines: readonly string[], index: number, match: RegExpExecArray): boolean {
  const body = /[A-Za-z0-9+/=]{40,}/
  const rest = lines[index]!.slice(match.index + match[0].length).replace(/\\n/g, '\n')
  if (body.test(rest.split('\n').find(part => body.test(part)) ?? '')) return true
  const next = lines[index + 1]?.trim() ?? ''
  return body.test(next) || /^(?:Proc-Type|DEK-Info):/.test(next)
}

function isComment(line: string): boolean {
  return /^\s*(?:\/\/|#|\*|\/\*|<!--)/.test(line)
}

/**
 * Credentials committed to a file. Pure. In tests, fixtures, examples and
 * docs only the shapes that are never a placeholder are reported, at a lower
 * severity; the generic `name = "value"` rule runs on real code only.
 */
export function scanSecrets(path: string, text: string): Finding[] {
  const findings: Finding[] = []
  const lenient = isTestPath(path) || isDocPath(path)
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    // A minified or generated line is not worth reading for assignments.
    if (line.length > 2000) continue
    let matched = false
    for (const rule of SECRET_RULES) {
      // Firebase's client config ships inside every app by design; Google documents its key as an identifier.
      if (rule.rule === 'secret/google-api-key' && PUBLIC_CLIENT_CONFIG.test(path)) continue
      const match = rule.pattern.exec(line)
      if (!match) continue
      const value = match[0]
      if (rule.rule === 'secret/private-key' && !hasKeyBody(lines, index, match)) continue
      if (rule.minEntropy && entropy(value) < rule.minEntropy) continue
      if (rule.rule !== 'secret/private-key' && (rule.rule === 'secret/database-url' ? PLACEHOLDER : OBVIOUS_PLACEHOLDER).test(value)) continue
      // The test mode keys Stripe publishes are fine; live ones are reported by the rule above.
      matched = true
      findings.push({
        rule: rule.rule,
        check: 'secrets',
        severity: lenient ? 'low' : rule.severity,
        title: rule.title,
        file: path,
        line: index + 1,
        detail: rule.rule === 'secret/private-key' ? 'A private key block' : redact(value),
        fix: 'Revoke and rotate the credential, remove it from the file and from git history, and read it from the environment (.env, which git ignores).',
      })
      break
    }
    if (matched || lenient || isComment(line)) continue
    const assigned = ASSIGNMENT.exec(line)
    if (!assigned) continue
    const value = assigned[3]!
    // Encrypted env values are the point of encrypting them; .env files are checked by the hygiene scan.
    if (/^(?:encrypted:|enc:|x25519-public:|\$argon|\$2[aby]\$|sha\d+-)/i.test(value) || /(^|\/)\.env(\.|$)/.test(path)) continue
    // A file path or a name that says what it points at ("FORGOT_PASSWORD_VIEW = 'resources/views/forgot-password.stx'").
    if (/^[\w.@-]+(?:\/[\w.@-]+)+\.\w{1,6}$/.test(value) || /(?:^|_)(?:path|view|screen|route|file|dir|url|uri|href|name|label|selector|header)$/i.test(assigned[1]!.replace(/([a-z])([A-Z])/g, '$1_$2'))) continue
    if (PLACEHOLDER.test(value) || PLACEHOLDER.test(assigned[1]!) || /^[a-z]+(?:[-_.][a-z]+)+$/i.test(value) || /^https?:\/\//.test(value)) continue
    if (entropy(value) < 3.7) continue
    findings.push({
      rule: 'secret/hardcoded-credential',
      check: 'secrets',
      severity: 'medium',
      title: `Hard-coded value for "${assigned[1]}"`,
      file: path,
      line: index + 1,
      detail: redact(value),
      fix: 'Read it from the environment instead. If it is not a secret, say so with `// security-ignore: secret/hardcoded-credential <why>`.',
    })
  }
  return findings
}
