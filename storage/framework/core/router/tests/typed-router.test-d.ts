/**
 * The compile-time half of the zero-generation typed client.
 *
 * The claim is that a TypeScript consumer sees a route's input and output
 * types with no CLI step in between - so the test has to be a compile, not an
 * assertion at runtime. Checked by `bun run typecheck` via
 * `tsconfig.type-tests.json`; nothing here executes.
 *
 * The `@ts-expect-error` lines are the load-bearing half. Each one fails the
 * build if the error it expects stops happening, which is what makes this a
 * test of inference rather than a demonstration that some code compiles.
 */

import { Action } from '@stacksjs/actions'
import { createTypedClient } from '@stacksjs/api/typed-client'
import { createTypedRouter } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

type Equal<TLeft, TRight>
  = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2) ? true : false
type Expect<T extends true> = T

const IndexAction = new Action({
  name: 'ProjectIndex',
  handle() {
    return { projects: [{ id: 1, name: 'apollo' }] }
  },
})

const ShowAction = new Action({
  name: 'ProjectShow',
  handle() {
    return { id: 1, name: 'apollo', archived: false }
  },
})

const StoreAction = new Action({
  name: 'ProjectStore',
  validations: {
    name: { rule: schema.string() },
    budget: { rule: schema.number() },
  },
  handle() {
    return { id: 1, name: 'apollo' }
  },
})

const StreamAction = new Action({
  name: 'ProjectExport',
  handle() {
    return new Response('a,b,c')
  },
})

const api = createTypedRouter()
  .get('/v1/projects', IndexAction)
  .get('/v1/projects/{id}', ShowAction)
  .post('/v1/projects', StoreAction)
  .get('/v1/projects/{id}/export', StreamAction)

export type AppRoutes = typeof api

const client = createTypedClient<AppRoutes>({ baseUrl: 'https://api.example.com' })

// ── outputs come from the action's own return type ────────────────────────

type IndexResult = Awaited<ReturnType<typeof client.get<'/v1/projects'>>>
type IndexIsInferred = Expect<Equal<IndexResult, { projects: Array<{ id: number, name: string }> }>>

type ShowResult = Awaited<ReturnType<typeof client.get<'/v1/projects/{id}'>>>
type ShowIsInferred = Expect<Equal<ShowResult, { id: number, name: string, archived: boolean }>>

// An action that writes the wire format itself is honestly unknown, not a lie.
type ExportResult = Awaited<ReturnType<typeof client.get<'/v1/projects/{id}/export'>>>
type ExportIsUnknown = Expect<Equal<ExportResult, unknown>>

// ── inputs come from the action's validations ─────────────────────────────

type StoreBody = Parameters<typeof client.post<'/v1/projects'>>[1]
type StoreBodyIsInferred = Expect<Equal<StoreBody, { name: string, budget: number }>>

// ── the calls that must compile ───────────────────────────────────────────

export async function usage(): Promise<void> {
  const projects = await client.get('/v1/projects')
  const firstName: string = projects.projects[0]!.name

  const one = await client.get('/v1/projects/{id}', { params: { id: '42' } })
  const archived: boolean = one.archived

  const created = await client.post('/v1/projects', { name: 'apollo', budget: 1200 })
  const createdId: number = created.id

  void firstName
  void archived
  void createdId
}

// ── the calls that must NOT ───────────────────────────────────────────────

export function negatives(): void {
  // @ts-expect-error a path the API does not serve
  client.get('/v1/nope')

  // @ts-expect-error the route is a POST, not a GET
  client.get('/v1/projects/{id}/nope')

  // @ts-expect-error `budget` is a number in the action's validations
  client.post('/v1/projects', { name: 'apollo', budget: 'twelve hundred' })

  // @ts-expect-error `name` is required by the action's validations
  client.post('/v1/projects', { budget: 1200 })

  // @ts-expect-error `{id}` is the only param this path has
  client.get('/v1/projects/{id}', { params: { slug: 'apollo' } })
}

/*
 * The one that the whole plan is about.
 *
 * `IndexAction` returns `{ projects: … }`. A consumer that expects the shape it
 * used to return has to stop compiling the moment the action changes - with no
 * `buddy generate:openapi` run in between, and no generated file that could
 * still be holding yesterday's answer.
 */
export async function staleExpectation(): Promise<void> {
  const projects = await client.get('/v1/projects')

  // @ts-expect-error there is no `items` on this response, and there never was
  void projects.items
}
