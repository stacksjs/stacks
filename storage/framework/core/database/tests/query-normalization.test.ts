import { describe, expect, it } from 'bun:test'
import { normalizeQuery, parseQuery } from '../src/query-parser'

describe('query normalization', () => {
  it.each([
    ['SELECT true, FALSE, nUlL, TrUe, False, NULL', 'SELECT ?, ?, ?, ?, ?, ?'],
    ['SELECT truefalse, null_true, false9, 9null, is_true, nullish', 'SELECT truefalse, null_true, false9, 9null, is_true, nullish'],
    ['SELECT TRUE.false/null, (false), NULL::boolean', 'SELECT ?.?/?, (?), ?::boolean'],
    ['SELECT étrue, NULLé, 漢false', 'SELECT é?, ?é, 漢?'],
    ["SELECT 'true false NULL', 'it''s true', \"null\"", 'SELECT ?, ?, ?'],
    ['SELECT true /* false */; -- NULL', 'SELECT ? /* ? */; -- ?'],
    ['SELECT\tTRUE,\n false,\r\nNULL', 'SELECT ?, ?, ?'],
    ['SELECT 123', 'SELECT ?'],
    ['SELECT * FROM items WHERE id IN (1, 22, 333)', 'SELECT * FROM items WHERE id IN (?, ?, ?)'],
    ['SELECT value1, value_2, _3, 4value, v5x FROM table6', 'SELECT value1, value_2, _3, 4value, v5x FROM table6'],
    ['SELECT A1, Z2, a3, z4, 5A, 6Z, 7a, 8z, _9, 10_', 'SELECT A1, Z2, a3, z4, 5A, 6Z, 7a, 8z, _9, 10_'],
    ['SELECT -12, +34, 5.67, 8e9, 0xFF', 'SELECT -?, +?, ?.?, 8e9, 0xFF'],
    ['SELECT * FROM items WHERE id = $1 LIMIT 1', 'SELECT * FROM items WHERE id = $? LIMIT ?'],
    ['SELECT 1/*2*/+3; -- 4', 'SELECT ?/*?*/+?; -- ?'],
    ['SELECT é12, 34é', 'SELECT é?, ?é'],
    [" SELECT  12, 'value34', \"field56\", TRUE, false, NULL ", 'SELECT ?, ?, ?, ?, ?, ?'],
  ])('preserves the normalization of %s', (query, expected) => {
    expect(normalizeQuery(query)).toBe(expected)
    expect(parseQuery(query).normalized).toBe(expected)
  })
})
