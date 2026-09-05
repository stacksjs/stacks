import { describe, expect, it } from 'bun:test'
import { normalizeQuery, parseQuery } from '../src/query-parser'

describe('query normalization', () => {
  it.each([
    ["SELECT '123'456, \"789\"10, a'12'34, _\"56\"78", 'SELECT ??, ??, a??, _??'],
    ["SELECT '12'x34, \"56\"_78, a12'34', _56\"78\"", 'SELECT ?x34, ?_78, a12?, _56?'],
    ["SELECT '12''34, \"56\"\"78", "SELECT ?'?, ?\"?"],
    ["SELECT '12\"34', \"56'78\", -90, 1.23", 'SELECT ?, ?, -?, ?.?'],
    [`INSERT INTO items (payload) VALUES ('${'1 22 333 4444 '.repeat(128)}')`, 'INSERT INTO items (payload) VALUES (?)'],
    ["SELECT 'it''s', \"a\"\"b\", '', \"\"", 'SELECT ?, ?, ?, ?'],
    ["SELECT 'unterminated", "SELECT 'unterminated"],
    ['SELECT "unterminated', 'SELECT "unterminated'],
    ["SELECT 'a''b", "SELECT ?'b"],
    ['SELECT "a""b', 'SELECT ?"b'],
    ["SELECT 'a\"b', \"c'd\"", 'SELECT ?, ?'],
    ["SELECT '漢\né', \"ü\n字\"", 'SELECT ?, ?'],
    [`SELECT '${'abcdefghijklmnop'.repeat(128)}', "${'q'.repeat(256)}"`, 'SELECT ?, ?'],
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
