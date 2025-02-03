import type { UserModel } from '../models/User'
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import User from '../models/User'

beforeEach(async () => {
  await refreshDatabase()
})

// describe('Models test', () => {
//   it('should fetch a single record in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const result = await User.create(user)

//     const model = await User.find(result.id as number)

//     expect(model?.email).toBe(user.email)
//   })

//   it('should store records in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const result = await User.create(user)

//     expect(result?.email).toBe(user.email)
//   })

//   it('should update records in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const model = await User.create(user)

//     expect(model?.email).toBe(user.email)

//     const updatedModel = await model.update({ job_title: 'Open Source Developer' })

//     expect(updatedModel?.job_title).toBe('Open Source Developer')
//   })

  it('should delete records in models', async () => {
    const user = {
      name: 'Chris Breuer',
      job_title: 'Open Sourceror',
      email: 'chris@stacksjs.org',
      password: '123456',
    }

    const model = await User.create(user)

    expect(model?.email).toBe(user.email)

    await model.delete()

    const userDeleted = await User.find(model?.id as number)

    expect(userDeleted).toBeUndefined()
  })

//   it('should remove records in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const model = await User.create(user)

//     expect(model?.email).toBe(user.email)

//     const userDeleted = await User.remove(model.id as number)

//     expect(userDeleted).toBeUndefined()
//   })

//   it('should fetch the first record in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     await User.create(user)

//     const firstModel = await User.first()

//     expect(firstModel?.email).toBe(user.email)
//   })

//   it('should fetch a record by ID in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const model = await User.create(user)

//     const foundModel = await User.findOrFail(model.id as number)

//     expect(foundModel?.email).toBe(user.email)
//   })

//   it('should throw an exception when record is not found by ID in models', async () => {
//     await expect(User.findOrFail(99999)).rejects.toThrowError('No UserModel results for 99999')
//   })

//   it('should fetch the last record in models', async () => {
//     const user1 = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const user2 = {
//       name: 'John Doe',
//       job_title: 'Data Scientist',
//       email: 'john@stacks.com',
//       password: '789012',
//     }

//     await User.create(user1)
//     await User.create(user2)

//     const lastModel = await User.last()

//     expect(lastModel?.email).toBe(user2.email)
//   })

//   it('should fetch records ordered by a specific column in models', async () => {
//     const user1 = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const user2 = {
//       name: 'John Doe',
//       job_title: 'Data Scientist',
//       email: 'john@stacks.com',
//       password: '789012',
//     }

//     await User.create(user1)
//     await User.create(user2)

//     const orderedModels = await User.orderBy('name', 'asc').get()

//     expect(orderedModels[0]?.email).toBe(user1.email)
//     expect(orderedModels[1]?.email).toBe(user2.email)
//   })

//   it('should fetch distinct records in models', async () => {
//     const user1 = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const user2 = {
//       name: 'John Doe',
//       job_title: 'Data Scientist',
//       email: 'john@stacks.com',
//       password: '789012',
//     }

//     const user3 = {
//       name: 'Jane Doe',
//       job_title: 'Data Scientist',
//       email: 'jane@stacks.com',
//       password: '101112',
//     }

//     await User.create(user1)
//     await User.create(user2)
//     await User.create(user3)

//     const distinctModels = await User.distinct('job_title').get()

//     expect(distinctModels.length).toBe(2)
//     expect(distinctModels.map((model: UserModel) => model.job_title)).toEqual(['Open Sourceror', 'Data Scientist'])
//   })

//   it('should fetch records ordered in ascending order in models', async () => {
//     const user1 = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const user2 = {
//       name: 'John Doe',
//       job_title: 'Data Scientist',
//       email: 'john@stacks.com',
//       password: '789012',
//     }

//     await User.create(user1)
//     await User.create(user2)

//     const orderedModelsAsc = await User.orderByAsc('name').get()

//     expect(orderedModelsAsc[0]?.email).toBe(user1.email)
//     expect(orderedModelsAsc[1]?.email).toBe(user2.email)
//   })

//   it('should fetch records ordered in descending order in models', async () => {
//     const user1 = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const user2 = {
//       name: 'John Doe',
//       job_title: 'Data Scientist',
//       email: 'john@stacks.com',
//       password: '789012',
//     }

//     await User.create(user1)
//     await User.create(user2)

//     const orderedModelsDesc = await User.orderByDesc('name').get()

//     expect(orderedModelsDesc[0]?.email).toBe(user2.email)
//     expect(orderedModelsDesc[1]?.email).toBe(user1.email)
//   })
// })

// // Add these test cases to your existing describe block

// it('should fetch records with where clause', async () => {
//   const user1 = {
//     name: 'Chris Breuer',
//     job_title: 'Open Sourceror',
//     email: 'chris@stacksjs.org',
//     password: '123456',
//   }

//   const user2 = {
//     name: 'John Doe',
//     job_title: 'Data Scientist',
//     email: 'john@stacks.com',
//     password: '789012',
//   }

//   await User.create(user1)
//   await User.create(user2)

//   const results = await User.where('job_title', 'Data Scientist').get()

//   expect(results.length).toBe(1)
//   expect(results[0]?.email).toBe(user2.email)
// })

// it('should fetch records with multiple where clauses', async () => {
//   const testUser = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Developer',
//       email: 'john@stacks.com',
//       password: '789012',
//     },
//   ]

//   await Promise.all(testUser.map(user => User.create(user)))

//   const results = await User
//     .where('job_title', 'Developer')
//     .where('name', 'John Doe')
//     .get()

//   expect(results[0]?.email).toBe(testUser[0]!.email)

//   expect(results.length).toBe(1)
// })

// it('should fetch records with whereIn clause', async () => {
//   const users = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Designer',
//       email: 'john@stacks.com',
//       password: '789012',
//     },
//     {
//       name: 'Jane Smith',
//       job_title: 'Manager',
//       email: 'jane@stacks.com',
//       password: '345678',
//     },
//   ]

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .whereIn('job_title', ['Developer', 'Designer'])
//     .get()

//   expect(results.length).toBe(2)
//   expect(results.map(r => r.job_title).sort()).toEqual(['Designer', 'Developer'])
// })

// it('should paginate with default options', async () => {
//   // Create 15 users for basic pagination test
//   const users = Array.from({ length: 15 }, (_, i) => ({
//     name: `User ${i + 1}`,
//     job_title: 'Developer',
//     email: `user${i + 1}@stacks.com`,
//     password: '123456',
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const result = await User.paginate()

//   expect(result.data.length).toBe(10) // Default limit
//   expect(result.paging.page).toBe(1)
//   expect(result.paging.total_records).toBe(15)
//   expect(result.paging.total_pages).toBe(2)
//   expect(result.next_cursor).not.toBeNull()
// })

// it('should handle last page with custom limit', async () => {
//   // Create 12 users to test partial page
//   const users = Array.from({ length: 12 }, (_, i) => ({
//     name: `User ${i + 1}`,
//     job_title: 'Developer',
//     email: `user${i + 1}@stacks.com`,
//     password: '123456',
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const result = await User.paginate({ limit: 10, page: 2 })

//   expect(result.data.length).toBe(2) // Only 2 records on last page
//   expect(result.paging.page).toBe(2)
//   expect(result.paging.total_records).toBe(12)
//   expect(result.paging.total_pages).toBe(2)
//   expect(result.next_cursor).toBeNull()
// })

// it('should handle last page with fewer records', async () => {
//   // Create 18 users
//   const users = Array.from({ length: 18 }, (_, i) => ({
//     name: `User ${i + 1}`,
//     job_title: 'Developer',
//     email: `user${i + 1}@stacks.com`,
//     password: '123456',
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const result = await User.paginate({ limit: 10, page: 2 })

//   expect(result.data.length).toBe(8) // Only 8 records on last page
//   expect(result.paging.page).toBe(2)
//   expect(result.paging.total_records).toBe(18)
//   expect(result.paging.total_pages).toBe(2)
//   expect(result.next_cursor).toBeNull() // No next cursor on last page
// })

// it('should handle empty result set', async () => {
//   const result = await User.paginate()

//   expect(result.data.length).toBe(0)
//   expect(result.paging.page).toBe(1)
//   expect(result.paging.total_records).toBe(0)
//   expect(result.paging.total_pages).toBe(0)
//   expect(result.next_cursor).toBeNull()
// })

// it('should handle custom offset', async () => {
//   // Create 30 users
//   const users = Array.from({ length: 30 }, (_, i) => ({
//     name: `User ${i + 1}`,
//     job_title: 'Developer',
//     email: `user${i + 1}@stacks.com`,
//     password: '123456',
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const result = await User.paginate({ limit: 10, offset: 5 })

//   expect(result.data.length).toBe(10)
//   expect(result.data[0].name).toBe('User 6') // First user after offset
//   expect(result.paging.total_records).toBe(30)
//   expect(result.next_cursor).not.toBeNull()
// })

// it('should count total records', async () => {
//   const users = Array.from({ length: 5 }, (_, i) => ({
//     name: `User ${i}`,
//     job_title: 'Developer',
//     email: `user${i}@stacks.com`,
//     password: '123456',
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const count = await User.count()

//   expect(count).toBe(5)
// })

// it('should perform where like queries', async () => {
//   const users = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Senior Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Junior Developer',
//       email: 'john@stacks.com',
//       password: '789012',
//     },
//   ]

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .whereLike('job_title', '%Developer%')
//     .get()

//   expect(results.length).toBe(2)
// })

// it('should fetch records with orWhere clauses', async () => {
//   const users = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Designer',
//       email: 'john@stacks.com',
//       password: '789012',
//     },
//   ]

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .where('job_title', 'Developer')
//     .orWhere('job_title', 'Designer')
//     .get()

//   expect(results.length).toBe(2)
// })

// it('should perform whereNotIn queries', async () => {
//   const users = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Designer',
//       email: 'john@stacks.com',
//       password: '789012',
//     },
//     {
//       name: 'Jane Smith',
//       job_title: 'Manager',
//       email: 'jane@stacks.com',
//       password: '345678',
//     },
//   ]

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .whereNotIn('job_title', ['Developer', 'Designer'])
//     .get()

//   expect(results.length).toBe(1)
//   expect(results[0]?.job_title).toBe('Manager')
// })

// it('should perform whereBetween queries', async () => {
//   const users = Array.from({ length: 5 }, (_, i) => ({
//     name: `User ${i}`,
//     job_title: 'Developer',
//     email: `user${i}@stacks.com`,
//     password: '123456',
//     age: 20 + i * 5,
//   }))

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .whereBetween('id', [1, 5])
//     .get()

//   expect(results.length).toBe(3)
// })

// it('should perform advanced where clause combinations', async () => {
//   const users = [
//     {
//       name: 'Chris Breuer',
//       job_title: 'Senior Developer',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//       department: 'Engineering',
//       active: true,
//     },
//     {
//       name: 'John Doe',
//       job_title: 'Junior Developer',
//       email: 'john@stacks.com',
//       password: '789012',
//       department: 'Engineering',
//       active: false,
//     },
//     {
//       name: 'Jane Smith',
//       job_title: 'Senior Designer',
//       email: 'jane@stacks.com',
//       password: '345678',
//       department: 'Design',
//       active: true,
//     },
//   ]

//   await Promise.all(users.map(user => User.create(user)))

//   const results = await User
//     .where('department', 'Engineering')
//     .where('active', true)
//     .whereLike('job_title', 'Senior%')
//     .get()

//   expect(results.length).toBe(1)
//   expect(results[0]?.email).toBe('chris@stacksjs.org')
// })
