import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const routeRoot = resolve('storage/framework/defaults/views/dashboard')

function routeFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...routeFiles(path))
    else if (path.endsWith('.stx'))
      files.push(path)
  }

  return files
}

describe('dashboard view componentization', () => {
  test('keeps every dashboard route as a thin component mount', () => {
    const routes = routeFiles(routeRoot)
      .filter(path => !path.includes('/layouts/'))
    const failures: string[] = []

    for (const path of routes) {
      const source = readFileSync(path, 'utf8')
      const route = relative(routeRoot, path)
      const lineCount = source.trimEnd().split('\n').length
      const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g)]
        .map(match => match[0])

      if (lineCount > 20)
        failures.push(`${route}: ${lineCount} lines`)
      if (!/<[A-Z][A-Za-z0-9]*\b/.test(source))
        failures.push(`${route}: no component mount`)

      if (route === '[...all].stx') {
        if (scripts.length !== 1 || !scripts[0].includes('definePageMeta({ status: 404 })'))
          failures.push(`${route}: missing native 404 page metadata`)
      }
      else if (scripts.length > 0) {
        failures.push(`${route}: owns route script`)
      }
    }

    expect(routes.length).toBeGreaterThan(100)
    expect(failures).toEqual([])
  })
})
