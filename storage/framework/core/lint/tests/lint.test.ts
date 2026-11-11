import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defaultConfig, formatCode } from '../src'

describe('@stacksjs/lint', () => {
  it('retains default and namespace type bindings through the public formatter', () => {
    const source = `import type Emitter from 'node:events'
import type * as Events from 'node:events'

export type Emitters = [Emitter, Events.EventEmitter]
`
    const formatted = formatCode(source, defaultConfig, 'emitters.ts')
    expect(formatted).toContain("import type Emitter from 'node:events'")
    expect(formatted).toContain("import type * as Events from 'node:events'")
    expect(formatCode(formatted, defaultConfig, 'emitters.ts')).toBe(formatted)
  })

  it('keeps independent runtime bindings from one module', async () => {
    const source = `import First from 'node:events'
import Second from 'node:events'
import * as Events from 'node:events'
import { EventEmitter } from 'node:events'

export const sameEmitter = First === Second && First === Events.EventEmitter && EventEmitter === Events.EventEmitter
`
    const formatted = formatCode(source, defaultConfig, 'emitters.ts')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-lint-imports-'))
    try {
      const file = join(directory, 'emitters.mjs')
      await writeFile(file, formatted)
      const module = await import(pathToFileURL(file).href)
      expect(module.sameEmitter).toBe(true)
      expect(formatCode(formatted, defaultConfig, 'emitters.ts')).toBe(formatted)
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
