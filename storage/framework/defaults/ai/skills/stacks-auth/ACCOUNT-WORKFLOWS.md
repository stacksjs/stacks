# Native account workflows

Read this when an account feature needs the native workflow rather than a token
or TOTP primitive. All source paths below start at
`storage/framework/core/auth/`. Public exports are in `src/index.ts`.

## Passwordless magic links

`sendMagicLink(email, options?)` accepts redirectTo, siteId, ttlMinutes and
createUser. Enable `config.auth.magicLink` and its route bundle before building
a form around the default actions. The native link flow keeps the bearer hashed
at rest and uses a POST to consume it; GET is an interstitial because mail
scanners prefetch links.

`consumeMagicLink(raw)` returns a discriminated result with userId/email/redirect
on success, or invalid/expired/used/no-user. The transactional `withMagicLink`
helper binds consumption to issuance; read its callback signature before writing
an alternative action. `pruneMagicLinkTokens(olderThanDays?)` removes old state.
Redirects must be local paths, and successful consume does not by itself set an
HTTP cookie. Keep issuance inside the native completed-login flow.

Source: `src/magic-link.ts`. Evidence: `tests/magic-link.test.ts`,
`magic-link-owner.test.ts`, `magic-link-send-atomicity.test.ts` and
`magic-link-drivers.test.ts`. A database failure or mail failure is not a reason
to return an unusable credential as successful login.

## Two-factor setup and completed login

`TwoFactor` and its named functions manage setup, pending secrets, challenges,
verification and recovery, beyond generating a TOTP code. Native functions
include generateTwoFactorSetup, stashPendingTwoFactorSecret,
consumePendingTwoFactorSecret, enableTwoFactor, disableTwoFactor,
verifyTwoFactorLoginCode, createTwoFactorChallenge, consumeTwoFactorChallenge,
withTwoFactorChallenge and revokeTwoFactorChallenges.

Use the default action flow as the application reference: the password step
creates a challenge, and completed verification issues the actual browser
credential. The challenge carries the remembered-lifetime choice. Setup and
disable actions impose their own proof and reauthentication requirements;
low-level helper calls do not establish that the caller owns the account.

Source: `src/two-factor.ts` and default auth actions. Evidence:
`tests/two-factor-login-wiring.test.ts`, `two-factor-recovery.test.ts`,
`two-factor-disable-reauth.test.ts`, `two-factor-challenge-atomicity.test.ts` and
`two-factor-state-atomicity.test.ts`.

## Cookie tokens and database sessions

Bearer/token-cookie auth and `SessionAuth` database sessions use different
credentials. The default Auth middleware tries a parsed bearer, then the
configured auth token cookie, then `session_id`, and stamps the request user.
`authCookieName`, authCookie/clearAuthCookie, userFromCookie/cookieCheck and
logoutCookie are native cookie helpers. Cookie writes need the normal browser
CSRF flow; a cookie is not a bearer header.

`SessionAuth.login` persists a session with an expiry; logout/destroyAll are
awaitable mutations. user/check/refresh validate owner, deadline and optional
idle timeout. `config.auth.idleTimeout` is milliseconds; fingerprint enforcement
is opt-in via `config.auth.session.enforceFingerprint`, true or individual
ip/userAgent flags. A changing mobile IP can make enforcement inappropriate.
Reads outside a request lack a client fingerprint. Session refresh accepts a
positive finite TTL and uses an observed-version update so it cannot resurrect
an expired/deleted credential.

Browser-session policy is separately resolved by resolveBrowserSessionPolicy.
Read `config/auth.ts`: baseline and remembered defaults currently share
tokenExpiry, and an app may configure them differently. Dedicated personal
access token and delegated OAuth issuance do not inherit the browser policy.

Source: `src/cookie-auth.ts`, `browser-session.ts`, `request-token.ts`,
`session-auth.ts`, `page-gate.ts`. Evidence: `tests/session-http-lifecycle.test.ts`,
`session-idle-timeout.test.ts`, `session-refresh-atomicity.test.ts`,
`browser-session-policy.test.ts` and `auth-cookie-name.test.ts`.

## Roles, permissions and active teams

RBAC lazily creates the native bun-query-builder store; a custom RbacStore is
optional. Apply role/permission/pivot migrations before assigning roles.
`seedDefaultRoles()` idempotently creates admin/dev/client role packs with their
declared guards. It does not seed the application's permission taxonomy.
Guard-scoped sync preserves other guards. Direct SQL changes require explicit
RBAC cache invalidation. A role name that drives UI visibility is not a substitute
for action authorization.

`resolveTeamContext(request, { allowAnyTeam? })` returns user, current team,
role, switchable teams and the active preference. Related helpers include
resolveAuthenticatedMembership, resolveAuthenticatedTeamId,
resolveAuthenticatedUser, buildActiveTeamCookie and clearActiveTeamCookie.
An active-team cookie is a preference, not proof of membership; the resolver
checks the authenticated user's active membership. An operator override is
application policy and must remain server-owned.

Source: `src/rbac.ts`, `rbac-store-bqb.ts`, `rbac-seed.ts` and `team.ts`.
Evidence: `tests/rbac-default-store.test.ts`, `rbac-guard-sync.test.ts`,
`rbac-seed.test.ts` and `active-team.test.ts`.

## Social identity linking and referrals

`resolveSocialSignIn(provider, identity, store?)` resolves durable provider-id
links first, then applies `config.auth.socials.matching`: link/create/refuse.
An email match is subject to the identity verification policy; copying an email
from a provider payload is not sufficient proof to link an existing account.
Use SocialSignInRefusedError to distinguish configured refusal from infrastructure
failure. `stacks-socials` owns provider authorization and callback exchange.

Referrals expose createReferralCode(ownerId), attributeReferral(newUserId, input),
qualifyReferral(referredUserId) and referralSummary(ownerId), with optional
database injection. Normalize/attribute at registration and qualify at the
application's real conversion milestone. Attribution alone is not a paid reward.

Source: `src/socials.ts`, `referrals.ts`. Evidence: `tests/social-linking.test.ts`,
`referrals.test.ts`. All account features remain subject to model loading,
selected route bundles, config gates and applied migrations.
