import { expect, test } from 'bun:test'
import { response as canonicalResponse } from '@stacksjs/bun-router'
import { response } from '../src/response'

test('response entry exports the canonical response factory', () => {
  expect(response).toBe(canonicalResponse)
})
