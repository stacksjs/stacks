import { describe, expect, it, jest } from 'bun:test'
import { local } from '../src/drivers'

describe('@stacksjs/storage', () => {
  it('should read the file', async () => {
    const contents = await local.readToString('./dirs/sample.txt')

    console.log(contents)
  })
})
