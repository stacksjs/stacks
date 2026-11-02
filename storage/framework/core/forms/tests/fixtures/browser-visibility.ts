import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { compileTemplate, hydrateTemplateStream, getServeClientAsset } from '@stacksjs/stx'
import { launch, waitFor } from '@stacksjs/testing/browser'
import { field, form } from './definitions'

const source = resolve(import.meta.dir, '../../../../defaults/resources/views/cms/blocks/form.stx')
const definition = form([
  field('kind', 'select', { options: { choices: [{ label: 'Personal', value: 'personal' }, { label: 'Business', value: 'business' }] } }),
  field('company', 'text', { conditions: { action: 'show', logic: 'all', rules: [{ field: 'kind', op: 'eq', value: 'business' }] } }),
  field('tax', 'text', { conditions: { action: 'hide', logic: 'all', rules: [{ field: 'company', op: 'eq', value: 'exempt' }] } }),
])
const directory = await mkdtemp(join(tmpdir(), 'stacks-form-browser-'))
const page = join(directory, 'form.stx')
// Supply the CMS block's prop without booting an unrelated CMS page or database.
await Bun.write(page, (await Bun.file(source).text()).replaceAll('{{ props.formUuid }}', 'browser-audit'))
const compiled = await compileTemplate(page, '/forms/browser-audit')
const rendered = await hydrateTemplateStream(compiled, { props: { formUuid: 'browser-audit' } })
const runtime = await getServeClientAsset('runtime')
const requests: string[] = []
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
  requests.push(new URL(request.url).pathname)
  if (new URL(request.url).pathname.startsWith('/__stx/runtime.')) return new Response(runtime.content, { headers: { 'content-type': 'application/javascript' } })
  if (new URL(request.url).pathname === '/api/forms/browser-audit') return Response.json(definition)
  return new Response(`<!doctype html><html><head><meta charset="UTF-8"></head><body>${rendered.html}</body></html>`, { headers: { 'content-type': 'text/html' } })
} })
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  browser = await launch()
  const { cdp } = browser
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/forms/browser-audit` })
  await waitFor(() => cdp.evaluate('document.querySelectorAll("select").length === 1'), 12_000, { label: 'form fields to hydrate' })
  const labels = () => cdp.evaluate<string[]>('Array.from(document.querySelectorAll("label")).filter(label => label.getBoundingClientRect().height > 0).map(label => label.textContent.trim())')
  assert((await labels()).some(label => label.startsWith('tax')))
  await cdp.evaluate('(() => { const select = document.querySelector("select"); select.focus(); select.value = "business"; select.dispatchEvent(new Event("change", {bubbles:true})); return true })()')
  await waitFor(async () => (await labels()).some(label => label.startsWith('company')), 3000)
  assert.equal(await cdp.evaluate('document.querySelector("select").value'), 'business')
  assert.equal(await cdp.evaluate('document.activeElement === document.querySelector("select")'), true)
  await cdp.evaluate('(() => { const input = Array.from(document.querySelectorAll("input")).find(input => input.getBoundingClientRect().height > 0 && input.type === "text"); input.value = "exempt"; input.dispatchEvent(new Event("input", {bubbles:true})); return true })()')
  await waitFor(async () => !(await labels()).some(label => label.startsWith('tax')), 3000)
  await cdp.evaluate('(() => { const select = document.querySelector("select"); select.value = "personal"; select.dispatchEvent(new Event("change", {bubbles:true})); return true })()')
  await waitFor(async () => (await labels()).some(label => label.startsWith('tax')) && !(await labels()).some(label => label.startsWith('company')), 3000)
  assert.deepEqual(cdp.errors, [])
  console.log('browser visibility OK')
}
catch (error) {
  console.error(JSON.stringify({ error: String(error), browserErrors: browser?.cdp.errors, requests }))
  throw error
}
finally { await browser?.close(); server.stop(true); await rm(directory, { recursive: true, force: true }) }
