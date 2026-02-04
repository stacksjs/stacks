import { faker as baseFaker } from 'ts-mocker'
import type { Faker as BaseFaker } from 'ts-mocker'

/**
 * Compatibility layer for @faker-js/faker API
 * ts-mocker uses different module names, so we create aliases
 */

// datatype module for boolean, number generation (compatibility with @faker-js/faker)
const datatype = {
  boolean(): boolean {
    return baseFaker.random.boolean()
  },
  number(options?: { min?: number; max?: number }): number {
    return baseFaker.number.int({ min: options?.min ?? 0, max: options?.max ?? 100 })
  },
  float(options?: { min?: number; max?: number; precision?: number }): number {
    return baseFaker.number.float({ min: options?.min ?? 0, max: options?.max ?? 1, fractionDigits: options?.precision ?? 2 })
  },
  uuid(): string {
    return baseFaker.string.uuid()
  },
  string(length?: number): string {
    return baseFaker.string.alphanumeric(length ?? 10)
  },
  array<T>(generator: () => T, length?: number): T[] {
    const arr: T[] = []
    const len = length ?? baseFaker.number.int({ min: 1, max: 10 })
    for (let i = 0; i < len; i++) {
      arr.push(generator())
    }
    return arr
  },
}

// location module (alias to address for @faker-js/faker compatibility)
const location = {
  street(): string {
    return baseFaker.address.street()
  },
  streetAddress(useFullAddress?: boolean): string {
    return baseFaker.address.streetAddress({ useFullAddress })
  },
  city(): string {
    return baseFaker.address.city()
  },
  state(): string {
    return baseFaker.address.state()
  },
  stateAbbr(): string {
    return baseFaker.address.stateAbbr()
  },
  country(): string {
    return baseFaker.address.country()
  },
  countryCode(): string {
    return baseFaker.address.countryCode()
  },
  zipCode(): string {
    return baseFaker.address.zipCode()
  },
  latitude(options?: { min?: number; max?: number; precision?: number }): number {
    return baseFaker.address.latitude(options)
  },
  longitude(options?: { min?: number; max?: number; precision?: number }): number {
    return baseFaker.address.longitude(options)
  },
  direction(): string {
    return baseFaker.address.direction()
  },
  buildingNumber(): string {
    return baseFaker.address.buildingNumber()
  },
}

// company module enhancements
const company = {
  ...baseFaker.company,
  name(): string {
    return baseFaker.company.name()
  },
  catchPhrase(): string {
    // ts-mocker might not have catchPhrase, generate similar content
    return baseFaker.company.buzzPhrase?.() ?? `${baseFaker.word.adjective()} ${baseFaker.word.noun()}`
  },
  buzzPhrase(): string {
    return baseFaker.company.buzzPhrase?.() ?? baseFaker.lorem.sentence(3)
  },
}

// vehicle module enhancements
const vehicle = {
  ...baseFaker.vehicle,
  vrm(): string {
    // UK Vehicle Registration Mark - generate a pattern like "AB12 CDE"
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    return `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}${numbers[Math.floor(Math.random() * 10)]}${numbers[Math.floor(Math.random() * 10)]} ${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}`
  },
  vehicle(): string {
    // Generate a vehicle description like "Toyota Camry" or "Ford F-150"
    const makes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes', 'Audi', 'Tesla', 'Nissan', 'Hyundai']
    const models = ['Sedan', 'SUV', 'Truck', 'Coupe', 'Hatchback', 'Wagon', 'Van', 'Crossover']
    return `${makes[Math.floor(Math.random() * makes.length)]} ${models[Math.floor(Math.random() * models.length)]}`
  },
  type(): string {
    const types = ['Sedan', 'SUV', 'Truck', 'Van', 'Coupe', 'Convertible', 'Wagon', 'Hatchback']
    return types[Math.floor(Math.random() * types.length)]
  },
  manufacturer(): string {
    const manufacturers = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes-Benz', 'Audi', 'Tesla', 'Nissan', 'Hyundai', 'Kia', 'Volkswagen']
    return manufacturers[Math.floor(Math.random() * manufacturers.length)]
  },
  model(): string {
    const models = ['Camry', 'Accord', 'F-150', 'Silverado', '3 Series', 'C-Class', 'A4', 'Model 3', 'Altima', 'Elantra']
    return models[Math.floor(Math.random() * models.length)]
  },
  fuel(): string {
    const fuels = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid']
    return fuels[Math.floor(Math.random() * fuels.length)]
  },
  vin(): string {
    // Generate a 17-character VIN
    const chars = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'
    let vin = ''
    for (let i = 0; i < 17; i++) {
      vin += chars[Math.floor(Math.random() * chars.length)]
    }
    return vin
  },
  color(): string {
    const colors = ['Black', 'White', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Brown', 'Orange', 'Yellow']
    return colors[Math.floor(Math.random() * colors.length)]
  },
}

// helpers module enhancements for @faker-js/faker compatibility
const helpers = {
  ...baseFaker.helpers,
  arrayElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  },
  arrayElements<T>(array: T[], count?: number): T[] {
    const n = count ?? Math.floor(Math.random() * array.length) + 1
    const shuffled = [...array].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(n, array.length))
  },
  shuffle<T>(array: T[]): T[] {
    return [...array].sort(() => Math.random() - 0.5)
  },
  maybe<T>(callback: () => T, options?: { probability?: number }): T | undefined {
    const probability = options?.probability ?? 0.5
    return Math.random() < probability ? callback() : undefined
  },
  objectKey<T extends object>(obj: T): keyof T {
    const keys = Object.keys(obj) as (keyof T)[]
    return keys[Math.floor(Math.random() * keys.length)]
  },
  objectValue<T extends object>(obj: T): T[keyof T] {
    const values = Object.values(obj)
    return values[Math.floor(Math.random() * values.length)]
  },
}

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
 * Enhanced faker instance with improved lorem API and @faker-js/faker compatibility
 */
export const faker = {
  ...baseFaker,
  lorem: enhancedLorem,
  datatype,
  location,
  company,
  vehicle,
  helpers,
}

export type Faker = BaseFaker
