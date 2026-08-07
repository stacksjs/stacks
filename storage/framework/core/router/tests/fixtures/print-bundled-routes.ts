/**
 * Subprocess fixture for default-route-bundles.test.ts (#2229).
 *
 * Bundle selection is read once per process and bootstrap.ts registers into
 * the router singleton as an import side effect, so each STACKS_DEFAULT_ROUTES
 * scenario needs a fresh process. Goes through `route.importRoutes()` rather
 * than importing a routes file directly, because the gate under test lives in
 * the loader and the mounting lives in bootstrap.
 *
 * Behind `import.meta.main` and using dynamic imports for the same reason the
 * sibling print-dashboard-routes.ts fixture is: `bun test <dir>` loads every
 * `.ts` file under the directory, and registering the framework route table
 * into the shared singleton poisons every other file in the run.
 */

if (import.meta.main) {
  const { listRegisteredRoutes, route } = await import('@stacksjs/router')
  await route.importRoutes()

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(listRegisteredRoutes().map(r => `${r.method} ${r.path}`)))
}
