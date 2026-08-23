/**
 * `ApiRoutesFor<M>` describes endpoints that are built at runtime by
 * `routes.ts`, from the same model definition, in a completely separate piece
 * of code. That is a mirror, and mirrors drift.
 *
 * Every assertion below reads the generator's own source and checks that the
 * decision the types copied is still the decision it makes. When one side
 * moves, this fails and names which pair stopped agreeing - which is the only
 * thing standing between a typed client and confidently-wrong endpoints.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const src = resolve(import.meta.dir, '../src')
const generator = readFileSync(join(src, 'routes.ts'), 'utf-8')
const autoCrud = readFileSync(join(src, 'auto-crud.ts'), 'utf-8')
const types = readFileSync(join(src, 'api-routes.ts'), 'utf-8')

describe('ApiRoutesFor mirrors the generated endpoints', () => {
  it('uses the same uri fallback chain', () => {
    // `apiConfig.uri || model.table || modelName.toLowerCase() + 's'`
    expect(generator).toContain('apiConfig.uri || model.table || modelName.toLowerCase()')
    expect(types).toContain('ApiTrait<M> extends { uri: infer U extends string }')
    expect(types).toContain('`${Lowercase<N>}s`')
  })

  it('uses the same default route list', () => {
    expect(generator).toContain(`apiConfig.routes || ['index', 'show', 'store', 'update', 'destroy']`)
    expect(types).toContain(`type DefaultRoutes = 'index' | 'show' | 'store' | 'update' | 'destroy'`)
  })

  it('builds the same base path', () => {
    expect(autoCrud).toContain('return `/api/${cleanPrefix ? `${cleanPrefix}/` : \'\'}${cleanUri}`')
    expect(types).toContain('export type ApiBasePathFor<M> = `/api/${ApiPrefix<M>}${ApiUri<M>}`')
  })

  it('strips the same hidden attributes from responses', () => {
    expect(generator).toContain('attr.hidden === true')
    expect(types).toContain('Attributes<M>[K] extends { hidden: true } ? K : never')
  })

  it('describes the same paths', () => {
    for (const path of ['basePath', '`${basePath}/{id}`', '`${basePath}/bulk-delete`'])
      expect(generator).toContain(path)

    for (const key of ['`GET ${TBase}`', '`GET ${TBase}/{id}`', '`POST ${TBase}`', '`PUT ${TBase}/{id}` | `PATCH ${TBase}/{id}`', '`DELETE ${TBase}/{id}`', '`POST ${TBase}/bulk-delete`'])
      expect(types).toContain(key)
  })

  it('describes the same envelopes', () => {
    // Listing: rows, the flat paginator, and the deprecated meta.
    expect(generator).toContain('data: records,')
    expect(generator).toContain('...paginator,')
    expect(types).toContain('export interface ApiIndexResponse<TRow> extends IndexPaginator {')

    // Single row, for show / store / update alike.
    expect(generator).toContain('{ data: stripHidden(applyReadCasts(created, model), hiddenFields) }, 201')
    expect(generator).toContain('{ data: stripHidden(applyReadCasts(updated, model), hiddenFields) }')
    expect(types).toContain('export interface ApiItemResponse<TRow> {')

    // Delete answers 204, which the client surfaces as undefined.
    expect(generator).toContain('return new Response(null, { status: 204 })')
    expect(types).toContain('output: undefined')

    // Bulk delete answers a message.
    expect(generator).toContain('message: `Successfully deleted ${validIds.length} ${uri}`')
    expect(types).toContain('output: { message: string }')
  })

  it('stays type-only, so nothing here can affect a running app', () => {
    expect(types).not.toMatch(/^(?!.*\*)\s*(?:export )?(?:const|let|var|function|class)\s/m)
  })
})
