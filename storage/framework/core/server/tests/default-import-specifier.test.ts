import { expect, test } from 'bun:test'
import { defaultImportSpecifier } from '../src/default-import-specifier'

test('application defaults use the same public import in npm, Pantry and managed scaffold layouts', () => {
  for (const root of ['/app/node_modules/@stacksjs/defaults', '/moved app/pantry/@stacksjs/defaults', '/app/storage/framework/defaults']) {
    expect(defaultImportSpecifier(`${root}/app/Models/User.ts`, [root])).toBe('@stacksjs/defaults/app/Models/User.ts')
    expect(defaultImportSpecifier(`${root}/functions/account.ts`, [root])).toBe('@stacksjs/defaults/functions/account.ts')
    expect(defaultImportSpecifier(`${root}/resources/emails/welcome.stx`, [root])).toBe('@stacksjs/defaults/resources/emails/welcome.stx')
  }
})

test('keeps application overrides and editable framework checkout sources internal', () => {
  const root = '/workspace/storage/framework/defaults'
  expect(defaultImportSpecifier('/workspace/app/Models/User.ts', [root])).toBeUndefined()
  expect(defaultImportSpecifier(`${root}-other/app/Models/User.ts`, [root])).toBeUndefined()
  expect(defaultImportSpecifier(`${root}/app/Models/User.ts`, [root], true)).toBeUndefined()
})
