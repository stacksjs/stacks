import { describe, expect, test } from 'bun:test'
import { FEATURE_FILES, FEATURE_TABLES } from '../../storage/framework/core/features/src/index'
import { subscriberTables } from '../../storage/framework/defaults/app/Actions/SubscriberEmailAction'

describe('the public signup works with every optional feature off', () => {
  test('no feature claims a table the signup writes', () => {
    for (const [feature, tables] of Object.entries(FEATURE_TABLES)) {
      for (const table of subscriberTables)
        expect(tables, `${feature} gates ${table}`).not.toContain(table)
    }
  })

  test('no feature uninstalls a model the signup needs', () => {
    for (const [feature, files] of Object.entries(FEATURE_FILES)) {
      for (const model of ['EmailList.ts', 'EmailListSubscriber.ts', 'Subscriber.ts', 'SubscriberEmail.ts'])
        expect(files, `${feature} claims ${model}`).not.toContain(`app/Models/${model}`)
    }
  })
})
