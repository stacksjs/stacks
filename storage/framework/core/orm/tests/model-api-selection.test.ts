import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { loadModelRegistryWithOrigins, resolveModelApiSelection, selectApiModels } from '../src/model-registry'

/**
 * Which `useApi` models publish a REST API (stacksjs/stacks#2866).
 *
 * Every one used to, the framework's ~80 defaults included. A forge built
 * around code review served the framework's product reviews at `/api/reviews`
 * over a table it never migrated. `security.api.models` and
 * `STACKS_MODEL_APIS` now choose, and unset is still everything.
 */

const api = (uri: string) => ({ traits: { useApi: { uri, routes: ['index', 'show'] } }, attributes: {} })

describe('resolveModelApiSelection', () => {
  it('is every model when nothing is set, so an upgrade changes no app', () => {
    expect(resolveModelApiSelection(undefined)).toEqual({ all: true, own: false, names: new Set(), source: 'default' })
  })

  it('reads the keywords and lists from the env var', () => {
    expect(resolveModelApiSelection(undefined, 'own')).toMatchObject({ all: false, own: true, names: new Set(), source: 'env' })
    expect(resolveModelApiSelection(undefined, 'none')).toMatchObject({ all: false, own: false, names: new Set() })
    expect(resolveModelApiSelection(undefined, '')).toMatchObject({ all: false, own: false, names: new Set() })
    expect(resolveModelApiSelection(undefined, 'all')).toMatchObject({ all: true })
    expect(resolveModelApiSelection(undefined, ' Product , OWN ,review ')).toMatchObject({ all: false, own: true, names: new Set(['product', 'review']) })
  })

  it('never lets a value mean more than its most restrictive keyword', () => {
    expect(resolveModelApiSelection(undefined, 'all,none')).toMatchObject({ all: false, own: false, names: new Set() })
    expect(resolveModelApiSelection(undefined, 'Product,all')).toMatchObject({ all: true, names: new Set() })
  })

  it('reads the config, and lets the env var override it', () => {
    expect(resolveModelApiSelection('own')).toMatchObject({ own: true, source: 'config' })
    expect(resolveModelApiSelection(['own', 'Product'])).toMatchObject({ own: true, names: new Set(['product']), source: 'config' })
    expect(resolveModelApiSelection('none', 'all')).toMatchObject({ all: true, source: 'env' })
  })

  it('treats a config of the wrong type as unset rather than switching APIs off', () => {
    for (const configured of [42, { own: true }, ['own', 1], null, true])
      expect(resolveModelApiSelection(configured)).toMatchObject({ all: true, source: 'default' })
  })
})

describe('selectApiModels', () => {
  const registry = {
    models: {
      Review: { name: 'Review', ...api('reviews') },
      Product: { name: 'Product', ...api('products') },
      User: { name: 'User', ...api('users') },
      Repo: { name: 'Repo', ...api('repos') },
      AuditTrail: { name: 'AuditTrail', attributes: {} },
    },
    origins: { Review: 'default', Product: 'default', User: 'app', Repo: 'app', AuditTrail: 'app' },
  } as const

  const names = (value: string | undefined) => Object.keys(selectApiModels(registry, resolveModelApiSelection(undefined, value)).models).sort()

  it('publishes every useApi model by default, and never one without the trait', () => {
    expect(names(undefined)).toEqual(['Product', 'Repo', 'Review', 'User'])
  })

  it('publishes only the app\'s models under own, counting an override of a default as the app\'s', () => {
    expect(names('own')).toEqual(['Repo', 'User'])
  })

  it('publishes nothing under none', () => {
    expect(names('none')).toEqual([])
  })

  it('publishes exactly the named models, case-insensitively, alone or beside own', () => {
    expect(names('product')).toEqual(['Product'])
    expect(names('own,Product')).toEqual(['Product', 'Repo', 'User'])
  })

  it('reports a name it could not publish, a model without useApi included', () => {
    const { unmatched } = selectApiModels(registry, resolveModelApiSelection(undefined, 'Prodcut,AuditTrail,Review'))
    expect(unmatched).toEqual(['audittrail', 'prodcut'])
  })
})

describe('loadModelRegistryWithOrigins', () => {
  let root: string
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'stacks-model-origins-'))
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('records which root each model came from, an app override winning', async () => {
    const write = (file: string, name: string) => {
      mkdirSync(dirname(join(root, file)), { recursive: true })
      writeFileSync(join(root, file), `export default { name: '${name}' }\n`)
    }
    write('defaults/commerce/Product.ts', 'Product')
    write('defaults/User.ts', 'User')
    write('user/Account.ts', 'User')
    write('user/Repo.ts', 'Repo')

    const { models, origins } = await loadModelRegistryWithOrigins({ defaultsRoot: join(root, 'defaults'), userRoot: join(root, 'user') })

    expect(Object.keys(models).sort()).toEqual(['Product', 'Repo', 'User'])
    expect(origins).toEqual({ Product: 'default', User: 'app', Repo: 'app' })
  })
})

/**
 * The real generator, booted in a throwaway project: one framework default
 * (`Review`), one app model (`Repo`), and whatever `config/security.ts` the
 * case writes. What it registers is what an app serves.
 */
describe('the ORM route generator', () => {
  let project: string
  const fixture = join(import.meta.dir, 'fixtures', 'print-model-api-routes.ts')

  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'stacks-model-apis-'))
    const model = (dir: string, name: string, uri: string) => {
      mkdirSync(join(project, dir), { recursive: true })
      writeFileSync(join(project, dir, `${name}.ts`), `export default ${JSON.stringify({ name, table: uri, ...api(uri) })}\n`)
    }
    model('storage/framework/defaults/app/Models', 'Review', 'reviews')
    model('app/Models', 'Repo', 'repos')
    mkdirSync(join(project, 'config'), { recursive: true })
    writeFileSync(join(project, 'package.json'), '{"name":"model-apis-fixture"}\n')
  })
  afterAll(() => rmSync(project, { recursive: true, force: true }))

  function boot(options: { env?: string, config?: string }): { paths: string[], output: string } {
    const security = join(project, 'config', 'security.ts')
    rmSync(security, { force: true })
    if (options.config !== undefined)
      writeFileSync(security, `export default { api: { models: ${options.config} } }\n`)

    const env: Record<string, string | undefined> = { ...process.env }
    delete env.STACKS_MODEL_APIS
    if (options.env !== undefined)
      env.STACKS_MODEL_APIS = options.env

    const result = Bun.spawnSync([process.execPath, fixture], { cwd: project, env, stdout: 'pipe', stderr: 'pipe' })
    const output = `${result.stdout}${result.stderr}`
    const line = result.stdout.toString().split('\n').find(candidate => candidate.startsWith('{"paths"'))
    if (!line)
      throw new Error(`the generator printed no routes (exit ${result.exitCode})\n${output}`)
    return { paths: JSON.parse(line).paths, output }
  }

  it('serves every model\'s API when nothing is set', () => {
    expect(boot({}).paths).toEqual(['/api/repos', '/api/repos/{id}', '/api/reviews', '/api/reviews/{id}'])
  }, 60_000)

  it('serves only the app\'s own under STACKS_MODEL_APIS=own', () => {
    expect(boot({ env: 'own' }).paths).toEqual(['/api/repos', '/api/repos/{id}'])
  }, 60_000)

  it('serves none under STACKS_MODEL_APIS=none', () => {
    expect(boot({ env: 'none' }).paths).toEqual([])
  }, 60_000)

  it('reads security.api.models, and lets the env var override it', () => {
    expect(boot({ config: `['Review']` }).paths).toEqual(['/api/reviews', '/api/reviews/{id}'])
    expect(boot({ config: `'none'`, env: 'own' }).paths).toEqual(['/api/repos', '/api/repos/{id}'])
  }, 60_000)

  it('says which named model it could not serve', () => {
    const { paths, output } = boot({ env: 'own,Reviews' })
    expect(paths).toEqual(['/api/repos', '/api/repos/{id}'])
    expect(output).toContain('STACKS_MODEL_APIS names a model with no `useApi` trait, so no API was generated for reviews.')
  }, 60_000)
})
