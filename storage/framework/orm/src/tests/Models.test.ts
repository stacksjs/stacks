import { beforeEach, describe, expect, it } from 'bun:test'
import { DB } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'

import User from '../models/User'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Models test', () => {
  it('should fetch a single record in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const result = await User.create(user)

    const model = await User.find(result.id as number)

    expect(model?.email).toBe(user.email)
  })

  it('should store records in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const result = await User.create(user)

    expect(result?.email).toBe(user.email)
  })

  it('should update records in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const model = await User.create(user)

    expect(model?.email).toBe(user.email)

    const updatedModel = await model.update({ name: 'Open Source Developer' })

    expect(updatedModel?.name).toBe('Open Source Developer')
  })

  it('should delete records in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const model = await User.create(user)

    expect(model?.email).toBe(user.email)

    await model.delete()

    const userDeleted = await User.find(model?.id as number)

    expect(userDeleted).toBeUndefined()
  })

  it('should remove records in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const model = await User.create(user)

    expect(model?.email).toBe(user.email)

    await User.remove(model.id!)

    const deletedUser = await User.find(model.id!)

    expect(deletedUser).toBeUndefined()
  })

  it('should fetch the first record in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    await User.create(user)

    const firstModel = await User.first()

    expect(firstModel?.email).toBe(user.email)
  })

  it('should fetch a record by ID in models', async () => {
    const user = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const model = await User.create(user)

    const foundModel = await User.findOrFail(model.id as number)

    expect(foundModel?.email).toBe(user.email)
  })

  it('should throw an exception when record is not found by ID in models', async () => {
    await expect(User.findOrFail(99999)).rejects.toThrowError('No users results found for id 99999')
  })

  it('should fetch the last record in models', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    await User.create(user1)
    await User.create(user2)

    const lastModel = await User.last()

    expect(lastModel?.email).toBe(user2.email)
  })

  it('should fetch records ordered by a specific column in models', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    await User.create(user1)
    await User.create(user2)

    const orderedModels = await User.orderBy('name', 'asc').get()

    expect(orderedModels[0]?.email).toBe(user1.email)
    expect(orderedModels[1]?.email).toBe(user2.email)
  })

  it('should fetch distinct records in models', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    const user3 = {
      name: 'Jane Doe',
      email: 'jane@stacks.com',
      password: '101112',
    }

    await User.create(user1)
    await User.create(user2)
    await User.create(user3)

    const distinctModels = await User.distinct('name').get()

    expect(distinctModels.length).toBe(3)
    expect(distinctModels.map((model: any) => model.name)).toEqual(['Chris Breuer', 'Jane Doe', 'John Doe'])
  })

  it('should fetch records ordered in ascending order in models', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    await User.create(user1)
    await User.create(user2)

    const orderedModelsAsc = await User.orderByAsc('name').get()

    expect(orderedModelsAsc[0]?.email).toBe(user1.email)
    expect(orderedModelsAsc[1]?.email).toBe(user2.email)
  })

  it('should fetch records ordered in descending order in models', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    await User.create(user1)
    await User.create(user2)

    const orderedModelsDesc = await User.orderByDesc('name').get()

    expect(orderedModelsDesc[0]?.email).toBe(user2.email)
    expect(orderedModelsDesc[1]?.email).toBe(user1.email)
  })

  it('should fetch records with where clause', async () => {
    const user1 = {
      name: 'Chris Breuer',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const user2 = {
      name: 'John Doe',
      email: 'john@stacks.com',
      password: '789012',
    }

    await User.create(user1)
    await User.create(user2)

    const results = await User.where('email', 'john@stacks.com').get()

    expect(results.length).toBe(1)
    expect(results[0]?.email).toBe(user2.email)
  })

  it('should fetch records with multiple where clauses', async () => {
    const testUser = [
      {
        name: 'Chris Breuer',
        email: 'chris@stacksjs.org',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@stacks.com',
        password: '789012',
      },
    ]

    await Promise.all(testUser.map(user => User.create(user)))

    const results = await User
      .where('email', 'john@stacks.com')
      .where('name', 'John Doe')
      .get()

    expect(results[0]?.email).toBe(testUser[1]!.email)
    expect(results.length).toBe(1)
  })

  it('should fetch records with whereIn clause', async () => {
    const users = [
      {
        name: 'Chris Breuer',
        email: 'chris@stacksjs.org',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@stacks.com',
        password: '789012',
      },
      {
        name: 'Jane Smith',
        email: 'jane@stacks.com',
        password: '345678',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .whereIn('email', ['chris@stacksjs.org', 'john@stacks.com'])
      .get()

    expect(results.length).toBe(2)
    expect(results.map(r => r.email).sort()).toEqual(['chris@stacksjs.org', 'john@stacks.com'])
  })

  it('should paginate with default options', async () => {
    const users = Array.from({ length: 15 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const result = await User.paginate()

    expect(result.data.length).toBe(10) // Default limit
    expect(result.paging.page).toBe(1)
    expect(result.paging.total_records).toBe(15)
    expect(result.paging.total_pages).toBe(2)
    expect(result.next_cursor).not.toBeNull()
  })

  it('should handle last page with custom limit', async () => {
    const users = Array.from({ length: 12 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const result = await User.paginate({ limit: 10, page: 2 })

    expect(result.data.length).toBe(2) // Only 2 records on last page
    expect(result.paging.page).toBe(2)
    expect(result.paging.total_records).toBe(12)
    expect(result.paging.total_pages).toBe(2)
    expect(result.next_cursor).toBeNull()
  })

  it('should handle last page with fewer records', async () => {
    const users = Array.from({ length: 18 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const result = await User.paginate({ limit: 10, page: 2 })

    expect(result.data.length).toBe(8) // Only 8 records on last page
    expect(result.paging.page).toBe(2)
    expect(result.paging.total_records).toBe(18)
    expect(result.paging.total_pages).toBe(2)
    expect(result.next_cursor).toBeNull() // No next cursor on last page
  })

  it('should handle empty result set', async () => {
    const result = await User.paginate()

    expect(result.data.length).toBe(0)
    expect(result.paging.page).toBe(1)
    expect(result.paging.total_records).toBe(0)
    expect(result.paging.total_pages).toBe(0)
    expect(result.next_cursor).toBeNull()
  })

  it('should handle custom offset', async () => {
    const users = Array.from({ length: 30 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    for (const user of users) {
      await User.create(user)
    }

    const result = await User.paginate({ limit: 10, offset: 5 })

    expect(result.data.length).toBe(10)
    expect(result.data[0]!.name).toBe('User 1')
    expect(result.paging.total_records).toBe(30)
    expect(result.next_cursor).not.toBeNull()
  })

  it('should count total records', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const count = await User.count()

    expect(count).toBe(5)
  })

  it('should perform where like queries', async () => {
    const users = [
      {
        name: 'Chris Breuer',
        email: 'chris@stacksjs.org',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@stacks.com',
        password: '789012',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .whereLike('email', '%stacks%')
      .get()

    expect(results.length).toBe(2)
  })

  it('should fetch records with OR conditions', async () => {
    const users = [
      {
        name: 'Chris',
        email: 'chris@test.com',
        password: '123456',
      },
      {
        name: 'John',
        email: 'john@test.com',
        password: '123456',
      },
      {
        name: 'Jane',
        email: 'jane@test.com',
        password: '123456',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .orWhere(
        ['email', 'chris@test.com'],
        ['email', 'john@test.com'],
      )
      .get()

    expect(results.length).toBe(2)
    expect(results.map(r => r.email).sort()).toEqual(['chris@test.com', 'john@test.com'])
  })

  it('should perform whereNotIn queries', async () => {
    const users = [
      {
        name: 'Chris Breuer',
        email: 'chris@stacksjs.org',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@stacks.com',
        password: '789012',
      },
      {
        name: 'Jane Smith',
        email: 'jane@stacks.com',
        password: '345678',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .whereNotIn('email', ['chris@stacksjs.org', 'john@stacks.com'])
      .get()

    expect(results.length).toBe(1)
    expect(results[0]?.email).toBe('jane@stacks.com')
  })

  it('should perform whereBetween queries', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .whereBetween('id', [1, 3])
      .get()

    expect(results.length).toBe(3)
  })

  it('should perform advanced where clause combinations', async () => {
    const users = [
      {
        name: 'Chris Breuer',
        email: 'chris@stacksjs.org',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@stacks.com',
        password: '789012',
      },
      {
        name: 'Jane Smith',
        email: 'jane@stacks.com',
        password: '345678',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .whereLike('email', 'john%')
      .get()

    expect(results.length).toBe(1)
    expect(results[0]?.email).toBe('john@stacks.com')
  })

  it('should perform aggregation functions (min, max, avg, sum)', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    const maxId = await User.max('id')
    const minId = await User.min('id')
    const avgId = await User.avg('id')
    const totalId = await User.sum('id')

    expect(maxId).toBe(5) // Last created user's id
    expect(minId).toBe(1) // First created user's id
    expect(avgId).toBe(3) // Average of ids 1,2,3,4,5
    expect(totalId).toBe(15) // Sum of ids 1,2,3,4,5
  })

  it('should handle chunk processing of records', async () => {
    const users = Array.from({ length: 25 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    await Promise.all(users.map(user => User.create(user)))

    let processedCount = 0
    let chunkedCount = 0
    const chunkSize = 5

    await User.chunk(chunkSize, async (models) => {
      chunkedCount++
      processedCount += models.length
    })

    expect(processedCount).toBe(25)
    expect(chunkedCount).toBe(5)
  })

  it('should handle pluck operation for specific fields', async () => {
    const users = [
      {
        name: 'Chris Breuer',
        email: 'chris@test.com',
        password: '123456',
      },
      {
        name: 'John Doe',
        email: 'john@test.com',
        password: '123456',
      },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const emails = await User.pluck('email')
    expect(emails).toContain('chris@test.com')
    expect(emails).toContain('john@test.com')
    expect(emails.length).toBe(2)
  })

  it('should handle firstOrCreate operation', async () => {
    const userData = {
      name: 'Chris Breuer',
      email: 'chris@test.com',
      password: '123456',
    }

    // First creation
    const firstUser = await User.firstOrCreate(
      { email: 'chris@test.com' },
      userData,
    )

    // Attempt to create the same user
    const existingUser = await User.firstOrCreate(
      { email: 'chris@test.com' },
      {
        name: 'Different Name',
        email: 'chris@test.com',
        password: '789012',
      },
    )

    expect(firstUser.id).toBe(existingUser.id!)
    expect(existingUser.name).toBe('Chris Breuer')
  })

  it('should handle updateOrCreate operation', async () => {
    const initialData = {
      name: 'Chris Breuer',
      email: 'chris@test.com',
      password: '123456',
    }

    const updatedData = {
      name: 'Chris B',
      email: 'chris@test.com',
      password: '789012',
    }

    // First creation
    await User.updateOrCreate(
      { email: 'chris@test.com' },
      initialData,
    )

    // Update the existing record
    const updated = await User.updateOrCreate(
      { email: 'chris@test.com' },
      updatedData,
    )

    // Retrieve the record directly to confirm it was updated
    const directCheck = await User.whereEmail('chris@test.com').first()

    expect(updated.name).toBe('Chris B')
    expect(directCheck?.name).toBe('Chris B')
  })

  it('should handle model state tracking (isDirty, isClean, wasChanged)', async () => {
    const user = await User.create({
      name: 'Chris Breuer',
      email: 'chris@test.com',
      password: '123456',
    })

    expect(user.isDirty()).toBe(false)
    expect(user.isClean()).toBe(true)

    user.name = 'Chris B'
    expect(user.isDirty('name')).toBe(true)
    expect(user.isClean('email')).toBe(true)

    await user.save()
  })

  it('should handle join operations', async () => {
    // First create a user
    const user = await User.create({
      name: 'Chris Breuer',
      email: 'chris@test.com',
      password: '123456',
    })

    // Create some posts for the user
    await DB.instance.insertInto('posts').values([
      { user_id: user.id, title: 'Post 1', body: 'lorem ipsum' },
      { user_id: user.id, title: 'Post 2', body: 'lorem ipsum' },
    ]).execute()

    const results = await User
      .join('posts', 'users.id', 'posts.user_id')
      .where('users.id', '=', user.id)
      .get()

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.name).toBe('Chris Breuer')
  })

  it('should handle groupBy and having operations', async () => {
    // Create users with different names
    const users = [
      { name: 'User 1', email: 'user1@test.com', password: '123456' },
      { name: 'User 2', email: 'user2@test.com', password: '123456' },
      { name: 'User 3', email: 'user3@test.com', password: '123456' },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const results = await User
      .groupBy('name')
      .having('id', '>', 0)
      .get()

    expect(results.length).toBe(3) // Should have three groups
  })

  it('should handle fill and forceFill operations', async () => {
    const user = new User(undefined)

    user.fill({
      name: 'Chris Breuer',
      email: 'chris@test.com',
      password: '123456',
    })

    expect(user.name).toBe('Chris Breuer')

    // Try to fill a guarded attribute
    user.forceFill({
      id: 999,
      name: 'Changed Name',
    })

    expect(user.id).toBe(999) // Should work with forceFill
  })

  it('should handle inRandomOrder query', async () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))
    await Promise.all(users.map(user => User.create(user)))

    const randomResults1 = await User.inRandomOrder().get()
    const randomResults2 = await User.inRandomOrder().get()

    expect(randomResults1.length).toBe(10)
    expect(randomResults2.length).toBe(10)
    // Check if orders are different (there's a small chance they could be the same)
    const areDifferent = randomResults1.some((user, index) => user.id !== randomResults2[index]?.id)
    expect(areDifferent).toBe(true)
  })

  it('should handle whereNull queries', async () => {
    await User.create({
      name: 'User 1',
      email: 'user1@test.com',
      password: '123456',
    })
    await User.create({
      name: 'User 2',
      email: 'user2@test.com',
      password: '123456',
    })

    const nullResults = await User.whereNull('updated_at').get()
    expect(nullResults.length).toBe(2)
  })

  it('should handle skip and take operations', async () => {
    const users = Array.from({ length: 5 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@stacks.com`,
      password: '123456',
    }))

    // Insert sequentially to ensure consistent ordering
    for (const user of users) {
      await User.create(user)
    }

    const results = await User.skip(2).take(2).get()
    expect(results.length).toBe(2)
    expect(results[0]?.name).toBe('User 3')
    expect(results[1]?.name).toBe('User 4')
  })

  it('should handle whereColumn comparison', async () => {
    await User.create({
      name: 'Same Name',
      email: 'test1@test.com',
      password: '123456',
    })
    await User.create({
      name: 'Different',
      email: 'test2@test.com',
      password: '123456',
    })

    const results = await User.whereColumn('name', '=', 'email').get()
    expect(results.length).toBe(0)
  })

  it('should handle when conditional queries', async () => {
    await Promise.all([
      User.create({ name: 'User 1', email: 'user1@test.com', password: '123456' }),
      User.create({ name: 'User 2', email: 'user2@test.com', password: '123456' }),
    ])

    const condition = true
    const results = await User
      .when(condition, query => query.where('email', '=', 'user1@test.com'))
      .get()

    expect(results.length).toBe(1)
    expect(results[0]?.name).toBe('User 1')
  })

  it('should track original attributes and changes', async () => {
    const user = await User.create({
      name: 'Original Name',
      email: 'test@test.com',
      password: '123456',
    })

    const original = user.getOriginal('name')
    user.name = 'New Name'
    const changes = user.getChanges()

    expect(original).toBe('Original Name')
    expect(changes.name).toBe('New Name')
  })

  it('should handle findMany operation', async () => {
    const createdUsers = await Promise.all([
      User.create({ name: 'User 1', email: 'user1@test.com', password: '123456' }),
      User.create({ name: 'User 2', email: 'user2@test.com', password: '123456' }),
    ])

    const ids = createdUsers.map(user => user.id) as number[]
    const foundUsers = await User.findMany(ids)

    expect(foundUsers.length).toBe(2)
    expect(foundUsers.map(user => user.name).sort()).toEqual(['User 1', 'User 2'])
  })

  it('should handle exists check', async () => {
    await User.create({
      name: 'Test User',
      email: 'test@test.com',
      password: '123456',
    })

    const exists = await User.where('email', '=', 'test@test.com').exists()
    const notExists = await User.where('email', '=', 'nonexistent@test.com').exists()

    expect(exists).toBe(true)
    expect(notExists).toBe(false)
  })

  it('should handle latest and oldest queries', async () => {
    const users = Array.from({ length: 3 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@test.com`,
      password: '123456',
    }))

    // Insert sequentially to ensure consistent ordering
    for (const user of users) {
      await User.create(user)
    }

    const latest = await User.latest('id')
    const oldest = await User.oldest('id')

    expect(latest?.name).toBe('User 3')
    expect(oldest?.name).toBe('User 1')
  })

  it('should handle createMany operation', async () => {
    const usersToCreate = Array.from({ length: 3 }, (_, i) => ({
      name: `Batch User ${i + 1}`,
      email: `batch${i + 1}@test.com`,
      password: '123456',
    }))

    await User.createMany(usersToCreate)
    const allUsers = await User.get()

    expect(allUsers.length).toBe(3)
    expect(allUsers.map(user => user.name)).toContain('Batch User 1')
  })

  it('should handle dynamic query building using when() with multiple conditions', async () => {
    const users = [
      { name: 'John', email: 'john@test.com', password: '123' },
      { name: 'Jane', email: 'jane@test.com', password: '456' },
      { name: 'Bob', email: 'bob@test.com', password: '789' },
    ]

    await Promise.all(users.map(user => User.create(user)))

    const filters = {
      searchTerm: 'test.com',
      isJohn: true,
    }

    const results = await User
      .when(filters.searchTerm !== '', query => query.where('email', 'like', `%${filters.searchTerm}%`))
      .when(filters.isJohn, query => query.where('name', '=', 'John'))
      .get()

    expect(results.length).toBe(1)
    expect(results[0]?.name).toBe('John')
  })

  it('should handle whereRef for column comparisons', async () => {
    await User.create({
      name: 'John Smith',
      email: 'john@test.com',
      password: '123456',
    })
    await User.create({
      name: 'Jane Doe',
      email: 'jane@test.com',
      password: '123456',
    })

    const results = await User.whereRef('name', '=', 'email').get()
    expect(results.length).toBe(0)
  })

  it('should load multiple relations using with()', async () => {
    const user = await User.create({
      name: 'John',
      email: 'john@test.com',
      password: '123456',
    })

    // Create some related records
    await DB.instance.insertInto('posts').values([
      { user_id: user.id, title: 'Post 1', body: 'lorem ipsum' },
    ]).execute()

    await DB.instance.insertInto('subscriptions').values([
      { user_id: user.id, plan: 'basic', type: 'monthly', provider_id: '1234567890', provider_status: 'active', provider_type: 'stripe' },
    ]).execute()

    const result = await User.with(['posts', 'subscriptions']).find(user.id!)

    expect(result?.posts).toBeDefined()
    expect(result?.subscriptions).toBeDefined()
  })

  it('should combine where and whereNull conditions', async () => {
    await User.create({
      name: 'Jane',
      email: 'jane@test.com',
      password: '123456',
    })

    const results = await User.where('name', 'like', 'J%').whereNull('updated_at').get()
    expect(results.length).toBe(1)
    expect(results[0]?.name).toBe('Jane')
  })

  it('should handle select with specific columns', async () => {
    await User.create({
      name: 'John',
      email: 'john@test.com',
      password: '123456',
    })

    const results = await User.select(['name', 'email']).first()

    expect(results?.name).toBeDefined()
    expect(results?.email).toBeDefined()
    expect(results?.password).toBeUndefined()
  })
})
