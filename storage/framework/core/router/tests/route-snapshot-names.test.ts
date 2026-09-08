import { describe, expect, test } from 'bun:test'
import { createStacksRouter, listRegisteredRoutes } from '../src/stacks-router'

describe('route snapshot names', () => {
  test('uses the first path alias across methods and deduplicates route keys', () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const other = createStacksRouter({ autoDiscoverRoutes: false })
    const path = '/snapshot-alias-order/shared'
    router.get(path, () => 'get').name('snapshot-alias-order.first')
    router.post(path, () => 'post').name('snapshot-alias-order.second')
    other.get(path, () => 'duplicate')

    const rows = listRegisteredRoutes().filter(row => row.path === path)
    expect(rows.map(row => [row.method, row.name])).toEqual([
      ['GET', 'snapshot-alias-order.first'],
      ['POST', 'snapshot-alias-order.first'],
    ])
  })

  test('reflects reassigned names on each call without changing earlier snapshots', () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const firstPath = '/snapshot-renamed/first'
    const secondPath = '/snapshot-renamed/second'
    const first = router.get(firstPath, () => 'first')
    first.name('snapshot-renamed.primary')
    first.name('snapshot-renamed.secondary')
    const second = router.get(secondPath, () => 'second')
    const snapshot = () => listRegisteredRoutes()
      .filter(row => row.path.startsWith('/snapshot-renamed/'))
      .map(row => [row.path, row.name])

    const original = snapshot()
    expect(original).toEqual([
      [firstPath, 'snapshot-renamed.primary'],
      [secondPath, undefined],
    ])

    second.name('snapshot-renamed.primary')
    expect(snapshot()).toEqual([
      [firstPath, 'snapshot-renamed.secondary'],
      [secondPath, 'snapshot-renamed.primary'],
    ])
    first.name('snapshot-renamed.primary')
    expect(snapshot()).toEqual(original)
    expect(original[0]).toEqual([firstPath, 'snapshot-renamed.primary'])
  })

  test('retains an empty first name and sorts named and unnamed paths', () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.get('/snapshot-empty-name/z', () => 'z').name('')
    router.post('/snapshot-empty-name/z', () => 'post').name('snapshot-empty-name.later')
    router.get('/snapshot-empty-name/a', () => 'a')
    expect(listRegisteredRoutes()
      .filter(row => row.path.startsWith('/snapshot-empty-name/'))
      .map(row => [row.path, row.method, row.name])).toEqual([
      ['/snapshot-empty-name/a', 'GET', undefined],
      ['/snapshot-empty-name/z', 'GET', ''],
      ['/snapshot-empty-name/z', 'POST', ''],
    ])
  })
})
