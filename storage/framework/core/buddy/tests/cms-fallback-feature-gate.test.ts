// A 404 asks the CMS tree only in an app that has one.
//
// Both stx servers hand a 404 to `cmsNotFoundFallback` so a published CMS page
// can answer it. They did so whenever `sites` was enabled. A multi-tenant app
// that is not a CMS (sites on, cms bundle off) has no `pages` table, because
// the cms migrations are gated on the feature, so every 404 it served resolved
// the site and then queried a table that was never created. Found building
// cursio.

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SERVERS = {
  'buddy dev': join(import.meta.dir, '../../actions/src/dev/views.ts'),
  'buddy serve': join(import.meta.dir, '../src/production-server.ts'),
}

describe('the CMS not-found fallback', () => {
  for (const [name, file] of Object.entries(SERVERS)) {
    const source = readFileSync(file, 'utf8')
    const call = source.indexOf('await cmsNotFoundFallback(req)')
    // The condition guarding the call: the nearest `if (` above it.
    const guard = source.slice(source.lastIndexOf('if (current.status === 404', call), call)

    test(`${name} calls it`, () => {
      expect(call).toBeGreaterThan(-1)
      expect(guard.length).toBeGreaterThan(0)
    })

    test(`${name} asks only with sites and the cms feature both on`, () => {
      expect(guard.includes('.sites?.enabled')).toBe(true)
      expect(guard.includes('feature(\'cms\')')).toBe(true)
    })

    test(`${name} imports feature from the config package`, () => {
      expect(/import \{[^}]*\bfeature\b[^}]*\} from '@stacksjs\/config'/.test(source)).toBe(true)
    })
  }
})
