// Routes that name an action the framework no longer ships.
//
// `routes/` belongs to the app, so `buddy upgrade` never rewrote it - and apps
// scaffolded before 0.74.5 kept `route.get('/commands',
// 'Actions/Buddy/CommandsAction')` in routes/buddy.ts after e05bb758db (#2056)
// removed the action. `buddy test:types` then failed on a line the app never
// wrote (ps1, trifitla, rappid).

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  findDanglingRouteActions,
  pruneRetiredScaffoldRoutes,
  RETIRED_SCAFFOLD_ROUTES,
} from '../src/upgrade/route-actions'

let root: string

function write(path: string, contents: string): void {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

// routes/buddy.ts as `buddy new` wrote it before 0.74.5.
const OLD_BUDDY_ROUTES = `import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's Buddy routes.
 */

route.get('/versions', 'Actions/Buddy/VersionsAction') // your-domain.com/api/buddy/versions
route.get('/commands', 'Actions/Buddy/CommandsAction') // your-domain.com/api/buddy/commands

route.get('/jobs', 'Actions/Buddy/JobsListAction')
`

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-route-actions-'))
  write('storage/framework/defaults/app/Actions/Buddy/VersionsAction.ts', 'export default {}\n')
  write('storage/framework/defaults/app/Actions/Buddy/JobsListAction.ts', 'export default {}\n')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('pruneRetiredScaffoldRoutes', () => {
  it('removes the scaffold\'s /commands route once its action is gone, and nothing else', () => {
    write('routes/buddy.ts', OLD_BUDDY_ROUTES)

    const pruned = pruneRetiredScaffoldRoutes(root)

    expect(pruned).toEqual([expect.objectContaining({ file: 'routes/buddy.ts', line: 8, action: 'Actions/Buddy/CommandsAction' })])
    const after = readFileSync(join(root, 'routes/buddy.ts'), 'utf8')
    expect(after).toBe(OLD_BUDDY_ROUTES.replace(`route.get('/commands', 'Actions/Buddy/CommandsAction') // your-domain.com/api/buddy/commands\n`, ''))
    expect(findDanglingRouteActions(root)).toEqual([])
  })

  it('keeps the route when the app wrote its own CommandsAction', () => {
    write('routes/buddy.ts', OLD_BUDDY_ROUTES)
    write('app/Actions/Buddy/CommandsAction.ts', 'export default {}\n')

    expect(pruneRetiredScaffoldRoutes(root)).toEqual([])
    expect(readFileSync(join(root, 'routes/buddy.ts'), 'utf8')).toBe(OLD_BUDDY_ROUTES)
  })

  it('never edits a line the app changed, only reports it', () => {
    write('routes/buddy.ts', `import { route } from '@stacksjs/router'\nroute.get('/cli-commands', 'Actions/Buddy/CommandsAction').middleware('auth')\n`)

    expect(pruneRetiredScaffoldRoutes(root)).toEqual([])
    expect(findDanglingRouteActions(root)).toEqual([{ file: 'routes/buddy.ts', line: 2, action: 'Actions/Buddy/CommandsAction' }])
  })

  it('writes nothing on a dry run', () => {
    write('routes/buddy.ts', OLD_BUDDY_ROUTES)

    expect(pruneRetiredScaffoldRoutes(root, { dryRun: true })).toHaveLength(1)
    expect(readFileSync(join(root, 'routes/buddy.ts'), 'utf8')).toBe(OLD_BUDDY_ROUTES)
  })

  it('lists only actions the framework really removed', () => {
    const shipped = join(import.meta.dir, '../../../defaults/app')
    for (const retired of RETIRED_SCAFFOLD_ROUTES)
      expect(Bun.file(join(shipped, `${retired.action}.ts`)).size).toBe(0)
  })
})

describe('findDanglingRouteActions', () => {
  it('resolves against the app, the vendored defaults and the installed package', () => {
    write('app/Actions/Mine.ts', 'export default {}\n')
    write('node_modules/@stacksjs/defaults/app/Actions/FromPackage.ts', 'export default {}\n')
    write('routes/api.ts', [
      `route.get('/a', 'Actions/Mine')`,
      `route.get('/b', 'Actions/FromPackage')`,
      `route.get('/c', 'Actions/Buddy/VersionsAction')`,
      `route.get('/d', 'Actions/Gone')`,
      `route.get('/e', 'UserController@index')`,
      `// route.get('/f', 'Actions/Commented')`,
    ].join('\n'))

    expect(findDanglingRouteActions(root)).toEqual([{ file: 'routes/api.ts', line: 4, action: 'Actions/Gone' }])
  })

  it('is empty for an app with no routes directory', () => {
    expect(findDanglingRouteActions(root)).toEqual([])
  })
})
