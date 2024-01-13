import * as pluralize from 'pluralize'

type Rule = string | RegExp
type Replacement = string
type Word = string
export type PluralizeTest = (word: Word) => boolean

export interface Pluralize {
  plural: (word: Word, count?: number, inclusive?: boolean) => Word
  singular: (word: Word) => Word
  isPlural: (word: Word) => boolean
  isSingular: (word: Word) => boolean
  addPluralRule: (rule: Rule, replacement: Replacement) => void
  addSingularRule: (rule: Rule, replacement: Replacement) => void
  addIrregularRule: (single: Word, plural: Word) => void
  addUncountableRule: (word: Word | RegExp) => void
}

export const plural: Pluralize['plural'] = (...args) => pluralize.plural(...args)
export const singular: Pluralize['singular'] = (...args) => pluralize.singular(...args)
export const isPlural: Pluralize['isPlural'] = (...args) => pluralize.isPlural(...args)
export const isSingular: Pluralize['isSingular'] = (...args) => pluralize.isSingular(...args)
export const addPluralRule: Pluralize['addPluralRule'] = (...args) => pluralize.addPluralRule(...args)
export const addSingularRule: Pluralize['addSingularRule'] = (...args) => pluralize.addSingularRule(...args)
export const addIrregularRule: Pluralize['addIrregularRule'] = (...args) => pluralize.addIrregularRule(...args)
export const addUncountableRule: Pluralize['addUncountableRule'] = (...args) => pluralize.addUncountableRule(...args)
