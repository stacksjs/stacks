import { describe, expect, it } from 'bun:test'
import {
  camelCase,
  capitalize,
  constantCase,
  dotCase,
  kebabCase,
  lowercase,
  noCase,
  paramCase,
  pascalCase,
  pascalSnakeCase,
  pathCase,
  sentenceCase,
  snakeCase,
  split,
  splitSeparateNumbers,
  trainCase,
} from '../src/case'

describe('capitalize', () => {
  it('should capitalize the first letter and lowercase the rest', () => {
    expect(capitalize('hello world')).toBe('Hello world')
  })

  it('should handle single character', () => {
    expect(capitalize('h')).toBe('H')
  })

  it('should return empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })

  it('should lowercase the rest of the string', () => {
    expect(capitalize('HELLO')).toBe('Hello')
  })
})

describe('lowercase', () => {
  it('should convert to lowercase', () => {
    expect(lowercase('HELLO WORLD')).toBe('hello world')
  })
})

describe('split', () => {
  it('should split camelCase words', () => {
    expect(split('helloWorld')).toEqual(['hello', 'World'])
  })

  it('should split PascalCase words', () => {
    expect(split('HelloWorld')).toEqual(['Hello', 'World'])
  })

  it('should split snake_case words', () => {
    expect(split('hello_world')).toEqual(['hello', 'world'])
  })

  it('should split kebab-case words', () => {
    expect(split('hello-world')).toEqual(['hello', 'world'])
  })

  it('should return empty array for empty string', () => {
    expect(split('')).toEqual([])
  })

  it('should handle single word', () => {
    expect(split('hello')).toEqual(['hello'])
  })
})

describe('splitSeparateNumbers', () => {
  it('should separate numbers from words', () => {
    expect(splitSeparateNumbers('hello2world')).toEqual(['hello', '2', 'world'])
  })
})

describe('camelCase', () => {
  it('should convert space-separated words', () => {
    expect(camelCase('hello world')).toBe('helloWorld')
  })

  it('should convert kebab-case', () => {
    expect(camelCase('hello-world')).toBe('helloWorld')
  })

  it('should convert snake_case', () => {
    expect(camelCase('hello_world')).toBe('helloWorld')
  })

  it('should convert PascalCase', () => {
    expect(camelCase('HelloWorld')).toBe('helloWorld')
  })

  it('should handle already camelCase', () => {
    expect(camelCase('helloWorld')).toBe('helloWorld')
  })

  it('should handle empty string', () => {
    expect(camelCase('')).toBe('')
  })

  it('should handle single word', () => {
    expect(camelCase('hello')).toBe('hello')
  })

  it('should handle multiple words', () => {
    expect(camelCase('the quick brown fox')).toBe('theQuickBrownFox')
  })

  it('should handle CONSTANT_CASE input', () => {
    expect(camelCase('HELLO_WORLD')).toBe('helloWorld')
  })
})

describe('pascalCase', () => {
  it('should convert space-separated words', () => {
    expect(pascalCase('hello world')).toBe('HelloWorld')
  })

  it('should convert kebab-case', () => {
    expect(pascalCase('hello-world')).toBe('HelloWorld')
  })

  it('should convert snake_case', () => {
    expect(pascalCase('hello_world')).toBe('HelloWorld')
  })

  it('should convert camelCase', () => {
    expect(pascalCase('helloWorld')).toBe('HelloWorld')
  })

  it('should handle already PascalCase', () => {
    expect(pascalCase('HelloWorld')).toBe('HelloWorld')
  })

  it('should handle empty string', () => {
    expect(pascalCase('')).toBe('')
  })

  it('should handle single word', () => {
    expect(pascalCase('hello')).toBe('Hello')
  })
})

describe('snakeCase', () => {
  it('should convert space-separated words', () => {
    expect(snakeCase('hello world')).toBe('hello_world')
  })

  it('should convert camelCase', () => {
    expect(snakeCase('helloWorld')).toBe('hello_world')
  })

  it('should convert PascalCase', () => {
    expect(snakeCase('HelloWorld')).toBe('hello_world')
  })

  it('should handle already snake_case', () => {
    expect(snakeCase('hello_world')).toBe('hello_world')
  })

  it('should handle empty string', () => {
    expect(snakeCase('')).toBe('')
  })
})

describe('kebabCase', () => {
  it('should convert space-separated words', () => {
    expect(kebabCase('hello world')).toBe('hello-world')
  })

  it('should convert camelCase', () => {
    expect(kebabCase('helloWorld')).toBe('hello-world')
  })

  it('should convert PascalCase', () => {
    expect(kebabCase('HelloWorld')).toBe('hello-world')
  })

  it('should handle already kebab-case', () => {
    expect(kebabCase('hello-world')).toBe('hello-world')
  })

  it('should handle empty string', () => {
    expect(kebabCase('')).toBe('')
  })
})

describe('constantCase', () => {
  it('should convert space-separated words', () => {
    expect(constantCase('hello world')).toBe('HELLO_WORLD')
  })

  it('should convert camelCase', () => {
    expect(constantCase('helloWorld')).toBe('HELLO_WORLD')
  })

  it('should convert PascalCase', () => {
    expect(constantCase('HelloWorld')).toBe('HELLO_WORLD')
  })

  it('should handle already CONSTANT_CASE', () => {
    expect(constantCase('HELLO_WORLD')).toBe('HELLO_WORLD')
  })

  it('should handle empty string', () => {
    expect(constantCase('')).toBe('')
  })
})

describe('dotCase', () => {
  it('should convert space-separated words', () => {
    expect(dotCase('hello world')).toBe('hello.world')
  })

  it('should convert camelCase', () => {
    expect(dotCase('helloWorld')).toBe('hello.world')
  })

  it('should handle empty string', () => {
    expect(dotCase('')).toBe('')
  })
})

describe('pathCase', () => {
  it('should convert space-separated words', () => {
    expect(pathCase('hello world')).toBe('hello/world')
  })

  it('should convert camelCase', () => {
    expect(pathCase('helloWorld')).toBe('hello/world')
  })

  it('should handle empty string', () => {
    expect(pathCase('')).toBe('')
  })
})

describe('noCase', () => {
  it('should convert camelCase to space-separated lowercase', () => {
    expect(noCase('helloWorld')).toBe('hello world')
  })

  it('should convert PascalCase', () => {
    expect(noCase('HelloWorld')).toBe('hello world')
  })

  it('should handle empty string', () => {
    expect(noCase('')).toBe('')
  })
})

describe('sentenceCase', () => {
  it('should capitalize first word only', () => {
    expect(sentenceCase('hello world')).toBe('Hello world')
  })

  it('should convert camelCase to sentence', () => {
    expect(sentenceCase('helloWorld')).toBe('Hello world')
  })

  it('should handle empty string', () => {
    expect(sentenceCase('')).toBe('')
  })
})

describe('trainCase', () => {
  it('should convert to Train-Case (header case)', () => {
    expect(trainCase('hello world')).toBe('Hello-World')
  })

  it('should convert camelCase', () => {
    expect(trainCase('helloWorld')).toBe('Hello-World')
  })

  it('should handle empty string', () => {
    expect(trainCase('')).toBe('')
  })
})

describe('pascalSnakeCase', () => {
  it('should convert to Pascal_Snake_Case', () => {
    expect(pascalSnakeCase('hello world')).toBe('Hello_World')
  })

  it('should convert camelCase', () => {
    expect(pascalSnakeCase('helloWorld')).toBe('Hello_World')
  })

  it('should handle empty string', () => {
    expect(pascalSnakeCase('')).toBe('')
  })
})

describe('paramCase', () => {
  it('should behave the same as kebabCase', () => {
    expect(paramCase('hello world')).toBe('hello-world')
    expect(paramCase('helloWorld')).toBe('hello-world')
  })
})

describe('edge cases', () => {
  it('should handle strings with numbers', () => {
    expect(camelCase('version 2 release')).toBe('version_2Release')
    expect(snakeCase('version2Release')).toBe('version2_release')
  })

  it('should handle strings with special characters', () => {
    expect(camelCase('hello!@#world')).toBe('helloWorld')
    expect(kebabCase('foo & bar')).toBe('foo-bar')
  })

  it('should handle multiple spaces and delimiters', () => {
    expect(camelCase('hello   world')).toBe('helloWorld')
    expect(snakeCase('hello---world')).toBe('hello_world')
  })

  it('should handle single character words', () => {
    expect(camelCase('a b c')).toBe('aBC')
  })
})
