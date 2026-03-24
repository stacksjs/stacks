import { describe, expect, it } from 'bun:test'
import {
  ConditionalValue,
  JsonResource,
  MergeValue,
  MissingValue,
  PaginatedResourceCollection,
  ResourceCollection,
  collection,
  resource,
} from '../src/resource'

// ---------------------------------------------------------------------------
// Test resource subclass
// ---------------------------------------------------------------------------
interface User {
  id: number
  name: string
  email: string
  secret?: string
  posts?: { id: number; title: string }[]
  posts_count?: number
}

class UserResource extends JsonResource<User> {
  toArray() {
    return {
      id: this.resource.id,
      name: this.resource.name,
      email: this.resource.email,
      posts: this.whenLoaded('posts'),
    }
  }
}

const sampleUser: User = { id: 1, name: 'Alice', email: 'alice@test.com' }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Resource', () => {
  describe('JsonResource constructor', () => {
    it('should store the resource on the instance', () => {
      const res = new (class extends JsonResource<User> {
        toArray() { return { id: this.resource.id } }
      })(sampleUser)
      expect(res.resource).toBe(sampleUser)
    })

    it('should default additional to empty object', () => {
      const res = new (class extends JsonResource<User> {
        toArray() { return {} }
      })(sampleUser)
      expect(res.additional).toEqual({})
    })

    it('should default wrap to "data"', () => {
      expect(JsonResource.wrap).toBe('data')
    })
  })

  describe('toArray()', () => {
    it('should return the transformed data', () => {
      const res = new UserResource(sampleUser)
      const arr = res.toArray()
      expect(arr.id).toBe(1)
      expect(arr.name).toBe('Alice')
      expect(arr.email).toBe('alice@test.com')
    })
  })

  describe('toResponse()', () => {
    it('should wrap data under the "data" key by default', () => {
      const res = new UserResource(sampleUser)
      const resp = res.toResponse()
      expect(resp).toHaveProperty('data')
      expect(resp.data.id).toBe(1)
    })

    it('should include additional data at the top level', () => {
      const res = new UserResource(sampleUser)
      res.withAdditional({ meta: 'extra' })
      const resp = res.toResponse()
      expect(resp.meta).toBe('extra')
    })

    it('should respect withoutWrapping()', () => {
      class UnwrappedResource extends JsonResource<User> {
        toArray() { return { id: this.resource.id } }
      }
      UnwrappedResource.withoutWrapping()
      const res = new UnwrappedResource(sampleUser)
      const resp = res.toResponse()
      expect(resp).not.toHaveProperty('data')
      expect(resp.id).toBe(1)
      // Reset wrap for other tests
      UnwrappedResource.wrapWith('data')
    })
  })

  describe('toJSON()', () => {
    it('should work with JSON.stringify', () => {
      const res = new UserResource(sampleUser)
      const json = JSON.stringify(res)
      const parsed = JSON.parse(json)
      expect(parsed.data.id).toBe(1)
      expect(parsed.data.name).toBe('Alice')
    })
  })

  describe('toJson()', () => {
    it('should return a JSON string', () => {
      const res = new UserResource(sampleUser)
      const str = res.toJson()
      expect(typeof str).toBe('string')
      const parsed = JSON.parse(str)
      expect(parsed.data.id).toBe(1)
    })
  })

  describe('collection()', () => {
    it('should create a ResourceCollection', () => {
      const users = [sampleUser, { id: 2, name: 'Bob', email: 'bob@test.com' }]
      const coll = UserResource.collection(users)
      expect(coll).toBeInstanceOf(ResourceCollection)
      expect(coll.count()).toBe(2)
    })

    it('should transform all items via toResponse', () => {
      const users = [sampleUser, { id: 2, name: 'Bob', email: 'bob@test.com' }]
      const resp = UserResource.collection(users).toResponse()
      expect(resp.data).toBeArray()
      expect(resp.data).toHaveLength(2)
      expect(resp.data[0].id).toBe(1)
      expect(resp.data[1].name).toBe('Bob')
    })
  })

  describe('ResourceCollection', () => {
    it('should report isEmpty / isNotEmpty correctly', () => {
      const empty = UserResource.collection([])
      expect(empty.isEmpty()).toBe(true)
      expect(empty.isNotEmpty()).toBe(false)

      const nonEmpty = UserResource.collection([sampleUser])
      expect(nonEmpty.isEmpty()).toBe(false)
      expect(nonEmpty.isNotEmpty()).toBe(true)
    })

    it('should serialize to JSON via toJson()', () => {
      const coll = UserResource.collection([sampleUser])
      const str = coll.toJson()
      const parsed = JSON.parse(str)
      expect(parsed.data).toBeArray()
      expect(parsed.data[0].id).toBe(1)
    })
  })

  describe('PaginatedResourceCollection', () => {
    it('should include meta and links in toResponse', () => {
      const paginated = PaginatedResourceCollection.fromPagination(
        [sampleUser],
        UserResource,
        { currentPage: 1, perPage: 10, total: 1, baseUrl: '/api/users' },
      )
      const resp = paginated.toResponse()
      expect(resp.meta).toBeDefined()
      expect(resp.meta.current_page).toBe(1)
      expect(resp.meta.total).toBe(1)
      expect(resp.links).toBeDefined()
      expect(resp.links.first).toBe('/api/users?page=1')
    })

    it('should compute last_page correctly', () => {
      const paginated = PaginatedResourceCollection.fromPagination(
        [],
        UserResource,
        { currentPage: 1, perPage: 10, total: 55 },
      )
      expect(paginated.meta.last_page).toBe(6) // ceil(55/10)
    })

    it('should set prev to null on first page', () => {
      const paginated = PaginatedResourceCollection.fromPagination(
        [sampleUser],
        UserResource,
        { currentPage: 1, perPage: 10, total: 20, baseUrl: '/api/users' },
      )
      expect(paginated.links.prev).toBeNull()
      expect(paginated.links.next).toBe('/api/users?page=2')
    })
  })

  describe('whenLoaded()', () => {
    it('should return MissingValue when relationship is not loaded', () => {
      const res = new UserResource(sampleUser)
      const data = res.resolve()
      // posts not on sampleUser, so it should be filtered out
      expect(data).not.toHaveProperty('posts')
    })

    it('should include relationship data when loaded', () => {
      const userWithPosts: User = {
        ...sampleUser,
        posts: [{ id: 10, title: 'Hello' }],
      }
      const res = new UserResource(userWithPosts)
      const data = res.resolve()
      expect(data.posts).toEqual([{ id: 10, title: 'Hello' }])
    })
  })

  describe('MissingValue', () => {
    it('should be a singleton via instance', () => {
      expect(MissingValue.instance.isMissing()).toBe(true)
    })
  })

  describe('MergeValue', () => {
    it('should store data', () => {
      const mv = new MergeValue({ a: 1 })
      expect(mv.data).toEqual({ a: 1 })
    })
  })

  describe('ConditionalValue', () => {
    it('should resolve to value when condition is true', () => {
      const cv = new ConditionalValue(true, 'yes')
      expect(cv.resolve()).toBe('yes')
    })

    it('should resolve to MissingValue when condition is false and no default', () => {
      const cv = new ConditionalValue(false, 'yes')
      expect(cv.resolve()).toBeInstanceOf(MissingValue)
    })
  })

  describe('Anonymous resource()', () => {
    it('should create an inline resource with toResponse and toJson', () => {
      const r = resource({ id: 1, name: 'Test' }, d => ({ id: d.id, label: d.name }))
      const resp = r.toResponse()
      expect(resp.data.id).toBe(1)
      expect(resp.data.label).toBe('Test')
      expect(typeof r.toJson()).toBe('string')
    })
  })

  describe('Anonymous collection()', () => {
    it('should create an inline collection with toResponse and toJson', () => {
      const items = [{ id: 1 }, { id: 2 }]
      const c = collection(items, d => ({ num: d.id }))
      const resp = c.toResponse()
      expect(resp.data).toHaveLength(2)
      expect(resp.data[0].num).toBe(1)
      expect(typeof c.toJson()).toBe('string')
    })
  })
})
