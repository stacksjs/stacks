// The name-addressed registries, derived rather than generated.
//
// Actions, listeners, policies, middleware and jobs are all resolved by NAME at
// runtime - out of a route string, an `app/Events.ts` entry, an `app/Gates.ts`
// mapping, a `.middleware(...)` call, a `job(...)` dispatch. Every one of those
// names used to be `string` to the compiler, and the fix for that used to be
// `storage/framework/types/actions.d.ts`: 1500 lines of hand-generated unions
// that were correct only until somebody added a file without re-running
// `buddy generate:types`.
//
// Nothing is generated for the types now. Each registry is a lazy map the
// RESOLVER reads - `storage/framework/auto-imports/*.ts`, written by
// `generateAutoImportFiles()` for the runtime - and the type is `keyof` over
// the same object. A name that type-checks is a name that resolves, because
// there is only one list.
//
// Every registry falls back to "any string" when its barrel is missing, so a
// project that has not run `buddy generate` yet compiles exactly as before.

/** Every action, by the path a route string names it with. */
type Actions = typeof import('../auto-imports/actions')['actions']

/** Every listener module under `app/Listeners/`, and the defaults behind it. */
type Listeners = typeof import('../auto-imports/listeners')['listeners']

/** Every policy class under `app/Policies/`, and the defaults behind it. */
type Policies = typeof import('../auto-imports/policies')['policies']

/** Every middleware class under `app/Middleware/`, and the defaults behind it. */
type Middlewares = typeof import('../auto-imports/middleware')['middleware']

/** Every email template under `resources/emails/`, and the defaults behind it. */
type EmailTemplates = typeof import('../auto-imports/emails')['emails']

/** Every job, by the name `resolveJobFile` finds it under. */
type JobRegistry = typeof import('../auto-imports/jobs')
type Jobs = JobRegistry

/** The application's middleware alias map, and the framework's behind it. */
type AppAliases = typeof import('../../../app/Middleware')['default']
type DefaultAliases = typeof import('../defaults/app/Middleware')['default']

type ActionName = keyof Actions & string
type ListenerModuleName = keyof Listeners & string
type PolicyClassName = keyof Policies & string
type MiddlewareClassName = keyof Middlewares & string
type JobName = keyof Jobs & string
type EmailTemplateName = keyof EmailTemplates & string

/**
 * `'Actions/Auth/LoginAction'` → `'Auth/LoginAction'`.
 *
 * A generic, so the conditional distributes over the union. A conditional whose
 * checked type is a union ALIAS rather than a naked type parameter does not
 * distribute, and would collapse the whole set to `never`.
 */
type WithoutActionsPrefix<T> = T extends `Actions/${infer TRest}` ? TRest : never

/**
 * What `app/Events.ts` may name against an event: a listener module, or an
 * action by the name `resolveListener` joins back on (no `Actions/` prefix).
 */
type EventListenerName = ListenerModuleName | WithoutActionsPrefix<ActionName>

/**
 * A middleware reference, in every form the resolver reads.
 *
 * The aliases come from the alias maps themselves - they are ordinary modules,
 * and `defineMiddleware` keeps their literal keys - so there is nothing to
 * generate for them either. Class names are included because they resolve:
 * an unaliased middleware is reached by name through `toPascalCase`.
 */
type MiddlewareAliasName = (keyof DefaultAliases | keyof AppAliases) & string
type MiddlewareReferenceName = MiddlewareAliasName | MiddlewareClassName

/**
 * Every named route, and the path it resolves to.
 *
 * The one name here that is not read off the filesystem: a route name is
 * produced by running code, so `buddy generate:types` loads the route table and
 * writes the answer as a runtime map. Read here the same way as the others.
 */
type NamedRoutes = typeof import('../auto-imports/routes')['routeNames']

declare module '@stacksjs/bun-router' {
  interface RouterTypeRegistry {
    actions: ActionName | `${string}Controller@${string}`
    middleware: MiddlewareReferenceName | `!${MiddlewareReferenceName}`
    routes: NamedRoutes
  }
}

declare module '@stacksjs/router' {
  interface MiddlewareClasses extends Record<MiddlewareClassName, true> {}
}

declare module '@stacksjs/events' {
  interface EventListeners extends Record<EventListenerName, true> {}
}

declare module '@stacksjs/auth' {
  interface PolicyClasses extends Record<PolicyClassName, true> {}
}

declare module '@stacksjs/email' {
  interface EmailTemplates extends Record<EmailTemplateName, true> {}
}

declare module '@stacksjs/queue' {
  /*
   * The job MODULES, not `Record<JobName, true>`.
   *
   * The names are the same either way - `JobName` is `keyof` this - but the
   * value carries the `Job<Payload>` instance, so dispatching by name can be
   * checked against the payload its handler declares. Mapped to `true`, the
   * registry knew a job existed and nothing about how to call it, and
   * `job('SendWelcomeEmail', { emial: … })` was accepted.
   *
   * Free here: the jobs auto-import is a real re-export barrel rather than a
   * name-to-path map, so `JobName` already resolves these modules.
   */
  interface Jobs extends JobRegistry {}
}

declare module '@stacksjs/actions' {
  interface RunnableActions extends Record<ActionName, true> {}
}

declare module '@stacksjs/scheduler' {
  interface SchedulableJobs extends Record<JobName, true> {}
  interface SchedulableActions extends Record<ActionName, true> {}
}

export {}
