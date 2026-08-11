import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('email persistence contract', () => {
  test('models suppression, send idempotency, and webhook dedup through authenticated APIs', () => {
    const suppression = source('storage/framework/defaults/app/Models/EmailSuppression.ts')
    const idempotency = source('storage/framework/defaults/app/Models/EmailIdempotency.ts')
    const webhook = source('storage/framework/defaults/app/Models/EmailWebhookEvent.ts')

    expect(suppression).toContain("table: 'email_suppressions'")
    expect(suppression).toContain("uri: 'email-suppressions'")
    expect(suppression).toContain("routes: ['index', 'show', 'destroy']")
    expect(suppression).toContain("middleware: ['auth']")
    expect(suppression).toContain("columns: ['email', 'type']")
    expect(suppression).toContain('unique: true')

    expect(idempotency).toContain("table: 'email_idempotency'")
    expect(idempotency).toContain("uri: 'email-idempotency'")
    expect(idempotency).toContain('idempotencyKey:')
    expect(idempotency).toContain('hidden: true')
    expect(idempotency).toContain('unique: true')

    expect(webhook).toContain("table: 'email_webhook_events'")
    expect(webhook).toContain("uri: 'email-webhook-events'")
    expect(webhook).toContain("columns: ['provider', 'event_id']")
    expect(webhook).toContain('unique: true')
  })

  test('ships model-generated migrations with database-enforced uniqueness', () => {
    const idempotency = source('database/migrations/1785502251830-create-email_idempotency-table.sql')
    const suppression = source('database/migrations/1785502251831-create-email_suppressions-table.sql')
    const webhook = source('database/migrations/1785502251832-create-email_webhook_events-table.sql')

    expect(idempotency).toContain('CREATE TABLE IF NOT EXISTS "email_idempotency"')
    expect(idempotency).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "email_idempotency_idempotency_key_unique"')
    expect(suppression).toContain('CREATE TABLE IF NOT EXISTS "email_suppressions"')
    expect(suppression).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_email_type_unique"')
    expect(webhook).toContain('CREATE TABLE IF NOT EXISTS "email_webhook_events"')
    expect(webhook).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "email_webhook_events_provider_event_unique"')
  })

  test('keeps internal email records out of the generic dashboard catalog', () => {
    for (const path of [
      'storage/framework/defaults/app/Models/EmailSuppression.ts',
      'storage/framework/defaults/app/Models/EmailIdempotency.ts',
      'storage/framework/defaults/app/Models/EmailWebhookEvent.ts',
    ]) {
      expect(source(path)).toContain('dashboard: { enabled: false }')
    }
  })
})
