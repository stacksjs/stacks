/**
 * Subprocess fixture for dashboard-access.test.ts (stacksjs/stacks#2883).
 *
 * Prints `METHOD path` with the middleware each route in
 * `defaults/routes/dashboard.ts` ended up with. The middleware is the half
 * that cannot be inferred from the paths: a guarded and an unguarded route are
 * the same string, so a group's gate is invisible until it is printed beside
 * the routes it guards.
 *
 * A sibling of print-dashboard-routes.ts rather than a flag on it, so that
 * fixture's output stays byte-identical for `dev-only-default-routes.test.ts`,
 * which matches its entries exactly.
 *
 * Behind `import.meta.main` and dynamically imported for the reason spelled
 * out in that sibling: `bun test <dir>` loads every `.ts` file under the
 * directory, and registering this route table into the router singleton at
 * import time hung 77 tests in this suite.
 */

if (import.meta.main) {
  const { listRegisteredRoutes } = await import('@stacksjs/router')
  await import('../../../../defaults/routes/dashboard')

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(listRegisteredRoutes().map(entry => ({
    route: `${entry.method} ${entry.path}`,
    middleware: entry.middleware ?? [],
  }))))
}
