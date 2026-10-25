import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STX_RUNTIME_GLOBALS, COMPILE_TIME_ONLY_GLOBALS } from '@stacksjs/stx/runtime-globals'
import { SERVER_ONLY_COMPOSABLES } from '@stacksjs/stx/unresolved-identifiers'
import { getCachedSignalsRuntime } from '@stacksjs/stx/caching'
import { browserAutoImportSurface, renderAutoImportReference } from '../src/auto-import-reference'
import { generateAutoImportFiles } from '../src/imports'
import { primitiveAutoImportEntries } from '../src/primitive-imports'

function listed(section: string): string[] {
  return [...section.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map(match => match[1]!)
}

describe('AI auto-import reference', () => {
  it('covers the installed STX compiler, eager aliases and demand registry exactly', async () => {
    const browser = await browserAutoImportSurface()
    expect(browser).toBeDefined()
    const source = await getCachedSignalsRuntime(false)
    const aliases = [...source.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)]
      .map(match => match[1]!).filter(name => !name.startsWith('__') && !name.startsWith('$'))
    const expected = [...new Set([...STX_RUNTIME_GLOBALS, ...aliases, ...SERVER_ONLY_COMPOSABLES, ...COMPILE_TIME_ONLY_GLOBALS])].sort()
    const client = renderAutoImportReference([], browser).split('### Runtime and compiler bindings')[1]!

    expect([...new Set(listed(client))].sort()).toEqual(expected)
    expect(listed(client)).not.toContain('schema')
    expect(listed(client)).not.toContain('db')
  })

  it('reports unavailable browser evidence without claiming ambient names', () => {
    const text = renderAutoImportReference([])
    expect(text).toContain('delivery registries are unavailable')
    expect(text).not.toContain('`useForm`')
  })

  it('sorts and deduplicates names for deterministic, compact output', () => {
    const text = renderAutoImportReference([{ source: 'app', names: ['zeta', 'alpha', 'zeta'] }])
    expect(text).toContain('| app | `alpha`, `zeta` |')
  })

  const previousCwd = process.cwd()
  let scratch: string | undefined
  afterEach(() => {
    process.chdir(previousCwd)
    if (scratch) rmSync(scratch, { recursive: true, force: true })
    scratch = undefined
  })

  it('refreshes app helpers, overrides and types through normal auto-import generation', async () => {
    scratch = mkdtempSync(join(tmpdir(), 'stacks-auto-import-ai-'))
    mkdirSync(join(scratch, 'resources/functions'), { recursive: true })
    mkdirSync(join(scratch, 'app/Models'), { recursive: true })
    mkdirSync(join(scratch, 'app/Jobs'), { recursive: true })
    const helper = join(scratch, 'resources/functions/probe.ts')
    writeFileSync(helper, 'export function projectHelper() {}\nexport type HelperOptions = { value: string }\n')
    writeFileSync(join(scratch, 'app/Models/User.ts'), 'export default {}\n')
    writeFileSync(join(scratch, 'app/Models/Request.ts'), 'export default {}\n')
    writeFileSync(join(scratch, 'app/Jobs/ProjectJob.ts'), 'export default {}\n')
    process.chdir(scratch)

    await generateAutoImportFiles()
    const reference = join(scratch, 'storage/framework/auto-imports/RUNTIME.md')
    const text = readFileSync(reference, 'utf8')
    const server = text.split('## STX client scripts')[0]!
    const globals = listed(server)
    for (const { as } of primitiveAutoImportEntries()) expect(globals).toContain(as)
    expect(globals).toContain('projectHelper')
    expect(globals).toContain('ProjectJob')
    expect(globals.filter(name => name === 'User')).toHaveLength(1)
    expect(globals).not.toContain('HelperOptions')
    expect(globals).not.toContain('Request')

    await generateAutoImportFiles()
    expect(readFileSync(reference, 'utf8')).toBe(text)

    writeFileSync(helper, 'export function renamedHelper() {}\n')
    await generateAutoImportFiles()
    const refreshed = readFileSync(reference, 'utf8')
    expect(refreshed).toContain('`renamedHelper`')
    expect(refreshed).not.toContain('`projectHelper`')
    expect(refreshed).not.toMatch(/[\u2013\u2014]/)
  }, 30_000)
})
