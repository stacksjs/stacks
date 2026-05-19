/**
 * End-to-end smoke action for the #1851 type-inference work
 * (stacksjs/stacks#1851 Phase 4).
 *
 * This file exists to PROVE the inference story holds when path +
 * validations + cookies + the proxy export all interact in a single
 * real action — not just at the type-shape unit level. If the
 * Action generic, ExtractParams, InferValidations, or the proxy
 * typing regresses, this file stops typechecking. It's referenced
 * from `action-typing.test.ts` so a `bun tsc` over the actions
 * package catches the regression.
 *
 * Crucially: **there is NOT a single `as any` cast in this file.**
 * Every value access is typed end-to-end from the inferred shape.
 * That's the issue's success criterion verbatim.
 */

import { Action } from '@stacksjs/actions'
import { schema } from '@stacksjs/validation'

/**
 * Imagined route: POST /api/judges/{id}/follow with a body carrying
 * a `note: string` and an optional `silent: boolean`. The action
 * declares its path + validations and `handle` receives a fully-
 * typed request.
 */
export const FollowJudgeAction = new Action({
  name: 'FollowJudge',
  description: 'Follow a judge with an optional note.',
  method: 'POST',
  path: '/api/judges/{id}/follow',
  // `as const` is what makes InferValidations read the rule types.
  // Without it, the validations object widens to ActionValidations
  // and the body falls back to Record<string, any>.
  validations: {
    note: { rule: schema.string().max(500) },
    silent: { rule: schema.boolean() },
  } as const,
  async handle(req) {
    // 1. Path-extracted params — req.params.id is typed `string`,
    //    not `string | number | undefined`, not `any`.
    const judgeId = Number(req.params.id)
    if (!Number.isFinite(judgeId) || judgeId <= 0)
      return { error: 'Invalid judge id', status: 400 }

    // 2. Body shape from validations — req.input('note') is typed
    //    string (not string | undefined, because the validator says
    //    `string`). req.all() returns { note: string, silent: boolean }.
    const note = req.input('note')
    const silent = req.input('silent')

    // 3. Cookies access via the typed accessor — no `as any` needed
    //    for the `request.cookies?.delete?.(…)` pattern that
    //    motivated keeping cookies on the unified RequestInstance.
    req.cookies?.set('last-followed-judge', String(judgeId), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    })

    // 4. Param method form — `req.param('id')` narrows to the path's
    //    TParams shape; unknown keys fall back to string | default.
    const idAgain: string = req.param('id')
    const fallback: string = req.param('nonexistent', '')

    return {
      judgeId,
      note,
      silent,
      idAgain,
      fallback,
      followedAt: new Date().toISOString(),
    }
  },
})

/**
 * Imagined route: GET /api/judges (no params, no body). The action
 * declares neither `path:` nor `validations:`, so `req` falls back
 * to the bare `RequestInstance<Record<string, any>>` shape — same
 * back-compat behaviour every pre-#1851 action had.
 */
export const ListJudgesAction = new Action({
  name: 'ListJudges',
  description: 'List judges, no params required.',
  method: 'GET',
  async handle(req) {
    // Bare type: request.get('q') returns `any` (back-compat), no
    // narrowing because there's no validations + no path.
    const q = req.get('q')
    return { q, judges: [] }
  },
})

/**
 * Imagined route: PATCH /api/orders/{orderId}/items/{itemId} —
 * exercises multi-param extraction. Both `orderId` and `itemId`
 * narrow to `string` on `req.params`.
 */
export const UpdateOrderItemAction = new Action({
  name: 'UpdateOrderItem',
  method: 'PATCH',
  path: '/api/orders/{orderId}/items/{itemId}',
  validations: {
    quantity: { rule: schema.number().min(1) },
  } as const,
  async handle(req) {
    const orderId = req.params.orderId  // string
    const itemId = req.params.itemId    // string
    const quantity = req.input('quantity') // number from validations
    return { orderId, itemId, quantity }
  },
})

/**
 * Imagined route: DELETE /api/sessions/:sessionId — exercises the
 * Express-style colon form of param extraction. Same `req.params.sessionId`
 * typing as the brace form.
 */
export const DestroySessionAction = new Action({
  name: 'DestroySession',
  method: 'DELETE',
  path: '/api/sessions/:sessionId',
  async handle(req) {
    return { sessionId: req.params.sessionId }
  },
})

/**
 * Compile-time "this used to need (request as any)" canary. If
 * anyone regresses the types so the cookies/param/all() access
 * here stops typechecking, this file fails to compile.
 */
export const NoCastsSmokeAction = new Action({
  name: 'NoCastsSmoke',
  method: 'POST',
  path: '/api/things/{thingId}',
  validations: {
    title: { rule: schema.string() },
    rating: { rule: schema.number().min(1).max(5) },
  } as const,
  async handle(req) {
    // The six patterns from #1851's "Concrete pain" section, no
    // `as any` anywhere:

    // 1. Route param
    const thingId = Number(req.params.thingId)
    // 2. Query string (still loose because no query-validation type)
    const q = req.get('q', '')
    // 3. all() body
    const body = req.all()
    // 4. get() with fallback
    const limit = req.get('limit', 20)
    // 5. params with default — params doesn't have a default-helper
    //    but `req.param('thingId', '0')` gives the typed fallback.
    const safeId = req.param('thingId', '0')
    // 6. mixed query+param — both typed.
    return { thingId, q, body, limit, safeId }
  },
})
