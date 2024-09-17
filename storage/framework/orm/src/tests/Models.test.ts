import { beforeAll, describe, expect, it } from 'bun:test'
import { refreshDatabase, setupDatabase } from '@stacksjs/testing'

import User from '../models/User'

beforeAll(async () => {
  process.env.APP_ENV = 'testing'
  await setupDatabase()
})

describe('redisTest', () => {
  it('should store records in models', async () => {
    console.log(process.env.APP_ENV)
  })
})
