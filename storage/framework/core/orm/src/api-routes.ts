/**
 * The endpoints a `useApi` model publishes, as a type.
 *
 * A model with `traits: { useApi: true }` gets a full REST surface generated
 * for it at boot - index, show, store, update, destroy, bulk-delete - and until
 * now a TypeScript consumer could not see any of it. The handlers are built at
 * runtime from the model definition, so there is no action to import and no
 * route file to read; the only description of those endpoints was whatever
 * `buddy generate:openapi` had last written down.
 *
 * This derives the same surface from the same model definition, at compile
 * time, with no runtime involvement whatsoever:
 *
 * ```ts
 * import type { ApiRoutesFor } from '@stacksjs/orm'
 * import type Product from '../app/Models/Product'
 * import type Order from '../app/Models/Order'
 *
 * export type GeneratedRoutes = ApiRoutesFor<typeof Product> & ApiRoutesFor<typeof Order>
 *
 * const client = createTypedClient<GeneratedRoutes>({ baseUrl })
 * const listing = await client.get('/api/products')     // typed, generated, no CLI step
 * ```
 *
 * It composes with hand-written typed routes, since both sides are just route
 * maps:
 *
 * ```ts
 * export type AppRoutes = RoutesOf<typeof api> & ApiRoutesFor<typeof Product>
 * ```
 *
 * ## Why not register the generated routes through `createTypedRouter()`
 *
 * Because it would buy nothing. Those handlers are inline functions that build
 * a `Response` themselves - there is no action, and therefore no return type to
 * infer - so pushing every `useApi` model in every Stacks app through a
 * different registration path would be churn on the framework's most
 * heavily-used code path in exchange for no inference at all. The model
 * definition already holds everything the types need; reading it directly is
 * the shorter honest route.
 *
 * ## Keeping this honest
 *
 * Everything below mirrors a decision made in `routes.ts`, and mirrors are
 * exactly the thing that drifts. The pairs are:
 *
 * - the URI fallback chain (`useApi.uri` → `table` → lowercased name + "s")
 * - the default route list when `useApi.routes` is absent
 * - `/api/` + optional prefix (`apiBasePath`)
 * - `hidden: true` attributes stripped from every response and refused on
 *   every write (`stripHidden` / `dropHiddenInputs`)
 * - the response envelopes: `{ data }` for a single row, `{ data, ...paginator,
 *   meta }` for a listing, 204 (so, `undefined`) for a delete
 *
 * `tests/api-routes.test.ts` asserts each of those against the generator's own
 * source rather than against a copy of it, so a change on either side fails.
 */

import type { IndexPaginator } from './auto-crud'
import type { ModelCreateData, ModelRow } from './model-types'

/** The definition behind a model, whether it was passed bare or via `defineModel`. */
type Definition<M> = M extends { attributes: unknown } ? M : never

type ApiTrait<M> = Definition<M> extends { traits?: { useApi?: infer A } } ? A : never

/** `useApi: { uri: 'products' }` → `'products'`, else the table, else name + "s". */
type ApiUri<M>
  = ApiTrait<M> extends { uri: infer U extends string }
    ? U
    : (Definition<M> extends { table: infer T extends string }
        ? T
        : (Definition<M> extends { name: infer N extends string } ? `${Lowercase<N>}s` : never))

type ApiPrefix<M> = ApiTrait<M> extends { prefix: infer P extends string } ? `${P}/` : ''

/** `/api/{prefix/}{uri}` — the same shape `apiBasePath()` builds. */
export type ApiBasePathFor<M> = `/api/${ApiPrefix<M>}${ApiUri<M>}`

type DefaultRoutes = 'index' | 'show' | 'store' | 'update' | 'destroy'

/** Which of the CRUD verbs this model publishes. */
type EnabledRoutes<M>
  = ApiTrait<M> extends { routes: infer R extends readonly string[] }
    ? R[number]
    : DefaultRoutes

type Attributes<M> = Definition<M> extends { attributes: infer A } ? A : never

/** Attributes flagged `hidden: true`, which never appear in a response. */
type HiddenKeys<M> = {
  [K in keyof Attributes<M>]: Attributes<M>[K] extends { hidden: true } ? K : never
}[keyof Attributes<M>]

/** A row as the generated endpoints actually return it: hidden fields removed. */
export type ApiRow<M> = Omit<ModelRow<M>, Extract<HiddenKeys<M>, keyof ModelRow<M>>>

/** What a write accepts: fillable fields, minus anything hidden. */
export type ApiWriteData<M> = Omit<ModelCreateData<M>, Extract<HiddenKeys<M>, keyof ModelCreateData<M>>>

/** The listing envelope: rows, the flat paginator, and the deprecated `meta`. */
export interface ApiIndexResponse<TRow> extends IndexPaginator {
  data: TRow[]
  /**
   * @deprecated Kept for one transition release (stacksjs/stacks#1960). Read
   * the top-level paginator fields instead; `meta.page` is `current_page`.
   */
  meta: Record<string, unknown>
}

/** The single-row envelope, used by show, store and update alike. */
export interface ApiItemResponse<TRow> {
  data: TRow
}

type Params<TId extends string = 'id'> = { [K in TId]: string }

type IndexRoute<M, TBase extends string>
  = 'index' extends EnabledRoutes<M>
    ? { [K in `GET ${TBase}`]: { input: Record<string, never>, output: ApiIndexResponse<ApiRow<M>>, params: Record<string, never> } }
    : Record<string, never>

type ShowRoute<M, TBase extends string>
  = 'show' extends EnabledRoutes<M>
    ? { [K in `GET ${TBase}/{id}`]: { input: Record<string, never>, output: ApiItemResponse<ApiRow<M>>, params: Params } }
    : Record<string, never>

type StoreRoute<M, TBase extends string>
  = 'store' extends EnabledRoutes<M>
    ? { [K in `POST ${TBase}`]: { input: ApiWriteData<M>, output: ApiItemResponse<ApiRow<M>>, params: Record<string, never> } }
    : Record<string, never>

type UpdateRoute<M, TBase extends string>
  = 'update' extends EnabledRoutes<M>
    ? {
        [K in `PUT ${TBase}/{id}` | `PATCH ${TBase}/{id}`]: {
          input: ApiWriteData<M>
          output: ApiItemResponse<ApiRow<M>>
          params: Params
        }
      }
    : Record<string, never>

type DestroyRoute<M, TBase extends string>
  = 'destroy' extends EnabledRoutes<M>
    ? {
        [K in `DELETE ${TBase}/{id}`]: { input: Record<string, never>, output: undefined, params: Params }
      } & {
        [K in `POST ${TBase}/bulk-delete`]: {
          input: { ids: Array<number | string> }
          output: { message: string }
          params: Record<string, never>
        }
      }
    : Record<string, never>

/**
 * Every endpoint `useApi` publishes for this model, as a route map the typed
 * client understands.
 *
 * Intersect several of them - one per model - to describe a whole generated
 * API, and intersect that with `RoutesOf<typeof api>` to describe an app that
 * has both generated and hand-written routes.
 */
export type ApiRoutesFor<M>
  = ApiBasePathFor<M> extends infer TBase extends string
    ? IndexRoute<M, TBase>
    & ShowRoute<M, TBase>
    & StoreRoute<M, TBase>
    & UpdateRoute<M, TBase>
    & DestroyRoute<M, TBase>
    : never
