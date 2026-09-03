import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, 'NativeAppShell.stx'), 'utf8')

describe('NativeAppShell landmarks', () => {
  it('does not introduce a main landmark around the application layout', () => {
    expect(source).not.toContain('<main class="native-app-content">')
    expect(source).toContain('<div class="native-app-content">')
  })
})
