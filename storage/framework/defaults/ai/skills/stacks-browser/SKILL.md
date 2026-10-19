---
name: stacks-browser
description: Use when working with browser/frontend functionality in Stacks - the useAuth composable (login, register, logout, token management), Stripe billing utilities (loadCardElement, confirmPayment), the API fetch client, browser model loading, or auto-imported browser utilities. Covers @stacksjs/browser.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Browser

Use `@stacksjs/browser` for client authentication, API transport, browser models,
request error messages and imported billing/utilities. Imported availability is
different from an STX runtime global.

## Imports and runtime boundary

Import useAuth/authGuard, initApi/Fetch and needed helpers explicitly. The package
initializes browser API config as an import side effect, using public injected
config or same-origin /api; initApi is an optional override. autoInit itself is
internal, not a public entry export. window.StacksBrowser is a bag of utilities
and registered models, not proof that each name is attached as a bare global.
Read stacks-auto-imports for the actual STX runtime names.

The public query builder comes from bun-query-builder/browser, so client bundles
avoid server SQLite/child_process dependencies. configureBrowser/getBrowserConfig,
browserQuery/BrowserQueryBuilder/BrowserQueryError, browserAuth and
createBrowserDb/createBrowserModel are native browser exports. API access remains
subject to server routes, permissions and row scoping; a client model is not a
direct SQL connection or authorization layer.

## Authentication and session recovery

~~~ts
import { useAuth } from '@stacksjs/browser'

const session = useAuth()
const result = await session.login({ email: 'user@example.com', password: 'secret' })
~~~

useAuth returns shared client refs and login/register/logout/session methods.
Login returns a union including validation/refusal and a two-factor challenge;
inspect the result, rather than assuming a resolved call means signed-in state.
Browser state uses imported storage helpers, not direct document/window mutation
inside STX scripts.

refreshSession coalesces concurrent refresh attempts. A server refusal clears the
session and returns false; a network failure, 5xx, 408 or 429 keeps the existing
credential and returns false. authFetch retries the eligible request after
refresh using the native credential/CSRF flow. Cookie/session behavior and
refresh-token availability depend on server browser-session policy. A
fixed-lifetime login cannot be made renewable by keeping an old client refresh
token.

Only a 401 ends a session. fetchAuthUser shares one in-flight /api/me request
between concurrent callers. A network failure, 5xx, 403 or other non-401 answer
keeps token, user and isAuthenticated and resolves the last known user. 403 is
an authorization decision about a recognised identity, so the app should show
a forbidden state, not send the user to log in again. An unchanged /me answer
keeps the same user object, so effects do not re-run. A same-origin authFetch
401 that refresh cannot cure re-checks /api/me instead of signing out (signed
URLs and step-up checks also answer 401). Only that check's 401 clears the
session. A burst of such 401s makes one /me request, one clear and one
onSessionExpired(listener) call. Answers to requests sent before a new sign-in
are ignored. logout() does not fire onSessionExpired.

completeSocialLogin applies the native handoff through the same storage refs and
strips its URL fragment. The default callback sends a one-use stx_handoff code.
Called with no argument, completeSocialLogin redeems it with a credentialed POST
to /auth/handoff (AUTH_HANDOFF_PATH); a refused or unreachable redemption
resolves null and leaves the existing session alone. A stx_auth pack from a
custom callback still works. Use socialHandoffRedirect on the server; a
hand-built inline script writing token/user keys duplicates the
encoding/security contract.

authGuard controls client navigation; guard server pages/actions independently.
With a stored but unconfirmed token it checks /api/me instead of redirecting,
so a network blip on page load keeps the user on the page. A 401 then, or any
later session expiry on that page, redirects to /login once.

## API transports and errors

initApi configures the browser query builder. The older Fetch facade has its own
baseURL/token/request path; do not assume initApi changes Fetch's baseURL.
Fetch.get uses query parameters, post/patch/put JSON bodies, and destroy sends
DELETE with query parameters. Non-2xx throws an error with status/data after
body parsing. Its methods return parsed response data, not query-builder Results.

For cookie writes prefer the native auth/composable request flow and
readCsrfToken/withCsrfHeader. The low-level Fetch facade is not that complete
session/CSRF abstraction. describeResponseError(status, body?) and
describeThrownError(error) normalize useful client messages and field errors.
Read request-error.ts before displaying raw server/provider data to a user.

## Models, billing and utilities

registerModelModules or loadBrowserModels(modules?) registers bundled model
definitions; loadBrowserModels is synchronous and does not dynamically scan
server app/Models over HTTP. Only definitions with traits.useApi.uri become
browser models, with server-only factories/validators stripped. getBrowserModel
returns a model or null; getBrowserModelNames lists the registered model entries.

Stripe helpers (loadCardElement/loadPaymentElement/confirmCardSetup/
confirmCardPayment/createPaymentMethod/confirmPayment) are imported exports;
Stripe.js and the public key are prerequisites. Server payment actions retain
authority over amounts, ownership and payment completion. Utility/composable
re-exports have their own signatures in utils/ and composables/; read the native
composable skill instead of copying another fixed inventory of globals.

## Source and evidence

`storage/framework/core/browser/src/index.ts`, auto-init.ts, model-loader.ts,
composables/useAuth.ts/useApi.ts/csrf.ts/request-error.ts and utils/fetch.ts.
Tests: client-bundle-safety.test.ts, use-auth-refresh.test.ts (refresh, session
resilience, burst expiry, authGuard, handoff code), auth.test.ts, csrf.test.ts,
request-error.test.ts and api-url.test.ts under core/browser/tests.
