import { beforeAll, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/database'
import User from '../models/User'

beforeAll(async () => {
  await refreshDatabase()
})

describe('redisTest', () => {
  it('should store records in models', async () => {})
})
