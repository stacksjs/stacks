/**
 * Subprocess fixture for dashboard-api-guard.test.ts.
 *
 * `guard()` in defaults/routes/dashboard-api.ts decides at module-import time
 * whether to attach `auth` + `role:admin`, and bun caches modules per process,
 * so each environment scenario needs a fresh one. Prints `METHOD path` with the
 * middleware each route ended up with, which is the only way to see the gate:
 * a guarded and an unguarded route have identical paths.
 *
 * Behind `import.meta.main` and dynamically imported for the same reason as
 * print-dashboard-routes.ts: `bun test <dir>` loads every .ts file under the
 * directory, and registering the dashboard table into the router singleton at
 * import time poisons the rest of the run.
 */

if (import.meta.main) {
  const { listRegisteredRoutes } = await import('@stacksjs/router')
  await import('../../../../defaults/routes/dashboard-api')

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(listRegisteredRoutes().map(r => ({ route: `${r.method} ${r.path}`, middleware: r.middleware ?? [] }))))
}
