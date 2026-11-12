import { licensing } from '@stacksjs/commerce'
import { route } from '@stacksjs/router'
import { sendLicenseEmail } from '../app/Mail/LicenseEmail'

/**
 * Software licensing endpoints (`@stacksjs/commerce` `licensing`).
 *
 * The first three are what a desktop app's license client calls
 * (`@stacksjs/commerce/licensing/client`): the license key is the credential,
 * so they are CSRF-exempt and rate limited instead. Resend and transfer are
 * for a page on the app's site. Seats are for a signed-in owner or admin of
 * the team a team license belongs to.
 *
 * An opt-in bundle: mounted when `LICENSE_SIGNING_KEY` is set, or when
 * `STACKS_DEFAULT_ROUTES` names `licensing`. Issuing needs no route of its
 * own; it rides the payment webhook (`routes/payments.ts`).
 *
 * To override a route, define the same method and path in `routes/api.ts`.
 */

// An app that set its own `onIssued` keeps it; this is only the fallback.
licensing.registerDefaultLicenseMailer(sendLicenseEmail)

route.post('/licenses/activate', 'Actions/Commerce/Licensing/LicenseActivateAction').skipCsrf().rateLimit(20, 'minute')
route.post('/licenses/deactivate', 'Actions/Commerce/Licensing/LicenseDeactivateAction').skipCsrf().rateLimit(20, 'minute')
route.post('/licenses/check', 'Actions/Commerce/Licensing/LicenseCheckAction').skipCsrf().rateLimit(60, 'minute')

// The per-address and per-IP hourly limits live in the action, where the
// address is known; this is the coarse brake in front of it.
route.post('/licenses/resend', 'Actions/Commerce/Licensing/LicenseResendAction').rateLimit(10, 'minute')
route.post('/licenses/transfer', 'Actions/Commerce/Licensing/LicenseTransferAction').rateLimit(5, 'minute')

route.get('/licenses/seats', 'Actions/Commerce/Licensing/LicenseSeatIndexAction').middleware('auth')
route.post('/licenses/seats', 'Actions/Commerce/Licensing/LicenseSeatStoreAction').middleware('auth')
route.delete('/licenses/seats', 'Actions/Commerce/Licensing/LicenseSeatDestroyAction').middleware('auth')
