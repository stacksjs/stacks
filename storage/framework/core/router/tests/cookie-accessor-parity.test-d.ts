/**
 * `@stacksjs/types` keeps its own copy of the cookie accessor's shape, so that
 * package does not have to depend on bun-router for a single type. The copy
 * carried a comment asking whoever changed the original to keep it in sync.
 *
 * It drifted the first time that happened. bun-router's `CookieAccessor` became
 * a hybrid - callable, carrying the parsed entries directly, and holding
 * get/set/delete/getAll - while `RequestCookies` still said it was four
 * methods, so `request.cookies()` and `request.cookies.session` were errors
 * against a runtime that supports both. A comment cannot notice that.
 *
 * This can. Assignability in both directions is the property the duplication
 * needs and the property a comment was standing in for; `@stacksjs/router`
 * already depends on bun-router, so it is the right place to assert it.
 *
 * If this file stops compiling, the two declarations describe different
 * objects. Fix the copy in `@stacksjs/types` rather than this file.
 */

import type { CookieAccessor } from '@stacksjs/bun-router'
import type { RequestCookies } from '@stacksjs/types'

declare const fromRouter: CookieAccessor
declare const fromTypes: RequestCookies

// Each has to stand in for the other: a value the router produces must satisfy
// what `@stacksjs/types` promises, and anything written against that promise
// must be satisfiable by what the router produces.
export const routerSatisfiesTypes: RequestCookies = fromRouter
export const typesSatisfiesRouter: CookieAccessor = fromTypes

// The three shapes the runtime actually has, spelled out - so a copy that
// silently lost one is a failure here rather than at a call site.
export const callable: Record<string, string> = fromTypes()
export const byName: unknown = fromTypes.session
export const byGet: string | undefined = fromTypes.get('session')
export const all: Record<string, string> = fromTypes.getAll()
