import { describe, expect, it } from 'bun:test'
import { createStacksRouter } from '../src/stacks-router'
import { JSON_CONTENT_TYPE } from '../src/api-shape'

/**
 * Form bodies keep every value, whatever case the media type is written in.
 *
 * A key sent more than once - a multi-select, a set of checkboxes - kept only
 * its last value, while the same keys in a query string came back as arrays.
 * And `Application/X-WWW-Form-Urlencoded`, which is the same media type, left
 * the body unparsed.
 */
async function post(nativeRoutes: boolean, body: BodyInit, contentType?: string): Promise<any> {
  const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
  router.post('/form', (req: any) => ({ all: req.all() }))
  const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/form`, {
      method: 'POST',
      body,
      headers: contentType ? { 'content-type': contentType } : {},
    })
    return (await response.json()).all
  }
  finally {
    server.stop()
  }
}

describe('form bodies', () => {
  it.each([false, true])('collect a repeated urlencoded key into an array (nativeRoutes=%s)', async (nativeRoutes) => {
    const all = await post(nativeRoutes, 'tags=a&tags=b&name=x&ids[]=1&ids[]=2', 'application/x-www-form-urlencoded')
    expect(all).toEqual({ 'tags': ['a', 'b'], 'name': 'x', 'ids[]': ['1', '2'] })
  })

  it.each([false, true])('collect a repeated multipart field into an array (nativeRoutes=%s)', async (nativeRoutes) => {
    const form = new FormData()
    form.append('tags', 'a')
    form.append('tags', 'b')
    form.append('name', 'x')
    expect(await post(nativeRoutes, form)).toEqual({ tags: ['a', 'b'], name: 'x' })
  })

  it('parse a form whose media type is written in another case', async () => {
    expect(await post(false, 'name=x', 'Application/X-WWW-Form-Urlencoded')).toEqual({ name: 'x' })
  })
})

describe('JSON_CONTENT_TYPE', () => {
  it.each(['application/json', 'application/json; charset=utf-8', 'application/json ; charset=utf-8', 'APPLICATION/JSON', 'application/vnd.api+json'])('matches %p', (value) => {
    expect(JSON_CONTENT_TYPE.test(value)).toBe(true)
  })

  it.each(['text/html', 'application/jsonx', 'application/x; a=b+json', 'application/x-www-form-urlencoded'])('does not match %p', (value) => {
    expect(JSON_CONTENT_TYPE.test(value)).toBe(false)
  })
})
