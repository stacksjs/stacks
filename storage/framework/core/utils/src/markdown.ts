/**
 * Markdown table generation (markdown-table replacement)
 */

export interface MarkdownTableOptions {
  /**
   * Alignment for each column
   * - 'l' or 'left': Left-aligned
   * - 'c' or 'center': Center-aligned
   * - 'r' or 'right': Right-aligned
   * - null: No alignment
   */
  align?: Array<'l' | 'c' | 'r' | 'left' | 'center' | 'right' | null>

  /**
   * Padding around cell content
   * @default true
   */
  padding?: boolean

  /**
   * Delimiters
   */
  delimiter?: string

  /**
   * Start each row with delimiter
   * @default true
   */
  delimiterStart?: boolean

  /**
   * End each row with delimiter
   * @default true
   */
  delimiterEnd?: boolean

  /**
   * Character for alignment row
   * @default '-'
   */
  alignDelimiter?: string
}

type CellValue = string | number | boolean | null | undefined
type Row = CellValue[]
type Table = Row[]

/**
 * Generate a markdown table from a 2D array
 *
 * @example
 * ```ts
 * const table = markdownTable([
 *   ['Name', 'Age', 'City'],
 *   ['Alice', 30, 'NYC'],
 *   ['Bob', 25, 'LA']
 * ])
 * // | Name  | Age | City |
 * // | ----- | --- | ---- |
 * // | Alice | 30  | NYC  |
 * // | Bob   | 25  | LA   |
 * ```
 */
export function markdownTable(table: Table, options: MarkdownTableOptions = {}): string {
  const {
    align = [],
    padding = true,
    delimiter = '|',
    delimiterStart = true,
    delimiterEnd = true,
    alignDelimiter = '-',
  } = options

  if (!table || table.length === 0) {
    return ''
  }

  // Normalize table data
  const normalized = table.map(row =>
    row.map(cell => {
      if (cell === null || cell === undefined) return ''
      return String(cell)
    }),
  )

  // Calculate column widths
  const columnCount = Math.max(...normalized.map(row => row.length))
  const columnWidths: number[] = Array.from({ length: columnCount }).fill(0) as number[]

  for (const row of normalized) {
    for (let i = 0; i < row.length; i++) {
      const cellLength = row[i].length
      if (cellLength > columnWidths[i]) {
        columnWidths[i] = cellLength
      }
    }
  }

  // Build rows
  const rows: string[] = []

  // Header row
  if (normalized.length > 0) {
    rows.push(buildRow(normalized[0], columnWidths, padding, delimiter, delimiterStart, delimiterEnd))

    // Separator row
    const separatorCells = columnWidths.map((width, index) => {
      const alignment = normalizeAlignment(align[index])
      return buildSeparator(width, alignment, alignDelimiter)
    })
    rows.push(buildRow(separatorCells, columnWidths, padding, delimiter, delimiterStart, delimiterEnd))

    // Data rows
    for (let i = 1; i < normalized.length; i++) {
      rows.push(buildRow(normalized[i], columnWidths, padding, delimiter, delimiterStart, delimiterEnd))
    }
  }

  return rows.join('\n')
}

function buildRow(
  cells: string[],
  columnWidths: number[],
  padding: boolean,
  delimiter: string,
  delimiterStart: boolean,
  delimiterEnd: boolean,
): string {
  const paddedCells = cells.map((cell, index) => {
    const width = columnWidths[index]
    return cell.padEnd(width, ' ')
  })

  const space = padding ? ' ' : ''
  let row = paddedCells.map(cell => `${space}${cell}${space}`).join(delimiter)

  if (delimiterStart) row = delimiter + row
  if (delimiterEnd) row = row + delimiter

  return row
}

function buildSeparator(
  width: number,
  alignment: 'left' | 'center' | 'right' | null,
  char: string,
): string {
  const minWidth = alignment === 'center' ? 3 : alignment ? 2 : 1

  if (width < minWidth) {
    width = minWidth
  }

  let separator = char.repeat(width)

  if (alignment === 'left') {
    separator = ':' + separator.slice(1)
  }
  else if (alignment === 'right') {
    separator = separator.slice(0, -1) + ':'
  }
  else if (alignment === 'center') {
    separator = ':' + separator.slice(2) + ':'
  }

  return separator
}

function normalizeAlignment(
  align: 'l' | 'c' | 'r' | 'left' | 'center' | 'right' | null | undefined,
): 'left' | 'center' | 'right' | null {
  if (!align) return null

  switch (align) {
    case 'l':
    case 'left':
      return 'left'
    case 'c':
    case 'center':
      return 'center'
    case 'r':
    case 'right':
      return 'right'
    default:
      return null
  }
}

/**
 * Create a markdown table from objects
 *
 * @example
 * ```ts
 * const data = [
 *   { name: 'Alice', age: 30 },
 *   { name: 'Bob', age: 25 }
 * ]
 * const table = markdownTableFromObjects(data)
 * ```
 */
export function markdownTableFromObjects<T extends Record<string, any>>(
  objects: T[],
  options: MarkdownTableOptions = {},
): string {
  if (!objects || objects.length === 0) {
    return ''
  }

  // Get all unique keys
  const keys = Array.from(new Set(objects.flatMap(obj => Object.keys(obj))))

  // Build table data
  const table: Table = [
    keys, // Header row
    ...objects.map(obj => keys.map(key => obj[key])), // Data rows
  ]

  return markdownTable(table, options)
}

// Alias
export { markdownTable as default }
