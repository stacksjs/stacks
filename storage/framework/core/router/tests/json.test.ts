import { expect, test } from 'bun:test'
import { parseJsonText } from '../src/json'

const strict = { rejectDuplicateKeys: true }

test('strict JSON keeps key identity local to each object and ignores structural characters inside values', () => {
  const text = String.raw`{"same":{"name":"} ] , : \\\" name"},"entries":[{"name":1},{"name":2}],"other":{"name":3}}`
  expect(parseJsonText(text, strict)).toEqual({ same: { name: '} ] , : \\" name' }, entries: [{ name: 1 }, { name: 2 }], other: { name: 3 } })
  expect(parseJsonText('"quoted text"', strict)).toBe('quoted text')
  expect(parseJsonText('null', strict)).toBeNull()
  expect(parseJsonText('[true,0,-1,1e2]', strict)).toEqual([true, 0, -1, 100])
})

test('strict JSON compares decoded keys including empty, escaped, Unicode and prototype names', () => {
  for (const text of [
    '{"":1,"":2}',
    String.raw`{"a":1,"\u0061":2}`,
    String.raw`{"a\"b":1,"a\u0022b":2}`,
    String.raw`{"😀":1,"\ud83d\ude00":2}`,
    '{"__proto__":1,"__proto__":2}',
    '{"constructor":1,"constructor":2}',
    '{"a":{"a":1,"a":2}}',
    '[{"first":1},{"nested":{"same":1,"same":2}}]',
  ]) expect(() => parseJsonText(text, strict)).toThrow(SyntaxError)
  expect(Object.hasOwn(parseJsonText('{"__proto__":1}', strict) as object, '__proto__')).toBe(true)
  expect(parseJsonText(String.raw`{"é":1,"e\u0301":2}`, strict)).toEqual({ é: 1, 'é': 2 })
})

test('strict JSON retains grammar validation and handles depth without a recursive key traversal', () => {
  for (const text of ['{', '{"a":1,}', '{a:1}', '[1,]', 'NaN', '{"a":1} {"a":2}'])
    expect(() => parseJsonText(text, strict)).toThrow(SyntaxError)
  const depth = 10000
  expect(() => parseJsonText(`${'['.repeat(depth)}{"key":1}${']'.repeat(depth)}`, strict)).not.toThrow()
  expect(() => parseJsonText(`${'['.repeat(depth)}{"key":1,"key":2}${']'.repeat(depth)}`, strict)).toThrow(SyntaxError)
})
