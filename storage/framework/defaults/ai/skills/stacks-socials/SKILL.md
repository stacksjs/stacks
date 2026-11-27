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

## Signing in with another Stacks application

`StacksIssuerProvider({ issuer, clientId, clientSecret, redirectUrl, scopes,
resource, userInfoUrl })` signs people in with another Stacks app that runs
`oauthProvider`: Authorization Code with S256 PKCE (always on, so carry
`getPkceVerifier()` in the flow and restore it with `withCodeVerifier()`) and
client_secret_basic. Send `resource` whenever the issuer binds scopes to one.
`getTokens(code)` keeps the refresh token that `getAccessToken` drops;
`refreshTokens(rt)` rotates it, `revokeToken(rt)` unlinks (RFC 7009) and
`getClaims(token)` / `getUserByToken(token)` read the issuer's
`oauthUserInfoResponse` endpoint, keyed by its pairwise `sub`. Only a boolean
`email_verified` counts as verified. It is constructed directly, not through the
registry.

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

Each driver measures its limit the way its network counts (countText and
exceedsLimit in text.ts: graphemes on Bluesky and Threads, X's weighted count,
Mastodon's link and mention rules) and sends several images with alt text: X up
to four, carousels on Threads and Instagram, multiImage on LinkedIn. An image
given by URL is downloaded through fetchPostImage (the outbound guard in
@stacksjs/security) and a URL that gives no image throws PostImageError; tests
replace a driver's fetchImage. Mastodon's publish takes a third argument
(idempotencyKey, visibility, spoilerText, language) and reads the instance's
limits. Bluesky uploads external.thumb for link cards, and its publish takes a
third argument too: { rkey } from blueskyRecordKey(), kept per post, so a retry
answers with the post that already went out instead of posting twice. Bluesky
hashtags take letters from any script (#café, #日本), and images leave a link
card out with a warning, since a post holds one attachment. A Bluesky account on
its own PDS signs in there: when no service is configured and bsky.social refuses
the password, createSession looks the account's PDS up from its DID document
(resolveBlueskyService), and the session's service is where its posts go.

For Mastodon polls, read the instance's advertised `instanceLimits().poll`
and supply `publish(..., { poll: { options, expiresIn, multiple?, hideTotals? } })`.
Duration is in seconds. Mastodon quote posts require the advertised
`instanceLimits().quotePosts` capability. `resolvePostId(identity, permalink)`
uses the account's instance and `read:search` to obtain its local ID. Pass
that ID as `quotedStatusId` and keep the reference with the publishing
target. A poll, a quote, and attached images are mutually exclusive on Mastodon.

For Bluesky, `resolveQuote(identity, permalinkOrAtUri)` checks the
viewer's quote permission and returns the post's URI and CID. Keep that
reference with the post, then pass it as `quote` in the driver's third
argument. A quote can accompany images or an external card. Supply
`selfLabels` in the same argument to attach the author's content labels.

Mastodon and Bluesky take one MP4 in `PublishPostInput.video` with its bytes,
MIME type, optional alt text, and optional dimensions. Mastodon checks the
instance's advertised media limits and waits for its attachment endpoint to
return the processed video. Bluesky uses a PDS-scoped upload token and waits
for its video service to return the processed blob. Reuse the normal Mastodon
idempotency key or Bluesky record key on retry. The other drivers reject a
video before they publish a post.

Instagram waits for
each media container to be FINISHED before publishing it (containerTimeoutMs,
five minutes by default), sends alt text on images and carousel items, refuses an
image whose mimeType is not JPEG, and looks through every page of the user's
Facebook Pages for the linked account. Threads deletes with deletePost (the
threads_delete permission, 100 a day). LinkedIn posts as a company Page when the
identity's did (the memberUrn setting) is an urn:li:organization URN, with the
w_organization_social scope; listOrganizations(accessToken) lists the Pages the
member may post for (rw_organization_admin). PublishedPost.warnings
lists what went out without failing the post. The LinkedIn version is
LINKEDIN_API_VERSION unless a configured one is still supported.

For LinkedIn and Instagram first comments, call
`createComment(identity, publishedPost.uri, text)` after saving the published
post. LinkedIn needs `w_member_social_feed` or `w_organization_social_feed`
and the matching author URN. Instagram (Facebook Login) needs a Facebook User
token with `instagram_manage_comments` in addition to its normal account access.
An accepted response can return no comment ID. The comment is a distinct
write. Do not send the parent post again when this write fails, and do not
blindly repeat a timed-out comment whose outcome is unknown.

A driver error's isAuthError is narrow; classifySocialError in
publish-errors.ts sorts any failure by status and body, and only `expired`
means the account must sign in again (a duplicate post on X is a 403).

Every driver error (BlueskyApiError, TwitterApiError, ...) is a SocialApiError
from errors.ts: `network`, `status`, the raw `body`, `kind` (the
classification), `reason` (the network's own sentence) and `retryAfterMs`. Its
message is the network's reason or the status text, never the raw body.
`retryAfterMs` reads Retry-After on any answer and, on a rate limit, X's
`x-rate-limit-reset`, Bluesky's `ratelimit-reset`, Mastodon's
`x-ratelimit-reset` and Meta's `estimated_time_to_regain_access`. Meta answers
a rate limit with a 400 ("(#4) Application request limit reached"), which still
classifies as `rate-limited`.

Engagement is a separate capability, like deletion: `supportsMetrics(driver)`,
then `driver.metrics(identity, uris)` with any number of `PublishedPost.uri`s,
answering `PostMetrics` (`likes`, `reposts`, `replies`, `quotes`, `views`,
`shares`). A count the network does not report is absent, not zero, and a post
that is gone is left out. Bluesky batches 25 a request (no views). Mastodon
batches 40 with `GET /api/v1/statuses?id[]=` and falls back to one status at a
time before 4.3 (no views; quotes from 4.5). Threads asks one post at a time
(`/{id}/insights`, the threads_manage_insights permission). Instagram asks one
post at a time too (`/{id}/insights`, instagram_manage_insights) and adds
`reach` and `saves`. LinkedIn batches 20 through Social Metadata: `likes` is
every reaction together, and it needs r_organization_social_feed for a Page
(r_member_social_feed for a member, granted to select developers only). X uses
Post Lookup with `tweet.read` and requests public metrics for up to 100 post IDs
per call. These reads are billed per returned post. Apply the application's
read budget before calling the driver.

## Authorization and operational limits

For X messaging, request `dm.read` and `dm.write` only when the user enables
that feature. `TwitterPublishingDriver.listDirectMessageEvents(identity,
{ limit, cursor, conversationId })` reads one page for the account or a
conversation and returns the next cursor. The request expands only the sender
so a caller can reserve the maximum charge for one DM event and one user per
result. `sendDirectMessage(identity, conversationId, text)` sends one reply
and returns its confirmed event ID. A permission refusal does not invalidate
the account's token. See the [X API pricing](https://docs.x.com/x-api/getting-started/pricing)
and [DM lookup reference](https://docs.x.com/x-api/direct-messages/lookup/introduction).

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
handoff.ts, identities.ts, publish.ts, authorize.ts, meta-graph.ts, text.ts,
media.ts, publish-errors.ts and drivers/.
Tests: registry.test.ts, apple.test.ts, session-handoff.test.ts, oauth-flows.test.ts,
provider-flow-state.test.ts, auth/tests/social-callback-flow.test.ts,
identities.test.ts, publish.test.ts, authorize.test.ts,
credentials-stay-out-of-output.test.ts, meta-graph.test.ts,
publishing-drivers.test.ts, text.test.ts and publish-errors.test.ts.
