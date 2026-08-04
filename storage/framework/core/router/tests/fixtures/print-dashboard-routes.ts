/**
 * Subprocess fixture for dev-only-default-routes.test.ts (#1955).
 *
 * The /install + /test-error gate in defaults/routes/dashboard.ts is
 * evaluated at module-import time and bun caches modules per process,
 * so each APP_ENV scenario must run in a fresh process. Importing the
 * routes file registers into the router singleton as a side effect;
 * we then print a `METHOD path` snapshot as JSON on stdout.
 *
 * Everything is behind `import.meta.main`, and the imports are dynamic so the
 * guard can actually gate them, because `bun test <dir>` loads every `.ts`
 * file under the directory rather than only `*.test.ts`. Loaded that way this
 * file contributes no tests — but its import side effect still registered the
 * whole dashboard route table into the shared router singleton, which
 * poisoned every other file in the run: 77 of the router suite's tests hung
 * to their timeout, including ones that are pure synchronous assertions.
 * Running the 27 `*.test.ts` files explicitly passed; adding this one file
 * back reproduced the 77 failures exactly.
 *
 * `Bun.spawn(['bun', <this file>])` makes it the entry point, so the guard is
 * true in exactly the case it is meant to run.
 */

if (import.meta.main) {
  const { listRegisteredRoutes } = await import('@stacksjs/router')
  await import('../../../../defaults/routes/dashboard')

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(listRegisteredRoutes().map(r => `${r.method} ${r.path}`)))
}
