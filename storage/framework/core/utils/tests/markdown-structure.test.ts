import { expect, test } from 'bun:test'
import { markdownTable, markdownTableFromObjects } from '../src/markdown'

test('every Markdown table row has the selected column count, including short headers', () => {
  const text = markdownTable([['Name'], ['Alice', 30], [], ['Bob']])
  const html = Bun.markdown.html(text)
  expect(html).toContain('<table>')
  expect(html.match(/<th[ >]/g)).toHaveLength(2)
  expect(html.match(/<td[ >]/g)).toHaveLength(6)
  expect(html).toContain('Alice')
})

test('text cells preserve pipes and literal backslashes without injecting table rows', () => {
  const input = 'a\\|b\r\nnext\rthird\nfourth'
  const text = markdownTable([['Name'], [input]])
  expect(text.split('\n')).toHaveLength(3)
  const html = Bun.markdown.html(text)
  expect(html).toContain('a\\|b<br>next<br>third<br>fourth')
  expect(html.match(/<td[ >]/g)).toHaveLength(1)
  expect(Bun.markdown.html(markdownTableFromObjects([{ name: 'a|b', age: 1 }]))).toContain('a|b')
})


test('already formatted cells can opt out of text escaping explicitly', () => {
  const html = Bun.markdown.html(markdownTable([['Name'], ['a\\|b']], { escapeCells: false }))
  expect(html).toContain('a|b')
})
