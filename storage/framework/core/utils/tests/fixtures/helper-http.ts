import assert from 'node:assert/strict'
import { startHelperServer } from './helper-server'
const server = startHelperServer()
try {
  const read = async (path: string) => { const response = await fetch(server.url + path); assert.equal(response.status, 200); return response.json() }
  const expected = { first: 20, second: 2, sibling: false, restored: 'original', graph: { name: 'graph', selfIsRoot: true },
    omitted: { 2: 'public' }, filtered: {}, changed: { balance: 'text' }, array: { hole: true, label: 'kept', value: 'new' } }
  assert.deepEqual(await read('/contracts'), expected)
  assert.deepEqual(await read('/contracts'), expected)
  const files = await read('/files')
  assert.deepEqual(files, { listed: ['local.txt'], external: 'external', localExists: false, config: JSON.parse('{"kept":true,"__proto__":{"flag":1},"value":2}') })
  assert.deepEqual(await read('/retry'), { attempts: 3, value: 42, invalid: true, invalidCalls: 0, delay: 2147483647, error: 'Unknown error' })
  const markdown = await fetch(server.url + '/markdown')
  assert.equal(markdown.status, 200)
  const html = await markdown.text()
  assert.match(html, /<table>/)
  assert.match(html, /a\|b<br>next/)
  console.log('helper HTTP OK')
}
finally { server.close() }
