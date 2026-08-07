/**
 * Route-model binding (stacksjs/stacks#2231).
 *
 * The framework ships a full Policy system and a `can:` middleware, and they
 * could not be connected. `Can` read the route parameter and handed the RAW
 * STRING to `authorize()`, while `resolveAbility()` only reaches for a policy
 * when the first argument is an object with a matching `constructor.name`. A
 * string's is `String`, so `can:view,site` could never dispatch to
 * `SitePolicy.view(user, site)` — every ownership check had to be written
 * imperatively inside the handler instead.
 *
 * A gate that is opt-in per handler rather than declarative on the route means
 * a new endpoint that forgets the three-line prologue is readable by anyone.
 * One real app carries that prologue at 18 call sites and wrote a source-grep
 * test purely to stop a copy being deleted.
 *
 * Resolution order: an explicit binding, then the fallback, then nothing. The
 * "nothing" case matters most — it is what keeps this from changing behaviour
 * for a parameter no one has bound.
 */

export interface RouteModelContext {
  /** The route parameter's name, e.g. `site` in `/sites/:site`. */
  param: string
  /** The request being authorized, when the caller has one. */
  request?: unknown
}

/**
 * Resolves a parameter's raw path value to a model.
 *
 * `context.param` is supplied so ONE resolver can serve every parameter — which
 * is what the convention fallback needs, since it derives the model name from
 * the parameter name.
 */
export type RouteModelResolver = (value: string, context: RouteModelContext) => unknown | Promise<unknown>

/**
 * Outcome of a resolution attempt.
 *
 * `bound` distinguishes "nobody claims this parameter" from "someone claims it
 * and there is no such row". They must not collapse: the first has to keep
 * passing the raw string through, exactly as before, or every existing
 * `can:ability,param` route changes meaning at once.
 */
export interface RouteModelResolution {
  bound: boolean
  model?: unknown
}

const bindings = new Map<string, RouteModelResolver>()
let fallbackResolver: RouteModelResolver | null = null

/**
 * Bind a route parameter to a model.
 *
 * ```ts
 * defineRouteModelBinding('site', id => Site.find(Number(id)))
 * ```
 *
 * The last registration for a name wins, so an app can override a convention
 * binding without having to unregister one.
 */
export function defineRouteModelBinding(param: string, resolver: RouteModelResolver): void {
  bindings.set(param, resolver)
}

/**
 * A resolver consulted for any parameter with no explicit binding.
 *
 * This is how a convention — parameter `site` resolves through the `Site`
 * model — is supplied without the router having to import the ORM, which would
 * be a dependency cycle. Pass `null` to remove it.
 */
export function setRouteModelFallback(resolver: RouteModelResolver | null): void {
  fallbackResolver = resolver
}

/** Registered parameter names, for diagnostics and tests. */
export function routeModelBindings(): string[] {
  return [...bindings.keys()].sort()
}

export function clearRouteModelBindings(): void {
  bindings.clear()
  fallbackResolver = null
}

/**
 * Resolve one route parameter to a model instance.
 *
 * A resolver that throws is treated as "no model" rather than allowed to
 * propagate: a lookup failure must not turn an authorization check into a 500,
 * and falling through to the unresolved path denies, which is the safe
 * direction.
 */
export async function resolveRouteModel(
  param: string,
  value: string,
  request?: unknown,
): Promise<RouteModelResolution> {
  const resolver = bindings.get(param) ?? fallbackResolver

  if (!resolver)
    return { bound: false }

  try {
    const model = await resolver(value, { param, request })
    // A resolver may decline by returning undefined — used by the convention
    // fallback to say "there is no model of this name", which is different
    // from "there is one and the row is missing" (null).
    if (model === undefined)
      return { bound: false }

    return { bound: true, model: model ?? undefined }
  }
  catch {
    return { bound: true, model: undefined }
  }
}
