/**
 * Framework Default Routes - Social sign-in (stacksjs/stacks#2276)
 *
 * `GET /auth/{provider}` sends the browser to the provider's consent page
 * with a single-use, browser-bound `state`; `/auth/{provider}/callback`
 * redeems that state, completes the exchange, resolves the local user
 * through the find-or-create policy in `@stacksjs/auth` (with its
 * unverified-email takeover guards), and redirects with a one-use handoff
 * code that `POST /auth/handoff` trades for the session.
 *
 * Mounted by `defaults/bootstrap.ts` as the `social` bundle. Unlike the other
 * bundles it is NOT part of the implicit default set: it mounts only when the
 * app names it in `STACKS_DEFAULT_ROUTES`, or when at least one provider is
 * actually configured in `config/services.ts` — a callback URL for a provider
 * nobody configured is surface for nothing. The actions themselves 404 for
 * unconfigured provider names either way.
 *
 * The callback is registered for POST as well as GET because Apple mandates
 * `response_mode=form_post` whenever scopes are requested — a GET-only
 * callback answers Apple's redirect with a 404.
 *
 * Users should NOT edit this file. To override any route here, define the
 * same method + path in your `routes/api.ts`: user routes load first and
 * first registration wins.
 */

import { route } from '@stacksjs/router'

// Rate-limited like the other token-issuance endpoints (#1921): the callback
// mints a session, and the redirect endpoint is a cheap way to hammer a
// provider's authorize page with this app's client id.
route.get('/auth/{provider}', 'Actions/Auth/SocialRedirectAction').rateLimit(10, 'minute')
route.get('/auth/{provider}/callback', 'Actions/Auth/SocialCallbackAction').rateLimit(10, 'minute')
// Apple's form_post is a cross-site POST that cannot carry a CSRF token. The
// single-use, cookie-bound OAuth `state` the action checks is the CSRF
// defence here, and a stronger one: it binds the code to the browser that
// started the flow.
route.post('/auth/{provider}/callback', 'Actions/Auth/SocialCallbackAction').skipCsrf().rateLimit(10, 'minute')
// Trades the callback's one-use code for the session (useAuth's
// completeSocialLogin). Bound to an HttpOnly cookie set beside the code,
// which is the proof a CSRF token would add.
route.post('/auth/handoff', 'Actions/Auth/SessionHandoffAction').skipCsrf().rateLimit(10, 'minute')
