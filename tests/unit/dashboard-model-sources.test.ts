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

describe('the generator\'s staging directory is the generator\'s alone', () => {
  // `resolveModelSources` deletes and rebuilds that directory whenever the
  // framework defaults are merged in. Search indexing, starting the dashboard,
  // `generate:erd` and `generate:vschema` each called it for its list of
  // models and used nothing else of what it returns: they import the files
  // where they are. Each now lists them, and nothing but generating
  // migrations writes there.
  const core = 'storage/framework/core'
  const generator = `${core}/database/src`

  it('nothing outside the migration generator asks its entry point', () => {
    const packages = readdirSync(core, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => `${core}/${entry.name}/src`)
    expect(packages.length).toBeGreaterThan(60)
    const asking: string[] = []
    let read = 0
    for (const src of packages) {
      if (src === generator)
        continue
      let files: string[]
      try {
        files = sourcesUnder(src)
      }
      catch {
        continue
      }
      for (const file of files) {
        read++
        // Only a file that names it at all is parsed, to tell a call from a sentence.
        if (readFileSync(file, 'utf8').includes('resolveModelSources') && /\bresolveModelSources\b/.test(code(file)))
          asking.push(file)
      }
    }
    expect(read).toBeGreaterThan(1000)
    expect(asking).toEqual([])
    // The control: the generator itself is seen to use it.
    expect(/\bresolveModelSources\(/.test(code(`${generator}/migrations.ts`))).toBe(true)
  })

  it('the four that only wanted the list of models ask for the list', () => {
    const listing: Array<[string, RegExp]> = [
      ['search-engine/src/documents/models.ts', /\(listModelSources\(\) \?\? \[\]\)\.map\(\(?model\)? => model\.file\)/],
      ['actions/src/dev/dashboard-utils.ts', /for \(const model of listModelSources\(\) \?\? \[\]\)/],
      ['actions/src/dev/dashboard.ts', /schemaModels: \(listModelSources\(\) \?\? \[\]\)\.map/],
      ['actions/src/generate/erd.ts', /const sources = listModelSources\(\)/],
      ['actions/src/generate/vschema.ts', /const sources = listModelSources\(\)/],
    ]
    for (const [file, call] of listing)
      expect(code(`${core}/${file}`), file).toMatch(call)
  })
})
