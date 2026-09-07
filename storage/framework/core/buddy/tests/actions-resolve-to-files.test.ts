import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Action } from '@stacksjs/enums'

/**
 * Every `Action` names a file that exists.
 *
 * `runAction` resolves the enum's value to a path and returns an error when it
 * finds none, so an entry with no file is a command that cannot work: `buddy
 * migrate:dns` was registered, documented in five places and listed in
 * `lazy-commands`, and every run of it failed with "Action 'migrate/dns' not
 * found". Two more entries - `Inspire` and `MakeNotification` - named files that
 * never existed either, and were called by nothing; the commands that share
 * their names are implemented directly.
 *
 * The enum is the contract, so it is checked rather than the call sites: an
 * entry nobody calls today is a trap for whoever calls it tomorrow.
 */

const root = join(import.meta.dir, '..', '..', '..', '..', '..')

/** Where `runAction` looks, in its own order. */
const bases = [
  join(root, 'storage/framework/core/actions/src'),
  join(root, 'node_modules/@stacksjs/actions/src'),
  join(root, 'node_modules/@stacksjs/actions/dist/src'),
  join(root, 'app/Actions'),
]

function resolves(action: string): boolean {
  return bases.some(base =>
    existsSync(join(base, `${action}.ts`))
    || existsSync(join(base, `${action}.js`))
    || existsSync(join(base, action, 'index.ts')))
}

describe('the Action enum', () => {
  it('has entries to check', () => {
    expect(Object.keys(Action).length).toBeGreaterThan(50)
  })

  it('names a file for every action', () => {
    const missing = Object.entries(Action)
      .filter(([, value]) => !resolves(String(value)))
      .map(([key, value]) => `Action.${key} = '${value}'`)

    expect(missing.sort()).toEqual([])
  })
})
