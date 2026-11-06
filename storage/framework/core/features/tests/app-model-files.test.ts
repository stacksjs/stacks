import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appModelFiles } from '../src/index'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('nested feature scaffolding stays excluded until customized', () => {
  const root = mkdtempSync(join(tmpdir(), 'app-model-files-'))
  roots.push(root)
  const templates = join(root, 'templates')
  const rel = 'app/Models/commerce/Order.ts'
  mkdirSync(join(root, 'app/Models/commerce'), { recursive: true })
  mkdirSync(join(templates, 'app/Models/commerce'), { recursive: true })
  const original = "export default { table: 'orders' }\n"
  writeFileSync(join(root, rel), original)
  writeFileSync(join(templates, rel), original)
  expect(appModelFiles(root, templates)).toEqual([])
  writeFileSync(join(root, rel), `${original}// app customization\n`)
  expect(appModelFiles(root, templates)).toEqual([join(root, rel)])
})

test('a nested app model is owned even when its contents match an unrelated default', () => {
  const root = mkdtempSync(join(tmpdir(), 'app-model-files-'))
  roots.push(root)
  const templates = join(root, 'templates')
  const rel = 'app/Models/Training/Session.ts'
  for (const directory of [root, templates]) {
    mkdirSync(join(directory, 'app/Models/Training'), { recursive: true })
    writeFileSync(join(directory, rel), "export default { table: 'sessions' }\n")
  }
  expect(appModelFiles(root, templates)).toEqual([join(root, rel)])
})
