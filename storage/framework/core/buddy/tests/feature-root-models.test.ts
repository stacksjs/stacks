import type { FeatureName } from '@stacksjs/features'
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appModelClaimsTable, copyFeatureFiles, deleteFeatureFiles } from '../src/commands/features'

const rootModels: Array<[FeatureName, string, string]> = [
  ['dashboard', 'Board', 'boards'],
  ['dashboard', 'BoardColumn', 'board_columns'],
  ['dashboard', 'Card', 'cards'],
  ['dashboard', 'CardComment', 'card_comments'],
  ['dashboard', 'Label', 'labels'],
  ['dashboard', 'Log', 'logs'],
  ['dashboard', 'Request', 'requests'],
  ['marketing', 'MailPreference', 'mail_preferences'],
  ['commerce', 'PaymentMethod', 'payment_methods'],
  ['commerce', 'PaymentProduct', 'payment_products'],
  ['commerce', 'PaymentTransaction', 'payment_transactions'],
  ['commerce', 'Subscriber', 'subscribers'],
  ['commerce', 'SubscriberEmail', 'subscriber_emails'],
  ['commerce', 'Subscription', 'subscriptions'],
]

let root: string
let source: string
let target: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'feature-root-models-'))
  source = join(root, 'defaults')
  target = join(root, 'app')
  mkdirSync(join(source, 'app/Models'), { recursive: true })
  mkdirSync(join(target, 'app/Models'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

for (const [feature, model, table] of rootModels) {
  test(`${feature} installs and safely removes its root ${model} model (#2583)`, async () => {
    const rel = `app/Models/${model}.ts`
    const content = `export default { table: '${table}' }\n`
    writeFileSync(join(source, rel), content)

    const installed = await copyFeatureFiles(feature, { source, target })
    expect(installed.copied).toContain(rel)
    expect(readFileSync(join(target, rel), 'utf8')).toBe(content)
    expect(appModelClaimsTable(table, target)).toBe(false)

    const removed = await deleteFeatureFiles(feature, target, { source })
    expect(removed.removed).toContain(rel)
    expect(existsSync(join(target, rel))).toBe(false)
  })

  test(`${feature} preserves a customised root ${model} model`, async () => {
    const rel = `app/Models/${model}.ts`
    const original = `export default { table: '${table}' }\n`
    const customised = `${original}// Application-specific customisation\n`
    writeFileSync(join(source, rel), original)
    writeFileSync(join(target, rel), customised)

    const installed = await copyFeatureFiles(feature, { source, target })
    expect(installed.skipped).toContain(rel)
    const removed = await deleteFeatureFiles(feature, target, { source })
    expect(removed.preserved).toContain(rel)
    expect(readFileSync(join(target, rel), 'utf8')).toBe(customised)
  })
}

test('an application-owned model with a different name can still claim its own table', () => {
  writeFileSync(join(target, 'app/Models/NewsletterMember.ts'), "export default { table: 'subscribers' }\n")

  expect(appModelClaimsTable('subscribers', target)).toBe(true)
})
