import { describe, expect, it } from 'bun:test'
import { markdownTable, markdownTableFromObjects } from '../src/markdown'

describe('markdownTable', () => {
  it('should create a basic table', () => {
    const table = [
      ['Name', 'Age'],
      ['Alice', '30'],
      ['Bob', '25'],
    ]

    const result = markdownTable(table)
    expect(result).toContain('| Name  | Age |')
    expect(result).toContain('| Alice | 30  |')
    expect(result).toContain('| Bob   | 25  |')
  })

  it('should handle alignment', () => {
    const table = [
      ['Left', 'Center', 'Right'],
      ['L', 'C', 'R'],
    ]

    const result = markdownTable(table, {
      align: ['left', 'center', 'right'],
    })

    expect(result).toContain(':---')
    expect(result).toContain(':----:')
    expect(result).toContain('----:')
  })

  it('should handle short alignment notation', () => {
    const table = [
      ['L', 'C', 'R'],
      ['1', '2', '3'],
    ]

    const result = markdownTable(table, {
      align: ['l', 'c', 'r'],
    })

    expect(result).toContain(':-')
    expect(result).toContain(':-:')
    expect(result).toContain('-:')
  })

  it('should handle padding option', () => {
    const table = [
      ['A', 'B'],
      ['1', '2'],
    ]

    const resultWithPadding = markdownTable(table, { padding: true })
    const resultWithoutPadding = markdownTable(table, { padding: false })

    expect(resultWithPadding).toContain(' A ')
    expect(resultWithoutPadding).not.toContain(' A ')
  })

  it('should handle delimiter options', () => {
    const table = [
      ['A', 'B'],
      ['1', '2'],
    ]

    const result = markdownTable(table, {
      delimiterStart: false,
      delimiterEnd: false,
    })

    expect(result).not.toMatch(/^\|/)
    expect(result).not.toMatch(/\|$/)
  })

  it('should handle null and undefined values', () => {
    const table = [
      ['A', 'B', 'C'],
      ['1', null, undefined],
    ]

    const result = markdownTable(table)
    expect(result).toContain('| 1 |')
    expect(result).toContain('|   |')
  })

  it('should handle numbers and booleans', () => {
    const table = [
      ['Number', 'Boolean'],
      [42, true],
      [3.14, false],
    ]

    const result = markdownTable(table)
    expect(result).toContain('42')
    expect(result).toContain('true')
    expect(result).toContain('false')
  })

  it('should handle empty table', () => {
    expect(markdownTable([])).toBe('')
  })

  it('should handle varying column counts', () => {
    const table = [
      ['A', 'B', 'C'],
      ['1', '2'],
      ['X', 'Y', 'Z'],
    ]

    const result = markdownTable(table)
    expect(result).toContain('A')
    expect(result).toContain('Z')
  })

  it('should handle custom alignment delimiter', () => {
    const table = [
      ['A', 'B'],
      ['1', '2'],
    ]

    const result = markdownTable(table, {
      align: ['left', null],
      alignDelimiter: '=',
    })

    expect(result).toContain(':=')
  })

  it('should pad columns to same width', () => {
    const table = [
      ['Short', 'VeryLongColumnName'],
      ['A', 'B'],
    ]

    const result = markdownTable(table)
    const lines = result.split('\n')

    // All lines should have similar lengths (accounting for delimiters)
    const firstLineLength = lines[0].length
    for (const line of lines) {
      expect(Math.abs(line.length - firstLineLength)).toBeLessThan(5)
    }
  })
})

describe('markdownTableFromObjects', () => {
  it('should create table from objects', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]

    const result = markdownTableFromObjects(data)
    expect(result).toContain('name')
    expect(result).toContain('age')
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })

  it('should handle objects with different keys', () => {
    const data = [
      { a: 1, b: 2 },
      { b: 3, c: 4 },
      { a: 5, c: 6 },
    ]

    const result = markdownTableFromObjects(data)
    expect(result).toContain('a')
    expect(result).toContain('b')
    expect(result).toContain('c')
  })

  it('should handle empty array', () => {
    expect(markdownTableFromObjects([])).toBe('')
  })

  it('should pass options through', () => {
    const data = [
      { left: 'L', center: 'C', right: 'R' },
    ]

    const result = markdownTableFromObjects(data, {
      align: ['left', 'center', 'right'],
    })

    expect(result).toContain(':---')
    expect(result).toContain(':----:')
  })

  it('should handle nested objects (converts to string)', () => {
    const data = [
      { name: 'Test', obj: { nested: 'value' } },
    ]

    const result = markdownTableFromObjects(data)
    expect(result).toContain('[object Object]')
  })
})
