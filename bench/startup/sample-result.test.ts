import { describe, expect, test } from 'bun:test'
import { parseProcessSample } from './sample-result'

describe('fresh-process startup sample output', () => {
  test('accepts one strict measurement object', () => {
    expect(parseProcessSample('{"importMs":1.25,"rssBytes":123456}\n', '')).toEqual({
      importMs: 1.25,
      rssBytes: 123456,
    })
  })

  test('rejects logs, diagnostics, and invalid measurements', () => {
    expect(() => parseProcessSample('log\n{"importMs":1,"rssBytes":2}', '')).toThrow('malformed JSON')
    expect(() => parseProcessSample('{"importMs":1,"rssBytes":2}', 'warning')).toThrow('wrote to stderr')
    expect(() => parseProcessSample('{"importMs":0,"rssBytes":2}', '')).toThrow('invalid import time')
    expect(() => parseProcessSample('{"importMs":1,"rssBytes":2.5}', '')).toThrow('invalid RSS')
  })
})
