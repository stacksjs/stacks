import { describe, expect, it } from 'bun:test'
import { format } from '../src/format'
import { parse } from '../src/parse'

describe('format/parse roundtrip', () => {
  const fmt = 'YYYY-MM-DD HH:mm:ss'

  function roundtrip(date: Date) {
    const formatted = format(date, fmt)
    const parsed = parse(formatted, fmt)
    expect(parsed.getFullYear()).toBe(date.getFullYear())
    expect(parsed.getMonth()).toBe(date.getMonth())
    expect(parsed.getDate()).toBe(date.getDate())
    expect(parsed.getHours()).toBe(date.getHours())
    expect(parsed.getMinutes()).toBe(date.getMinutes())
    expect(parsed.getSeconds()).toBe(date.getSeconds())
  }

  it('roundtrips Jan 1 midnight', () => {
    roundtrip(new Date(2024, 0, 1, 0, 0, 0))
  })

  it('roundtrips leap day noon', () => {
    roundtrip(new Date(2024, 1, 29, 12, 0, 0))
  })

  it('roundtrips Dec 31 end of day', () => {
    roundtrip(new Date(2024, 11, 31, 23, 59, 59))
  })

  it('roundtrips mid-year date', () => {
    roundtrip(new Date(2023, 5, 15, 8, 30, 45))
  })

  it('roundtrips Y2K', () => {
    roundtrip(new Date(2000, 0, 1, 0, 0, 0))
  })

  it('roundtrips Feb 28 non-leap year', () => {
    roundtrip(new Date(2023, 1, 28, 6, 15, 30))
  })

  it('roundtrips with date-only format', () => {
    const dateFmt = 'YYYY-MM-DD'
    const dates = [
      new Date(2024, 0, 1),
      new Date(2024, 1, 29),
      new Date(2024, 11, 31),
    ]
    for (const date of dates) {
      const formatted = format(date, dateFmt)
      const parsed = parse(formatted, dateFmt)
      expect(parsed.getFullYear()).toBe(date.getFullYear())
      expect(parsed.getMonth()).toBe(date.getMonth())
      expect(parsed.getDate()).toBe(date.getDate())
    }
  })

  it('roundtrips with 12-hour format', () => {
    const fmt12 = 'YYYY-MM-DD hh:mm:ss A'
    const dates = [
      new Date(2024, 0, 1, 0, 0, 0),   // midnight
      new Date(2024, 0, 1, 1, 30, 0),   // 1:30 AM
      new Date(2024, 0, 1, 12, 0, 0),   // noon
      new Date(2024, 0, 1, 13, 45, 30), // 1:45 PM
      new Date(2024, 0, 1, 23, 59, 59), // 11:59 PM
    ]
    for (const date of dates) {
      const formatted = format(date, fmt12)
      const parsed = parse(formatted, fmt12)
      expect(parsed.getHours()).toBe(date.getHours())
      expect(parsed.getMinutes()).toBe(date.getMinutes())
      expect(parsed.getSeconds()).toBe(date.getSeconds())
    }
  })

  it('roundtrips compact format', () => {
    const compactFmt = 'YYYYMMDD'
    const date = new Date(2024, 2, 15)
    const formatted = format(date, compactFmt)
    expect(formatted).toBe('20240315')
    const parsed = parse(formatted, compactFmt)
    expect(parsed.getFullYear()).toBe(2024)
    expect(parsed.getMonth()).toBe(2)
    expect(parsed.getDate()).toBe(15)
  })

  it('roundtrips every month of the year', () => {
    for (let m = 0; m < 12; m++) {
      const date = new Date(2024, m, 15, 10, 30, 0)
      const formatted = format(date, fmt)
      const parsed = parse(formatted, fmt)
      expect(parsed.getMonth()).toBe(m)
    }
  })
})
