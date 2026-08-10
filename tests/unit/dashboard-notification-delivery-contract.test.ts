import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Notifications')

function action(name: string): string {
  return readFileSync(resolve(actions, name), 'utf8')
}

describe('dashboard notification delivery contract', () => {
  test('keeps delivery reads behind safe operational boundaries', () => {
    const index = action('NotificationDeliveryIndexAction.ts')
    const overview = action('NotificationDeliveryOverviewAction.ts')
    const history = action('NotificationDeliveryHistoryAction.ts')

    expect(index.match(/dashboardOperationalError\(/g)?.length).toBe(1)
    expect(overview.match(/dashboardOperationalError\(/g)?.length).toBe(1)
    expect(history.match(/dashboardOperationalError\(/g)?.length).toBe(1)
    expect([index, overview, history].join('\n')).not.toContain('error instanceof Error ? error.message')
  })

  test('limits delivery work in the database before serialization', () => {
    const index = action('NotificationDeliveryIndexAction.ts')
    const history = action('NotificationDeliveryHistoryAction.ts')

    expect(index).toContain(".orderByDesc('sent_at')")
    expect(index).toContain(".orderByDesc('created_at')")
    expect(index).toContain('.limit(500)')
    expect(index).not.toContain('.slice(0, 500)')
    expect(history).toContain('const page = Math.min(1_000_000')
    expect(history).toContain("search.length > 200")
    expect(history).toContain('!Number.isSafeInteger(total) || total < 0')
  })

  test('separates retry validation, absence, and provider failures', () => {
    const retry = action('NotificationDeliveryRetryAction.ts')

    expect(retry).toContain('!Number.isSafeInteger(id) || id <= 0')
    expect(retry).toContain("response.json({ message: 'A valid delivery ID is required.' }, 400)")
    expect(retry).toContain("response.json({ message: 'Notification delivery not found.' }, 404)")
    expect(retry.match(/dashboardOperationalError\(/g)?.length).toBe(3)
    expect(retry).not.toContain("result?.error?.message || 'The retry failed.'")
  })
})
