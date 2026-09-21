/**
 * The stx server public-serving.test.ts sends its requests to, run in a
 * process of its own so the test can stop it.
 *
 * bun-plugin-stx 0.2.286's `serve()` gives its caller no way to stop it. Its
 * promise never settles, because the function ends by sleeping forever. It
 * takes no signal, returns no handle, and keeps the Bun server it creates in a
 * local variable; the only code that stops that server is a SIGTERM handler,
 * installed with `reusePort`, which then ends the process. Started inside the
 * test process, it held its port, and the file watchers it starts outside
 * production, until that process exited, which is the end of the whole
 * `bun test ./src/tests` run. In here it lasts exactly as long as this
 * process, and the test kills this process.
 *
 * Usage: bun stx-cms-server.ts <root> <port> <publicDir> <siteJson>
 *
 * The database comes from DB_CONNECTION and DB_DATABASE_PATH, which the test
 * passes explicitly: the sqlite file its own setup.ts created and filled.
 * Nothing here writes to it.
 */

import process from 'node:process'

const [root, portArg, publicDir, siteJson] = process.argv.slice(2)
const port = Number(portArg)
const dbPath = process.env.DB_DATABASE_PATH

if (!root || !Number.isInteger(port) || port <= 0 || !publicDir || !siteJson)
  throw new Error('usage: stx-cms-server.ts <root> <port> <publicDir> <siteJson>')
// Without a path the sqlite driver would fall back to the project's own
// database file, which this server has no business opening.
if (process.env.DB_CONNECTION !== 'sqlite' || !dbPath)
  throw new Error('stx-cms-server.ts needs DB_CONNECTION=sqlite and DB_DATABASE_PATH')

const site = JSON.parse(siteJson) as { id: number, name: string, subdomain: string, settings: Record<string, unknown> }

// The test holds the other end of stdin and writes nothing, so the stream ends
// only when the test process closes it, which it does by ending, however it
// ends. Stopping here then means a test process that died before its
// afterAll could kill this one does not leave the server behind.
void (async () => {
  const reader = Bun.stdin.stream().getReader()
  while (!(await reader.read()).done) {
    // Nothing is sent; this only waits for the end.
  }
  process.exit(0)
})()

// Views, block partials and the page template all resolve against the working
// directory, which for a real server is the project root.
process.chdir(root)

// The same pin setup.ts applies in the test process: let the async config load
// finish, then point the shared `db` at the test's sqlite file.
const { ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'testing' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database: dbPath, prefix: '' } },
  },
})

const { registerDefaultBlocks } = await import('../../blocks/defaults')
const { cmsPageFallback } = await import('../../public/fallback')
registerDefaultBlocks()

const { serve } = await import('bun-plugin-stx/serve')
await serve({
  patterns: ['resources/views/**/*.stx'],
  port,
  // Fail on a taken port rather than move to the next one, where the test
  // would not be looking.
  autoIncrementPort: false,
  publicDir,
  quiet: true,
  // The CMS step of both stx servers' `onResponse` (actions/src/dev/views.ts
  // and buddy/src/production-server.ts): on a 404, and only then, ask the CMS.
  // Theirs resolve the site from the Host header through
  // `cmsNotFoundFallback`, which ends in this same `cmsPageFallback`; this
  // one is handed the site. Their security headers and CSRF cookie are
  // left out.
  onResponse: async (req: Request, response: Response) => {
    if (response.status !== 404)
      return undefined
    return await cmsPageFallback(req, site) ?? undefined
  },
})
