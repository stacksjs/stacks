/**
 * Entry compiled by compiled-binary-routes.test.ts.
 *
 * Asks the loader for a route file the way a userland desktop launcher would
 * if it booted the app in-process, and prints what came back.
 *
 * Behind `import.meta.main` for the reason the sibling fixtures are: `bun test
 * <dir>` loads every `.ts` under the directory, and registering a route table
 * into the router singleton at import time poisons the rest of the run.
 */

if (import.meta.main) {
  const { loadRoutes } = await import('../../src/route-loader')
  const { listRegisteredRoutes } = await import('../../src/index')

  let error: string | null = null
  try {
    // The default registry's own shape: name -> route file.
    await loadRoutes({ api: 'api' })
  }
  catch (err) {
    error = err instanceof Error ? err.message : String(err)
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ routeCount: listRegisteredRoutes().length, error }))
}
