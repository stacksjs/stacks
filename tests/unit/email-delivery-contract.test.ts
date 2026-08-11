import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('email delivery contract', () => {
  test('uses fail-fast delivery in workflows that promise or catch successful sends', () => {
    for (const path of [
      'storage/framework/defaults/app/Actions/ContactAction.ts',
      'storage/framework/defaults/app/Actions/SendWelcomeEmail.ts',
      'storage/framework/defaults/app/Mail/OrderConfirmation.ts',
      'storage/framework/defaults/app/Mail/SubscriptionConfirmation.ts',
      'storage/framework/defaults/app/Mail/TeamInvitation.ts',
      'storage/framework/core/auth/src/password/reset.ts',
      'storage/framework/core/auth/src/email-verification.ts',
    ]) {
      const contents = source(path)
      expect(contents).toContain('mail.sendOrFail({')
      expect(contents).not.toContain('await mail.send({')
    }
  })

  test('keeps template fallbacks separate from provider delivery failures', () => {
    const passwordReset = source('storage/framework/core/auth/src/password/reset.ts')
    const verification = source('storage/framework/core/auth/src/email-verification.ts')

    expect(passwordReset.lastIndexOf('await mail.sendOrFail({')).toBeGreaterThan(passwordReset.indexOf('catch (templateError)'))
    expect(verification.indexOf('await mail.sendOrFail({')).toBeGreaterThan(verification.indexOf('catch (templateError)'))
  })

  test('keeps batch campaign delivery on explicit structured-result handling', () => {
    const campaign = source('storage/framework/defaults/app/Jobs/SendCampaignJob.ts')

    expect(campaign).toContain('const result = await mail.send({')
    expect(campaign).toContain('if (result?.success === false)')
    expect(campaign).toContain("status: 'failed'")
  })

  test('keeps asynchronous commerce and subscription callers failure-aware', () => {
    const order = source('storage/framework/defaults/app/Actions/Storefront/PlaceOrderAction.ts')
    const subscription = source('storage/framework/defaults/app/Actions/SubscriberEmailAction.ts')

    expect(order).toContain('sendOrderConfirmation({')
    expect(order).toContain('}).catch((err: unknown) => {')
    expect(subscription).toContain('sendSubscriptionConfirmation({')
    expect(subscription).toContain('}).catch((err: unknown) => {')
  })
})
