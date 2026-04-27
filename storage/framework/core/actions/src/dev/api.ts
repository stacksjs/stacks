import { existsSync } from 'node:fs'
import { parseOptions } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { cors, route } from '@stacksjs/router'
import { generateAutoImportFiles, injectGlobalAutoImports } from '@stacksjs/server'

const _options = parseOptions()
const port = config.ports?.api || 3008

// Regenerate the model + function auto-import manifest ONLY when missing —
// regenerating on every boot (and thus every hot-reload cycle) triggers an
// infinite loop when a watcher is observing the auto-imports directory.
// initiateImports() handles live updates under the bundler plugin.
const modelsIndex = path.storagePath('framework/auto-imports/models.ts')
if (!existsSync(modelsIndex))
  await generateAutoImportFiles()

// Inject models + framework primitives (Action, response, schema, Auth) onto
// globalThis so user actions can use them without explicit imports, matching
// the "no imports needed" ergonomics of framework default actions.
await injectGlobalAutoImports()

// Enable CORS middleware
route.use(cors().handle.bind(cors()))

// Import routes
await route.importRoutes()

// Start server (URL shown by unified dev output). Surface EADDRINUSE with a
// clear message — without this, the process exits with a stack trace that
// mentions `bun.serve` and `os` errno, which sends users hunting for the
// wrong cause when the actual fix is "another buddy dev is still running".
try {
  await route.serve({
    port,
    hostname: '127.0.0.1',
  })
}
catch (err: any) {
  const code = err?.code || err?.errno
  if (code === 'EADDRINUSE' || String(err?.message || '').includes('EADDRINUSE')) {
    console.error(`\n[dev/api] Port ${port} is already in use. Kill the other process and re-run \`./buddy dev\`, or set PORT_API to another port.\n`)
    process.exit(1)
  }
  throw err
}
