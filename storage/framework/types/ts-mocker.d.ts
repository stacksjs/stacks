declare module 'ts-mocker' {
  export interface Faker {
    string: {
      uuid: () => string
      alphanumeric: (len?: number) => string
      alpha: (len?: number) => string
      sample: () => string
    }
    number: {
      int: (options?: { min?: number, max?: number }) => number
      float: (options?: { min?: number, max?: number, fractionDigits?: number }) => number
    }
    random: {
      boolean: () => boolean
    }
    person: {
      firstName: () => string
      lastName: () => string
      fullName: () => string
    }
    internet: {
      email: () => string
      url: () => string
      userName: () => string
    }
    lorem: {
      sentence: (wordCount?: number) => string
      sentences: (count?: number, separator?: string) => string
      paragraph: (sentenceCount?: number) => string
      paragraphs: (count?: number, separator?: string) => string
      word: () => string
      words: (count?: number) => string
      text: (length?: number) => string
      slug: (wordCount?: number) => string
      lines: (count?: number) => string
    }
    date: {
      past: () => Date
      future: () => Date
      recent: () => Date
    }
    datatype: {
      boolean: () => boolean
    }
    image: {
      url: () => string
    }
    phone: {
      number: () => string
    }
    company: {
      name: () => string
      buzzPhrase?: () => string
    }
    word: {
      adjective: () => string
      noun: () => string
    }
    address: {
      city: () => string
      country: () => string
      countryCode: () => string
      streetAddress: (options?: { useFullAddress?: boolean }) => string
      street: () => string
      state: () => string
      stateAbbr: () => string
      zipCode: () => string
      latitude: (options?: { min?: number, max?: number, precision?: number }) => number
      longitude: (options?: { min?: number, max?: number, precision?: number }) => number
      direction: () => string
      buildingNumber: () => string
    }
    helpers: {
      arrayElement: <T>(arr: T[]) => T
    }
    vehicle: {
      [key: string]: (...args: any[]) => any
    }
  }

  export const faker: Faker
}
