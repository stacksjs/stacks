import { projectPath } from '@stacksjs/path'

const port = Number(process.env.PORT_DOCS) || 3006

// `@stacksjs/bunpress`'s dist bundles an older `@stacksjs/clarity` that has a
// top-level `await loadConfig()`. When that chain stalls (or `bunfig` reads
// a slow user config file), the whole module-evaluation hangs and `dev/docs`
// never reaches its serve call, blocking dev startup. Race the import against
// a 5s timeout so the docs server fails loudly instead of silently deadlocking
// — the rest of the dev stack stays up. The proper fix is republishing
// `@stacksjs/clarity` (no TLA) and `@stacksjs/bunpress` (with the new clarity).
const importTimeout = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`@stacksjs/bunpress import timed out after ${ms}ms`)), ms),
  )

let startServer: ((opts: any) => Promise<unknown>) | undefined
try {
  ;({ startServer } = await Promise.race([
    import('@stacksjs/bunpress'),
    importTimeout(5000),
  ]) as { startServer: (opts: any) => Promise<unknown> })
}
catch (err) {
  console.warn('[dev/docs]', (err as Error).message)
  console.warn('[dev/docs] Skipping docs server. Run `./buddy dev:docs` in isolation if you need it.')
  process.exit(0)
}

await startServer!({
  port,
  root: projectPath('docs'),
  watch: true,
  quiet: true,
} as any)
