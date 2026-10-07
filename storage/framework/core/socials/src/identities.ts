import type {
  BlueskyCredentialOptions,
  InstagramCredentialOptions,
  LinkedInCredentialOptions,
  MastodonCredentialOptions,
  SocialCredentialPlatform,
  SocialCredentialsByPlatform,
  SocialIdentityOptions,
  ThreadsCredentialOptions,
  TwitterCredentialOptions,
} from '@stacksjs/types'

/**
 * Where a social credential comes from.
 *
 * Six publishing drivers shipped before there was anywhere to declare their
 * credentials, so `SocialIdentityCredentials` was passed in per call and every
 * application invented its own convention (stacksjs/stacks#2873). This
 * resolves them once, from one place, the way `initializeIntegration()` does
 * for telemetry.
 *
 * Values are read lazily, inside the call. Reading `config` at module load
 * returns framework defaults rather than the application's own values,
 * because the override pass has not finished yet, and a credential resolved
 * from a default is an empty string that fails much later and somewhere else.
 */

/**
 * The field names each platform's credentials are read from, in env order.
 *
 * Exported so a test can hold them against the drivers rather than against
 * this file: these tables ARE the claim that a platform's credentials are
 * complete, and a claim nothing checks is a comment.
 */
export const SOCIAL_CREDENTIAL_FIELDS = {
  bluesky: ['identifier', 'password', 'service'],
  twitter: ['clientId', 'clientSecret', 'accessToken', 'refreshToken'],
  linkedin: ['accessToken', 'memberUrn', 'clientId', 'clientSecret', 'apiVersion'],
  mastodon: ['accessToken', 'instanceUrl'],
  instagram: ['accessToken', 'accountId', 'clientId', 'clientSecret'],
  threads: ['accessToken', 'userId', 'clientId', 'clientSecret'],
} as const satisfies Record<SocialCredentialPlatform, readonly string[]>

/**
 * The fields a platform cannot act without.
 *
 * Taken from what each driver's `publish()` dereferences and throws over, not
 * from what its API documents. LinkedIn, Mastodon, Instagram and Threads each
 * need a second value besides the token - the member URN, the instance, the
 * account id, the user id - because a token alone does not say where or as
 * whom to post, and each driver refuses without it.
 *
 * `clientId` and `clientSecret` are NOT required for those four: they are for
 * refreshing, and an identity with a live token posts without them. Requiring
 * them would refuse a working configuration.
 */
export const REQUIRED_SOCIAL_CREDENTIALS = {
  bluesky: ['identifier', 'password'],
  twitter: ['clientId', 'clientSecret', 'accessToken'],
  linkedin: ['accessToken', 'memberUrn'],
  mastodon: ['accessToken', 'instanceUrl'],
  instagram: ['accessToken', 'accountId'],
  threads: ['accessToken', 'userId'],
} as const satisfies Record<SocialCredentialPlatform, readonly string[]>

/**
 * The environment segment for an identity name.
 *
 * `home-lang` becomes `HOMELANG`, so the variable is
 * `SOCIALS_HOMELANG_BLUESKY_PASSWORD`. Anything that is not a letter or digit
 * is dropped rather than replaced with `_`, because `HOME_LANG_BLUESKY_...`
 * cannot be told apart from an identity actually called `home` on a platform
 * called `lang`.
 */
export function envSegment(identity: string): string {
  return identity.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** `SOCIALS_STACKS_BLUESKY_PASSWORD`, for the error messages and the docs. */
export function envName(identity: string, platform: SocialCredentialPlatform, field: string): string {
  const snake = field.replace(/[A-Z]/g, c => `_${c}`).toUpperCase()
  return `SOCIALS_${envSegment(identity)}_${platform.toUpperCase()}_${snake}`
}

export class SocialIdentityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SocialIdentityError'
  }
}

/**
 * This application's `socials` configuration, after the overrides have
 * merged.
 *
 * Exported so the publishing layer reads it through the same barrier rather
 * than reaching for `config` itself: an early read answers with framework
 * defaults, and a credential resolved from a default is an empty string that
 * fails much later and somewhere else (stacksjs/stacks#2333).
 */
export async function socialsConfig(): Promise<SocialsShape> {
  const { config, overridesReady } = await import('@stacksjs/config')
  await overridesReady
  return (config as { socials?: SocialsShape }).socials ?? {}
}

export interface SocialsShape {
  default?: string
  identities?: Record<string, SocialIdentityOptions>
}

/**
 * Which identity a call acts as, given the configuration.
 *
 * Pure, and the async wrapper below only fetches the config, so every branch
 * here is reachable from a test. The helper being right while the public entry
 * never reaches it is a shape this repository has shipped more than once.
 *
 * With several identities configured and none named, this refuses rather than
 * picking one. Posting as the wrong account cannot be taken back, so the
 * ambiguity is reported at the call instead of resolved by position.
 */
export function pickIdentity(socials: SocialsShape, identity?: string): string {
  const names = Object.keys(socials.identities ?? {})

  if (identity) {
    if (!names.includes(identity))
      throw new SocialIdentityError(`Unknown social identity '${identity}'. config/socials.ts declares: ${names.length ? names.join(', ') : 'none'}.`)
    return identity
  }

  if (socials.default) {
    if (!names.includes(socials.default))
      throw new SocialIdentityError(`config/socials.ts sets default: '${socials.default}', which is not one of its identities: ${names.length ? names.join(', ') : 'none'}.`)
    return socials.default
  }

  if (names.length === 1)
    return names[0]!

  if (names.length === 0)
    throw new SocialIdentityError('config/socials.ts declares no identities, so there is no account to post as.')

  throw new SocialIdentityError(`config/socials.ts declares ${names.length} identities (${names.join(', ')}) and no default, so a call has to name one.`)
}

/**
 * Whatever is configured for one identity on one platform, without judging it.
 *
 * Inline `credentials` win; otherwise the environment convention applies.
 *
 * Separate from {@link pickCredentials} because a consent flow needs exactly
 * this: it reads `clientId` and `clientSecret` in order to GO AND GET the
 * access token, so the validator that insists on an access token would refuse
 * the one command that can produce one.
 */
export function readCredentials<P extends SocialCredentialPlatform>(
  socials: SocialsShape,
  platform: P,
  identity: string,
  env: Record<string, string | undefined> = process.env,
): Partial<SocialCredentialsByPlatform[P]> {
  const declared = socials.identities?.[identity] ?? {}
  const inline = (declared.credentials?.[platform] ?? {}) as Record<string, string | undefined>
  const resolved: Record<string, string> = {}

  for (const field of SOCIAL_CREDENTIAL_FIELDS[platform]) {
    const value = (inline[field] ?? env[envName(identity, platform, field)] ?? '').trim()
    if (value) resolved[field] = value
  }

  return resolved as Partial<SocialCredentialsByPlatform[P]>
}

/**
 * The credentials for one identity on one platform, given the configuration.
 *
 * Inline `credentials` win; otherwise the environment convention applies. The
 * error names the variables that were looked for and never the values that
 * were found, so it is safe to paste into an issue.
 */
export function pickCredentials<P extends SocialCredentialPlatform>(
  socials: SocialsShape,
  platform: P,
  identity?: string,
  env: Record<string, string | undefined> = process.env,
): SocialCredentialsByPlatform[P] {
  const name = pickIdentity(socials, identity)
  const resolved = readCredentials(socials, platform, name, env) as Record<string, string>

  const missing = REQUIRED_SOCIAL_CREDENTIALS[platform].filter(field => !resolved[field])
  if (missing.length) {
    const vars = missing.map(field => envName(name, platform, field)).join(', ')
    throw new SocialIdentityError(
      `Identity '${name}' is not configured for ${platform}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. Set ${vars}, or supply them inline in config/socials.ts.`,
    )
  }

  return resolved as SocialCredentialsByPlatform[P]
}

/** {@link pickIdentity}, against the application's own configuration. */
export async function resolveIdentityName(identity?: string): Promise<string> {
  return pickIdentity(await socialsConfig(), identity)
}

/** {@link pickCredentials}, against the application's own configuration. */
export async function resolveSocialCredentials<P extends SocialCredentialPlatform>(
  platform: P,
  identity?: string,
  env?: Record<string, string | undefined>,
): Promise<SocialCredentialsByPlatform[P]> {
  return pickCredentials(await socialsConfig(), platform, identity, env)
}

/** Typed shorthands, so a caller does not restate the platform twice. */
export function resolveBlueskyCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<BlueskyCredentialOptions> {
  return resolveSocialCredentials('bluesky', identity, env)
}

export function resolveTwitterCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<TwitterCredentialOptions> {
  return resolveSocialCredentials('twitter', identity, env)
}

export function resolveLinkedInCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<LinkedInCredentialOptions> {
  return resolveSocialCredentials('linkedin', identity, env)
}

export function resolveMastodonCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<MastodonCredentialOptions> {
  return resolveSocialCredentials('mastodon', identity, env)
}

export function resolveInstagramCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<InstagramCredentialOptions> {
  return resolveSocialCredentials('instagram', identity, env)
}

export function resolveThreadsCredentials(identity?: string, env?: Record<string, string | undefined>): Promise<ThreadsCredentialOptions> {
  return resolveSocialCredentials('threads', identity, env)
}
