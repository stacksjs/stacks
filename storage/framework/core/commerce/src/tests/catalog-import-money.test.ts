import { describe, expect, it } from 'bun:test'
import { catalogUuid, uuidV5 } from '../imports/identity'
import { normalizeStoreUrl, storeHost } from '../imports/http'
import { currencyExponent, decimalToMinor, formatMinor, minorToDecimal, PriceFormatError, rescaleMinor } from '../imports/money'
import { cleanName, decodeHtmlEntities } from '../imports/text'

/**
 * The boundary conversions the catalog importer leans on. A price read wrong
 * here is wrong on every product of every store, silently, so each accepted
 * and each rejected shape is pinned.
 */

describe('decimalToMinor', () => {
  it.each([
    ['19.99', 1999],
    ['0.10', 10],
    ['1999', 199900],
    ['19.9', 1990],
    ['0', 0],
    ['0.00', 0],
    ['.5', 50],
    ['5.', 500],
    [' 24.00 ', 2400],
    ['1.005', 101],
    ['1.004', 100],
    ['0.995', 100],
  ])('reads %p as %p cents', (input, cents) => {
    expect(decimalToMinor(input)).toBe(cents)
  })

  it('never goes through a float', () => {
    // 1.005 * 100 is 100.49999999999999 in IEEE 754; string math says 101.
    expect(Math.round(1.005 * 100)).toBe(100)
    expect(decimalToMinor('1.005')).toBe(101)
    expect(decimalToMinor('4.35')).toBe(435)
    expect(decimalToMinor('1234567.89')).toBe(123456789)
  })

  it('treats empty as unpriced rather than free', () => {
    expect(decimalToMinor('')).toBeNull()
    expect(decimalToMinor('   ')).toBeNull()
    expect(decimalToMinor(null)).toBeNull()
    expect(decimalToMinor(undefined)).toBeNull()
  })

  it.each(['1,000.00', '1,99', '-5.00', '+5', '1e3', 'abc', '.', '19.99 USD', '$19.99', 'NaN'])('rejects %p', (input) => {
    expect(() => decimalToMinor(input)).toThrow(PriceFormatError)
  })

  it('rejects an amount too large to store exactly', () => {
    expect(() => decimalToMinor('99999999999999999.99')).toThrow('too large')
  })

  it('honours the currency precision', () => {
    expect(decimalToMinor('1999', 0)).toBe(1999)
    expect(decimalToMinor('1999.00', 0)).toBe(1999)
    expect(decimalToMinor('1999.50', 0)).toBe(2000)
    expect(decimalToMinor('1.234', 3)).toBe(1234)
    expect(decimalToMinor('1.2', 3)).toBe(1200)
  })

  it('accepts a number that arrived as JSON', () => {
    expect(decimalToMinor(19.99)).toBe(1999)
  })
})

describe('minorToDecimal and rescaleMinor', () => {
  it('formats minor units back to a decimal', () => {
    expect(minorToDecimal(1999)).toBe('19.99')
    expect(minorToDecimal(5)).toBe('0.05')
    expect(minorToDecimal(0)).toBe('0.00')
    expect(minorToDecimal(1999, 0)).toBe('1999')
    expect(minorToDecimal(1234, 3)).toBe('1.234')
  })

  it('keeps a WooCommerce amount at the same precision unchanged', () => {
    expect(rescaleMinor('1105', 2, 2)).toBe(1105)
  })

  it('scales a store configured with fewer decimals than its currency', () => {
    // A USD store set to 0 decimals sends "20" for $20.00.
    expect(rescaleMinor('20', 0, 2)).toBe(2000)
  })

  it('rounds a store configured with more decimals than its currency', () => {
    // A JPY store set to 2 decimals sends "199950" for 1999.50 yen.
    expect(rescaleMinor('199950', 2, 0)).toBe(2000)
    expect(rescaleMinor('199949', 2, 0)).toBe(1999)
  })

  it('treats an empty Store API price as unpriced', () => {
    expect(rescaleMinor('', 2, 2)).toBeNull()
    expect(rescaleMinor(null, 2, 2)).toBeNull()
  })

  it('rejects a non-integer amount where minor units were promised', () => {
    expect(() => rescaleMinor('19.99', 2, 2)).toThrow(PriceFormatError)
  })
})

describe('currencyExponent', () => {
  it('reads ISO 4217 precision', () => {
    expect(currencyExponent('USD')).toBe(2)
    expect(currencyExponent('GBP')).toBe(2)
    expect(currencyExponent('JPY')).toBe(0)
    expect(currencyExponent('KWD')).toBe(3)
  })

  it('assumes 2 for an unknown or missing currency', () => {
    expect(currencyExponent(null)).toBe(2)
    expect(currencyExponent('NOT-A-CODE')).toBe(2)
  })

  it('formats for reports in the currency precision', () => {
    expect(formatMinor(1999, 'USD')).toBe('19.99 USD')
    expect(formatMinor(1999, 'JPY')).toBe('1999 JPY')
    expect(formatMinor(1999, null)).toBe('19.99')
  })
})

describe('uuidV5', () => {
  it('matches the RFC 9562 reference value', () => {
    // The DNS namespace example every v5 implementation is checked against.
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })

  it('is stable per record and distinct across stores, sources and kinds', () => {
    const id = catalogUuid('shopify', 'shop.example.com', 'product', '1')
    expect(catalogUuid('shopify', 'SHOP.example.com', 'product', '1')).toBe(id)
    expect(catalogUuid('shopify', 'other.example.com', 'product', '1')).not.toBe(id)
    expect(catalogUuid('woocommerce', 'shop.example.com', 'product', '1')).not.toBe(id)
    expect(catalogUuid('shopify', 'shop.example.com', 'variant', '1')).not.toBe(id)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('HTML entities in names', () => {
  it('decodes named, decimal and hex references once', () => {
    expect(decodeHtmlEntities('Hoodie &amp; Logo &#8211; Navy')).toBe(`Hoodie & Logo ${String.fromCodePoint(0x2013)} Navy`)
    // What WordPress actually emits: esc_html's five, and wptexturize's numerics.
    expect(decodeHtmlEntities('&quot;Rock&#x2019;n&#039;roll&quot; &lt;3')).toBe(`"Rock${String.fromCodePoint(0x2019)}n'roll" <3`)
    expect(decodeHtmlEntities('&amp;amp;')).toBe('&amp;')
    expect(decodeHtmlEntities('AT&T and &unknown;')).toBe('AT&T and &unknown;')
  })

  it('cleans a name for storage', () => {
    expect(cleanName('  Thread &amp;\n Needle ')).toBe('Thread & Needle')
    expect(cleanName(undefined)).toBe('')
  })
})

describe('normalizeStoreUrl', () => {
  it('accepts a bare host and strips the trailing slash', () => {
    expect(normalizeStoreUrl('Shop.Example.com/')).toBe('https://shop.example.com')
    expect(normalizeStoreUrl('https://shop.example.com/?ref=x#top')).toBe('https://shop.example.com')
  })

  it('keeps a WordPress subdirectory', () => {
    expect(normalizeStoreUrl('https://example.com/shop/')).toBe('https://example.com/shop')
    expect(storeHost('https://example.com/shop')).toBe('example.com')
  })

  it('rejects what is not an http(s) URL', () => {
    expect(() => normalizeStoreUrl('')).toThrow('required')
    expect(() => normalizeStoreUrl('ftp://example.com')).toThrow('http(s)')
  })
})
