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

type FileExtension = '.csv' | '.xlsx'

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

export const spreadsheet: Spreadsheet = Object.assign(
  (data: Content) => ({
    csv: () => spreadsheet.generateCSV(data),
    excel: () => spreadsheet.generateExcel(data),
    store: async (path: string) => {
      const extension = path.slice(path.lastIndexOf('.')) as FileExtension
      const type = extension === '.csv' ? 'csv' : 'excel'
      const content = spreadsheet.generate(data, { type })
      await spreadsheet.store({ content, type }, path)
    },
    generateCSV: () => spreadsheet.generateCSV(data),
    generateExcel: () => spreadsheet.generateExcel(data),
  }),
  {
    generate: (data: Content, options: SpreadsheetOptions = { type: 'csv' }): string | Uint8Array => {
      const generators: Record<SpreadsheetType, (content: Content) => string | Uint8Array | SpreadsheetWrapper> = {
        csv: spreadsheet.generateCSV,
        excel: spreadsheet.generateExcel,
      }

      const generator = generators[options.type || 'csv']

      if (!generator) {
        throw new Error(`Unsupported spreadsheet type: ${options.type}`)
      }

      const result = generator(data)
      if (result instanceof SpreadsheetWrapper) {
        return result.getContent()
      }

      return result
    },

    create: (data: Content, options: SpreadsheetOptions = { type: 'csv' }): SpreadsheetContent => ({
      content: spreadsheet.generate(data, options),
      type: options.type || 'csv',
    }),

    generateCSV: (content: Content): SpreadsheetWrapper => {
      const csvContent = generateCSVContent(content)
      return new SpreadsheetWrapper(csvContent, 'csv')
    },

    generateExcel: (content: Content): SpreadsheetWrapper => {
      const excelContent = generateExcelContent(content)
      return new SpreadsheetWrapper(excelContent, 'excel')
    },

    store: async ({ content }: SpreadsheetContent, path: string): Promise<void> => {
      try {
        await Bun.write(path, content)
      } catch (error) {
        throw new Error(`Failed to store spreadsheet: ${(error as Error).message}`)
      }
    },

    download: ({ content, type }: SpreadsheetContent, filename: string): Response => {
      const mimeType = type === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const blob = new Blob([content], { type: mimeType })

      return new Response(blob, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    },
  },
)

export class SpreadsheetWrapper {
  constructor(
    private content: string | Uint8Array,
    private type: SpreadsheetType,
  ) {}

  getContent(): string | Uint8Array {
    return this.content
  }

  download(filename: string): Response {
    return spreadsheet.download({ content: this.content, type: this.type }, filename)
  }

  store(path: string): Promise<void> {
    return spreadsheet.store({ content: this.content, type: this.type }, path)
  }
}

export function createSpreadsheet(data: Content, options: SpreadsheetOptions = { type: 'csv' }): SpreadsheetWrapper {
  const content = spreadsheet.generate(data, options)

  return new SpreadsheetWrapper(content, options.type || 'csv')
}

export function generateCSVContent(content: Content): string {
  const rows = [content.headings, ...content.data]

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const cellString = String(cell)
          if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
            return `"${cellString.replace(/"/g, '""')}"`
          }
          return cellString
        })
        .join(','),
    )
    .join('\n')
}

export function generateExcelContent(content: Content): Uint8Array {
  const workbook = Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
      <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
    </sheets>
  </workbook>`)

  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheetData>
      ${[content.headings, ...content.data]
        .map(
          (row, rowIndex) => `
      <row r="${rowIndex + 1}">
        ${row
          .map(
            (cell, cellIndex) => `
        <c r="${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}" ${typeof cell === 'number' ? 't="n"' : ''}>
          <v>${typeof cell === 'string' ? cell.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : cell}</v>
        </c>`,
          )
          .join('')}
      </row>`,
        )
        .join('')}
    </sheetData>
  </worksheet>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  </Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  </Relationships>`

  const files: Array<{ name: string; content: string | Uint8Array }> = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet },
  ]

  const zipData = files.map((file) => {
    const compressedContent = Bun.gzipSync(Buffer.from(file.content))
    const header = Buffer.alloc(30 + file.name.length)
    header.write('PK\x03\x04', 0)
    header.writeUInt32LE(0x0008, 4)
    header.writeUInt32LE(compressedContent.length, 18)
    header.writeUInt32LE(Buffer.from(file.content).length, 22)
    header.writeUInt16LE(file.name.length, 26)
    header.write(file.name, 30)

    return Buffer.concat([header, compressedContent])
  })

  const centralDirectory = files.map((file, index) => {
    const header = Buffer.alloc(46 + file.name.length)
    header.write('PK\x01\x02', 0)
    header.writeUInt16LE(0x0014, 4)
    header.writeUInt16LE(0x0008, 6)
    header.writeUInt32LE(0x0008, 8)
    // biome-ignore lint/style/noNonNullAssertion: We know that zipData[index] is not null because we are iterating over files
    header.writeUInt32LE(zipData[index]!.length - 30 - file.name.length, 20)
    header.writeUInt32LE(
      zipData.slice(0, index).reduce((acc, curr) => acc + curr.length, 0),
      42,
    )
    header.writeUInt16LE(file.name.length, 28)
    header.write(file.name, 46)
    return header
  })

  const endOfCentralDirectory = Buffer.alloc(22)
  endOfCentralDirectory.write('PK\x05\x06', 0)
  endOfCentralDirectory.writeUInt16LE(files.length, 8)
  endOfCentralDirectory.writeUInt16LE(files.length, 10)
  endOfCentralDirectory.writeUInt32LE(
    centralDirectory.reduce((acc, curr) => acc + curr.length, 0),
    12,
  )
  endOfCentralDirectory.writeUInt32LE(
    zipData.reduce((acc, curr) => acc + curr.length, 0),
    16,
  )

  return Uint8Array.from(Buffer.concat([...zipData, ...centralDirectory, endOfCentralDirectory]))
}
