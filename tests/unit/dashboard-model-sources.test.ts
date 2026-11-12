import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dashboardModelSources, resolveDashboardModel } from '../../storage/framework/defaults/resources/functions/dashboard/model-access'

/**
 * The dashboard asks which models exist without writing anything.
 *
 * It used to ask `resolveModelSources`, the migration generator's entry
 * point, once for every model it resolved. On the merge path that call
 * deletes and rebuilds the staging directory (a symlink per model): about
 * 11ms of blocking file writes each. The models overview resolves every
 * model, so it took 1.6s and held the server for all of it; global search
 * paid the same on every keystroke.
 *
 * `listModelSources` reads directory listings only, and a caller that
 * resolves many models reads the list once and hands it to each resolve.
 * The overview now answers in about 6ms with the same response.
 */
const defaults = 'storage/framework/defaults'

/** Source with its comments removed, so a sentence about a function is not read as a call to it. */
function code(path: string): string {
  return new Bun.Transpiler({ loader: 'ts' }).transformSync(readFileSync(path, 'utf8'))
}

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
    .map(entry => join(entry.parentPath, entry.name))
}

describe('which models exist, asked while serving a request', () => {
  const served = [
    ...sourcesUnder(`${defaults}/app/Actions/Dashboard`),
    ...sourcesUnder(`${defaults}/resources/functions/dashboard`),
  ]

  it('is never asked of the migration generator, which rebuilds its staging directory to answer', () => {
    expect(served.length).toBeGreaterThan(300)
    const asking = served.filter(file => /\bresolveModelSources\b/.test(code(file)))
    expect(asking).toEqual([])
    // The control for the scan: it does see the name where it is used.
    expect(/\bresolveModelSources\b/.test(code('storage/framework/core/database/src/migrations.ts'))).toBe(true)
    expect(code(`${defaults}/resources/functions/dashboard/model-access.ts`)).toContain('listModelSources()')
  })

  it('is asked once by anything that resolves many models', () => {
    const loops: Array<[string, RegExp]> = [
      ['app/Actions/Dashboard/Models/ModelsIndexAction.ts', /resolveDashboardModel\(m\.name, module\.default \?\? module, sources\)/],
      ['app/Actions/Dashboard/Models/GetModels.ts', /resolveDashboardModel\(candidate\.name \|\| "", candidate, sources\)/],
      ['app/Actions/Dashboard/Search/GlobalSearchAction.ts', /resolveDashboardModel\(fallbackName, module\.default \?\? module, sources\)/],
      ['app/Actions/Dashboard/Search/SearchEngineIndexAction.ts', /resolveDashboardModel\(source\.name, module\.default \?\? module, sources\)/],
    ]
    for (const [file, call] of loops) {
      const source = code(`${defaults}/${file}`)
      expect(source, file).toMatch(call)
      expect((source.match(/dashboardModelSources\(\)/g) || []).length, file).toBe(1)
      // No resolve in the file is left to list the directories for itself.
      const resolves = source.match(/resolveDashboardModel\([^\n]*\)/g) || []
      expect(resolves.length, file).toBeGreaterThan(0)
      expect(resolves.filter(resolve => !resolve.includes(', sources)')), file).toEqual([])
    }
  })

  it('a resolve handed the list uses it, and does not look for itself', async () => {
    const App = { name: 'OnlyInThisTest', dashboard: {} }
    const Hidden = { name: 'OnlyInThisTestHidden', dashboard: { access: false } }
    const sources = [
      { name: 'OnlyInThisTest', file: '/nowhere/OnlyInThisTest.ts', origin: 'user' as const },
      { name: 'OnlyInThisTestHidden', file: '/nowhere/OnlyInThisTestHidden.ts', origin: 'user' as const },
    ]
    // An app's own model is the one it is handed, and one it keeps out stays out.
    expect(await resolveDashboardModel('OnlyInThisTest', App, sources)).toBe(App)
    expect(await resolveDashboardModel('OnlyInThisTestHidden', Hidden, sources)).toBeNull()
    // The same call without the list reads the real directories, where no such model is.
    expect(dashboardModelSources().some(source => source.name === 'OnlyInThisTest')).toBe(false)
  })

  it('the list is the app\'s schema: names, files and where each comes from', () => {
    const sources = dashboardModelSources()
    expect(sources.length).toBeGreaterThan(40)
    for (const source of sources.slice(0, 5)) {
      expect(source.name).toMatch(/^[A-Z]\w+$/)
      expect(source.file.endsWith(`${source.name}.ts`)).toBe(true)
      expect(['user', 'framework']).toContain(source.origin)
    }
  })
})
