/**
 * Text detection utilities (detect-indent and detect-newline replacements)
 */

/**
 * Detect indentation type and amount in a string
 */
export interface IndentInfo {
  /** Indentation amount (number of spaces or tabs) */
  amount: number
  /** Indentation type: 'space', 'tab', or null */
  type: 'space' | 'tab' | null
  /** The actual indentation string */
  indent: string
}

export function detectIndent(text: string): IndentInfo {
  const lines = text.split('\n')
  const indents: string[] = []

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Match leading whitespace
    const match = line.match(/^(\s+)/)
    if (match) {
      indents.push(match[1])
    }
  }

  if (indents.length === 0) {
    return { amount: 0, type: null, indent: '' }
  }

  // Count occurrences of each indent pattern
  const indentCounts = new Map<string, number>()
  for (const indent of indents) {
    indentCounts.set(indent, (indentCounts.get(indent) || 0) + 1)
  }

  // Find most common indent
  let mostCommon = ''
  let maxCount = 0
  for (const [indent, count] of indentCounts) {
    if (count > maxCount) {
      maxCount = count
      mostCommon = indent
    }
  }

  // Determine indent type and amount
  if (mostCommon.includes('\t')) {
    return {
      amount: mostCommon.length,
      type: 'tab',
      indent: mostCommon,
    }
  }

  // Count spaces
  const spaceCount = mostCommon.length
  return {
    amount: spaceCount,
    type: 'space',
    indent: mostCommon,
  }
}

/**
 * Detect newline type in a string
 *
 * @returns '\r\n' (CRLF - Windows), '\n' (LF - Unix), '\r' (CR - old Mac), or null
 */
export function detectNewline(text: string): '\r\n' | '\n' | '\r' | null {
  if (!text) return null

  // Check for CRLF first (Windows)
  if (text.includes('\r\n')) {
    return '\r\n'
  }

  // Check for LF (Unix/Linux/Mac)
  if (text.includes('\n')) {
    return '\n'
  }

  // Check for CR (old Mac)
  if (text.includes('\r')) {
    return '\r'
  }

  return null
}

/**
 * Detect newline type with graceful fallback
 */
export function detectNewlineGraceful(text: string, fallback: '\r\n' | '\n' = '\n'): '\r\n' | '\n' | '\r' {
  return detectNewline(text) || fallback
}

/**
 * Normalize newlines in text to specified type
 */
export function normalizeNewlines(text: string, newline: '\r\n' | '\n' | '\r' = '\n'): string {
  return text.replace(/\r\n|\r|\n/g, newline)
}

/**
 * Count different types of newlines in text
 */
export function countNewlines(text: string): {
  crlf: number
  lf: number
  cr: number
  total: number
} {
  const crlf = (text.match(/\r\n/g) || []).length
  const cr = (text.match(/\r(?!\n)/g) || []).length
  const lf = (text.match(/(?<!\r)\n/g) || []).length

  return {
    crlf,
    lf,
    cr,
    total: crlf + lf + cr,
  }
}
