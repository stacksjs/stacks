import { describe, expect, it } from 'bun:test'
import { slugify } from '../src/slug'
import { titleCase, WORD_SEPARATORS } from '../src/title-case'
import { slug } from '../src/utils'

const EM_DASH = '\u2014'
const EN_DASH = '\u2013'

// A sweep for em-dashes in user-facing copy (cbc6e2c2ac) replaced these two
// with hyphens in data tables, where the dash is the subject.
describe('the dashes the em-dash sweep turned into hyphens', () => {
  it('titleCase capitalizes the word after an em or en dash', () => {
    expect(WORD_SEPARATORS.has(EM_DASH)).toBe(true)
    expect(WORD_SEPARATORS.has(EN_DASH)).toBe(true)
    expect(titleCase(`well${EM_DASH}known fact`)).toBe(`Well${EM_DASH}Known Fact`)
    expect(titleCase(`pages one${EN_DASH}two`)).toBe(`Pages One${EN_DASH}Two`)
  })

  it('an en dash separates the words of a slug', () => {
    expect(slug(`Pages 1${EN_DASH}10`)).toBe('pages-1-10')
    expect(slugify(`a ${EN_DASH} b`)).toBe('a-b')
  })
})
