import { describe, expect, test } from 'bun:test'
import { ConditionalValue, JsonResource, MergeValue, MissingValue, PaginatedResourceCollection } from '../src/resource'

class Inline extends JsonResource<Record<string, unknown>> {
  toArray() { return this.resource }
}
class PublicUser extends JsonResource<{ id: number, password: string }> {
  toArray(request?: Record<string, unknown>) { return { id: this.resource.id, allowed: request?.allowed } }
}
const user = { id: 1, password: 'private' }

describe('resource serialization boundaries', () => {
  test('resolves wrappers recursively in objects and arrays and omits only missing values', () => {
    expect(new Inline({ list: [null, false, 0, '', MissingValue.instance, new ConditionalValue(false, 'private'), new ConditionalValue(false, 'private', new ConditionalValue(true, 7)), [new Inline({ id: 1 })]], merge: new MergeValue({ nested: new ConditionalValue(true, new Inline({ ok: true })) }) }).resolve()).toEqual({ list: [null, false, 0, '', 7, [{ id: 1 }]], nested: { ok: true } })
  })
  test('propagates the parent request into nested resources and collections', () => {
    const nested = new Inline({ one: new PublicUser(user), list: PublicUser.collection([user]) }).withRequest({ allowed: true })
    expect(nested.resolve()).toEqual({ one: { id: 1, allowed: true }, list: [{ id: 1, allowed: true }] })
    expect(nested.resolve({ allowed: false })).toEqual({ one: { id: 1, allowed: false }, list: [{ id: 1, allowed: false }] })
    expect(JSON.parse(JSON.stringify(PublicUser.collection([user]).withRequest({ allowed: true })))).toEqual({ data: [{ id: 1, allowed: true }] })
  })
  test('keeps protected request context available to direct and nested collection projections', () => {
    class ProtectedUser extends PublicUser {
      toArray() { return { id: this.resource.id, allowed: this.request?.allowed } }
    }
    const collection = ProtectedUser.collection([user]).withRequest({ allowed: true })
    expect(collection.resolve()).toEqual([{ id: 1, allowed: true }])
    expect(new Inline({ users: collection }).withRequest({ allowed: false }).resolve()).toEqual({ users: [{ id: 1, allowed: false }] })
  })
  test('allows repeated references but rejects object, array, resource and collection cycles', () => {
    const shared = { value: 1 }
    expect(new Inline({ a: shared, b: shared }).resolve()).toEqual({ a: shared, b: shared })
    const object: Record<string, unknown> = {}; object.self = object
    const array: unknown[] = []; array.push(array)
    const resource = new Inline({}); resource.resource.self = resource
    const collection = Inline.collection([{}]); collection.resources[0]!.self = collection
    for (const value of [object, array, resource, collection]) expect(() => new Inline({ value }).toJson()).toThrow(/cycle/)
  })
  test('keeps one depth budget across nested resource instances and custom JSON values', () => {
    let value: unknown = new ConditionalValue(false, 'private')
    for (let index = 0; index < 25; index++) value = new Inline({ nested: value })
    expect(() => new Inline({ value }).resolve()).toThrow(/maximum depth/)
    const custom = { toJSON() { return { value: new ConditionalValue(false, 'private'), url: new URL('https://example.com/') } } }
    expect(new Inline({ custom, date: new Date('2026-01-01Z') }).toJson()).toBe('{"data":{"custom":{"url":"https://example.com/"},"date":"2026-01-01T00:00:00.000Z"}}')
  })
  test('supports spread merges, conditional spreads, legacy placeholders and explicit wrappers in order', () => {
    class Merged extends Inline {
      toArray() {
        return { id: 1, ...this.merge({ data: 'field', id: 2, 0: 'numeric' }), ...this.mergeWhen(true, { name: 'kept' }), ...this.mergeWhen(false, { private: true }), legacy: this.merge({ flag: true }), explicit: new MergeValue({ id: 3 }), after: 'last' }
      }
    }
    expect(new Merged({}).resolve()).toEqual({ 0: 'numeric', data: 'field', id: 3, name: 'kept', flag: true, after: 'last' })
    class Special extends Inline { toArray() { return { fields: this.merge(JSON.parse('{"__proto__":{"safe":true},"constructor":"kept"}')) } } }
    const result = new Special({}).resolve()
    expect(Object.hasOwn(result, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(result.constructor).toBe('kept')
  })
})

describe('resource pagination boundaries', () => {
  test('serializes projected rows and pagination metadata directly', () => {
    const page = PaginatedResourceCollection.fromPagination([user], PublicUser, { currentPage: 2, perPage: 2, total: 3, baseUrl: '/users?tag=a&tag=b&page=99#section' }).withRequest({ allowed: true })
    expect(JSON.parse(JSON.stringify(page))).toEqual({ data: [{ id: 1, allowed: true }], meta: { current_page: 2, from: 3, last_page: 2, per_page: 2, to: 3, total: 3 }, links: { first: '/users?tag=a&tag=b&page=1#section', last: '/users?tag=a&tag=b&page=2#section', prev: '/users?tag=a&tag=b&page=1#section', next: null } })
  })
  test('links support absolute, relative and query-only paths', () => {
    for (const baseUrl of ['', '?status=a#s', '/users?status=a#s', 'https://example.com/users?status=a#s']) {
      const page = PaginatedResourceCollection.fromPagination([user], PublicUser, { currentPage: 1, perPage: 1, total: 2, baseUrl })
      const link = new URL(page.links.next!, 'https://test.local/current')
      expect(link.searchParams.get('page')).toBe('2')
      if (baseUrl) { expect(link.searchParams.get('status')).toBe('a'); expect(link.hash).toBe('#s') }
    }
  })
  test('rejects invalid page arithmetic instead of emitting NaN, infinity or misleading ranges', () => {
    for (const overrides of [{ perPage: 0 }, { currentPage: 0 }, { total: -1 }, { perPage: 1.5 }, { total: Infinity }, { currentPage: Number.MAX_SAFE_INTEGER, perPage: 2 }]) {
      expect(() => PaginatedResourceCollection.fromPagination([], PublicUser, { currentPage: 1, perPage: 10, total: 0, ...overrides })).toThrow(RangeError)
    }
    expect(() => PaginatedResourceCollection.fromPagination([user], PublicUser, { currentPage: 2, perPage: 1, total: 1 })).toThrow(RangeError)
  })
})
