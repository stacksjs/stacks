import type { SocialCredentialPlatform } from '@stacksjs/types'
import type {
  PublishedPost,
  PublishPostInput,
  SocialIdentityCredentials,
  SocialPublishingDriver,
} from './types'
import {
  BlueskyPublishingDriver,
  InstagramPublishingDriver,
  LinkedInPublishingDriver,
  MastodonPublishingDriver,
  ThreadsPublishingDriver,
  TwitterPublishingDriver,
} from './drivers'
import { pickCredentials, resolveIdentityName, SocialIdentityError, socialsConfig } from './identities'

/**
 * Posting as a configured identity.
 *
 * The drivers and the credential resolver both existed and nothing joined
 * them: `config/socials.ts` resolves to `{ accessToken, memberUrn }` while a
 * driver reads `{ handle, did, accessToken }`, so every caller had to know
 * which config field goes in the `did` slot for which platform
 * (stacksjs/stacks#2873). That knowledge belongs here, once.
 */

/**
 * The resolved credential field each driver reads out of `identity.did`.
 *
 * `did` is an ATProto name and the slot is reused by every driver for "where
 * or as whom", which is the one thing a token does not say. Four platforms
 * need it and refuse without it; this table is what keeps the mapping out of
 * the call sites.
 *
 * Null means the driver does not read the slot:
 *
 * - `bluesky` fills it itself. `createSession` returns the account's real DID,
 *   so taking one from configuration would be a second source for a value the
 *   network already answers.
 * - `twitter` never reads it. Posting is scoped by the token alone.
 */
export const DRIVER_DID_FIELD = {
  bluesky: null,
  twitter: null,
  linkedin: 'memberUrn',
  mastodon: 'instanceUrl',
  instagram: 'accountId',
  threads: 'userId',
} as const satisfies Record<SocialCredentialPlatform, string | null>

/** Driver constructor options that come from a credential rather than a default. */
export interface SocialDriverOptions {
  /** Bluesky: a PDS other than `https://bsky.social`. */
  service?: string
  /** LinkedIn: the `LinkedIn-Version` this tenant is on. */
  apiVersion?: string
}

/**
 * The two driver options that are per identity rather than per platform.
 *
 * Pure and separate from the identity, because they go to a constructor while
 * the identity goes to `publish()`. Resolved from the same credentials, so an
 * app on a self-hosted PDS or an older LinkedIn tenant configures it in one
 * place.
 */
export function driverOptions(
  platform: SocialCredentialPlatform,
  credentials: Record<string, string | undefined>,
): SocialDriverOptions {
  if (platform === 'bluesky')
    return credentials.service ? { service: credentials.service } : {}
  if (platform === 'linkedin')
    return credentials.apiVersion ? { apiVersion: credentials.apiVersion } : {}
  return {}
}

/** The driver for a platform. */
export function publishingDriver(
  platform: SocialCredentialPlatform,
  options: SocialDriverOptions = {},
): SocialPublishingDriver {
  switch (platform) {
    case 'bluesky': return new BlueskyPublishingDriver(options)
    case 'linkedin': return new LinkedInPublishingDriver(options)
    case 'twitter': return new TwitterPublishingDriver()
    case 'mastodon': return new MastodonPublishingDriver()
    case 'instagram': return new InstagramPublishingDriver()
    case 'threads': return new ThreadsPublishingDriver()
    default: {
      // Exhaustive over SocialCredentialPlatform, so adding a platform to the
      // type without a driver here fails to compile rather than at runtime.
      const unreachable: never = platform
      throw new SocialIdentityError(`No publishing driver for '${String(unreachable)}'.`)
    }
  }
}

/**
 * Resolved credentials, in the shape a driver reads.
 *
 * Pure, so the mapping is testable without a network: this is the function
 * that decides a LinkedIn post's author and a Mastodon post's instance, and
 * getting either wrong posts to the wrong place rather than failing.
 *
 * Bluesky is the exception and is handled by {@link socialPublishTarget},
 * because its `accessToken` comes from a session mint rather than from
 * configuration.
 */
export function toDriverIdentity(
  platform: SocialCredentialPlatform,
  handle: string,
  credentials: Record<string, string | undefined>,
): SocialIdentityCredentials {
  const field = DRIVER_DID_FIELD[platform]
  const identity: SocialIdentityCredentials = {
    // Only ever used to build a post's permalink, so an identity with no
    // handle declared posts fine and gets no URL back. Not a credential, and
    // never used to authenticate.
    handle: (handle ?? '').trim(),
  }

  if (credentials.accessToken) identity.accessToken = credentials.accessToken
  if (credentials.refreshToken) identity.refreshToken = credentials.refreshToken
  if (field && credentials[field]) identity.did = credentials[field]

  return identity
}

/**
 * Refuse a platform the identity does not list.
 *
 * Declaring `platforms` in `config/socials.ts` is what turns a missing
 * credential into a configuration error rather than a silent no-op, so an
 * undeclared platform must not quietly work off stray environment variables.
 * An identity that declares no platforms at all is unconstrained, which is
 * what an app with one identity and no list means.
 *
 * Pure, because it is the one check standing between "this identity speaks on
 * these networks" and posting somewhere nobody said it could.
 */
export function assertPlatformDeclared(
  name: string,
  platform: SocialCredentialPlatform,
  platforms?: readonly SocialCredentialPlatform[],
): void {
  if (!platforms)
    return
  if (platforms.includes(platform))
    return

  throw new SocialIdentityError(
    `Identity '${name}' is not set up for ${platform}. config/socials.ts lists: ${platforms.length ? platforms.join(', ') : 'none'}.`,
  )
}

/** Everything needed to post as one identity on one platform. */
export interface SocialPublishTarget {
  /** The identity's configured name, for messages and logs. Never a secret. */
  name: string
  platform: SocialCredentialPlatform
  /** What `publish()` reads. */
  identity: SocialIdentityCredentials
  /** What the driver's constructor takes. */
  options: SocialDriverOptions
}

/**
 * Resolve one identity on one platform, ready to post.
 *
 * Bluesky mints a session here, which is a network call: its app password is
 * long-lived and the token it buys is not, so there is nothing to store
 * between posts and nothing to refresh.
 */
export async function socialPublishTarget(
  platform: SocialCredentialPlatform,
  identity?: string,
  env?: Record<string, string | undefined>,
): Promise<SocialPublishTarget> {
  const socials = await socialsConfig()
  const name = await resolveIdentityName(identity)
  const declared = socials.identities?.[name] ?? {}

  // Refused before any credential is read, so an undeclared platform costs
  // nothing and cannot pick up stray environment variables.
  assertPlatformDeclared(name, platform, declared.platforms)

  const credentials = pickCredentials(socials, platform, name, env) as Record<string, string | undefined>
  const options = driverOptions(platform, credentials)

  if (platform === 'bluesky') {
    const session = await new BlueskyPublishingDriver(options).createSession({
      identifier: credentials.identifier!,
      password: credentials.password!,
    })
    return {
      name,
      platform,
      identity: {
        // The account's own handle and DID rather than whatever configuration
        // says: the network is authoritative about who an app password belongs
        // to, and a mismatch would build permalinks for another account.
        handle: session.handle,
        did: session.did,
        accessToken: session.accessJwt,
        refreshToken: session.refreshJwt,
      },
      options,
    }
  }

  return { name, platform, identity: toDriverIdentity(platform, declared.handle ?? '', credentials), options }
}

/**
 * Post as a configured identity.
 *
 * The one call a caller needs: `publishAs('bluesky', { text }, 'home-lang')`.
 * Nothing about which field is a DID, which driver takes which options, or
 * where a credential lives reaches the call site.
 */
export async function publishAs(
  platform: SocialCredentialPlatform,
  post: PublishPostInput,
  identity?: string,
  env?: Record<string, string | undefined>,
): Promise<PublishedPost> {
  const target = await socialPublishTarget(platform, identity, env)
  return publishingDriver(target.platform, target.options).publish(target.identity, post)
}
