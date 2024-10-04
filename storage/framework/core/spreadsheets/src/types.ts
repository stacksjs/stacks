import type { SpreadsheetWrapper } from './'

/**
 * Content is the data structure that represents the spreadsheet content.
 *
 * @example
 * const content: Content = {
 *   headings: ['Name', 'Age', 'City'],
 *   data: [
 *     ['John Doe', 30, 'New York'],
 *     ['Jane Smith', 25, 'London'],
 *     ['Bob Johnson', 35, 'Paris']
 *   ]
 * }
 */
export interface Content {
  headings: string[]
  data: (string | number)[][]
}

export type SpreadsheetType = 'csv' | 'excel'

export interface SpreadsheetContent {
  content: string | Uint8Array
  type: SpreadsheetType
}

export type SpreadsheetOptions = Partial<{
  type: SpreadsheetType
}>

export type FileExtension = '.csv' | '.xlsx'

export type Spreadsheet = {
  (
    data: Content,
  ): {
    csv: () => SpreadsheetWrapper
    excel: () => SpreadsheetWrapper
    store: (path: string) => Promise<void>
    generateCSV: () => SpreadsheetWrapper
    generateExcel: () => SpreadsheetWrapper
  }
  create: (data: Content, options: SpreadsheetOptions) => SpreadsheetContent
  generate: (data: Content, options: SpreadsheetOptions) => string | Uint8Array
  generateCSV: (content: Content) => SpreadsheetWrapper
  generateExcel: (content: Content) => SpreadsheetWrapper
  store: (spreadsheet: SpreadsheetContent, path: string) => Promise<void>
  download: (spreadsheet: SpreadsheetContent, filename: string) => Response
}
