import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { androidIconTable, writeAndroidIconTable } from '../src/build/android-icons'

let root = ''
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = ''
})

function app(icons: Record<string, { body: string }>, aliases: Record<string, { parent: string }> = {}): string {
  root = mkdtempSync(join(tmpdir(), 'stacks-android-icons-'))
  writeFileSync(join(root, 'package.json'), '{"name":"app"}')
  const lucide = join(root, 'node_modules/@iconify-json/lucide')
  mkdirSync(lucide, { recursive: true })
  writeFileSync(join(lucide, 'package.json'), '{"name":"@iconify-json/lucide","exports":{"./icons.json":"./icons.json"}}')
  writeFileSync(join(lucide, 'icons.json'), JSON.stringify({ prefix: 'lucide', width: 24, height: 24, icons, aliases }))
  return root
}

describe('Android icon table', () => {
  it('keys the web\'s Lucide icons by name and by the SF Symbol stx maps them to', () => {
    const dir = app({ 'sun': { body: '<circle cx="12" cy="12" r="4"/>' }, 'calendar': { body: '<rect width="18" height="18" x="3" y="4" rx="2"/>' } }, { 'calendar-days': { parent: 'calendar' } })
    const table = androidIconTable(dir, { 'sun': 'sun.max', 'calendar': 'calendar', 'calendar-days': 'calendar', 'missing': 'questionmark' })!
    expect(table.viewBox).toBe(24)
    expect(table.icons.sun).toContain('circle')
    expect(table.icons['sun.max']).toBe(table.icons.sun)
    // An alias draws its parent; the first icon for a symbol stands for it.
    expect(table.icons['calendar-days']).toBe(table.icons.calendar)
    expect(table.icons.calendar).toContain('rect')
    expect(table.icons.missing).toBeUndefined()
    expect(table.icons.questionmark).toBeUndefined()
    const file = writeAndroidIconTable(dir, dir, { sun: 'sun.max' })!
    expect(JSON.parse(readFileSync(file, 'utf8')).icons['sun.max']).toContain('circle')
  })

  it('has no table for an app without Lucide', () => {
    root = mkdtempSync(join(tmpdir(), 'stacks-android-icons-'))
    writeFileSync(join(root, 'package.json'), '{"name":"app"}')
    expect(androidIconTable(root, { sun: 'sun.max' })).toBeNull()
    expect(writeAndroidIconTable(root, root, { sun: 'sun.max' })).toBeNull()
  })
})
