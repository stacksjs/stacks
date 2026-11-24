import { join } from 'node:path'

export function dashboardThemeAssetRoutes(defaultsRoot: string): Record<string, (request: Request) => Response | Promise<Response>> {
  let script: Promise<string> | undefined

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

  return {
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
