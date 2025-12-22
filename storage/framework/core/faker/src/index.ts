import { faker as baseFaker } from 'ts-mocker'
import type { Faker as BaseFaker } from 'ts-mocker'

/**
 * Enhanced lorem module with better API
 */
const enhancedLorem = {
  ...baseFaker.lorem,

  /**
   * Generate a random word
   */
  word(): string {
    return baseFaker.lorem.word()
  },

  /**
   * Generate random words
   * @param count - Number of words (default: 3)
   */
  words(count?: number): string {
    return baseFaker.lorem.words(count ?? 3)
  },

  /**
   * Generate a sentence with random words
   * @param maxWords - Maximum number of words in the sentence (default: random 3-10)
   */
  sentence(maxWords?: number): string {
    if (maxWords !== undefined) {
      // Generate random word count between 3 and maxWords
      const minWords = Math.min(3, maxWords)
      const wordCount = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords
      return baseFaker.lorem.sentence(wordCount)
    }
    return baseFaker.lorem.sentence()
  },

  /**
   * Generate multiple sentences
   * @param count - Number of sentences (default: 3)
   * @param separator - Separator between sentences (default: ' ')
   */
  sentences(count?: number, separator?: string): string {
    return baseFaker.lorem.sentences(count ?? 3, separator ?? ' ')
  },

  /**
   * Generate a paragraph
   * @param sentenceCount - Number of sentences in the paragraph
   */
  paragraph(sentenceCount?: number): string {
    return baseFaker.lorem.paragraph(sentenceCount)
  },

  /**
   * Generate multiple paragraphs
   * @param count - Number of paragraphs (default: 3)
   * @param separator - Separator between paragraphs (default: '\n\n')
   */
  paragraphs(count?: number, separator?: string): string {
    return baseFaker.lorem.paragraphs(count ?? 3, separator ?? '\n\n')
  },

  /**
   * Generate lorem text of specified length
   * @param length - Target character length (default: 200)
   */
  text(length?: number): string {
    return baseFaker.lorem.text(length)
  },

  /**
   * Generate a slug from lorem words
   * @param wordCount - Number of words in the slug (default: 3)
   */
  slug(wordCount?: number): string {
    return baseFaker.lorem.slug(wordCount ?? 3)
  },

  /**
   * Generate multiple lines of sentences
   * @param count - Number of lines (default: 3)
   */
  lines(count?: number): string {
    return baseFaker.lorem.lines(count ?? 3)
  },
}

/**
 * Enhanced faker instance with improved lorem API
 */
export const faker = {
  ...baseFaker,
  lorem: enhancedLorem,
}

export type Faker = BaseFaker
