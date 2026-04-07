import { projectPath } from '@stacksjs/path'

// Check if the project has its own serve.ts — if so, use it directly.
// This allows projects to define their own API routes, middleware, and config
// while still using the stx dev server under the hood.
const projectServe = projectPath('serve.ts')

try {
  const file = Bun.file(projectServe)
  if (await file.exists()) {
    await import(projectServe)
  }
  else {
    await startDefaultServer()
  }
}
catch {
  await startDefaultServer()
}

async function startDefaultServer() {
  // Try standard resolution first, then fall back to pantry path
  let serve: any
  try {
    ;({ serve } = await import('bun-plugin-stx/serve'))
  }
  catch {
    ;({ serve } = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js')))
  }

  // Run stx dev server for resources/views
  const userViewsPath = 'resources/views'
  const defaultViewsPath = 'storage/framework/defaults/resources/views'
  const userLayoutsPath = 'resources/layouts'
  const defaultLayoutsPath = 'storage/framework/defaults/resources/layouts'
  const userComponentsPath = 'resources/components'
  const preferredPort = Number(process.env.PORT) || 3000

  await serve({
    patterns: [userViewsPath, defaultViewsPath],
    port: preferredPort,
    componentsDir: 'storage/framework/defaults/resources/components/Dashboard',
    layoutsDir: userLayoutsPath,
    partialsDir: userComponentsPath,
    fallbackLayoutsDir: defaultLayoutsPath,
    fallbackPartialsDir: defaultViewsPath,
    quiet: true,
  })
}
