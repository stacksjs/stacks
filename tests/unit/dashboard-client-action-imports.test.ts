import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * Every app/Actions module a dashboard component imports a value from builds
 * for the browser.
 *
 * Components import runtime helpers from records modules under app/Actions
 * (restaurantWaitlistTimestamp, printLogTimestamp, ...), so those modules and
 * everything they import end up in the page's browser bundle. One re-export
 * from a module that reads the database pulled `bun`'s SQL into it, and the
 * whole Restaurant Waitlist page stopped hydrating ("the page module registry
 * did not build", stacksjs/stacks#3218). Type-only imports are erased and are
 * not checked.
 */
const checkout = resolve(import.meta.dir, '../..')
const defaults = join(checkout, 'storage/framework/defaults')

function stxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      return stxFiles(path)
    return entry.name.endsWith('.stx') ? [path] : []
  })
}

/** The app/Actions modules each component imports at least one value from. */
function actionValueImports(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const imports = /^\s*import\s+(?!type\s)[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm
  for (const file of [...stxFiles(join(defaults, 'resources')), ...stxFiles(join(defaults, 'views'))]) {
    for (const script of readFileSync(file, 'utf8').matchAll(/<script\b[^>]*\bclient\b[^>]*>([\s\S]*?)<\/script>/g)) {
      for (const [, specifier] of script[1]!.matchAll(imports)) {
        if (!specifier!.startsWith('.'))
          continue
        const target = resolve(dirname(file), specifier!)
        if (!target.includes(`${join(defaults, 'app/Actions')}/`))
          continue
        const module = existsSync(target) ? target : `${target}.ts`
        found.set(module, [...(found.get(module) ?? []), relative(defaults, file)])
      }
    }
  }
  return found
}

describe('dashboard client imports from app/Actions', () => {
  const modules = actionValueImports()

  test('finds the modules components import values from', () => {
    // A scanner that found nothing would pass everything below.
    expect(modules.size).toBeGreaterThanOrEqual(5)
    expect([...modules.keys()].some(module => module.endsWith('restaurant-waitlist-records.ts'))).toBe(true)
  })

  for (const [module, components] of modules) {
    test(`${relative(defaults, module)} builds for the browser`, async () => {
      const result = await Bun.build({ entrypoints: [module], target: 'browser', throw: false })
      const reason = result.logs.map(log => String(log.message)).join('\n')
      expect(result.success, `${reason}\nimported by ${components.join(', ')}`).toBe(true)
    }, 30_000)
  }
})
