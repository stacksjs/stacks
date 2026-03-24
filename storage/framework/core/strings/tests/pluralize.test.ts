import { describe, expect, it } from 'bun:test'
import { pluralize } from '../src/pluralize'

describe('pluralize', () => {
  describe('regular plurals', () => {
    it('should pluralize regular nouns by adding s', () => {
      expect(pluralize.plural('cat')).toBe('cats')
    })

    it('should pluralize words ending in s/sh/ch/x/z with es', () => {
      expect(pluralize.plural('box')).toBe('boxes')
      expect(pluralize.plural('bus')).toBe('buses')
      expect(pluralize.plural('wish')).toBe('wishes')
      expect(pluralize.plural('watch')).toBe('watches')
      expect(pluralize.plural('buzz')).toBe('buzzes')
    })

    it('should pluralize words ending in consonant + y by replacing y with ies', () => {
      expect(pluralize.plural('city')).toBe('cities')
      expect(pluralize.plural('puppy')).toBe('puppies')
    })

    it('should pluralize words ending in f/fe', () => {
      expect(pluralize.plural('knife')).toBe('knives')
      expect(pluralize.plural('wife')).toBe('wives')
      expect(pluralize.plural('leaf')).toBe('leaves')
    })
  })

  describe('irregular plurals', () => {
    it('should handle child -> children', () => {
      expect(pluralize.plural('child')).toBe('children')
    })

    it('should handle person -> people', () => {
      expect(pluralize.plural('person')).toBe('people')
    })

    it('should handle foot -> feet', () => {
      expect(pluralize.plural('foot')).toBe('feet')
    })

    it('should handle tooth -> teeth', () => {
      expect(pluralize.plural('tooth')).toBe('teeth')
    })

    it('should handle goose -> geese', () => {
      expect(pluralize.plural('goose')).toBe('geese')
    })

    it('should handle ox -> oxen', () => {
      expect(pluralize.plural('ox')).toBe('oxen')
    })

    it('should handle man -> men', () => {
      expect(pluralize.plural('man')).toBe('men')
    })

    it('should handle woman -> women', () => {
      expect(pluralize.plural('woman')).toBe('women')
    })
  })

  describe('uncountable words', () => {
    it('should not change sheep', () => {
      expect(pluralize.plural('sheep')).toBe('sheep')
    })

    it('should not change fish', () => {
      expect(pluralize.plural('fish')).toBe('fish')
    })

    it('should not change deer', () => {
      expect(pluralize.plural('deer')).toBe('deer')
    })

    it('should not change moose', () => {
      expect(pluralize.plural('moose')).toBe('moose')
    })

    it('should not change series', () => {
      expect(pluralize.plural('series')).toBe('series')
    })

    it('should not change software', () => {
      expect(pluralize.plural('software')).toBe('software')
    })
  })

  describe('singular from plural', () => {
    it('should singularize regular plurals', () => {
      expect(pluralize.singular('cats')).toBe('cat')
    })

    it('should singularize children -> child', () => {
      expect(pluralize.singular('children')).toBe('child')
    })

    it('should singularize people -> person', () => {
      expect(pluralize.singular('people')).toBe('person')
    })

    it('should singularize men -> man', () => {
      expect(pluralize.singular('men')).toBe('man')
    })

    it('should singularize knives -> knife', () => {
      expect(pluralize.singular('knives')).toBe('knife')
    })

    it('should singularize cities -> city', () => {
      expect(pluralize.singular('cities')).toBe('city')
    })
  })

  describe('isPlural / isSingular', () => {
    it('should detect plural words', () => {
      expect(pluralize.isPlural('cats')).toBe(true)
      expect(pluralize.isPlural('cat')).toBe(false)
    })

    it('should detect singular words', () => {
      expect(pluralize.isSingular('cat')).toBe(true)
      expect(pluralize.isSingular('cats')).toBe(false)
    })

    it('should handle uncountable as both singular and plural', () => {
      expect(pluralize.isPlural('sheep')).toBe(true)
      expect(pluralize.isSingular('sheep')).toBe(true)
    })
  })

  describe('pluralize function with options', () => {
    it('should return singular when count is 1', () => {
      expect(pluralize('cat', { count: 1 })).toBe('cat')
    })

    it('should return plural when count is not 1', () => {
      expect(pluralize('cat', { count: 2 })).toBe('cats')
      expect(pluralize('cat', { count: 0 })).toBe('cats')
    })

    it('should include count when inclusive is true', () => {
      expect(pluralize('cat', { count: 2, inclusive: true })).toBe('2 cats')
      expect(pluralize('cat', { count: 1, inclusive: true })).toBe('1 cat')
    })

    it('should default to plural (count=2) when no options given', () => {
      expect(pluralize('cat')).toBe('cats')
    })

    it('should throw TypeError for non-string input', () => {
      // eslint-disable-next-line ts/no-unsafe-argument
      expect(() => pluralize(123 as any)).toThrow(TypeError)
    })
  })

  describe('case preservation', () => {
    it('should preserve uppercase input', () => {
      expect(pluralize.plural('CAT')).toBe('CATS')
    })

    it('should preserve capitalized input', () => {
      expect(pluralize.plural('Cat')).toBe('Cats')
    })

    it('should preserve lowercase input', () => {
      expect(pluralize.plural('cat')).toBe('cats')
    })
  })
})
