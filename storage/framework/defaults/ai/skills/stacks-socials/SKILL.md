---
name: stacks-socials
description: Use when implementing social sign-in, Apple callbacks, PKCE/session handoff, named publishing identities, or publishing through native platform drivers. Covers @stacksjs/socials and config/socials.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Socials

The native package has separate social sign-in and publishing APIs. Selecting a
publishing identity does not sign a user into the app, and a sign-in token is not
necessarily authorized to publish.

## Social sign-in

Apple, Facebook, GitHub, Google and X providers implement getAuthUrl,
getAccessToken(code), getUserByToken(token) and inherited userFromToken.
configuredSocialProviders/isSocialProviderConfigured/socialProvider expose the
native provider registry and prerequisite checks. Render buttons from that
registry rather than guessing clientId/clientSecret works for every provider.

Apple uses teamId/keyId/privateKey to mint a client-secret JWT; it has no static
client secret requirement. Its callback is a cross-site POST, so a GET-only
callback cannot complete it. Read the native default auth route/actions and
provider test before handling one-time Apple name data or ID-token verification.
Meta API version is centralized in meta-graph.ts rather than an obsolete v18
copied into every example.

Scopes/setScopes/with/setRedirectUrl/withState belong to AbstractProvider and
are on ProviderInterface, so the registry's `socialProvider()` result can be
driven without casts. Every OAuth2 driver honours withState, with() and an
instance redirect. X always uses PKCE; its verifier lives in the base class
(getPkceVerifier/withCodeVerifier), so a callback on a fresh instance can
restore it. Registry descriptors say `pkce` (X) and `nonce` (Apple).

## Flow state (login CSRF)

A callback that exchanges any `code` signs the victim into the attacker's
account. Start every flow with
`issueOAuthFlow({ purpose, userId?, data?, ttlMs, bindBrowser?, challenge?, nonce?, cookie? })`,
which returns `{ state, cookie, secret, nonce?, expiresAt }`: a random state for
`withState()`, and a `Set-Cookie` (HttpOnly, per-flow `stacks_oauth_*` name,
`SameSite=Lax`, or `None; Secure` for Apple's cross-site form_post) binding it
to the browser. Only SHA-256 digests are stored, in the auth-owned
`oauth_flows` table (`buddy migrate`). On the callback,
`consumeOAuthFlow(state, { purpose, browserSecret })` returns
`{ purpose, userId, nonce, data, expiresAt }` once, or null for an unknown,
spent, expired, foreign-purpose or other-browser state; a mismatch does not burn
the real flow. Read the secret with `readOAuthFlowCookie(cookieHeader, state)`
and clear it on every outcome with `clearOAuthFlowCookie(state, cookieOptions)`.
`challenge` binds to the SHA-256 hex of a native client's verifier instead of a
cookie. `nonce: true` mints an OIDC nonce: pass it with `with({ nonce })` and
to `getUserByToken(token, { nonce })`, which refuses a mismatched id_token.
`useOAuthFlowStore(memoryOAuthFlowStore())` swaps storage in tests;
`validateState()` remains for callers holding their own expected value.

The default routes do all of this: `GET /auth/{provider}` (optional
`?redirect_to=/path`, same-origin only) and `GET|POST /auth/{provider}/callback`
(POST skips CSRF, since the bound state is the defence). Read
`defaults/app/Actions/Auth/SocialRedirectAction.ts` and
`SocialCallbackAction.ts` before writing a custom callback.

SocialUser includes emailVerified. Respect the provider's verification signal
and the configured account-linking policy, using auth's resolveSocialSignIn
instead of attaching any equal email address to an existing account; it also
refuses to link onto a local account that never verified its address
(`'unverified-local-email'`). Provider errors and
ConfigException/InvalidStateException are different from successful profile
retrieval. Never log raw credential fields.

## Session handoff

The default callback mints no session and puts no token in the URL. It calls
`createSessionHandoff(userId, { bindTo: 'cookie' })` (`@stacksjs/auth`) and
returns `socialHandoffCodeRedirect(code, { redirectTo?, allowedHosts? })`, a
no-store 302 to `redirectTo#stx_handoff=<code>` plus the binding cookie.
Browser `useAuth().completeSocialLogin()` strips the fragment and POSTs the code
to `POST /auth/handoff`, which redeems it once (60 seconds, this browser only)
and answers with the token pack and auth cookie. Native apps bind with
`{ challenge }` and redeem with `{ code, verifier }`.

socialHandoffRedirect(pack, ...) still emits the older fragment carrying the
bearer and refresh tokens (`stx_auth`); avoid it for new flows, since browser
history keeps the fragment. isSafeHandoffTarget checks permitted redirect
shape; choose a server-owned landing path. socialHandoffFailureRedirect supplies
the failed-sign-in redirect (`?social_error=`).

## Named publishing identities

config/socials.ts declares identities/platforms and optional defaultIdentity.
resolveSocialCredentials and the six platform-specific resolvers read settings
after config readiness, with explicit identity selection and environment-backed
credentials. envName/envSegment define the SOCIALS_<IDENTITY>_<PLATFORM>_<FIELD>
namespace. An identity's declared platform and required fields are checked; a
handle used in a permalink is not an authentication credential.

Native publishing drivers cover Bluesky, X, LinkedIn, Mastodon, Instagram and
Threads. publishingDriver/platform options and toDriverIdentity map the actual
account/instance/URN fields; socialPublishTarget resolves a complete target,
including a Bluesky session, and publishAs(platform, post, identity?, env?) sends
through it. PublishPostInput/PublishedPost/SocialPublishingDriver are exported
contracts. Read their driver methods before using media, metrics, deletion,
refresh or profile functionality; support differs per provider.

## Authorization and operational limits

The native terminal consent helper in authorize.ts currently supports X only.
It uses loopback callback URI, checked state and PKCE; offline.access supplies
refresh credentials. Declaring another publishing platform does not make the
same interactive consent helper support it. Stored tokens, platform account
access and provider app registration remain prerequisites.

Drafting or reviewing a post does not itself authorize publishAs, deletion,
credential writes or a consent flow. Use the task's explicit authorization for
those actions. Local driver/request tests establish behavior, not live platform
conformance or successful publication for arbitrary accounts.

## Source and evidence

`storage/framework/core/socials/src/index.ts`, registry.ts, abstract.ts, flows.ts,
handoff.ts, identities.ts, publish.ts, authorize.ts, meta-graph.ts and drivers/.
Tests: registry.test.ts, apple.test.ts, session-handoff.test.ts, oauth-flows.test.ts,
provider-flow-state.test.ts, auth/tests/social-callback-flow.test.ts,
identities.test.ts, publish.test.ts, authorize.test.ts,
credentials-stay-out-of-output.test.ts and meta-graph.test.ts.
