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

describe('an anonymized account can be viewed and nothing else', () => {
  // Its name and email are gone, so there is nothing to edit, and deleting it
  // again would only anonymize what already is (stacksjs/stacks#3254).
  const components = 'storage/framework/defaults/resources/components/Dashboard'

  it('its row in the Users list keeps the eye and loses the pencil and trash', () => {
    const list = source(`${components}/Data/DataRecords.stx`)
    expect(list).toContain('const NOT_ANONYMIZED = { key: \'anonymized\', equals: false }')
    // The table shows such an action only where the row holds exactly false, so
    // every row of every mode has to carry the flag or it would lose its actions.
    const rows = list.slice(list.indexOf('const recordRows = derived('), list.indexOf('async function loadRecords()'))
    expect(rows).toContain('const anonymized = mode() === \'users\' && row.anonymized === true')
    expect(rows).toMatch(/\n {4}anonymized,\n/)
    const table = source(`${components}/UI/Table.stx`)
    expect(table).toContain('return !action.when || rawValue(row, action.when.key) === action.when.equals')
    expect(table).toContain(':if="showsRowAction(row, action)"')
  })

  it('its row in the model browser does too', () => {
    const browser = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(browser).toContain('anonymizedIds.set((data.anonymizedIds ?? []).map(String))')
    expect(browser).toContain(':canUpdate="writeCapabilities().update && !isAnonymized(row)"')
    expect(browser).toContain(':canDestroy="writeCapabilities().destroy && !isAnonymized(row)"')
  })

  it('its own page has no Edit or Delete button', () => {
    const page = source(`${components}/Models/ModelRecordDetail.stx`)
    expect(page).toContain('const canEdit = derived(() => Boolean(record()?.writeCapabilities.update) && !record()?.anonymized)')
    expect(page).toContain('const canDelete = derived(() => Boolean(record()?.writeCapabilities.destroy) && !record()?.anonymized)')
  })

  it('its edit page, reached by address, says why there is no form', () => {
    const edit = source(`${components}/Models/ModelRecordEdit.stx`)
    expect(edit).toContain('&& writable().length > 0 && !anonymized())')
    expect(edit).toContain(':if="!loading() && anonymized()"')
    expect(edit).toContain('title="This account was anonymized"')
    // Not the message for a model that allows no edits at all.
    expect(edit).toContain(':if="!loading() && record() && !canEdit() && !anonymized()"')
  })
})
