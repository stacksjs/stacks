import type { License } from '@stacksjs/commerce'
import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'

/**
 * The email that carries license keys, in two variants of one design
 * (`resources/emails/license.stx`): the purchase email, sent once when a
 * purchase becomes a license, and the resend, sent when someone asks for the
 * keys bought with an address.
 *
 * To send your own, copy the template to your app's `resources/emails/`, or
 * replace the mailer outright with `licensing.configureLicensing({ onIssued })`.
 */

const TIER_NAMES: Record<License['tier'], string> = {
  standard: 'Pro',
  lifetime: 'Pro Lifetime',
  team: 'Team',
}

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : ''
}

/** What a license includes, in a sentence. */
export function licenseTerms(license: License): string {
  const devices = `${license.maxDevices} ${license.maxDevices === 1 ? 'device' : 'devices'}`
  if (license.tier === 'lifetime')
    return `Every update, for good, on up to ${devices}.`
  if (license.tier === 'team')
    return `${license.seats} ${license.seats === 1 ? 'seat' : 'seats'}, ${devices} each${license.expiresAt ? `, until ${day(license.expiresAt)}` : ''}.`
  if (license.updatesUntil)
    return `Updates until ${day(license.updatesUntil)}, on up to ${devices}. Every version released by then is yours to keep.`
  return `On up to ${devices}.`
}

async function send(to: string, licenses: License[], variant: 'purchase' | 'resend'): Promise<void> {
  const appName = config.app.name || 'Stacks'
  const several = licenses.length > 1
  const subject = several ? `Your ${appName} license keys` : `Your ${appName} license key`
  const { html, text } = await template('license', {
    variables: {
      appName,
      appUrl: config.app.url ? `https://${String(config.app.url).replace(/^https?:\/\//, '')}` : '',
      variant,
      keys: licenses.map(license => ({ name: TIER_NAMES[license.tier], key: license.key, terms: licenseTerms(license) })),
      subject,
    },
    subject,
  })

  await mail.sendOrFail({
    to: [to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@stacksjs.com',
    },
    subject,
    html,
    text,
  })
}

/** The purchase email: one key, to the address on the license. */
export async function sendLicenseEmail(license: License): Promise<void> {
  if (license.email)
    await send(license.email, [license], 'purchase')
}

/**
 * The resend: every key given, to the address they share. Takes licenses
 * rather than an address, so keys cannot be directed anywhere else.
 */
export async function sendLicenseKeys(licenses: License[]): Promise<void> {
  const to = licenses[0]?.email
  if (to)
    await send(to, licenses.filter(license => license.email === to), 'resend')
}

export default sendLicenseEmail
