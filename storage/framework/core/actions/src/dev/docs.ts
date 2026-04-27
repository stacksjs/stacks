import { projectPath } from '@stacksjs/path'

const port = Number(process.env.PORT_DOCS) || 3006

// Pre-warm `ts-broadcasting` so the bundled clarity chain inside it gets
// initialized BEFORE `@stacksjs/bunpress` (which transitively pulls
// ts-broadcasting in through stx) starts evaluating. Without this, bunpress
// hangs on its bundled `var X=await loadConfig({ name:"clarity" })` for
// the full process lifetime and the docs server never binds. clarity@0.3.25
// removes the TLA at source — once it propagates, this preload becomes a
// no-op and can be deleted.
try {
  await import('ts-broadcasting')
}
catch {
  // optional — keep going if missing
}

// `@stacksjs/bunpress`'s dist still bundles an older `@stacksjs/clarity`
// with a top-level `await loadConfig()`. The preload above usually neutralizes
// it; race the import against a 10s timeout as a belt-and-braces guard so
// that any new clarity-style hang fails loudly instead of silently
// deadlocking the whole dev stack.
const importTimeout = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`@stacksjs/bunpress import timed out after ${ms}ms`)), ms),
  )

let startServer: ((opts: any) => Promise<unknown>) | undefined
try {
  ;({ startServer } = await Promise.race([
    import('@stacksjs/bunpress'),
    importTimeout(10000),
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
