import type { Finding, Severity } from './types'
import { isTestPath } from './files'

interface CodeRule {
  rule: string
  title: string
  pattern: RegExp
  severity: Severity
  fix: string
  /** Skip tests, fixtures and examples. */
  skipTests?: boolean
  /** Only these extensions. */
  ext?: RegExp
  /** Look at the line once the pattern matched; false sets it aside as safe. */
  accept?: (line: string) => boolean
}

/** `${…}` parts of a template that are placeholders or quoted identifiers, not data. */
const SAFE_INTERPOLATION = /\bparam\w*\(|\bplaceholders?\b|\bquote\w*\(|\bescape\w*\(|\bident\w*\(|^(?:q|qi|\d+)$|^[a-z]{1,2}\(\d+\)$|^\w*(?:Placeholders?|Quoted|Columns?|Table(?:Name)?|Qualified|Sql|Clause|Cascade)\w*$/i

function onlySafeInterpolation(line: string): boolean {
  const parts = [...line.matchAll(/\$\{([^}]*)\}/g)].map(match => (match[1] ?? '').trim())
  return parts.length > 0 && parts.every(part => SAFE_INTERPOLATION.test(part))
}

/** `x.innerHTML = 'plain text'`: a fixed string cannot carry anyone's markup. */
function assignsData(line: string): boolean {
  const right = line.split(/\.(?:innerHTML|outerHTML)\s*\+?=(?!=)/)[1]
  if (right === undefined) return true
  return !/^\s*(['"`])(?:(?!\$\{)[^'"`\\])*\1\s*;?\s*(?:\/\/.*)?$/.test(right)
}

const SOURCE = /\.(?:[cm]?[jt]sx?|stx|vue|svelte|html)$/i

/**
 * Patterns that are dangerous in the code a Stacks app is made of. They are
 * line-based and deliberately narrow: each one names a call that is only
 * unsafe when it is fed something built from a variable, so a finding is a
 * place to look, with the reason attached, not a style opinion.
 */
const CODE_RULES: CodeRule[] = [
  { rule: 'code/eval', title: 'eval() or new Function() runs a string as code', pattern: /(?<![.\w$])(?:eval\s*\(|new\s+Function\s*\()/, severity: 'high', fix: 'Parse data with JSON.parse or a real parser, and pick behaviour from a lookup table instead of building code.', skipTests: true, ext: SOURCE },
  { rule: 'code/command-injection', title: 'Shell command built from a string with interpolation', pattern: /(?<![.\w$])(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|(?:'[^']*'|"[^"]*")\s*\+)|\b(?:child_process|cp|childProcess)\.(?:exec|execSync)\s*\(\s*(?:`[^`]*\$\{|(?:'[^']*'|"[^"]*")\s*\+)|\bspawn(?:Sync)?\s*\(\s*['"`](?:ba|z|da)?sh['"`]\s*,\s*\[\s*['"`]-c['"`]\s*,\s*(?:`[^`]*\$\{|[A-Za-z_$])/, severity: 'high', fix: 'Pass the program and its arguments separately (Bun.spawn([cmd, ...args]) or Bun\'s $ template), never one string.', skipTests: true, ext: SOURCE },
  { rule: 'code/sql-interpolation', title: 'SQL built with string interpolation', pattern: /(?:\.unsafe|\bsql\.raw|\.\$queryRawUnsafe|\.executeRaw)\s*\(\s*(?:`[^`]*\$\{|(?:'[^']*'|"[^"]*")\s*\+)/, severity: 'medium', fix: 'Use parameter placeholders ($1, ?) and pass the values separately; interpolate only fixed identifiers (a table or column from a list in your code).', skipTests: true, ext: SOURCE, accept: line => !onlySafeInterpolation(line) },
  { rule: 'code/insecure-tls', title: 'TLS certificate verification is turned off', pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*[=:]\s*['"`]?0|tls\s*:\s*\{[^}]*rejectUnauthorized\s*:\s*false/, severity: 'high', fix: 'Trust the real certificate (or add the CA) instead of disabling verification.', skipTests: true, ext: SOURCE },
  { rule: 'code/jwt-none', title: 'A token algorithm of "none" skips signature checks', pattern: /\balg(?:orithms?)?\s*:\s*\[?\s*['"`]none['"`]/i, severity: 'high', fix: 'Pin the expected algorithm when verifying a token.', skipTests: true, ext: SOURCE },
  { rule: 'code/inner-html', title: 'Markup written straight into the page', pattern: /\.(?:innerHTML|outerHTML)\s*[+]?=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(?:ln)?\s*\(/, severity: 'medium', fix: 'Set textContent, or render through the template engine, which escapes by default. If the HTML is sanitized, say so with a security-ignore comment.', skipTests: true, ext: SOURCE, accept: line => /insertAdjacentHTML|document\.write/.test(line) || assignsData(line) },
  { rule: 'code/random-token', title: 'Math.random() used for something secret', pattern: /Math\.random\(\)[^\n]*\b(?:token|secret|password|nonce|otp|csrf|api.?key)\b|\b(?:token|secret|password|nonce|otp|csrf|api.?key)\b[^\n]*Math\.random\(\)/i, severity: 'medium', fix: 'Use crypto.getRandomValues() or crypto.randomUUID().', skipTests: true, ext: SOURCE, accept: line => !/setTimeout|setInterval|delay|jitter|backoff|retry|sleep/i.test(line) },
  { rule: 'code/weak-hash', title: 'MD5 or SHA-1 used as a hash', pattern: /createHash\(\s*['"`](?:md5|sha1)['"`]\s*\)/i, severity: 'low', fix: 'Use SHA-256 or better; for passwords use the password hasher (make/check). Fine for a non-security cache key or a vendor\'s required format: say so with a security-ignore comment.', skipTests: true, ext: SOURCE },
  { rule: 'code/cors-wildcard-credentials', title: 'CORS allows every origin with credentials', pattern: /Access-Control-Allow-Origin['"`]?\s*[:,]\s*['"`]\*['"`][^\n]*(?:credentials|Allow-Credentials)|(?:credentials|Allow-Credentials)[^\n]*Access-Control-Allow-Origin['"`]?\s*[:,]\s*['"`]\*['"`]/i, severity: 'medium', fix: 'Name the allowed origins; browsers refuse a wildcard with credentials anyway.', skipTests: true, ext: SOURCE },
  { rule: 'code/disabled-csrf', title: 'CSRF protection turned off', pattern: /\bcsrf\s*:\s*false\b|verifyCsrf\s*=\s*false/i, severity: 'medium', fix: 'Leave CSRF protection on for anything a browser session can reach.', skipTests: true, ext: SOURCE },
]

const IGNORE = /security-ignore(?::|\s|$)\s*([a-z][\w/-]*)?\s*(.*)$/i

export interface InlineIgnore { rule: string | null, reason: string }

/** `// security-ignore: code/eval why it is fine` on a line, or on the one above it. */
export function inlineIgnore(lines: readonly string[], index: number): InlineIgnore | null {
  for (const candidate of [lines[index], lines[index - 1]]) {
    if (candidate === undefined) continue
    const match = IGNORE.exec(candidate)
    if (match) {
      const rule = match[1]?.includes('/') ? match[1] : null
      const reason = (rule ? (match[2] ?? '') : `${match[1] ?? ''} ${match[2] ?? ''}`).replace(/\s*(?:-->|\*\/)\s*$/, '').trim()
      return { rule, reason }
    }
  }
  return null
}

function isCommentOnly(line: string): boolean {
  return /^\s*(?:\/\/|\*|\/\*|#|<!--)/.test(line)
}

/** Dangerous calls in a source file. Pure; `security-ignore` comments are applied by the caller. */
export function scanCode(path: string, text: string): Finding[] {
  const findings: Finding[] = []
  const test = isTestPath(path)
  const rules = CODE_RULES.filter(rule => (!rule.skipTests || !test) && (!rule.ext || rule.ext.test(path)))
  if (!rules.length) return findings
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    if (line.length > 2000 || isCommentOnly(line)) continue
    for (const rule of rules) {
      if (!rule.pattern.test(line) || (rule.accept && !rule.accept(line))) continue
      findings.push({ rule: rule.rule, check: 'code', severity: rule.severity, title: rule.title, file: path, line: index + 1, detail: line.trim().slice(0, 160), fix: rule.fix })
    }
  }
  return findings
}
