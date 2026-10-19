/**
 * Application files that shadow a framework security default.
 *
 * Stacks resolves `app/` before `storage/framework/defaults/app/`, so a copy
 * of `Middleware/Csrf.ts` or `Actions/Auth/LoginAction.ts` under `app/` wins
 * for good. Every later security fix to that default then lands in a file the
 * application no longer runs. Nothing said so: the copy kept working, and
 * "works" is exactly what code missing a fix looks like.
 *
 * The check is deliberately small. It reads only the files named in
 * `SECURITY_DEFAULT_FILES`, and only when the application has one, so it can
 * run on every boot.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/logging/runtime'
import { path } from '@stacksjs/path'
import { frameworkDefaultsDir } from './imports'

/**
 * The framework defaults whose job is security, as paths relative to `app/`.
 *
 * Authentication, session and token issuance, password reset, request
 * forgery, cross-origin policy, rate limiting, signed URLs and the
 * authorization middleware. Helpers the auth actions import by relative path
 * are listed too: a copied action resolves its helper from `app/` as well.
 *
 * Keep it explicit. A default not listed here can still be overridden; it just
 * does not warn.
 */
export const SECURITY_DEFAULT_FILES: readonly string[] = Object.freeze([
  // Middleware
  'Middleware/Auth.ts',
  'Middleware/Guest.ts',
  'Middleware/Csrf.ts',
  'Middleware/Cors.ts',
  'Middleware/Throttle.ts',
  'Middleware/Signed.ts',
  'Middleware/Abilities.ts',
  'Middleware/Can.ts',
  'Middleware/Permission.ts',
  'Middleware/Role.ts',
  'Middleware/EnsureEmailIsVerified.ts',
  // Sign-in, sign-out and session issuance
  'Actions/Auth/LoginAction.ts',
  'Actions/Auth/LogoutAction.ts',
  'Actions/Auth/LogoutAllAction.ts',
  'Actions/Auth/RegisterAction.ts',
  'Actions/Auth/RefreshTokenAction.ts',
  'Actions/Auth/VerifyTwoFactorLoginAction.ts',
  'Actions/Auth/VerifyEmailAction.ts',
  'Actions/Auth/MagicLinkSendAction.ts',
  'Actions/Auth/MagicLinkConsumeAction.ts',
  'Actions/Auth/PasskeyAuthenticationAction.ts',
  'Actions/Auth/VerifyAuthenticationAction.ts',
  'Actions/Auth/SocialRedirectAction.ts',
  'Actions/Auth/SocialCallbackAction.ts',
  'Actions/Auth/SessionHandoffAction.ts',
  'Actions/Auth/social-flow.ts',
  'Actions/Auth/token-request.ts',
  // Tokens and OAuth
  'Actions/Auth/CreateTokenAction.ts',
  'Actions/Auth/RevokeTokenAction.ts',
  'Actions/Auth/OAuthAuthorizationAction.ts',
  'Actions/Auth/OAuthTokenAction.ts',
  'Actions/Auth/oauth-request.ts',
  // Password reset
  'Actions/Password/SendPasswordResetEmailAction.ts',
  'Actions/Password/VerifyResetTokenAction.ts',
  'Actions/Password/PasswordResetAction.ts',
])

/**
 * The comment an application adds to a modified override once it has been
 * reviewed against the current default, followed by the default's fingerprint.
 *
 * Tied to the default's content, not to a flag: when the framework changes
 * that default, the fingerprint stops matching and the warning returns, which
 * is the moment a review is needed again.
 */
export const SHADOWED_DEFAULT_REVIEW_MARKER = 'stacks-reviewed-default:'

/** Environment variable that turns the boot warning off. */
export const SHADOWED_DEFAULTS_ENV = 'STACKS_SHADOWED_DEFAULTS_WARN'

export interface ShadowedSecurityDefault {
  /** Relative to `app/`, e.g. `Middleware/Csrf.ts`. */
  path: string
  /**
   * `identical`: a byte-for-byte copy. It changes nothing except that it stops
   * receiving fixes; delete it.
   * `modified`: a customised or outdated copy. Review it against the default.
   */
  kind: 'identical' | 'modified'
  /** The application file that wins resolution. */
  appFile: string
  /** The framework default it shadows. */
  defaultFile: string
  /** What a reviewed override carries after `SHADOWED_DEFAULT_REVIEW_MARKER`. */
  fingerprint: string
}

/** A short, stable fingerprint of a default's contents. */
export function defaultFingerprint(contents: Uint8Array | string): string {
  return createHash('sha256').update(contents).digest('hex').slice(0, 16)
}

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile()
  }
  catch {
    return false
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength)
    return false
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i])
      return false
  }
  return true
}

/**
 * List the application files that shadow a framework security default.
 *
 * `appDir` is the application's `app/`, `defaultsDir` the framework's
 * `defaults/app/`. A listed file the framework no longer ships is not a
 * shadow and is skipped. A modified override carrying
 * `stacks-reviewed-default: <fingerprint>` for the current default is
 * treated as reviewed and left out. Never throws: an unreadable file is
 * skipped, since a diagnostic must not stop a boot.
 */
export function findShadowedSecurityDefaults(
  appDir: string,
  defaultsDir: string,
  files: readonly string[] = SECURITY_DEFAULT_FILES,
): ShadowedSecurityDefault[] {
  const found: ShadowedSecurityDefault[] = []

  for (const relative of files) {
    const appFile = join(appDir, relative)
    const defaultFile = join(defaultsDir, relative)

    try {
      if (!isFile(appFile) || !isFile(defaultFile))
        continue

      const own = readFileSync(appFile)
      const framework = readFileSync(defaultFile)
      const fingerprint = defaultFingerprint(framework)

      if (sameBytes(own, framework)) {
        found.push({ path: relative, kind: 'identical', appFile, defaultFile, fingerprint })
        continue
      }

      if (own.toString('utf8').includes(`${SHADOWED_DEFAULT_REVIEW_MARKER} ${fingerprint}`))
        continue

      found.push({ path: relative, kind: 'modified', appFile, defaultFile, fingerprint })
    }
    catch {
      // Unreadable: nothing useful to say about it here.
    }
  }

  return found
}

/** One readable warning for a list of shadowed defaults. */
export function describeShadowedSecurityDefaults(entries: readonly ShadowedSecurityDefault[]): string {
  const lines = entries.map((entry) => {
    if (entry.kind === 'identical')
      return `  - app/${entry.path} is an unchanged copy of the framework default. Delete it to receive security fixes.`

    return `  - app/${entry.path} differs from the framework default (${entry.defaultFile}). `
      + `Review it against the current default; once reviewed, add the comment \`// ${SHADOWED_DEFAULT_REVIEW_MARKER} ${entry.fingerprint}\` to it.`
  })

  return [
    `[security] ${entries.length} app/ file${entries.length === 1 ? '' : 's'} shadow${entries.length === 1 ? 's' : ''} a framework security default, so framework security fixes to ${entries.length === 1 ? 'it do' : 'them do'} not reach this app:`,
    ...lines,
    `  Set ${SHADOWED_DEFAULTS_ENV}=false to silence this warning.`,
  ].join('\n')
}

let warned = false

export interface WarnShadowedSecurityDefaultsOptions {
  /** Defaults to the project's `app/`. */
  appDir?: string
  /** Defaults to the framework's resolved `defaults/app/`. */
  defaultsDir?: string
  /** Defaults to `log.warn`. */
  warn?: (message: string) => void
  /** Run even if this process already warned. For tests. */
  force?: boolean
}

/**
 * Warn once per process about app files shadowing security defaults.
 *
 * Called from the API server entries. Cheap (a stat per listed file, and a
 * read only for the ones the app has) and never throws. Returns what it found,
 * which is empty when silenced or already run.
 */
export function warnShadowedSecurityDefaults(options: WarnShadowedSecurityDefaultsOptions = {}): ShadowedSecurityDefault[] {
  if (warned && !options.force)
    return []
  warned = true

  if (String(process.env[SHADOWED_DEFAULTS_ENV] ?? '').toLowerCase() === 'false')
    return []

  try {
    const appDir = options.appDir ?? path.appPath()
    const defaultsDir = options.defaultsDir ?? frameworkDefaultsDir('app')
    if (!appDir || !defaultsDir || !existsSync(appDir) || !existsSync(defaultsDir))
      return []

    const found = findShadowedSecurityDefaults(appDir, defaultsDir)
    if (found.length > 0)
      (options.warn ?? (message => log.warn(message)))(describeShadowedSecurityDefaults(found))

    return found
  }
  catch {
    return []
  }
}
