import { afterEach, expect, spyOn, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config, releaseOrm, setConfig } from '@stacksjs/query-builder'
import { schema } from '@stacksjs/validation/runtime'
import { defineModel, MODEL_DEFINITION } from '../src/define-model'
import { createNativeModelApi, openNativeDatabase } from '../src/native'

const roots: string[] = []
const handles: Database[] = []
afterEach(() => {
  releaseOrm()
  for (const db of handles.splice(0)) db.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
const makeModel = (extra = {}) => defineModel({
  name: 'NativeNote', table: 'native_notes',
  traits: { useApi: { uri: 'notes', middleware: [], routes: ['index', 'show', 'store', 'update', 'destroy'] } },
  attributes: {
    title: { fillable: true, validation: { rule: schema.string().min(1).max(80).required() } },
    secret: { fillable: true, hidden: true, default: '' },
    ...extra,
  },
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-native-'))
  roots.push(root)
  return join(root, 'app.sqlite')
}
const request = (path: string, method = 'GET', body?: unknown) => new Request(`http://127.0.0.1:1234/api/notes${path}`, {
  method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
})

test('native model CRUD validates, filters mass assignment, hides secrets and persists across restart', async () => {
  const Note = makeModel()
  const path = fixture()
  const db = openNativeDatabase({ path, models: { Note } })
  const api = createNativeModelApi({ models: { Note }, authorize: () => true })
  expect((await api(request('', 'POST', { title: '' })))?.status).toBe(422)
  const created = await api(request('', 'POST', { title: 'Keep this', secret: 'private', id: 900 }))
  expect(created?.status).toBe(201)
  const result = await created!.json()
  expect(result.data.id).not.toBe(900)
  expect(result.data.secret).toBeUndefined()
  const id = result.data.id
  expect((await api(request(`/${id}`, 'PATCH', { title: 'Updated' })))?.status).toBe(200)
  releaseOrm(); db.close()
  handles.push(openNativeDatabase({ path, models: { Note } }))
  expect((await (await api(request(`/${id}`)))!.json()).data.title).toBe('Updated')
  expect((await (await api(request('')) )!.json()).data).toHaveLength(1)
  expect((await api(request(`/${id}`, 'DELETE')))?.status).toBe(204)
  expect((await api(request(`/${id}`)))?.status).toBe(404)
})

test('authorization runs before queries, even for native local reads', async () => {
  const Note = makeModel()
  const api = createNativeModelApi({ models: { Note }, authorize: () => false })
  expect((await api(request('')))?.status).toBe(403)
  expect(await api(new Request('http://127.0.0.1/api/notes-elsewhere'))).toBeNull()
})

test('additive model upgrades preserve rows and destructive upgrades roll back', async () => {
  const path = fixture()
  const Note = makeModel()
  const db = openNativeDatabase({ path, models: { Note } })
  await Note.create({ title: 'Original' })
  releaseOrm(); db.close()
  const Expanded = makeModel({ tag: { type: 'string', default: 'inbox', fillable: true } })
  const upgraded = openNativeDatabase({ path, models: { Expanded } })
  expect(upgraded.query('SELECT title, tag FROM native_notes').get()).toEqual({ title: 'Original', tag: 'inbox' })
  releaseOrm(); upgraded.close()
  expect(() => openNativeDatabase({ path, models: {} })).toThrow('destructive')
  const check = new Database(path)
  expect(check.query('SELECT title FROM native_notes').get()).toEqual({ title: 'Original' })
  check.close()
})

test('native schema upgrades keep stdout available for the backend readiness handshake', () => {
  const previous = config.verbose
  const output = spyOn(console, 'log')
  try {
    setConfig({ verbose: true })
    const path = fixture()
    const original = openNativeDatabase({ path, models: { Note: makeModel() } })
    releaseOrm(); original.close()
    handles.push(openNativeDatabase({ path, models: { Note: makeModel({ tag: { type: 'string', default: 'inbox' } }) } }))
    expect(output).not.toHaveBeenCalled()
  }
  finally { output.mockRestore(); setConfig({ verbose: previous }) }
})

test('enum rebuilds preserve data and roll back schema plus snapshot if a later index fails', async () => {
  const path = fixture()
  const initial = makeModel({ status: { required: true, fillable: true, validation: { rule: schema.enum(['one', 'two']).required() } } })
  const db = openNativeDatabase({ path, models: { Note: initial } })
  await initial.create({ title: 'Same title', status: 'one' })
  await initial.create({ title: 'Same title', status: 'two' })
  const snapshot = db.query('SELECT snapshot FROM _stacks_native_schema').get()
  releaseOrm(); db.close()
  const expanded = makeModel({ status: { required: true, fillable: true, validation: { rule: schema.enum(['one', 'two', 'three']).required() } } })
  const conflicting = defineModel({ ...expanded[MODEL_DEFINITION], indexes: [{ name: 'native_note_title_unique', columns: ['title'], unique: true }] })
  expect(() => openNativeDatabase({ path, models: { Note: conflicting } })).toThrow()
  const check = new Database(path)
  expect(check.query('SELECT snapshot FROM _stacks_native_schema').get()).toEqual(snapshot)
  expect(check.query('SELECT count(*) AS count FROM native_notes').get()).toEqual({ count: 2 })
  expect(() => check.exec("INSERT INTO native_notes (title, status) VALUES ('New', 'three')")).toThrow()
  check.close()
  const upgraded = openNativeDatabase({ path, models: { Note: expanded } })
  handles.push(upgraded)
  await expanded.create({ title: 'New', status: 'three' })
  expect(upgraded.query('SELECT count(*) AS count FROM native_notes').get()).toEqual({ count: 3 })
  expect(upgraded.query('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 })
})
