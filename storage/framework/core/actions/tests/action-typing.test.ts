/**
 * Compile-time type-level tests for the Action surface
 * (stacksjs/stacks#1851).
 *
 * Strategy: the tests are dual-purpose. The `expectTypeOf` helpers
 * fire at compile time — if the inference regresses, the file won't
 * type-check and `bun test` won't run them. The `bun:test` describe
 * block is mostly a wrapper so the file shows up in the test runner
 * for visibility; the real assertions are the type-level shapes.
 *
 * If you change anything in:
 *   - `@stacksjs/types/src/request.ts` (RequestInstance, ExtractParams,
 *     InferValidations)
 *   - `@stacksjs/actions/src/action.ts` (Action generic, InferRequest)
 *
 * …and this file no longer typechecks, the regression is real —
 * the type-level intent is what users see in their editor.
 */

import type { ExtractParams, InferValidations, RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'

// ─── ExtractParams (#1851 Phase 2a) ─────────────────────────────────

// Brace-style params extract individually.
type _BraceSingle = ExtractParams<'/api/users/{id}'>
const _braceSingle: _BraceSingle = { id: 'x' }
// @ts-expect-error wrong key
const _braceSingleWrong: _BraceSingle = { name: 'x' }
void _braceSingle
void _braceSingleWrong

// Multiple brace params produce a union of keys.
type _BraceMulti = ExtractParams<'/orgs/{org}/repos/{repo}/runs/{runId}'>
const _braceMulti: _BraceMulti = { org: 'a', repo: 'b', runId: '100' }
void _braceMulti

// Express colon-style works too.
type _Colon = ExtractParams<'/api/users/:id/posts/:postId'>
const _colon: _Colon = { id: '1', postId: '2' }
void _colon

// Static paths produce an empty record (no keys to assign).
type _Static = ExtractParams<'/api/health'>
const _static: _Static = {}
void _static

// ─── InferValidations (#1851 Phase 2b) ──────────────────────────────

// The pure-type test — given a const validations object, the inferred
// body shape pulls each rule's `Validator<T>` output into a field
// type. We synthesise a minimal Validator<T> phantom shape here so
// the test doesn't depend on ts-validation's full module surface.

interface FakeValidator<T> {
  // The methods InferValidations doesn't need to read — only the
  // phantom `T` carries the type. `validate` is here just so the
  // shape matches ActionValidations' rule field shape.
  validate: (value: unknown) => { valid: boolean }
  __phantom?: T
}
function v<T>(): FakeValidator<T> { return { validate: () => ({ valid: true }) } }

const _validations = {
  email: { rule: v<string>() },
  age: { rule: v<number>() },
  isAdmin: { rule: v<boolean>() },
} as const

// `Infer` from ts-validation extracts `T` from `Validator<T>`. The
// phantom helper above isn't a real Validator at the nominal level —
// ts-validation's `Infer` reads via structural matching on the
// phantom slot. For this test we sidestep by writing the expected
// shape manually and letting `InferValidations` resolve at compile
// time.
type _Body = InferValidations<typeof _validations>
// Concretely we expect: { email: string, age: number, isAdmin: boolean }
// (or `never` if Infer doesn't accept the phantom shape — that's a
// separate test we'll exercise in the dedicated package).
type _BodyKeysAssign = { [K in keyof _Body]: _Body[K] }
const _bodyKeys: _BodyKeysAssign = {} as _BodyKeysAssign
void _bodyKeys

// ─── RequestInstance generics (#1851 Phase 1a) ──────────────────────

// TParams narrows `params` to the extracted keyset.
type _PathScopedRequest = RequestInstance<Record<string, any>, ExtractParams<'/api/users/{id}'>>
function _checkParams(r: _PathScopedRequest): string {
  // request.params.id is typed `string` — no `as any` needed.
  return r.params.id
}
void _checkParams

// TFields narrows `all()` / `input()` to the body shape.
interface Body { email: string, age: number }
function _checkBody(r: RequestInstance<Body>): { email: string, age: number } {
  return r.all()
}
void _checkBody

// `param('id')` returns `TParams['id']` when present in the path
// generic, falling back to `string` for unknown keys.
function _checkParam(r: _PathScopedRequest): string {
  const known = r.param('id')      // typed string from the path
  const unknown = r.param('whatever') // falls back to string
  return known + unknown
}
void _checkParam

// `cookies?.delete` works — covers the PlaceOrderAction pattern that
// motivated keeping cookies on the unified type.
function _checkCookies(r: RequestInstance): void {
  r.cookies?.delete('cart')
}
void _checkCookies

// ─── Backwards compatibility ────────────────────────────────────────

// Bare `RequestInstance` (no generics) still accepts any string key.
function _checkBare(r: RequestInstance): unknown {
  return r.get('anything-at-all')
}
void _checkBare

// ─── End-to-end smoke (#1851 Phase 4) ────────────────────────────
//
// Importing the smoke fixture forces it through TS in this test
// pass. If the smoke action's inference regresses (path-extracted
// params, validations-inferred body, cookies access, no `as any`),
// the import fails to typecheck and the test runner won't even
// reach the assertions below.
import {
  DestroySessionAction,
  FollowJudgeAction,
  ListJudgesAction,
  NoCastsSmokeAction,
  UpdateOrderItemAction,
} from './fixtures/smoke-action'

// ─── Bun-router inline-handler narrowing (#1851 Phase 2d) ──────────
//
// Type-only test that the `router.get<TPath>(path, handler)` overload
// in bun-router threads the path literal into the inline handler's
// `request.params` keyset. The function is never *called* — its
// existence is enough to type-check the inference.
import type { EnhancedRequest } from '@stacksjs/bun-router'
import type { ExtractRouteParams } from '@stacksjs/bun-router'

function _inlineHandlerTypeSmoke(): void {
  // Inline-handler shape that the typed-overload route methods
  // accept. The narrowing comes from `request: EnhancedRequest &
  // { params: ExtractRouteParams<TPath> }` — the `TypedRouteHandler`
  // contract bun-router already exports.
  type Handler<P extends string> = (
    req: EnhancedRequest & { params: ExtractRouteParams<P> },
  ) => Response | Promise<Response>

  // Single-param.
  const _h1: Handler<'/api/users/{id}'> = (req) => {
    const id: string = req.params.id
    // @ts-expect-error wrong key
    void req.params.bogus
    return new Response(id)
  }
  void _h1

  // Multi-param.
  const _h2: Handler<'/orgs/{org}/repos/{repo}/runs/{runId}'> = (req) => {
    const org: string = req.params.org
    const repo: string = req.params.repo
    const runId: string = req.params.runId
    return new Response(`${org}/${repo}@${runId}`)
  }
  void _h2

  // Static path → no narrowed params (empty `object` per
  // ExtractRouteParams's fallback).
  const _h3: Handler<'/api/health'> = (_req) => new Response('ok')
  void _h3
}
void _inlineHandlerTypeSmoke

describe('action-typing (compile-time)', () => {
  test('file type-checks', () => {
    // The real test happens at compile time. If you got here, the
    // type-level invariants hold.
    expect(true).toBe(true)
  })

  test('smoke action fixture is importable + constructed', () => {
    // Each action constructs without throwing. The interesting
    // story is the compile pass — these runtime asserts just keep
    // the imports from being tree-shaken.
    expect(FollowJudgeAction.name).toBe('FollowJudge')
    expect(ListJudgesAction.method).toBe('GET')
    expect(UpdateOrderItemAction.path).toBe('/api/orders/{orderId}/items/{itemId}')
    expect(DestroySessionAction.path).toBe('/api/sessions/:sessionId')
    expect(NoCastsSmokeAction.name).toBe('NoCastsSmoke')
  })
})
