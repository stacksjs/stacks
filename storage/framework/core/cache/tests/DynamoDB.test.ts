import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'

import { deleteStacksTable, launchServer } from '@stacksjs/testing'
import { dynamodb } from '../src/drivers/dynamodb'

beforeAll(async () => {
  await launchServer()
})

afterEach(async () => {
  await dynamodb.clear()
})

afterAll(async () => {
  await deleteStacksTable()
})

describe('@stacksjs/cache - DynamoDB', () => {
  it('should set and get a dynamodb cache value', async () => {
    await dynamodb.set('key1', 'value1')
    expect(await dynamodb.get('key1')).toBe('value1')
  })

  it('should set a dynamodb cache value with no TTL and get it', async () => {
    await dynamodb.setForever('key2', 'value2')
    expect(await dynamodb.get('key2')).toBe('value2')
  })

  it('should get or set a dynamodb cache value if not set', async () => {
    expect(await dynamodb.get('key3')).toBeUndefined()

    await dynamodb.getOrSet('key3', 'value3')
    expect(await dynamodb.get('key3')).toBe('value3')
  })

  it('should delete a dynamodb cache value', async () => {
    await dynamodb.set('key4', 'value4')
    await dynamodb.del('key4')
    expect(await dynamodb.get('key4')).toBeUndefined()
  })

  it('should delete multiple dynamodb cache values', async () => {
    await dynamodb.set('key5', 'value5')
    await dynamodb.set('key6', 'value6')
    await dynamodb.deleteMany(['key5', 'key6'])

    expect(await dynamodb.get('key5')).toBeUndefined()
    expect(await dynamodb.get('key6')).toBeUndefined()
  })

  it('should check if a key exists in dynamodb cache', async () => {
    await dynamodb.set('key7', 'value7')
    expect(await dynamodb.has('key7')).toBe(true)
  })

  it('should return false if a key is missing in dynamodb cache', async () => {
    expect(await dynamodb.missing('nonExistentKey')).toBe(true)
    await dynamodb.set('key8', 'value8')
    expect(await dynamodb.missing('key8')).toBe(false)
  })

  it('should clear all dynamodb cache values', async () => {
    await dynamodb.set('key9', 'value9')
    await dynamodb.set('key10', 'value10')
    await dynamodb.clear()

    expect(await dynamodb.get('key9')).toBeUndefined()
    expect(await dynamodb.get('key10')).toBeUndefined()
  })

  it('should remove a specific dynamodb cache value', async () => {
    await dynamodb.set('key11', 'value11')
    await dynamodb.remove('key11')

    expect(await dynamodb.get('key11')).toBeUndefined()
  })
})
