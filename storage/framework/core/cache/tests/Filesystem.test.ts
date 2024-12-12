import { beforeEach, describe, expect, it } from 'bun:test'

import { fileSystem } from '../src/drivers/filesystem'

beforeEach(async () => {
  await fileSystem.clear()
})

describe('@stacksjs/cache - Filesystem', () => {
  it('should set and get a fileSystem cache value', async () => {
    await fileSystem.set('key1', 'value1')
    expect(await fileSystem.get('key1')).toBe('value1')
  })

  it('should set a fileSystem cache value with no TTL and get it', async () => {
    await fileSystem.setForever('key2', 'value2')
    expect(await fileSystem.get('key2')).toBe('value2')
  })

  it('should get or set a fileSystem cache value if not set', async () => {
    expect(await fileSystem.get('key3')).toBeUndefined()

    await fileSystem.getOrSet('key3', 'value3')
    expect(await fileSystem.get('key3')).toBe('value3')
  })

  it('should delete a fileSystem cache value', async () => {
    await fileSystem.set('key4', 'value4')
    await fileSystem.del('key4')
    expect(await fileSystem.get('key4')).toBeUndefined()
  })

  it('should delete multiple fileSystem cache values', async () => {
    await fileSystem.set('key5', 'value5')
    await fileSystem.set('key6', 'value6')
    await fileSystem.deleteMany(['key5', 'key6'])

    expect(await fileSystem.get('key5')).toBeUndefined()
    expect(await fileSystem.get('key6')).toBeUndefined()
  })

  it('should check if a key exists in fileSystem cache', async () => {
    await fileSystem.set('key7', 'value7')
    expect(await fileSystem.has('key7')).toBe(true)
  })

  it('should return false if a key is missing in fileSystem cache', async () => {
    expect(await fileSystem.missing('nonExistentKey')).toBe(true)
    await fileSystem.set('key8', 'value8')
    expect(await fileSystem.missing('key8')).toBe(false)
  })

  it('should clear all fileSystem cache values', async () => {
    await fileSystem.set('key9', 'value9')
    await fileSystem.set('key10', 'value10')
    await fileSystem.clear()

    expect(await fileSystem.get('key9')).toBeUndefined()
    expect(await fileSystem.get('key10')).toBeUndefined()
  })

  it('should remove a specific fileSystem cache value', async () => {
    await fileSystem.set('key11', 'value11')
    await fileSystem.remove('key11')

    expect(await fileSystem.get('key11')).toBeUndefined()
  })
})
