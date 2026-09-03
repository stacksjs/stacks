import type { CLI } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { startProductionServer } from '../production-server'

export {
  loadStxPartialsDir,
  resolveUserPartialsPath,
  startProductionServer,
} from '../production-server'

export function serve(buddy: CLI): void {
  buddy
    .command('serve', 'Start the production HTTP server (STX views + /api proxy + coming-soon/maintenance gate)')
    .option('-p, --port <port>', 'Port to listen on (defaults to PORT env or 3000)')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(startProductionServer)
}

export function serveApi(buddy: CLI): void {
  buddy
    .command('serve:api', 'Start the production API server (bun-router routes the frontend proxies /api to)')
    .option('-p, --port <port>', 'Port to listen on (defaults to PORT env or 3008)')
    .action(async (options?: { port?: string | number }) => {
      if (options?.port)
        process.env.PORT = String(options.port)
      process.env.APP_ENV = process.env.APP_ENV || 'production'

      await import(resolveApiEntry())
    })
}

function resolveApiEntry(): string {
  const vendored = join(process.cwd(), 'storage/framework/core/actions/src/serve/api.ts')
  if (existsSync(vendored))
    return vendored

  return '@stacksjs/actions/serve/api'
}

export function preview(buddy: CLI): void {
  buddy
    .command('preview [dir]', 'Serve a static build locally, the way a static host would')
    .option('-p, --port <port>', 'Port to listen on', { default: '3001' })
    .example('buddy preview')
    .example('buddy preview dist --port 4000')
    .action(async (dir: string | undefined, options: { port?: string }) => {
      const root = dir || 'dist'
      const port = Number(options?.port) || 3001

      if (!existsSync(root)) {
        await log.error(`No \`${root}\` directory to preview. Run \`buddy build\` first, or pass the directory to serve.`)
        process.exit(ExitCode.FatalError)
      }

      Bun.serve({
        port,
        async fetch(req) {
          const url = new URL(req.url)
          let pathname = url.pathname

          if (pathname === '/' || pathname === '')
            pathname = '/index.html'
          else if (!pathname.includes('.'))
            pathname = `${pathname.replace(/\/$/, '')}.html`

          const file = Bun.file(join(root, pathname))
          if (await file.exists())
            return new Response(file)

          const notFound = Bun.file(join(root, '404.html'))
          if (await notFound.exists())
            return new Response(notFound, { status: 404 })

          return new Response('Not Found', { status: 404 })
        },
      })

      log.success(`Previewing ./${root} at http://localhost:${port}`)
    })
}
