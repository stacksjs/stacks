import { path as p } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

// we need this proxied by vite
await runCommand(`bunx --bun vite --config ${p.vitePath('src/api.ts')}`, {
  // ...options,
  cwd: p.frameworkPath(),
})
