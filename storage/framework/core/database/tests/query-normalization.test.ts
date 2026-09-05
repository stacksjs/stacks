import { describe, expect, it } from 'bun:test'
import { normalizeQuery, parseQuery } from '../src/query-parser'

describe('query normalization', () => {
  it.each([
    [' SELECT id FROM items ', 'SELECT id FROM items'],
    ['  SELECT   id,  name FROM  items  ', 'SELECT id, name FROM items'],
    [' \tSELECT\r\n id,\vname\fFROM items\t WHERE id = 1 ', 'SELECT id, name FROM items WHERE id = ?'],
    ['SELECT \t id \u00A0 FROM\u2003items', 'SELECT id FROM items'],
    ['\uFEFFSELECT\u00A0id\u2028FROM\u2029items\u3000', 'SELECT id FROM items'],
    [' \u0085SELECT\u180Eid\u200BFROM\u2060items ', '\u0085SELECT\u180Eid\u200BFROM\u2060items'],
    [' \t\r\n\v\f\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF', ''],
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
    ['SELECT 1true, true1, 2FALSE, FALSE2, 3null, null3, _4, true_5', 'SELECT 1true, true1, 2FALSE, FALSE2, 3null, null3, _4, true_5'],
    ['SELECT 1.true, FALSE-22, null/333, 4::boolean, $5, ?6', 'SELECT ?.?, ?-?, ?/?, ?::boolean, $?, ??'],
    ['SELECT é1true, 2TRUEé, é3, NULLé, 漢false, １２true', 'SELECT é1true, 2TRUEé, é?, ?é, 漢?, １２?'],
    ["SELECT 12'true'34, TRUE'56'null, 78\"false\"90", 'SELECT ???, ???, ???'],
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
