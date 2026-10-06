import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

/**
 * The OpenAPI document describes the model APIs the app actually serves.
 *
 * `security.api.models` / `STACKS_MODEL_APIS` choose which `useApi` models
 * get routes (stacksjs/stacks#2866). The paths follow on their own, since the
 * spec is built from registered routes; the component schemas are read from
 * the model registry, so they have to apply the same selection or the spec
 * keeps documenting a `Review` the app no longer serves.
 */
describe('OpenAPI model schemas', () => {
  let project: string
  const fixture = join(import.meta.dir, 'fixtures', 'print-openapi-models.ts')

  beforeAll(() => {
    project = mkdtempSync(join(tmpdir(), 'stacks-openapi-models-'))
    const model = (dir: string, name: string, uri: string) => {
      mkdirSync(join(project, dir), { recursive: true })
      const definition = { name, table: uri, traits: { useApi: { uri, routes: ['index', 'show'] } }, attributes: {} }
      writeFileSync(join(project, dir, `${name}.ts`), `export default ${JSON.stringify(definition)}\n`)
    }
    model('storage/framework/defaults/app/Models', 'Review', 'reviews')
    model('app/Models', 'Repo', 'repos')
    mkdirSync(join(project, 'routes'), { recursive: true })
    writeFileSync(join(project, 'routes', 'api.ts'), 'export {}\n')
    writeFileSync(join(project, 'package.json'), '{"name":"openapi-models-fixture"}\n')
  })
  afterAll(() => rmSync(project, { recursive: true, force: true }))

  function generate(selection?: string): { schemas: string[], paths: string[] } {
    const env: Record<string, string | undefined> = { ...process.env, STACKS_DEFAULT_ROUTES: 'none' }
    delete env.STACKS_MODEL_APIS
    if (selection !== undefined)
      env.STACKS_MODEL_APIS = selection

    const result = Bun.spawnSync([process.execPath, fixture], { cwd: project, env, stdout: 'pipe', stderr: 'pipe' })
    const line = result.stdout.toString().split('\n').find(candidate => candidate.startsWith('{"schemas"'))
    if (!line)
      throw new Error(`no spec printed (exit ${result.exitCode})\n${result.stdout}\n${result.stderr}`)
    return JSON.parse(line)
  }

  it('documents every model API when nothing is selected', () => {
    expect(generate()).toEqual({
      schemas: ['Repo', 'Review'],
      paths: ['/api/repos', '/api/repos/{id}', '/api/reviews', '/api/reviews/{id}'],
    })
  }, 60_000)

  it('documents only the selected ones, schemas included', () => {
    expect(generate('own')).toEqual({ schemas: ['Repo'], paths: ['/api/repos', '/api/repos/{id}'] })
    expect(generate('none')).toEqual({ schemas: [], paths: [] })
  }, 60_000)
})
