import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function dashboardAssetRoutes(defaultsRoot: string, projectRoot: string): Record<string, (request: Request) => Response | Promise<Response>> {
  let script: Promise<string> | undefined
  let iconCss: Promise<string> | undefined

  async function bundleBootstrap(): Promise<string> {
    const result = await Bun.build({
      entrypoints: [join(defaultsRoot, 'views/dashboard/composables/dashboard-theme-bootstrap.ts')],
      target: 'browser',
      format: 'iife',
      minify: true,
    })
    const output = result.outputs[0]
    if (!result.success || !output)
      throw new Error('Could not build the dashboard theme bootstrap.')
    return output.text()
  }

  // Dynamic Iconify bindings need a stylesheet that includes framework and
  // userland navigation icons before the client renders the link cards.
  async function buildIconCss(): Promise<string> {
    const { generateCss } = await import('@stacksjs/stx')
    const dirs = [
      join(defaultsRoot, 'views/dashboard'),
      join(projectRoot, 'resources/views/dashboard'),
      join(defaultsRoot, 'resources/components/Dashboard'),
      join(projectRoot, 'resources/components/Dashboard'),
      join(projectRoot, 'app/Models'),
      join(defaultsRoot, 'app/Models'),
      join(defaultsRoot, 'functions'),
      join(defaultsRoot, 'resources/functions'),
      join(projectRoot, 'config'),
    ]
    const icons = new Set<string>()
    const glob = new Bun.Glob('**/*.{stx,ts}')
    for (const dir of dirs) {
      if (!existsSync(dir))
        continue
      for await (const file of glob.scan({ cwd: dir, absolute: true })) {
        const text = await Bun.file(file).text()
        for (const match of text.matchAll(/\bi-[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g))
          icons.add(match[0])
      }
    }
    return icons.size ? generateCss(`<div class="${[...icons].join(' ')}"></div>`, projectRoot) : ''
  }

  return {
    '/__deps/dashboard-icons.css': async () => {
      iconCss ??= buildIconCss()
      try {
        return new Response(await iconCss, {
          headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache' },
        })
      }
      catch (error) {
        iconCss = undefined
        throw error
      }
    },
    '/__deps/dashboard-theme.js': async () => {
      script ??= bundleBootstrap()
      try {
        return new Response(await script, {
          headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' },
        })
      }
      catch (error) {
        script = undefined
        throw error
      }
    },
    '/__deps/dashboard-theme.css': () => new Response(Bun.file(join(defaultsRoot, 'styles/dashboard-theme.css')), {
      headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'no-cache' },
    }),
  }
}
