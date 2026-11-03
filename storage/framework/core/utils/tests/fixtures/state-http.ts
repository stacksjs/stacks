import assert from 'node:assert/strict'
import { startStateServer } from './state-server'
const server = await startStateServer()
try {
  async function read(path: string) {
    const response = await fetch(server.url + path)
    assert.equal(response.status, 200)
    return response.json()
  }
  for (const value of ['1.2.3 MB', '10 mystery', '1 MB junk']) {
    const response = await fetch(`${server.url}/bytes?value=${encodeURIComponent(value)}`)
    assert.equal(response.status, 422)
    assert.equal((await response.json()).error, 'Invalid byte size')
  }
  assert.deepEqual(await read('/bytes?value=1.5%20KiB'), { bytes: 1536 })
  assert.deepEqual(await read('/snapshot'), { serialized: '{"first":{"id":1},"second":{"id":1}}' })
  const cache = await read('/cache')
  assert(Object.hasOwn(cache, '__proto__'))
  assert.deepEqual(cache.__proto__, { value: 1 })
  assert.deepEqual(await read('/move'), { contents: 'important' })
  for (const path of ['/feed', '/composite']) {
    const first = await read(path)
    assert.deepEqual(first.data, [{ id: '9007199254740993' }])
    assert.equal(first.next_cursor, path === '/feed' ? '9007199254740993' : '["a","9007199254740993"]')
    const second = await read(first.next_page_url)
    assert.deepEqual(second.data, [{ id: '9007199254740994' }])
    const third = await read(second.next_page_url)
    assert.deepEqual(third.data, [{ id: '9007199254740995' }])
    assert.equal(third.next_cursor, null)
    assert.equal(third.next_page_url, null)
    const back = await read(third.prev_page_url)
    assert.deepEqual(back.data, [{ id: '9007199254740994' }])
    const original = await read(back.prev_page_url)
    assert.deepEqual(original.data, [{ id: '9007199254740993' }])
    assert.equal(original.prev_page_url, null)
    assert.deepEqual((await read(back.next_page_url)).data, third.data)
  }
  console.log('utility state HTTP OK')
}
finally { await server.close() }
