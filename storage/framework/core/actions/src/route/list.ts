/**
 * route:list — print every registered HTTP route in the project.
 *
 * Loads user routes (app/Routes.ts → routes/*.ts) plus framework defaults,
 * then formats them as a table grouped by HTTP method. The router exposes the
 * registered route list via `route.routes`; we drive this directly so the CLI
 * stays in sync with whatever the live server would serve.
 */

import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { route } from '@stacksjs/router'

interface RouteRow {
  method: string
  uri: string
  handler: string
  name: string
  middleware: string
}

const METHOD_ORDER = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

function formatHandler(handler: unknown): string {
  if (typeof handler === 'string') return handler
  if (typeof handler === 'function') return handler.name ? `[fn ${handler.name}]` : '[fn]'
  return '[handler]'
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value
  return value + ' '.repeat(width - value.length)
}

function write(line: string): void {
  process.stdout.write(`${line}\n`)
}

async function listRoutes(): Promise<{ isErr?: boolean, error?: unknown }> {
  try {
    await route.importRoutes()
  }
  catch (error) {
    return { isErr: true, error }
  }

  const registered = route.routes ?? []

  if (registered.length === 0) {
    write(italic('No routes registered.'))
    return {}
  }

  const rows: RouteRow[] = registered.map((r: any) => ({
    method: String(r.method || 'GET').toUpperCase(),
    uri: String(r.path || r.uri || ''),
    handler: formatHandler(r.handler ?? r.action ?? ''),
    name: String(r.name || ''),
    middleware: Array.isArray(r.middleware) ? r.middleware.join(',') : String(r.middleware || ''),
  }))

  rows.sort((a, b) => {
    const ai = METHOD_ORDER.indexOf(a.method)
    const bi = METHOD_ORDER.indexOf(b.method)
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    return a.uri.localeCompare(b.uri)
  })

  const widths = {
    method: Math.max(6, ...rows.map(r => r.method.length)),
    uri: Math.max(3, ...rows.map(r => r.uri.length)),
    handler: Math.max(7, ...rows.map(r => r.handler.length)),
    name: Math.max(4, ...rows.map(r => r.name.length)),
  }

  const header = [
    pad('METHOD', widths.method),
    pad('URI', widths.uri),
    pad('HANDLER', widths.handler),
    pad('NAME', widths.name),
    'MIDDLEWARE',
  ].join('  ')

  write('')
  write(header)
  write('-'.repeat(header.length))

  for (const r of rows) {
    write([
      pad(r.method, widths.method),
      pad(r.uri, widths.uri),
      pad(r.handler, widths.handler),
      pad(r.name || '-', widths.name),
      r.middleware || '-',
    ].join('  '))
  }

  write('')
  write(italic(`${rows.length} route${rows.length === 1 ? '' : 's'} registered.`))
  return {}
}

const result = await listRoutes()

if (result?.isErr) {
  console.error(result.error)
  log.error('Route lists failed', result.error)
  process.exit(1)
}

process.exit(0)
