import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import type { Content } from '../src/index'
import { createSpreadsheet, spreadsheet } from '../src/index'

describe('Bun Spreadsheets', () => {
  let testData: Content

  beforeEach(() => {
    testData = {
      headings: ['Name', 'Age', 'City'],
      data: [
        ['John Doe', 30, 'New York'],
        ['Jane Smith', 25, 'London'],
        ['Bob Johnson', 35, 'Paris'],
      ],
    }
  })

  afterEach(() => {
    // Clean up any files created during tests
    const filesToDelete = ['output.csv', 'output.xlsx']
    filesToDelete.forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file)
      }
    })
  })

  describe('Content Creation', () => {
    it('should create valid Content object', () => {
      expect(testData.headings.length).toBe(3)
      expect(testData.data.length).toBe(3)
    })

    it('should handle empty data', () => {
      const emptyData: Content = { headings: [], data: [] }
      expect(() => createSpreadsheet(emptyData)).not.toThrow()
    })
  })

  describe('CSV Generation', () => {
    it('should generate valid CSV content', async () => {
      const csvContent = spreadsheet(testData).csv().getContent() as string
      const lines = csvContent.split('\n')
      expect(lines[0]).toBe('Name,Age,City')
      expect(lines[1]).toBe('John Doe,30,New York')
    })

    it('should handle special characters in CSV', () => {
      const specialData: Content = {
        headings: ['Name', 'Description'],
        data: [['John, Doe', 'Likes "quotes"']],
      }
      const csvContent = spreadsheet(specialData).csv().getContent() as string
      expect(csvContent).toBe('Name,Description\n"John, Doe","Likes ""quotes"""')
    })

    // New test for handling numbers
    it('should correctly store numbers in CSV', () => {
      const numericData: Content = {
        headings: ['Name', 'Age', 'Score'],
        data: [
          ['Alice', 28, 95.5],
          ['Bob', 32, 88],
          ['Charlie', 45, 72.75],
        ],
      }
      const csvContent = spreadsheet(numericData).csv().getContent() as string
      const lines = csvContent.split('\n')
      expect(lines[0]).toBe('Name,Age,Score')
      expect(lines[1]).toBe('Alice,28,95.5')
      expect(lines[2]).toBe('Bob,32,88')
      expect(lines[3]).toBe('Charlie,45,72.75')
    })
  })

  describe('Excel Generation', () => {
    it('should generate valid Excel content', () => {
      const excelContent = spreadsheet(testData).excel().getContent() as Uint8Array
      expect(excelContent).toBeInstanceOf(Uint8Array)
    })

    // TODO: more excel tests
  })

  describe('File Storage', () => {
    it('should store CSV file', async () => {
      await spreadsheet(testData).store('output.csv')
      expect(existsSync('output.csv')).toBe(true)
    })

    it('should store Excel file', async () => {
      await spreadsheet(testData).store('output.xlsx')
      expect(existsSync('output.xlsx')).toBe(true)
    })
  })

  describe('Download Response', () => {
    it('should create valid download response for CSV', () => {
      const response = spreadsheet(testData).csv().download('test.csv')
      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
    })

    it('should create valid download response for Excel', () => {
      const response = spreadsheet(testData).excel().download('test.xlsx')
      expect(response).toBeInstanceOf(Response)
      expect(response.headers.get('Content-Type')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
    })
  })

  describe('Method Chaining', () => {
    it('should support method chaining', async () => {
      try {
        await spreadsheet(testData).csv().store('output.csv')
        // If we reach here, no error was thrown
        expect(true).toBe(true)
      } catch (error) {
        console.error('Error in method chaining:', error)
        // Fail the test if an error is caught
        expect(error).toBeUndefined()
      }
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unsupported spreadsheet type', () => {
      // @ts-expect-error: Testing invalid type
      expect(() => createSpreadsheet(testData, { type: 'pdf' })).toThrow()
    })
  })
})
