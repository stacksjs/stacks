import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve('storage/framework/core/newsletter/src/campaigns.ts'),
  'utf8',
)

describe('newsletter campaign delivery contract', () => {
  test('claims status, schedule, and version in one compare-and-set update', () => {
    expect(source).toContain(".updateTable('campaigns')")
    expect(source).toContain(".where('status', '=', expected.status)")
    expect(source).toContain(".where('updated_at', '=', updatedAt)")
    expect(source).toContain("query.whereNull('scheduled_at')")
    expect(source).toContain('throw new CampaignStateConflictError(id)')
  })

  test('deduplicates each claimed queue attempt', () => {
    expect(source).toContain('.withIdempotencyKey(campaignDeliveryDispatchKey(')
    expect(source).toContain('attemptId: crypto.randomUUID()')
  })

  test('restores only the unchanged claimed state after dispatch failure', () => {
    expect(source).toContain('await restoreCampaignDelivery(id, target, previous)')
    expect(source).toContain(".where('updated_at', '=', expected.updatedAt)")
    expect(source).toContain('[dispatchError, restoreError]')
  })
})
