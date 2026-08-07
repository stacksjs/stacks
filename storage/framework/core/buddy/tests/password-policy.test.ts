// One password policy, in one place (stacksjs/stacks#2226).
//
// The framework shipped three numbers for one product concept: RegisterAction
// and LoginAction accepted six characters, the User model declared six, and
// PasswordResetAction hand-checked eight inside handle() — not in a
// `validations:` block at all, so nothing that reads declared rules could see
// it.
//
// This walks the declaration sites rather than restating the number, so a
// fourth one added later fails here instead of in somebody's signup form.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../defaults/app/password-policy'

const DEFAULTS = join(import.meta.dir, '../../../defaults/app')

/**
 * Source with `//` comments removed.
 *
 * Asserting "this string does not appear" against raw source is a trap: the
 * comment explaining WHY the code is gone contains the string, so the check
 * fails on the very commit that fixes it.
 */
function code(source: string): string {
  return source.replace(/\/\/.*$/gm, '')
}

const read = (relative: string): string => readFileSync(join(DEFAULTS, relative), 'utf8')

/** The `password:` entry of a `validations:` block, isolated from its siblings. */
function passwordRuleOf(source: string): string {
  const start = source.indexOf('password: {')
  if (start === -1)
    return ''
  return source.slice(start, source.indexOf('},', start))
}

const REGISTER = read('Actions/Auth/RegisterAction.ts')
const LOGIN = read('Actions/Auth/LoginAction.ts')
const RESET = read('Actions/Password/PasswordResetAction.ts')
const USER = read('Models/User.ts')

describe('the policy is declared once (#2226)', () => {
  it('is a sane minimum', () => {
    // Not a tautology check: 8 is what the reset path already enforced, and
    // dropping below it would be a silent weakening of the only rule that was
    // protecting anything.
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8)
    expect(PASSWORD_MAX_LENGTH).toBe(255)
  })

  it('the paths that SET a password all reference it', () => {
    for (const [name, source] of [['RegisterAction', REGISTER], ['PasswordResetAction', RESET], ['User model', USER]] as const) {
      expect(`${name}: ${source.includes('PASSWORD_MIN_LENGTH')}`).toBe(`${name}: true`)
    }
  })

  it('none of them hardcodes a number instead', () => {
    // The failure mode being prevented: someone types the digit rather than
    // importing the constant, and the four drift apart again. Scoped to the
    // password rule — a sibling field's own `min()` is not this test's business.
    for (const [name, source] of [['RegisterAction', REGISTER], ['PasswordResetAction', RESET], ['User model', USER]] as const) {
      const hardcoded = /\.min\((\d+)\)/.exec(passwordRuleOf(code(source)))
      expect(`${name}: ${hardcoded?.[1] ?? 'none'}`).toBe(`${name}: none`)
    }
  })
})

describe('sign-in does not enforce the creation policy (#2226)', () => {
  it('LoginAction requires presence, not length', () => {
    // The trap in "make them all agree": applying a creation rule to
    // authentication locks out every account created under a shorter one. They
    // get a 422 before their credentials are checked, telling them their own
    // password is too short.
    expect(LOGIN).toContain('schema.string().min(1)')
    expect(LOGIN).not.toContain('PASSWORD_MIN_LENGTH')
  })
})

describe('the reset path declares its rule (#2226)', () => {
  it('no longer hand-checks the length inside handle()', () => {
    // `password.length < 8` was invisible to everything that reads
    // `validations:`, which is why it could drift from the others unnoticed.
    expect(code(RESET)).not.toContain('password.length <')
    expect(RESET).toContain('validations:')
  })

  it('still checks confirmation by hand, because that is cross-field', () => {
    // Declared rules see one field at a time, so this one legitimately stays.
    expect(RESET).toContain('password !== passwordConfirmation')
  })
})

describe('seeded users satisfy the rule they are seeded against (#2226)', () => {
  it('the User factory password is long enough', () => {
    const factory = /factory:\s*\(\)\s*=>\s*'([^']*)'/.exec(
      USER.slice(USER.indexOf('password: {')),
    )

    expect(factory?.[1]).toBeDefined()
    expect(factory![1].length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH)
  })
})
