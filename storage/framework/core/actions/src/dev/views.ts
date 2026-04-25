import { config } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'

/**
 * Boot the views/SSR dev server.
 *
 * If the project ships its own `serve.ts` we hand off to it (escape
 * hatch for custom needs). Otherwise we start the default stx serve
 * with sensible Stacks-aware options — including a server-side auth
 * gate that honours `definePageMeta({ middleware: ['auth'] })` on each
 * page so projects don't need a custom serve wrapper just to keep
 * /trips, /favorites, /host/* etc. behind a session.
 */
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
  let serve: any
  // Prefer the project-vendored pantry copy so framework patches and
  // bug fixes shipped via `cp` (or `pantry/install`) take effect even
  // when the global Bun install cache has an older `bun-plugin-stx`.
  try {
    ;({ serve } = await import(projectPath('pantry/bun-plugin-stx/dist/serve.js')))
  }
  catch {
    ;({ serve } = await import('bun-plugin-stx/serve'))
  }

  const userViewsPath = 'resources/views'
  const defaultViewsPath = 'storage/framework/defaults/resources/views'
  const userLayoutsPath = 'resources/layouts'
  const defaultLayoutsPath = 'storage/framework/defaults/resources/layouts'
  const userComponentsPath = 'resources/components'
  const preferredPort = Number(process.env.PORT) || 3000

  // Cookie name the SPA writes when a user logs in. Defaults to whatever
  // `config.auth.defaultTokenName` is set to, falling back to `auth-token`.
  const authCookie = (config as any)?.auth?.defaultTokenName ?? 'auth-token'

  await serve({
    patterns: [userViewsPath, defaultViewsPath],
    port: preferredPort,
    componentsDir: 'storage/framework/defaults/resources/components/Dashboard',
    layoutsDir: userLayoutsPath,
    partialsDir: userComponentsPath,
    fallbackLayoutsDir: defaultLayoutsPath,
    fallbackPartialsDir: defaultViewsPath,
    quiet: true,
    auth: {
      cookieName: authCookie,
      redirectTo: '/login',
    },
  } as any)
}
