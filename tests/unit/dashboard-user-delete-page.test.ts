import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * What the dashboard says about a user who is anonymized instead of deleted
 * (stacksjs/stacks#3253): before the button is pressed, after it, and
 * wherever the account is shown from then on.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('a delete that may anonymize says so', () => {
  it('all three delete confirmations pass it on, and report the outcome', () => {
    const components = 'storage/framework/defaults/resources/components/Dashboard'
    const list = source(`${components}/Data/DataRecords.stx`)
    expect(list).toContain('return modelDeleteWarning(name, capabilities().anonymize)')
    expect(list).toContain('const outcome = await deleteModelRecord(modelSlug(), row.id)')
    const page = source(`${components}/Models/ModelRecordDetail.stx`)
    expect(page).toContain(':description="modelDeleteWarning(title() || modelName(), Boolean(record()?.writeCapabilities.anonymize))"')
    expect(page).toContain('const outcome = await deleteModelRecord(slug(), recordId())')
    const browser = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(browser).toContain('return modelDeleteWarning(`Row ${row.id}`, writeCapabilities().anonymize)')
    expect(browser).toContain('const outcome = await deleteModelRecord(slug(), String(row.id))')
  })
})

describe('an anonymized account is named for what it is', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard'

  it('in the Users list, not shown as its stored placeholders', () => {
    const list = source(`${components}/Data/DataRecords.stx`)
    expect(list).toContain('...(anonymized && { name: \'Anonymized user\', email: \'Name and email removed\' }),')
    expect(list).toContain('verificationLabel: anonymized ? \'Anonymized\' : row.emailVerifiedAt ? \'Verified\' : \'Unverified\',')
  })

  it('on its own page, with a note saying what happened', () => {
    const page = source(`${components}/Models/ModelRecordDetail.stx`)
    expect(page).toContain(':if="!loading() && record()?.anonymized" role="note"')
    expect(page).toContain('This account was anonymized. Its name and email were removed and it can no longer sign in. Records that refer to it were kept.')
  })
})
