/**
 * Subprocess fixture for granular-auth-routes.test.ts (stacksjs/stacks#2229).
 *
 * Importing a default routes file registers into the router singleton as a side
 * effect, and `bun test` shares one process across files — so to see what ONE
 * file registers in isolation, each scenario runs this in a fresh subprocess
 * (`bun print-routes-for.ts <name>`) and reads back the `METHOD path` snapshot.
 *
 * Guarded by `import.meta.main` so that `bun test <dir>` — which loads every
 * `.ts` under the directory — does not run the side-effecting import and poison
 * the shared router singleton for the real test files.
 */
import process from 'node:process'

if (import.meta.main) {
  const target = process.argv[2]
  if (!target) {
    // eslint-disable-next-line no-console
    console.error('usage: bun print-routes-for.ts <auth|dashboard|...>')
    process.exit(2)
  }

  const { listRegisteredRoutes } = await import('@stacksjs/router')
  await import(`../../../../defaults/routes/${target}`)

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(listRegisteredRoutes().map(r => `${r.method} ${r.path}`)))
}
