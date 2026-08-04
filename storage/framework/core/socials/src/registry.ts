import type { ProviderInterface } from './types'
import { config } from '@stacksjs/config'
import { AppleProvider, FacebookProvider, GitHubProvider, GoogleProvider, TwitterProvider } from './drivers'

/**
 * Which social providers are usable in this application right now.
 *
 * Every driver already knows what it needs, but only as a throw: each
 * `validateConfig()` raises a ConfigException part-way through an auth
 * flow. A sign-in page has the opposite question, and has to answer it
 * before rendering anything: which buttons will actually work?
 *
 * Without an answer here, applications hand-roll one, and the shape they
 * reach for is `clientId && clientSecret`, because that is true of every
 * provider except the one it is not true of. Apple has no static client
 * secret at all (the driver signs a short-lived ES256 JWT from teamId +
 * keyId + privateKey), so a hand-rolled check silently classifies a fully
 * configured Apple as absent, and Sign in with Apple never appears.
 *
 * The same registry drives construction, so a provider is built with the
 * whole of its config block rather than the three fields the OAuth2
 * providers happen to share.
 */

export type SocialProviderName = 'apple' | 'facebook' | 'github' | 'google' | 'twitter'

export interface SocialProviderDescriptor {
  name: SocialProviderName
  /** Display name, as the provider's own brand guidelines write it. */
  label: string
  driver: new (providerConfig: any) => ProviderInterface
  /**
   * `config.services[name]` keys that must be non-empty before sign-in can
   * succeed. Mirrors the driver's own `validateConfig()`.
   */
  required: readonly string[]
  /**
   * True when the provider returns its callback as a cross-site POST
   * rather than a GET. Apple mandates `response_mode=form_post` whenever
   * scopes are requested, so an application that registers only a GET
   * callback route answers Apple's redirect with a 404.
   */
  postCallback: boolean
}

const OAUTH2_REQUIRED = ['clientId', 'clientSecret', 'redirectUrl'] as const

export const SOCIAL_PROVIDERS: Readonly<Record<SocialProviderName, SocialProviderDescriptor>> = Object.freeze({
  google: {
    name: 'google',
    label: 'Google',
    driver: GoogleProvider,
    required: OAUTH2_REQUIRED,
    postCallback: false,
  },
  github: {
    name: 'github',
    label: 'GitHub',
    driver: GitHubProvider,
    required: OAUTH2_REQUIRED,
    postCallback: false,
  },
  facebook: {
    name: 'facebook',
    label: 'Facebook',
    driver: FacebookProvider,
    required: OAUTH2_REQUIRED,
    postCallback: false,
  },
  twitter: {
    name: 'twitter',
    label: 'X',
    driver: TwitterProvider,
    required: OAUTH2_REQUIRED,
    postCallback: false,
  },
  apple: {
    name: 'apple',
    label: 'Apple',
    driver: AppleProvider,
    // No clientSecret. See generateClientSecret() in the Apple driver.
    required: ['clientId', 'teamId', 'keyId', 'privateKey', 'redirectUrl'],
    postCallback: true,
  },
})

function settingsFor(name: SocialProviderName): Record<string, any> | undefined {
  return (config as any)?.services?.[name]
}

/** Is `name` a provider this package can drive? */
export function isSocialProviderName(name: unknown): name is SocialProviderName {
  return typeof name === 'string' && name in SOCIAL_PROVIDERS
}

/**
 * Does this provider have everything it needs to complete a sign-in?
 *
 * Never throws, so it is safe to call while rendering. An unknown name is
 * simply not configured.
 */
export function isSocialProviderConfigured(name: unknown): boolean {
  if (!isSocialProviderName(name))
    return false

  const settings = settingsFor(name)
  if (!settings)
    return false

  return SOCIAL_PROVIDERS[name].required.every(key => Boolean(settings[key]))
}

/**
 * Every provider that would work if a visitor clicked it, in the order
 * they are declared above. Render sign-in buttons straight off this and a
 * half-configured provider never reaches a visitor as a dead button.
 */
export function configuredSocialProviders(): SocialProviderDescriptor[] {
  return (Object.keys(SOCIAL_PROVIDERS) as SocialProviderName[])
    .filter(isSocialProviderConfigured)
    .map(name => SOCIAL_PROVIDERS[name])
}

/**
 * Build a provider, or null when it is not configured.
 *
 * The whole `config.services[name]` block is passed to the driver, so
 * provider-specific fields (Apple's teamId, keyId and privateKey) arrive
 * rather than being dropped by a caller that only knew about clientId and
 * clientSecret. Returning null rather than throwing lets a route answer
 * 404 for an unconfigured provider instead of redirecting a visitor to a
 * provider error page that reads to them as the application's fault.
 */
export function socialProvider(name: unknown): ProviderInterface | null {
  if (!isSocialProviderConfigured(name))
    return null

  const descriptor = SOCIAL_PROVIDERS[name as SocialProviderName]
  const settings = settingsFor(name as SocialProviderName) ?? {}

  return new descriptor.driver({
    // clientSecret is required by ProviderConfig but meaningless to Apple,
    // which is why it is defaulted rather than demanded.
    clientSecret: '',
    ...settings,
    clientId: String(settings.clientId ?? ''),
    redirectUrl: String(settings.redirectUrl ?? ''),
  })
}
