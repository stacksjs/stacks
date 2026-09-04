/**
 * The ordinal band reserved for a discovered package's migrations.
 *
 * Nothing stages package migrations yet. These guards land first on purpose:
 * every one of them is a place that would renumber or delete a staged file the
 * moment one existed, and installing them afterwards would mean shipping a
 * window in which a package's schema could be deleted by the application's own
 * generator.
 *
 * All four are no-ops on a corpus with no band files, which is every corpus
 * today, so this is inert until the staging change arrives.
 */
import { describe, expect, test } from 'bun:test'
import { isPackageMigration, PACKAGE_MIGRATION_BAND } from '../src/package-migrations'

describe('the reserved package migration band', () => {
  test('is ten digits, so lexicographic order still equals numeric order', () => {
    // Run order is `readdirSync().sort()` on the basename. An eleven-digit
    // ordinal would sort before a ten-digit one and the band would invert.
    expect(String(PACKAGE_MIGRATION_BAND)).toHaveLength(10)
    expect(String(PACKAGE_MIGRATION_BAND).padStart(10, '0')).toBe('9000000000')
  })

  test('sorts after every plausible application ordinal', () => {
    const app = String(999_999).padStart(10, '0')
    const pkg = String(PACKAGE_MIGRATION_BAND + 1).padStart(10, '0')

    expect([`${pkg}-loghq.sql`, `${app}-create-users-table.sql`].sort())
      .toEqual([`${app}-create-users-table.sql`, `${pkg}-loghq.sql`])
  })

  test('recognises a file in the band', () => {
    expect(isPackageMigration('9000000001-loghq__create-log-entries-table.sql')).toBe(true)
    expect(isPackageMigration('9999999999-bughq__create-issues-table.sql')).toBe(true)
  })

  test('leaves every application migration alone', () => {
    expect(isPackageMigration('0000000001-create-users-table.sql')).toBe(false)
    expect(isPackageMigration('0000000133-add-orthomosaic-to-missions.sql')).toBe(false)
    expect(isPackageMigration('8999999999-still-the-application.sql')).toBe(false)
  })

  test('is not fooled by a filename carrying no ordinal', () => {
    // The corpus has always been ordinal-prefixed, but a hand-written file or
    // a stray `.sql` must not be mistaken for a package's and made undeletable.
    expect(isPackageMigration('create-users-table.sql')).toBe(false)
    expect(isPackageMigration('README.md')).toBe(false)
    expect(isPackageMigration('')).toBe(false)
  })
})
