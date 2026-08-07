/**
 * Framework Default Routes - Auth
 *
 * Login, registration, logout, token refresh and revocation, passkeys, TOTP
 * 2FA, and password reset.
 *
 * Split out of `dashboard.ts` for stacksjs/stacks#2229. That file bundles the
 * auth surface together with storefront cart/checkout, reviews, sitemap, AI
 * and voice, and the only gate over the whole thing is `feature('dashboard')`
 * - so an app that wanted `/login` and 2FA but ships no `Product` or `Coupon`
 * had to either mount the commerce demo surface or set
 * `STACKS_SKIP_DEFAULT_ROUTES=1` and re-declare every auth route by hand, rate
 * limits included. One reporting app did the latter and permanently gave up
 * 2FA, sign-out-everywhere and API token management, because re-registering
 * those was not worth the maintenance.
 *
 * Mounted by `defaults/bootstrap.ts` as the `auth` bundle; see
 * `resolveDefaultRouteBundles` in `core/router/src/route-loader.ts` for how an
 * app selects bundles.
 *
 * Users should NOT edit this file. To override any route here, define the same
 * method + path in your `routes/api.ts`: bun-router is first-registration-wins
 * and user routes load first, so your handler always takes priority.
 */

import { route } from '@stacksjs/router'

// Rate limits on token-issuance + password-reset endpoints
// (stacksjs/stacks#1921). `Auth.attempt()` already has a per-email
// lockout but it doesn't stop credential-stuffing across many emails
// from one IP, and the token endpoints have no upstream brake at all
// — a leaked refresh token could be hammered for unlimited access
// tokens until the row TTL. Userland that overrides any of these in
// `routes/api.ts` (user routes win) gets to pick its own limits.
route.post('/login', 'Actions/Auth/LoginAction').rateLimit(5, 'minute')
route.post('/register', 'Actions/Auth/RegisterAction').rateLimit(3, 'minute')
// Passkey ENROLLMENT (attaching a new credential to an account) must be
// auth-gated — it's not a login flow, it's a logged-in user adding a
// second factor to their own account. Previously unauthenticated and
// keyed off a client-supplied `email` field: anyone who knew a victim's
// email could register a passkey against that account and log in as
// them, no password required. GenerateRegistrationAction/
// VerifyRegistrationAction now derive identity from request.user().
route.get('/generate-registration-options', 'Actions/Auth/GenerateRegistrationAction').middleware('auth').rateLimit(10, 'minute')
route.post('/verify-registration', 'Actions/Auth/VerifyRegistrationAction').middleware('auth').rateLimit(5, 'minute')
// Passkey AUTHENTICATION (logging in) is correctly unauthenticated —
// the caller doesn't have a session yet, that's the point.
route.get('/generate-authentication-options', 'Actions/Auth/GenerateAuthenticationAction').rateLimit(10, 'minute')
route.get('/verify-authentication', 'Actions/Auth/VerifyAuthenticationAction').rateLimit(10, 'minute')

// TOTP 2FA. Setup/enable/disable act on the caller's own authenticated
// account (auth-gated, same identity rule as passkey enrollment above).
// verify-two-factor-login is the second step of LoginAction's flow and
// is correctly unauthenticated — the caller only has a short-lived
// challenge token at that point, not a session yet.
route.post('/generate-two-factor-secret', 'Actions/Auth/GenerateTwoFactorSecretAction').middleware('auth').rateLimit(10, 'minute')
route.post('/enable-two-factor', 'Actions/Auth/EnableTwoFactorAction').middleware('auth').rateLimit(10, 'minute')
route.post('/disable-two-factor', 'Actions/Auth/DisableTwoFactorAction').middleware('auth').rateLimit(10, 'minute')
route.post('/verify-two-factor-login', 'Actions/Auth/VerifyTwoFactorLoginAction').rateLimit(10, 'minute')

route.group({ prefix: '/auth' }, () => {
  route.post('/refresh', 'Actions/Auth/RefreshTokenAction').rateLimit(10, 'minute')
  route.get('/tokens', 'Actions/Auth/ListTokensAction').middleware('auth')
  route.post('/token', 'Actions/Auth/CreateTokenAction').middleware('auth').rateLimit(10, 'minute')
  route.delete('/tokens/{id}', 'Actions/Auth/RevokeTokenAction').middleware('auth')
  route.get('/abilities', 'Actions/Auth/TestAbilitiesAction').middleware('auth')
})

route.group({ middleware: 'auth' }, () => {
  route.get('/me', 'Actions/Auth/AuthUserAction')
  route.post('/logout', 'Actions/Auth/LogoutAction')
  // Sign out everywhere: revoke every access/refresh token AND destroy
  // every session for the authenticated user (stacksjs/stacks#1957).
  route.post('/logout-all', 'Actions/Auth/LogoutAllAction')
})

// Password Reset. `/forgot` triggers a mailer hop so it's the most
// abuse-prone — keep that tighter than the verification endpoints.
route.group({ prefix: '/password' }, () => {
  route.post('/forgot', 'Actions/Password/SendPasswordResetEmailAction').rateLimit(3, 'minute')
  route.post('/reset', 'Actions/Password/PasswordResetAction').rateLimit(5, 'minute')
  route.post('/verify-token', 'Actions/Password/VerifyResetTokenAction').rateLimit(10, 'minute')
})
