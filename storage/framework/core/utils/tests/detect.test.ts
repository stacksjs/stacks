import { describe, expect, it } from 'bun:test'
import { detectIndent, detectNewline, normalizeNewlines } from '../src/detect'

describe('detectIndent', () => {
  it('should detect space indentation', () => {
    const text = 'function foo() {\n  return true\n}'
    const result = detectIndent(text)
    expect(result.type).toBe('space')
    expect(result.amount).toBe(2)
    expect(result.indent).toBe('  ')
  })

  it('should detect tab indentation', () => {
    const text = 'function foo() {\n\treturn true\n}'
    const result = detectIndent(text)
    expect(result.type).toBe('tab')
    expect(result.amount).toBe(1)
    expect(result.indent).toBe('\t')
  })

  it('should detect 4-space indentation', () => {
    const text = 'function foo() {\n    return true\n}'
    const result = detectIndent(text)
    expect(result.type).toBe('space')
    expect(result.amount).toBe(4)
    expect(result.indent).toBe('    ')
  })

  it('should return null for no indentation', () => {
    const text = 'no indentation here'
    const result = detectIndent(text)
    expect(result.type).toBeNull()
    expect(result.amount).toBe(0)
    expect(result.indent).toBe('')
  })

  it('should handle mixed indentation (spaces win)', () => {
    const text = 'function foo() {\n  line1\n  line2\n\tline3\n}'
    const result = detectIndent(text)
    expect(result.type).toBe('space')
  })

  it('should handle empty string', () => {
    const result = detectIndent('')
    expect(result.type).toBeNull()
    expect(result.amount).toBe(0)
  })
})

describe('detectNewline', () => {
  it('should detect CRLF (Windows)', () => {
    const text = 'line1\r\nline2\r\nline3'
    expect(detectNewline(text)).toBe('\r\n')
  })

  it('should detect LF (Unix)', () => {
    const text = 'line1\nline2\nline3'
    expect(detectNewline(text)).toBe('\n')
  })

  it('should detect CR (old Mac)', () => {
    const text = 'line1\rline2\rline3'
    expect(detectNewline(text)).toBe('\r')
  })

  it('should prioritize CRLF over LF', () => {
    const text = 'line1\r\nline2\nline3'
    expect(detectNewline(text)).toBe('\r\n')
  })

  it('should return null for no newlines', () => {
    const text = 'single line'
    expect(detectNewline(text)).toBeNull()
  })

  it('should handle empty string', () => {
    expect(detectNewline('')).toBeNull()
  })
})

describe('normalizeNewlines', () => {
  it('should normalize CRLF to LF', () => {
    const text = 'line1\r\nline2\r\nline3'
    expect(normalizeNewlines(text)).toBe('line1\nline2\nline3')
  })

  it('should normalize CR to LF', () => {
    const text = 'line1\rline2\rline3'
    expect(normalizeNewlines(text)).toBe('line1\nline2\nline3')
  })

  it('should normalize to custom newline', () => {
    const text = 'line1\nline2\nline3'
    expect(normalizeNewlines(text, '\r\n')).toBe('line1\r\nline2\r\nline3')
  })

  it('should leave LF unchanged by default', () => {
    const text = 'line1\nline2\nline3'
    expect(normalizeNewlines(text)).toBe(text)
  })

  it('should handle mixed newlines', () => {
    const text = 'line1\r\nline2\nline3\rline4'
    expect(normalizeNewlines(text)).toBe('line1\nline2\nline3\nline4')
  })
})
