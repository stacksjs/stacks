/**
 * Framework Default Auth Routes
 *
 * Login, registration, passkeys, TOTP 2FA, token management and password
 * reset. Split out of `dashboard.ts` so an app can mount the auth surface on
 * its own — via `feature('auth')` — without also activating the dashboard's
 * commerce/cms/ai/admin bundle (stacksjs/stacks#2229). Still mounted whenever
 * the dashboard is on, so existing apps are unchanged.
 *
 * Loaded automatically AFTER user-defined routes. To override any route here,
 * define the same method + path in your `routes/api.ts` — bun-router is
 * first-registration-wins and user routes load first.
 *
 * @example Override the login route in routes/api.ts:
 * ```ts
 * route.post('/login', 'Actions/MyCustomLoginAction')
 * ```
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
