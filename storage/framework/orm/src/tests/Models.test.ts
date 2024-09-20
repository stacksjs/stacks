import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import User from '../models/User'
import type { UserModel } from '../models/User'

// beforeEach(async () => {
//   await refreshDatabase()
// })

await refreshDatabase()

// describe('redisTest', () => {
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

//   it('should delete records in models', async () => {
//     const user = {
//       name: 'Chris Breuer',
//       job_title: 'Open Sourceror',
//       email: 'chris@stacksjs.org',
//       password: '123456',
//     }

//     const model = await User.create(user)

//     expect(model?.email).toBe(user.email)

//     await model.delete()

//     const userDeleted = await User.find(model?.id as number)

//     expect(userDeleted).toBeUndefined()
//   })

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
//     await expect(User.findOrFail(99999)).rejects.toThrowError('No model results found for 99999')
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
