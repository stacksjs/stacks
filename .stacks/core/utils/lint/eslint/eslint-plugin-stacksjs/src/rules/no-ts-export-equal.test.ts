/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { RuleTester } from '@typescript-eslint/utils/dist/ts-eslint'
import { it } from '@stacksjs/testing'
import rule, { RULE_NAME } from './no-ts-export-equal'

const valids = [
  { code: 'export default {}', filename: 'test.ts' },
  { code: 'export = {}', filename: 'test.js' },
]

const invalids = [
  { code: 'export = {}', filename: 'test.ts' },
]

it('runs', () => {
  const ruleTester: RuleTester = new RuleTester({
    parser: require.resolve('@typescript-eslint/parser'),
  })

  ruleTester.run(RULE_NAME, rule, {
    valid: valids,
    invalid: invalids.map(i => ({
      ...i,
      errors: [{ messageId: 'noTsExportEqual' }],
    })),
  })
})
