/**
 * The framework's Job and FailedJob models declared `payload` (and
 * `exception`) with no column type, so the generated schema made them
 * varchar(255). A serialized job envelope is longer than that, and on
 * Postgres every dispatch failed with "value too long for type character
 * varying(255)"; SQLite does not enforce the length, so nothing local ever
 * showed it.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { frameworkPath } from '@stacksjs/path'

function attributeBlock(model: string, attribute: string): string {
  const source = readFileSync(frameworkPath(`defaults/app/Models/${model}.ts`), 'utf8')
  const start = source.indexOf(`    ${attribute}: {`)
  expect(start).toBeGreaterThan(-1)
  const end = source.indexOf('\n    },', start)
  return source.slice(start, end)
}

describe('job storage columns', () => {
  for (const [model, attribute] of [['Job', 'payload'], ['FailedJob', 'payload'], ['FailedJob', 'exception']] as const) {
    it(`${model}.${attribute} is a text column, not varchar(255)`, () => {
      expect(attributeBlock(model, attribute)).toContain(`type: 'text'`)
    })
  }
})
