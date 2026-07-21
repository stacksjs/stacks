import assert from 'node:assert/strict'
import test from 'node:test'
import { context, renderPage, renderTemplate } from './server.mjs'

test('compiles stx expressions with the first-party compiler', async () => {
  assert.equal(await renderTemplate('<h1>{{ heading }}</h1>'), `<h1>${context.heading}</h1>`)
})

test('renders a complete StackBlitz preview', async () => {
  const page = await renderPage()
  assert.match(page, /Build from the browser/)
  assert.match(page, /__stacks_reload/)
  assert.match(page, /Stacks on StackBlitz/)
})
