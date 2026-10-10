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

Scopes/setScopes/with/setRedirectUrl belong to AbstractProvider. Providers read
their actual services config and impose provider-specific scope and credential
rules. withState supplies the flow's state and validateState checks the expected
and returned values; persist expected state in the native callback session.
Twitter sign-in keeps a PKCE verifier on its instance; getAuthUrl must
precede its exchange on the same stateful flow. Persist and validate state/PKCE
through the native callback path before minting an app credential; low-level
getUserByToken alone does not prove the browser initiated a login.

SocialUser includes emailVerified. Respect the provider's verification signal
and the configured account-linking policy, using auth's resolveSocialSignIn
instead of attaching any equal email address to an existing account. Provider
errors and ConfigException/InvalidStateException are different from successful
profile retrieval. Never log raw credential fields.

## Session handoff

socialHandoffRedirect(pack, { redirectTo?, allowedHosts? }) emits a no-store
redirect with the native encoded session handoff. Browser useAuth's
completeSocialLogin consumes it and removes the fragment. isSafeHandoffTarget
checks permitted redirect shape; choose a server-owned landing path. The helper
also supplies a failed-sign-in redirect. These are separate from provider token
exchange and the auth cookie/session issuance policy.

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

`storage/framework/core/socials/src/index.ts`, registry.ts, abstract.ts,
handoff.ts, identities.ts, publish.ts, authorize.ts, meta-graph.ts and drivers/.
Tests: registry.test.ts, apple.test.ts, session-handoff.test.ts,
identities.test.ts, publish.test.ts, authorize.test.ts,
credentials-stay-out-of-output.test.ts and meta-graph.test.ts.
