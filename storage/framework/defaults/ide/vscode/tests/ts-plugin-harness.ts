/**
 * Loading the stx TypeScript server plugin the way tsserver loads it, for the
 * tests that check the built extension and the packaged VSIX.
 */
import { expect } from 'bun:test'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

/**
 * `require()` the plugin by name from `<extensionRoot>/node_modules` (VS Code
 * passes the extension root as the probe location) and take `module.exports`
 * as the factory, unwrapped, as tsserver does.
 */
export function loadLikeTsserver(extensionRoot: string, name: string): unknown {
  return createRequire(join(extensionRoot, 'node_modules', 'index.js'))(name)
}

/**
 * Create the plugin on a stub language service and read the buffer it serves
 * for a `.stx` file: line 1 references the declaration files the plugin found,
 * which it can only find when the package tells it where they are (Bun inlines
 * `__dirname` into the bundle at build time).
 */
export function expectDeclarationsFound(extensionRoot: string, name: string, typesDir: string): void {
  const factory = loadLikeTsserver(extensionRoot, name) as (modules: { typescript: unknown }) => { create: (info: unknown) => unknown }
  expect(typeof factory).toBe('function')

  const text = '<script client>\nconst n = state(0)\n</script>\n'
  const snapshot = (value: string) => ({ getText: (start: number, end: number) => value.slice(start, end), getLength: () => value.length, getChangeRange: () => undefined })
  const host: Record<string, any> = { getScriptSnapshot: () => snapshot(text), getScriptVersion: () => '1' }
  factory({ typescript: { ScriptSnapshot: { fromString: snapshot } } })
    .create({ languageService: {}, languageServiceHost: host, project: { projectService: { logger: { info: () => {} } } } })

  const buffer = host.getScriptSnapshot('/tmp/page.stx')
  const referenced = /^\/\/\/ <reference path="(.+)" \/>$/.exec(buffer.getText(0, buffer.getLength()).split('\n')[0])?.[1]
  expect(referenced).toBe(join(typesDir, 'stx-module.d.ts'))
  expect(existsSync(join(typesDir, 'stx.d.ts'))).toBeTrue()
}
