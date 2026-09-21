import { describe, expect, it } from 'bun:test'
import { blue, bold, cyan, dim, green, italic, red, reset, stripColors, supportsColor, underline, yellow } from '../src/colors'

describe('colors', () => {
  it('should colorize text with red', () => {
    const result = red('error')
    if (supportsColor()) {
      expect(result).toContain('\x1B[31m')
      expect(result).toContain('error')
      expect(result).toContain('\x1B[0m')
    }
    else {
      expect(result).toBe('error')
    }
  })

  it('should colorize text with green', () => {
    const result = green('success')
    if (supportsColor()) {
      expect(result).toContain('\x1B[32m')
    }
    else {
      expect(result).toBe('success')
    }
  })

  it('should colorize text with yellow', () => {
    const result = yellow('warning')
    if (supportsColor()) {
      expect(result).toContain('\x1B[33m')
    }
    else {
      expect(result).toBe('warning')
    }
  })

  it('should colorize text with blue', () => {
    const result = blue('info')
    if (supportsColor()) {
      expect(result).toContain('\x1B[34m')
    }
    else {
      expect(result).toBe('info')
    }
  })

  it('should colorize text with cyan', () => {
    const result = cyan('cyan')
    if (supportsColor()) {
      expect(result).toContain('\x1B[36m')
    }
    else {
      expect(result).toBe('cyan')
    }
  })

  it('should apply bold formatting', () => {
    const result = bold('bold text')
    if (supportsColor()) {
      expect(result).toContain('\x1B[1m')
    }
    else {
      expect(result).toBe('bold text')
    }
  })

  it('should apply dim formatting', () => {
    const result = dim('dim text')
    if (supportsColor()) {
      expect(result).toContain('\x1B[2m')
    }
    else {
      expect(result).toBe('dim text')
    }
  })

  it('should apply italic formatting', () => {
    const result = italic('italic text')
    if (supportsColor()) {
      expect(result).toContain('\x1B[3m')
    }
    else {
      expect(result).toBe('italic text')
    }
  })

  it('should apply underline formatting', () => {
    const result = underline('underlined')
    if (supportsColor()) {
      expect(result).toContain('\x1B[4m')
    }
    else {
      expect(result).toBe('underlined')
    }
  })

  it('should handle numbers', () => {
    const result = red(123)
    expect(result).toContain('123')
  })

  it('should reset colors', () => {
    const result = reset('text')
    if (supportsColor()) {
      expect(result).toContain('\x1B[0m')
    }
  })

  it('should allow color chaining via string concatenation', () => {
    const result = red('error: ') + bold('critical')
    expect(result).toContain('error: ')
    expect(result).toContain('critical')
  })
})

describe('stripColors', () => {
  it('should strip ANSI color codes', () => {
    const colored = '\x1B[31mred text\x1B[0m'
    expect(stripColors(colored)).toBe('red text')
  })

  it('should strip multiple color codes', () => {
    const colored = '\x1B[31mred\x1B[0m and \x1B[32mgreen\x1B[0m'
    expect(stripColors(colored)).toBe('red and green')
  })

  it('should handle text without colors', () => {
    const plain = 'plain text'
    expect(stripColors(plain)).toBe('plain text')
  })

  it('should strip formatting codes', () => {
    const formatted = '\x1B[1mbold\x1B[0m and \x1B[3mitalic\x1B[0m'
    expect(stripColors(formatted)).toBe('bold and italic')
  })
})

describe('supportsColor', () => {
  it('should return a boolean', () => {
    expect(typeof supportsColor()).toBe('boolean')
  })
})
