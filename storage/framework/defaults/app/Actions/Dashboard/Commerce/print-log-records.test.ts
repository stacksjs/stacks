import { describe, expect, test } from 'bun:test'
import Receipt from '../../../Models/commerce/Receipt'
import {
  normalizePrintLogRecord,
  printLogsToCsv,
  printLogTimestamp,
  summarizePrintLogs,
} from './print-log-records'

function receipt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 4,
    printer: null,
    document: 'Receipt #44',
    timestamp: '2026-07-29 18:30:00',
    status: 'success',
    size: 0,
    pages: 0,
    duration: 0,
    metadata: '{}',
    print_device_id: null,
    created_at: '2026-07-29 18:30:00',
    ...overrides,
  }
}

describe('dashboard print log records', () => {
  test('accepts API timestamps and normalizes them for persistence', async () => {
    const timestamp = Receipt.attributes.timestamp.validation.rule

    expect(timestamp.validate('2026-07-29T18:30:00.000Z').valid).toBe(true)
    expect(timestamp.validate('2026-07-29 18:30:00').valid).toBe(false)
    expect(await Receipt.set.timestamp({ timestamp: '2026-07-29T18:30:00.000Z' } as any)).toBe('2026-07-29 18:30:00')
    expect(await Receipt.set.timestamp({ timestamp: 1785349800 } as any)).toBe('2026-07-29 18:30:00')
  })

  test('normalizes native receipt columns, relationships, and UTC timestamps', () => {
    const record = normalizePrintLogRecord(receipt({
      printer: 'Front Counter',
      size: 12,
      pages: 2,
      duration: 1.5,
      print_device_id: 8,
    }), new Set(['8']))

    expect(record).toMatchObject({
      id: '4',
      printer: 'Front Counter',
      timestamp: '2026-07-29T18:30:00.000Z',
      status: 'success',
      sizeKb: 12,
      pages: 2,
      durationSeconds: 1.5,
      printDeviceId: '8',
      createdAt: '2026-07-29T18:30:00.000Z',
    })
    expect(printLogTimestamp(record.timestamp)).toBe(Date.parse('2026-07-29T18:30:00Z'))
    expect(printLogTimestamp(1785349800)).toBe(Date.parse('2026-07-29T18:30:00Z'))
    expect(printLogTimestamp('1785349800')).toBe(Date.parse('2026-07-29T18:30:00Z'))
  })

  test('rejects corrupt outcomes and missing PrintDevice relationships', () => {
    expect(() => normalizePrintLogRecord(receipt({
      status: 'SUCCESS',
    }))).toThrow('Receipt 4.status must be success or failed or warning')
    expect(() => normalizePrintLogRecord(receipt({
      pages: 1.5,
    }))).toThrow('Receipt 4.pages must be an integer')
    expect(() => normalizePrintLogRecord(
      receipt({ print_device_id: 9 }),
      new Set(),
    )).toThrow('Receipt 4.print_device_id references missing PrintDevice 9')
    expect(() => printLogTimestamp('not-a-date')).toThrow('valid timestamp')
  })

  test('summarizes only persisted print outcomes', () => {
    const records = [
      normalizePrintLogRecord(receipt({ id: 1, status: 'success', pages: 1, duration: 2 })),
      normalizePrintLogRecord(receipt({ id: 2, status: 'success', pages: 3, duration: 4 })),
      normalizePrintLogRecord(receipt({ id: 3, status: 'warning', pages: 2, duration: 7 })),
      normalizePrintLogRecord(receipt({ id: 4, status: 'failed', pages: 0, duration: 0 })),
    ]

    expect(summarizePrintLogs(records)).toEqual({
      total: 4,
      successful: 2,
      failed: 1,
      warnings: 1,
      successRate: 50,
      totalPages: 6,
      averagePages: 1.5,
      averageSuccessfulDuration: 3,
    })
  })

  test('exports the current print log view as CSV', () => {
    const csv = printLogsToCsv([
      normalizePrintLogRecord(receipt({
        id: 1,
        printer: 'Front, Counter',
        document: 'Receipt #1',
        status: 'success',
      })),
    ])

    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('"Front, Counter"')
    expect(csv).toContain('Receipt #1')
  })
})
