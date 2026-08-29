/**
 * The two ways a template name reaches the renderer, typed differently on purpose.
 *
 * `template()` took a bare `string`, so the registry `buddy generate` fills was
 * consulted by exactly one of the two entry points an app has - `Mailable`'s
 * builder, which already declared `EmailTemplateReference`. Calling
 * `template('welcom')` was a typo that rendered an empty email at runtime.
 *
 * Not every call site can be checked, and pretending otherwise would be worse
 * than the bug. A driver re-renders from an `EmailMessage` that may have
 * arrived off a queue, and `magic-link` deliberately probes for a template the
 * application is not required to provide. Those go through `templateByName`,
 * which takes a `string` and says so.
 *
 * Nothing here executes; it is checked by `bun run typecheck`.
 */

import type { EmailTemplateReference } from '../src/mailable'
import { template, templateByName } from '../src/template'

declare const someString: string

// The registry is populated: an arbitrary string is not a template name. If
// this stops failing, the augmentation has gone missing and the name type has
// fallen back to `string`, constraining nothing.
// @ts-expect-error - `string` is wider than the declared template names.
export const registryIsPopulated: EmailTemplateReference = someString

// Templates that exist, in each spelling `resolveTemplatePath` accepts.
export const bare: EmailTemplateReference = 'welcome'
export const stx: EmailTemplateReference = 'welcome.stx'
export const html: EmailTemplateReference = 'welcome.html'
export const nested: EmailTemplateReference = 'layouts/base'

export async function checkedAtTheCallSite(): Promise<void> {
  await template('welcome', { subject: 'Hi', variables: {} })
}

export async function rejectsATypo(): Promise<void> {
  // @ts-expect-error - 'welcom' is not a template this application has.
  await template('welcom', { subject: 'Hi', variables: {} })
}

export async function runtimeNamesStayOpen(): Promise<void> {
  // The whole point of the second entry point: a name known only at runtime.
  await templateByName(someString, { subject: 'Hi', variables: {} })
  await templateByName('magic-link', { subject: 'Hi', variables: {} })
}
