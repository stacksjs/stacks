import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const inventory = readFileSync(
  resolve('storage/framework/defaults/resources/components/Dashboard/App/SourceInventory.stx'),
  'utf8',
)
const commandAction = readFileSync(
  resolve('storage/framework/defaults/app/Actions/Dashboard/Infrastructure/CommandIndexAction.ts'),
  'utf8',
)
const actionAction = readFileSync(
  resolve('storage/framework/defaults/app/Actions/Dashboard/Source/source-inventory.ts'),
  'utf8',
)

// The two halves of the component's `page()` ternary, so an assertion meant
// for one mode cannot be satisfied by the other's copy.
const actionsBranch = inventory.slice(
  inventory.indexOf("title: 'Actions'"),
  inventory.indexOf("title: 'Commands'"),
)
const commandsBranch = inventory.slice(
  inventory.indexOf("title: 'Commands'"),
  inventory.indexOf('const filteredItems'),
)

describe('dashboard command inventory', () => {
  /**
   * Commands have one root, and it is the one `buddy` loads. Actions have two,
   * because `app/Actions/<path>.ts` shadows the framework default at the same
   * path. Reading `defaults/app/Commands` here would list a command the CLI
   * cannot run: that directory is what `buddy new` copies into a new app, not
   * a default the loader falls back to.
   */
  test('reads the directory the CLI loads commands from', () => {
    expect(commandAction).toContain("join(projectRoot, 'app/Commands')")
    expect(commandAction).not.toContain('frameworkDefaultsRoot')
    expect(actionAction).toContain('frameworkDefaultsRoot')
  })

  test('does not tell command authors to register their commands', () => {
    // Registration has been optional since every file in app/Commands became a
    // command on its own. The page said commands were "registered by
    // app/Commands.ts", which reads as a required step that does not exist.
    expect(inventory).not.toContain('registered by app/Commands.ts')
    expect(inventory).not.toContain('No application commands are registered.')
    expect(inventory).toContain('app/Commands')
  })

  test('leads the command stats with the count of commands', () => {
    // `registered` counts the optional app/Commands.ts entries, so an app
    // without that file read "Registered Entries 0" in the first card while
    // its commands sat in the second.
    const start = commandsBranch.indexOf("key: 'total'")
    const registry = commandsBranch.indexOf("key: 'registered'")

    expect(start).toBeGreaterThan(-1)
    expect(registry).toBeGreaterThan(-1)
    expect(start).toBeLessThan(registry)
    expect(commandsBranch).toContain("label: 'Commands'")
  })

  test('keeps the Origin column to the inventory that has two origins', () => {
    // Every command row is hardcoded 'Application'; only Actions span both.
    expect(commandsBranch).toContain('showOrigin: false')
    expect(actionsBranch).toContain('showOrigin: true')
    expect(inventory).toContain('<th :if="page().showOrigin"')
    expect(inventory).toContain('<td :if="page().showOrigin"')
  })
})
