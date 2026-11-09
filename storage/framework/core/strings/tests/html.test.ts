import { describe, expect, it } from 'bun:test'
import { decodeHtmlEntities } from '../src/html'

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hex references', () => {
    expect(decodeHtmlEntities('Trail Runner &times; 3')).toBe(`Trail Runner ${String.fromCodePoint(0xD7)} 3`)
    expect(decodeHtmlEntities('Hoodie &amp; Logo &#8211; Navy')).toBe(`Hoodie & Logo ${String.fromCodePoint(0x2013)} Navy`)
    expect(decodeHtmlEntities('&quot;Rock&#x2019;n&#039;roll&quot; &lt;3')).toBe(`"Rock${String.fromCodePoint(0x2019)}n'roll" <3`)
  })

  it('decodes once, so an escaped reference stays text', () => {
    expect(decodeHtmlEntities('&amp;amp;')).toBe('&amp;')
    expect(decodeHtmlEntities('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;')
  })

  it('leaves what is not a reference as written', () => {
    expect(decodeHtmlEntities('AT&T and &unknown; and &#0; and &#x110000;')).toBe('AT&T and &unknown; and &#0; and &#x110000;')
  })
})
