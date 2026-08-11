import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('storage/framework/defaults/app/Actions/Dashboard')

function readAction(name: string): string {
  return readFileSync(resolve(root, name), 'utf8')
}

describe('dashboard remaining operation boundaries', () => {
  test('protects analytics writes and preserves model validation', () => {
    const source = readAction('Analytics/EventStoreAction.ts')
    expect(source).toContain('error instanceof ModelValidationError')
    expect(source).toContain("message: 'Validation failed.'")
    expect(source).toContain("return dashboardOperationalError(error, 'Analytics event could not be recorded.'")
  })

  test('validates and protects exclusive commerce defaults', () => {
    for (const action of ['Commerce/ProductUnitDefaultAction.ts', 'Commerce/TaxRateDefaultAction.ts']) {
      const source = readAction(action)
      expect(source).toContain('Number.isSafeInteger(id)')
      expect(source).toContain("typeof request.get('isDefault') !== 'boolean'")
      expect(source).toContain('return dashboardOperationalError(error,')
    }
  })

  test('never exposes an inbox provider error', () => {
    const source = readAction('Email/InboxSendAction.ts')
    expect(source).toContain("dashboardOperationalError(error, 'The email could not be sent.'")
    expect(source).toContain("dashboardOperationalError(result?.error, 'The email could not be sent.'")
    expect(source).not.toContain('result?.error?.message')
  })

  test('protects model totals and mail settings persistence', () => {
    for (const action of [
      'Models/GetUserCount.ts',
      'Settings/MailSettingsGetAction.ts',
      'Settings/MailSettingsUpdateAction.ts',
    ]) {
      const source = readAction(action)
      expect(source).toContain('catch (error)')
      expect(source).toContain('return dashboardOperationalError(error,')
    }
  })
})
