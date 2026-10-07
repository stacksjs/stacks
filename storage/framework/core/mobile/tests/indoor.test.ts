import { describe, expect, it } from 'bun:test'
import { indoorVerdict, typedDistanceKm } from '../src/indoor'

const START = { latitude: 52.52, longitude: 13.405 }
// About 1.11 m per 0.00001 degrees of latitude.
const fix = (northM: number, eastM: number, accuracy: number, second: number) => ({
  latitude: START.latitude + northM / 111_320,
  longitude: START.longitude + eastM / (111_320 * Math.cos(START.latitude * Math.PI / 180)),
  accuracy,
  timestamp: second * 1000,
})

describe('indoorVerdict', () => {
  it('waits before it decides', () => {
    expect(indoorVerdict([], 60)).toBe('unsure')
  })

  it('calls a treadmill run a treadmill run: positions wandering round the room', () => {
    // Fifty minutes of fixes scattered within 40 m, as on the treadmill.
    const fixes = Array.from({ length: 300 }, (_, i) => fix(Math.sin(i) * 35, Math.cos(i * 1.7) * 35, 20, i * 10))
    expect(indoorVerdict(fixes, 3000)).toBe('indoors')
  })

  it('calls no positions at all indoors', () => {
    expect(indoorVerdict([], 200)).toBe('indoors')
  })

  it('calls a signal that never got good indoors', () => {
    const fixes = Array.from({ length: 30 }, (_, i) => fix(i * 10, 0, 65, i * 5))
    expect(indoorVerdict(fixes, 200)).toBe('indoors')
  })

  it('is not thrown by indoor GPS jumping across the street now and then', () => {
    const fixes = Array.from({ length: 300 }, (_, i) => i % 40 === 0
      ? fix(180, 120, 18, i * 10)
      : fix(Math.sin(i) * 30, Math.cos(i * 1.7) * 30, 18, i * 10))
    expect(indoorVerdict(fixes.slice(0, 30), 100)).toBe('unsure')
    expect(indoorVerdict(fixes, 3000)).toBe('indoors')
  })

  it('leaves intervals on a 400 m track alone', () => {
    // Laps of an oval roughly 170 m by 75 m, with a sharp signal.
    const fixes = Array.from({ length: 120 }, (_, i) => fix(Math.sin(i / 10) * 37, Math.cos(i / 10) * 80, 4, i * 2))
    expect(indoorVerdict(fixes, 600)).not.toBe('indoors')
  })

  it('knows an outside run as soon as it has gone somewhere', () => {
    const fixes = Array.from({ length: 40 }, (_, i) => fix(i * 10, 0, 6, i * 3))
    expect(indoorVerdict(fixes, 120)).toBe('outside')
  })

  it('does not call a slow start outside indoors', () => {
    // Warming up at walking pace: 150 m in two and a half minutes.
    const fixes = Array.from({ length: 30 }, (_, i) => fix(i * 5, 0, 8, i * 5))
    expect(indoorVerdict(fixes, 150)).toBe('unsure')
  })
})

describe('typedDistanceKm', () => {
  it('reads a treadmill display the way people type it', () => {
    expect(typedDistanceKm('8.4')).toBe(8.4)
    expect(typedDistanceKm('8,4')).toBe(8.4)
    expect(typedDistanceKm('8400 m')).toBe(8.4)
    expect(typedDistanceKm('8400')).toBe(8.4)
    expect(typedDistanceKm('5 mi')).toBe(8.047)
    expect(typedDistanceKm('')).toBeNull()
    expect(typedDistanceKm('far')).toBeNull()
  })
})
