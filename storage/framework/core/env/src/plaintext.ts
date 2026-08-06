/**
 * Unencrypted secrets in a committed env file.
 *
 * Stacks encrypts `.env.<environment>` in place and un-ignores those files so
 * they can be committed - a good design with one failure mode: a value that was
 * never encrypted looks exactly like one that was. `encrypted:`-prefixed and
 * bare text sit in the same file, in the same syntax, and nothing reads the
 * difference.
 *
 * It has already happened here. `.env.production` carried three per-mailbox
 * SMTP passwords and the coming-soon bypass secret in plaintext; this
 * repository is public, so they were readable at HEAD for anyone who looked.
 * They were removed in a57c8ed69b (stacksjs/stacks#2211).
 *
 * ## Why this is not "every value must be encrypted"
 *
 * That rule sounds right and is unusable. `.env.production` at the time of
 * writing holds 26 non-empty plaintext values, nearly all of them things like
 * `APP_NAME=Stacks`, `DB_HOST=127.0.0.1` and `MAIL_HOST=mailpit`. Failing on
 * those trains people to pass `--force`, which is worse than not checking.
 *
 * So the question asked here is narrower and answerable: **does this key look
 * like a secret, and is its value real rather than a placeholder?** Two
 * independent signals:
 *
 *  - the KEY NAME matches a secret-shaped pattern ({@link SECRET_NAME_PATTERN}),
 *    deliberately broad because a false positive costs one exclusion and a
 *    missed secret is the bug this module exists for. The same trade is made,
 *    for the same reason, by `SECRET_PATTERNS` in the query logger.
 *  - the VALUE is not the documented placeholder. `.env.example` is the
 *    project's own statement of what a non-secret default looks like, so a
 *    value byte-identical to the example's value for that key is understood as
 *    a placeholder rather than a leak. That is what clears `MAIL_PASSWORD=null`
 *    and `MEILISEARCH_KEY=masterKey` without an allowlist anyone has to
 *    maintain.
 *
 * `strict` opts into the absolute rule for projects that want it - and it is
 * satisfiable, since `buddy env:encrypt` encrypts every key, which is why
 * `.env.development` and `.env.staging` already pass it.
 *
 * ## What is never returned
 *
 * Key names only. A report that quotes the offending value writes the secret
 * into CI logs, terminal scrollback and issue trackers - which is the thing
 * being prevented.
 */

/**
 * Whether a value has been encrypted in place.
 *
 * `encrypted:` is the current envelope (`encrypted:v2:` with the versioned
 * header); `enc:` is the short alias. The predicate was written out four
 * separate times across this package before it lived here.
 */
export function isEncryptedValue(value: string | undefined | null): boolean {
  return typeof value === 'string' && (value.startsWith('encrypted:') || value.startsWith('enc:'))
}

/**
 * Key names that should never hold readable text in a committed file.
 *
 * Broad on purpose. Excluding a false positive is a one-line change a person
 * makes once; missing a real secret is the incident. Anchored on word
 * boundaries so `KEYCLOAK_URL` does not match on `KEY`.
 */
export const SECRET_NAME_PATTERN
  = /(?:^|_)(?:PASSWORD|PASSWD|SECRET|TOKEN|APIKEY|API_KEY|CREDENTIAL|CREDENTIALS|PRIVATE|SALT|DSN|CERT|CIPHER|SIGNATURE|WEBHOOK)(?:_|$)|(?:^|_)(?:ACCESS|SECRET)_KEY(?:_|$)|_KEY$/

/**
 * Keys that ARE cryptographic material and are meant to be readable.
 *
 * The public half of the keypair is public by definition, and the private half
 * is never committed (`.env.keys` is gitignored). Both match
 * {@link SECRET_NAME_PATTERN} on `_KEY`, so they are excluded explicitly rather
 * than by weakening the pattern.
 */
const CRYPTO_METADATA_PATTERN = /^DOTENV_(?:PUBLIC|PRIVATE)_KEY/

/** A value that refers to another variable rather than holding one. */
const EXPANSION_PATTERN = /^\$\{[^}]+\}$/

export type PlaintextReason = 'plaintext-secret' | 'plaintext-value'

export interface PlaintextFinding {
  /** The offending key. The VALUE is deliberately never carried. */
  key: string
  /**
   * `plaintext-secret` - the name looks like a secret and the value is not the
   * documented placeholder. `plaintext-value` - any unencrypted value, only
   * ever produced under `strict`.
   */
  reason: PlaintextReason
}

export interface PlaintextScanOptions {
  /**
   * The project's `.env.example` values, keyed the same way. A value equal to
   * its example counterpart is treated as a documented placeholder.
   */
  placeholders?: Record<string, string>
  /** Report every unencrypted value, not just secret-shaped ones. */
  strict?: boolean
}

/**
 * Find values in a parsed env file that should have been encrypted.
 *
 * Returns key names, never values. Empty values, `${VAR}` expansions, dotenvx
 * key metadata and anything already encrypted are skipped.
 */
export function plaintextSecrets(
  values: Record<string, string>,
  options: PlaintextScanOptions = {},
): PlaintextFinding[] {
  const { placeholders = {}, strict = false } = options
  const findings: PlaintextFinding[] = []

  for (const [key, value] of Object.entries(values)) {
    if (!value || value.trim() === '')
      continue
    if (isEncryptedValue(value))
      continue
    if (CRYPTO_METADATA_PATTERN.test(key))
      continue
    if (EXPANSION_PATTERN.test(value.trim()))
      continue

    const looksSecret = SECRET_NAME_PATTERN.test(key)

    // The example file's value for this key is the project's own statement of
    // what a non-secret default looks like.
    const isPlaceholder = Object.prototype.hasOwnProperty.call(placeholders, key)
      && placeholders[key] === value

    if (looksSecret && !isPlaceholder) {
      findings.push({ key, reason: 'plaintext-secret' })
      continue
    }

    if (strict)
      findings.push({ key, reason: 'plaintext-value' })
  }

  return findings
}

/**
 * Whether an env file is committed to git and therefore in scope.
 *
 * Enumerating with `git ls-files` rather than a hardcoded
 * production/staging/ci list, because `.gitignore` un-ignores three names but
 * `.env.development` is tracked as well - no ignore rule happens to match it.
 * A hardcoded list would have skipped a file that is just as public.
 */
export function trackedEnvFiles(gitLsFilesOutput: string): string[] {
  return gitLsFilesOutput
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    // `.env.example` is documentation of the shape; its values are placeholders
    // by definition and it is the reference the placeholder rule reads from.
    .filter(file => file !== '.env.example')
    .filter(file => /(?:^|\/)\.env(?:\.|$)/.test(file))
    // `.env.keys` holds the private halves and is gitignored; if one is ever
    // tracked that is its own, louder problem than a plaintext value.
    .filter(file => !file.endsWith('.env.keys'))
}
