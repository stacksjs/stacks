import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { watch } from 'node:fs'
import { compiler } from '@stacksjs/stx/precompiler'

const root = fileURLToPath(new URL('.', import.meta.url))
const templatePath = fileURLToPath(new URL('./resources/views/welcome.stx', import.meta.url))
const stylePath = fileURLToPath(new URL('./resources/css/app.css', import.meta.url))
const port = Number(process.env.PORT || 3000)
const clients = new Set()

export const context = {
  framework: 'Stacks',
  heading: 'Build from the browser',
  message: 'Edit resources/views/welcome.stx and save to see stx recompile instantly.',
}

export async function renderTemplate(source, values = context) {
  const result = compiler.compile(source, {
    filename: 'resources/views/welcome.stx',
    mode: 'ssr',
    module: 'esm',
    sourceMaps: false,
    dev: true,
  })
  const encoded = Buffer.from(`${result.code}\n//# sourceURL=welcome-${Date.now()}.mjs`).toString('base64')
  const module = await import(`data:text/javascript;base64,${encoded}`)
  return module.render(values)
}

export async function renderPage() {
  const [source, css] = await Promise.all([
    readFile(templatePath, 'utf8'),
    readFile(stylePath, 'utf8'),
  ])
  const content = await renderTemplate(source)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Stacks on StackBlitz</title>
    <style>${css}</style>
  </head>
  <body>
    ${content}
    <script>new EventSource('/__stacks_reload').onmessage = () => location.reload()</script>
  </body>
</html>`
}

function errorPage(error) {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  return `<!doctype html><meta charset="utf-8"><title>stx compile error</title><pre>${escapeHtml(message)}</pre>`
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function createStackBlitzServer() {
  return createServer(async (request, response) => {
    if (request.url === '/__stacks_reload') {
      response.writeHead(200, {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'text/event-stream',
      })
      response.write(': connected\n\n')
      clients.add(response)
      request.on('close', () => clients.delete(response))
      return
    }

    try {
      const html = await renderPage()
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(html)
    }
    catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      response.end(errorPage(error))
    }
  })
}

function notifyClients() {
  for (const client of clients)
    client.write('data: reload\n\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file://${process.argv[1]}`))) {
  const server = createStackBlitzServer()
  server.listen(port, '0.0.0.0', () => {
    console.log(`Stacks StackBlitz starter running at http://localhost:${port}`)
  })

  for (const file of [templatePath, stylePath])
    watch(file, { persistent: false }, notifyClients)
}
